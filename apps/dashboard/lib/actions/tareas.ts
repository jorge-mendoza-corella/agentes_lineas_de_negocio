'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { ejecutarEspecialista, makeDb } from '@/lib/agent/especialista';
import Anthropic from '@anthropic-ai/sdk';

export async function reejecutarTarea(tareaId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Limpiar el bloqueante y volver a pendiente
  await sb.from('tareas').update({
    estado: 'pendiente',
    notas: null,
    iniciado_en: null,
    completado_en: null,
  }).eq('id', tareaId);

  // Disparar especialista en segundo plano (fire-and-forget)
  ejecutarEspecialista(tareaId, makeDb()).catch(console.error);

  revalidatePath('/superadmin/proyectos', 'layout');
}

export async function diagnosticarYReparar(tareaId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const db = makeDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = db as any;

  const [tareaRes, bitacoraRes] = await Promise.all([
    sb.from('tareas')
      .select('id, agente_asignado, descripcion, plan_ejecucion, notas, estado')
      .eq('id', tareaId)
      .single() as Promise<{ data: { id: string; agente_asignado: string; descripcion: string; plan_ejecucion: string | null; notas: string | null; estado: string } | null }>,
    sb.from('bitacora_actividad')
      .select('agente, accion, creado_en')
      .eq('tarea_id', tareaId)
      .order('creado_en', { ascending: false })
      .limit(12) as Promise<{ data: { agente: string; accion: string; creado_en: string }[] | null }>,
  ]);

  const tarea = tareaRes.data;
  const bitacora = bitacoraRes.data ?? [];
  if (!tarea) throw new Error('Tarea no encontrada');

  const contexto = [
    `Agente: ${tarea.agente_asignado}`,
    `Tarea: ${tarea.descripcion}`,
    `Plan original:\n${tarea.plan_ejecucion ?? 'Sin plan'}`,
    `Error/Notas: ${tarea.notas ?? 'Sin notas'}`,
    `Últimas acciones (más reciente primero):`,
    ...bitacora.map(b => `  [${new Date(b.creado_en).toLocaleTimeString('es-MX')}] ${b.accion.slice(0, 200)}`),
  ].join('\n');

  // Generar plan de reparación con Claude
  let planReparacion = '1. Reintentar la tarea desde el principio con cuidado en los errores previos.';
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const resp = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Eres el PM técnico revisando una tarea fallida. Analiza el contexto y genera un PLAN DE REPARACIÓN numerado y concreto para que el agente pueda completar la tarea exitosamente.\n\nContexto del fallo:\n${contexto}\n\nResponde SOLO con el plan numerado. Empieza por identificar qué salió mal en 1 línea, luego lista los pasos correctivos.`,
      }],
    });
    const firstBlock = resp.content[0];
    planReparacion = firstBlock && firstBlock.type === 'text' ? firstBlock.text : planReparacion;
  } catch (_e) {
    // Si falla Claude, usamos plan genérico
  }

  const planActualizado = `=== DIAGNÓSTICO Y REPARACIÓN ===\n${planReparacion}\n\n=== PLAN ORIGINAL ===\n${tarea.plan_ejecucion ?? 'Sin plan original'}`;

  await sb.from('tareas').update({
    estado: 'pendiente',
    notas: null,
    iniciado_en: null,
    completado_en: null,
    plan_ejecucion: planActualizado,
  }).eq('id', tareaId);

  await sb.from('bitacora_actividad').insert({
    agente: 'pm-global',
    accion: `🔧 Diagnóstico completado. Nuevo plan de reparación generado para ${tarea.agente_asignado}.`,
    tarea_id: tareaId,
  });

  // Fire-and-forget el especialista con el nuevo plan
  const { ejecutarEspecialista: ejecutar } = await import('@/lib/agent/especialista');
  ejecutar(tareaId, db).catch(console.error);

  revalidatePath('/superadmin/proyectos', 'layout');
  revalidatePath('/superadmin/sims');
}
