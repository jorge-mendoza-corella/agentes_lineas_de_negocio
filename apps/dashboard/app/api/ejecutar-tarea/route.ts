import { NextRequest } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { ejecutarEspecialista } from '@/lib/agent/especialista';

export const runtime = 'nodejs';
export const maxDuration = 10;

function serviceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: { tarea_id: string; reanudar?: boolean };
  try { body = await req.json(); } catch { return new Response('Bad Request', { status: 400 }); }
  const { tarea_id, reanudar = false } = body;
  if (!tarea_id) return new Response(JSON.stringify({ error: 'tarea_id requerido' }), { status: 400 });

  const db = serviceClient();

  // Contexto previo para reanudación
  let prevContexto: string | undefined;
  if (reanudar) {
    const { data: entries } = await db
      .from('bitacora_actividad')
      .select('accion, creado_en')
      .eq('tarea_id', tarea_id)
      .order('creado_en', { ascending: false })
      .limit(15);
    if (entries?.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prevContexto = entries.map((e: any) => `[${e.creado_en}] ${e.accion.slice(0, 200)}`).join('\n');
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tarea } = await (db as any)
    .from('tareas')
    .select('estado, agente_asignado')
    .eq('id', tarea_id)
    .single() as { data: { estado: string; agente_asignado: string } | null };

  if (!tarea) return new Response(JSON.stringify({ error: 'Tarea no encontrada' }), { status: 404 });

  // Si estaba en_progreso (estancada) → reset
  if (tarea.estado === 'en_progreso') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).from('tareas').update({ estado: 'pendiente', iniciado_en: null }).eq('id', tarea_id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).from('bitacora_actividad').insert({
      agente: tarea.agente_asignado,
      accion: '🔄 Tarea reiniciada automáticamente por barrido del sistema.',
      tarea_id,
    });
  }

  // Disparar especialista en background (fire & forget)
  ejecutarEspecialista(tarea_id, db, prevContexto).catch((e: unknown) => {
    console.error('[ejecutar-tarea] error:', e);
  });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
