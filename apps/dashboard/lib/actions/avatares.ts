'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { ejecutarEspecialista, makeDb } from '@/lib/agent/especialista';

// ── Parser de pasos del plan (server-side) ───────────────────────────────────
function _parsePasos(plan: string): string[] {
  if (!plan) return [];
  const sinEncabezados = plan.replace(/^===.*===\s*$/gm, '');
  return sinEncabezados
    .split('\n')
    .map(l => l.trim())
    .filter(l =>
      /^\d+[\.\)\-]\s+\S/.test(l) ||
      /^\*\*\d+[\.\)]\*?\*?\s+\S/.test(l) ||
      /^[-*•]\s+\S/.test(l) ||
      /^Paso\s+\d+/i.test(l) ||
      /^Step\s+\d+/i.test(l)
    )
    .map(l => l
      .replace(/^\d+[\.\)\-]\s*/, '')
      .replace(/^\*\*\d+[\.\)]\*?\*?\s*/, '')
      .replace(/^[-*•]\s*/, '')
      .replace(/^Paso\s+\d+[\.\:\-]?\s*/i, '')
      .replace(/^Step\s+\d+[\.\:\-]?\s*/i, '')
      .replace(/\*\*/g, '')
      .trim()
    )
    .filter(l => l.length > 4);
}

// ── Helper interno: reanuda un agente sin chequeo PM ─────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function _reanudarAgente(agenteNombre: string, db: any): Promise<boolean> {
  // Priorizar tarea en_progreso (fue interrumpida) sobre pendiente
  const { data: tareasActivas } = await db
    .from('tareas')
    .select('id, descripcion, estado, plan_ejecucion')
    .eq('agente_asignado', agenteNombre)
    .in('estado', ['en_progreso', 'pendiente'])
    .order('creado_en', { ascending: true })
    .limit(5);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tarea = (tareasActivas as any[] | null)?.find(t => t.estado === 'en_progreso')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ?? (tareasActivas as any[] | null)?.find(t => t.estado === 'pendiente');

  if (!tarea) return false;

  let prevContexto: string | undefined;

  if (tarea.estado === 'en_progreso') {
    // Cargar historial en orden cronológico para identificar el último paso
    const { data: bitacora } = await db
      .from('bitacora_actividad')
      .select('agente, accion, creado_en')
      .eq('tarea_id', tarea.id)
      .order('creado_en', { ascending: true })
      .limit(40);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entradas: any[] = (bitacora as any[] | null) ?? [];
    const logCount   = entradas.length;
    const planSteps  = _parsePasos(tarea.plan_ejecucion ?? '');
    const totalSteps = planSteps.length;

    // Determinar el siguiente paso concreto
    const nextIdx    = Math.min(logCount, totalSteps > 0 ? totalSteps - 1 : 0);
    const nextStep   = totalSteps > 0 ? planSteps[nextIdx] : null;

    const historial = entradas
      .map(b => `  [${new Date(b.creado_en).toLocaleTimeString('es-MX')}] ${(b.accion as string).slice(0, 250)}`)
      .join('\n');

    const lineas = [
      '=== CONTEXTO DE REANUDACIÓN ===',
      `Fuiste interrumpido. Progreso estimado: ${logCount}${totalSteps > 0 ? `/${totalSteps}` : ''} pasos.`,
    ];
    if (nextStep) {
      lineas.push(`PRÓXIMO PASO A EJECUTAR — Paso ${nextIdx + 1}: "${nextStep}"`);
      lineas.push('Comienza DIRECTAMENTE desde ese paso. No repitas lo que ya está en el historial.');
    }
    lineas.push('', 'Historial de acciones realizadas (cronológico):');
    lineas.push(historial || '  (Sin historial)');
    lineas.push('=== FIN CONTEXTO ===');

    prevContexto = lineas.join('\n');

    // Resetear a pendiente para que ejecutarEspecialista lo marque en_progreso correctamente
    await db.from('tareas')
      .update({ estado: 'pendiente', iniciado_en: null })
      .eq('id', tarea.id);
  }

  await db.from('avatares')
    .update({ estado_animacion: 'caminando' })
    .eq('agente_nombre', agenteNombre);

  ejecutarEspecialista(tarea.id, db, prevContexto).catch(console.error);
  return true;
}

// ── Verificación de equipo al reanudar PM ─────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function verificarTareasEquipo(pmNombre: string, db: any): Promise<void> {
  const { data: tareasAbiertas } = await db
    .from('tareas')
    .select('id, agente_asignado, descripcion, estado')
    .in('estado', ['pendiente', 'en_progreso'])
    .order('creado_en', { ascending: true });

  if (!tareasAbiertas || (tareasAbiertas as any[]).length === 0) {
    await db.from('bitacora_actividad').insert({
      agente: pmNombre,
      accion: '✅ PM verificó el equipo al reanudar. Sin tareas pendientes — todo al día.',
    });
    return;
  }

  // Agrupar por agente
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const porAgente: Record<string, any[]> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const t of (tareasAbiertas as any[])) {
    if (!porAgente[t.agente_asignado]) porAgente[t.agente_asignado] = [];
    porAgente[t.agente_asignado]!.push(t);
  }

  const agentesConTareas = Object.keys(porAgente).filter(ag => ag !== pmNombre);
  if (agentesConTareas.length === 0) return;

  // Obtener estados actuales de avatares
  const { data: avatares } = await db
    .from('avatares')
    .select('agente_nombre, estado_animacion')
    .in('agente_nombre', agentesConTareas);

  const estadosAv: Record<string, string> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const av of ((avatares ?? []) as any[])) estadosAv[av.agente_nombre] = av.estado_animacion;

  // PM anima como hablando
  await db.from('avatares').update({ estado_animacion: 'hablando' }).eq('agente_nombre', pmNombre);

  // Log resumen general
  const resumen = agentesConTareas.map(ag => {
    const ts = porAgente[ag] ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enProg = ts.filter((t: any) => t.estado === 'en_progreso').length;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pend   = ts.filter((t: any) => t.estado === 'pendiente').length;
    const partes: string[] = [];
    if (enProg) partes.push(`${enProg} en progreso`);
    if (pend)   partes.push(`${pend} pendiente(s)`);
    return `• ${ag}: ${partes.join(', ')}`;
  }).join('\n');

  await db.from('bitacora_actividad').insert({
    agente: pmNombre,
    accion: `🔄 ${pmNombre} reanudó trabajo. Revisión del equipo:\n${resumen}`,
  });

  // Auto-reanudar agentes con tareas en_progreso pero en idle (interrumpidos)
  for (const agente of agentesConTareas) {
    const estado = estadosAv[agente] ?? 'idle';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const agTareas = porAgente[agente] ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tareaEnProg = agTareas.find((t: any) => t.estado === 'en_progreso');

    if (estado === 'idle' && tareaEnProg) {
      await db.from('bitacora_actividad').insert({
        agente: pmNombre,
        accion: `📋 → ${agente}: Retomando tarea interrumpida: "${(tareaEnProg.descripcion as string).slice(0, 80)}"`,
        tarea_id: tareaEnProg.id,
      });
      _reanudarAgente(agente, db).catch(console.error);
    } else if (estado === 'idle' && agTareas.length > 0) {
      const t = agTareas[0];
      await db.from('bitacora_actividad').insert({
        agente: pmNombre,
        accion: `📋 → ${agente}: Tienes ${agTareas.length} tarea(s) pendiente(s). Próxima: "${(t.descripcion as string).slice(0, 80)}"`,
        tarea_id: t.id,
      });
    }
  }

  // PM vuelve a idle después de 3s
  setTimeout(() => {
    db.from('avatares').update({ estado_animacion: 'idle' }).eq('agente_nombre', pmNombre)
      .then(() => {}).catch(() => {});
  }, 3000);
}

// ── Exportadas ────────────────────────────────────────────────────────────────

export async function moverAvatarADescanso(agenteNombre: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = makeDb() as any;

  // Pausar tareas en_progreso → pendiente para retomarse con historial al volver
  const { data: enProgreso } = await db
    .from('tareas')
    .select('id, descripcion')
    .eq('agente_asignado', agenteNombre)
    .eq('estado', 'en_progreso');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const t of ((enProgreso ?? []) as any[])) {
    await db.from('tareas').update({ estado: 'pendiente', iniciado_en: null }).eq('id', t.id);
    await db.from('bitacora_actividad').insert({
      agente: agenteNombre,
      accion: `⏸️ Tarea pausada — se retomará desde el último punto de progreso al volver.`,
      tarea_id: t.id,
    });
  }

  await db.from('avatares')
    .update({ estado_animacion: 'idle' })
    .eq('agente_nombre', agenteNombre);

  revalidatePath('/superadmin/sims');
}

export async function reanudarTrabajo(agenteNombre: string): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const db = makeDb();

  // Si es PM, briefear al equipo en background
  if (agenteNombre === 'pm-global' || agenteNombre === 'dev-pm') {
    verificarTareasEquipo(agenteNombre, db).catch(console.error);
  }

  const result = await _reanudarAgente(agenteNombre, db);

  if (!result) {
    // Sin tareas — queda en idle
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).from('avatares')
      .update({ estado_animacion: 'idle' })
      .eq('agente_nombre', agenteNombre);
  }

  revalidatePath('/superadmin/sims');
  return result;
}
