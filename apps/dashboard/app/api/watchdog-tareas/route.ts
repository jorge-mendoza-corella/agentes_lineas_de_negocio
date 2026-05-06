import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Watchdog de tareas atascadas:
// Detecta tareas en `pendiente` o `en_progreso` con más de N minutos sin actividad
// (sin updates en `tareas` ni nuevas entradas en `bitacora_actividad`).
// Para cada tarea atascada notifica al PM Global vía:
//   - mensaje en `mensajes_pm` (chat del usuario admin)
//   - mensaje a Telegram (si TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID están configurados)
//
// Marca `tareas.watchdog_alertado_en` para no spamear: no re-notifica la misma tarea
// dentro de la siguiente hora.
//
// Auth: requiere header `Authorization: Bearer <WATCHDOG_TOKEN>` o se rechaza con 401.
// Este endpoint debe llamarse desde un cron externo (GitHub Actions, pg_cron, etc.).

export const dynamic = 'force-dynamic';

const UMBRAL_MIN_INACTIVIDAD     = 15;   // minutos sin movimiento → atascada
const UMBRAL_MIN_REALERTAR       = 60;   // minutos antes de re-alertar la misma tarea
const MAX_TAREAS_POR_EJECUCION   = 20;   // safety: no procesar más de N tareas por corrida

interface TareaAtascada {
  id: string;
  agente_asignado: string;
  descripcion: string;
  estado: string;
  notas: string | null;
  creado_en: string | null;
  iniciado_en: string | null;
  watchdog_alertado_en: string | null;
}

export async function POST(req: Request) {
  // ── Auth ────────────────────────────────────────────────────────────────
  const expected = process.env.WATCHDOG_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: 'WATCHDOG_TOKEN no configurado en el servidor' }, { status: 503 });
  }
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token !== expected) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Supabase no configurado' }, { status: 503 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb: any = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const ahora       = new Date();
  const corteInact  = new Date(ahora.getTime() - UMBRAL_MIN_INACTIVIDAD * 60_000).toISOString();
  const corteAlert  = new Date(ahora.getTime() - UMBRAL_MIN_REALERTAR    * 60_000).toISOString();

  // ── Tareas candidatas ───────────────────────────────────────────────────
  // La tabla `tareas` no tiene `updated_at` — usamos `creado_en` como filtro grueso
  // y la lógica posterior con bitácora hace el filtro fino.
  // 1) estado en pendiente/en_progreso
  // 2) creado_en < corte de inactividad (15 min — descartamos tareas recién creadas)
  // 3) watchdog_alertado_en es null o es < corte de re-alerta (1h)
  const { data: candidatas, error: errCand } = await sb
    .from('tareas')
    .select('id, agente_asignado, descripcion, estado, notas, creado_en, iniciado_en, watchdog_alertado_en')
    .in('estado', ['pendiente', 'en_progreso'])
    .lt('creado_en', corteInact)
    .or(`watchdog_alertado_en.is.null,watchdog_alertado_en.lt.${corteAlert}`)
    .order('creado_en', { ascending: true })
    .limit(MAX_TAREAS_POR_EJECUCION);

  if (errCand) {
    return NextResponse.json({ error: errCand.message }, { status: 500 });
  }

  const tareas = (candidatas ?? []) as TareaAtascada[];
  if (tareas.length === 0) {
    return NextResponse.json({ ok: true, atascadas: 0, mensaje: 'No hay tareas atascadas.' });
  }

  // ── Verificar última entrada de bitácora por tarea ──────────────────────
  // Si hubo actividad reciente en bitácora aunque no se actualizó tareas.updated_at, no la consideramos atascada.
  const ids = tareas.map(t => t.id);
  const { data: ultBit } = await sb
    .from('bitacora_actividad')
    .select('tarea_id, creado_en')
    .in('tarea_id', ids)
    .order('creado_en', { ascending: false });

  const ultActividad = new Map<string, string>();
  for (const row of (ultBit ?? []) as Array<{ tarea_id: string; creado_en: string }>) {
    if (!ultActividad.has(row.tarea_id)) ultActividad.set(row.tarea_id, row.creado_en);
  }

  // Última actividad real = max(última bitácora, iniciado_en, creado_en)
  const atascadasReales = tareas.filter(t => {
    const ultBitTarea = ultActividad.get(t.id);
    const candidatos = [ultBitTarea, t.iniciado_en, t.creado_en].filter(Boolean) as string[];
    if (candidatos.length === 0) return true;
    const ultMov = candidatos.reduce((max, c) => (c > max ? c : max));
    return ultMov < corteInact;
  });

  if (atascadasReales.length === 0) {
    return NextResponse.json({ ok: true, atascadas: 0, mensaje: 'Tareas con candidatas pero todas tienen actividad reciente en bitácora.' });
  }

  // ── Buscar conversación admin para enviar mensajes al chat ──────────────
  const { data: rowSuper } = await sb
    .from('perfiles')
    .select('id')
    .in('rol', ['superadmin', 'plataforma_admin'])
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const adminId = (rowSuper as { id: string } | null)?.id;
  let convId: string | null = null;
  if (adminId) {
    const { data: conv } = await sb
      .from('conversaciones_pm')
      .select('id')
      .eq('usuario_id', adminId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    convId = (conv as { id: string } | null)?.id ?? null;

    if (!convId) {
      const { data: newConv } = await sb
        .from('conversaciones_pm')
        .insert({ usuario_id: adminId, titulo: 'Alertas del watchdog' })
        .select('id')
        .single();
      convId = (newConv as { id: string } | null)?.id ?? null;
    }
  }

  // ── Notificar cada tarea atascada ──────────────────────────────────────
  const notificadas: string[] = [];
  for (const t of atascadasReales) {
    const ultBitTarea = ultActividad.get(t.id);
    const candidatos = [ultBitTarea, t.iniciado_en, t.creado_en].filter(Boolean) as string[];
    const ultMov = candidatos.length > 0 ? candidatos.reduce((max, c) => (c > max ? c : max)) : null;
    const minInact = ultMov ? Math.round((ahora.getTime() - new Date(ultMov).getTime()) / 60_000) : null;
    const titulo = `⚠️ Tarea atascada (${t.estado}) — ${t.agente_asignado}`;
    const cuerpo = [
      titulo,
      ``,
      `**Descripción:** ${t.descripcion.slice(0, 200)}`,
      `**ID:** \`${t.id}\``,
      minInact != null ? `**Sin movimiento desde hace:** ${minInact} min` : '',
      t.notas ? `**Notas:** ${t.notas.slice(0, 200)}` : '',
      ``,
      `¿Cómo procedo? Puedo: reanudar, reasignar a otro agente, o cancelar.`,
    ].filter(Boolean).join('\n');

    // 1) Mensaje en chat del PM Global
    if (convId) {
      try {
        await sb.from('mensajes_pm').insert({
          conversacion_id: convId,
          rol: 'agente',
          contenido: cuerpo,
          metadata: { automatico: true, fuente: 'watchdog', tarea_id: t.id },
        });
      } catch (e) {
        console.error('[watchdog] error insertando mensaje_pm:', e);
      }
    }

    // 2) Bitácora de la tarea (visible en SimsCanvas)
    try {
      await sb.from('bitacora_actividad').insert({
        agente: 'pm-global',
        accion: `🐶 Watchdog: tarea sin movimiento por ${minInact ?? '?'} min — alerta enviada al usuario.`,
        tarea_id: t.id,
      });
    } catch {}

    // 3) Telegram (best-effort)
    const tgToken = process.env.TELEGRAM_BOT_TOKEN;
    const tgChat  = process.env.TELEGRAM_CHAT_ID;
    if (tgToken && tgChat) {
      try {
        await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: tgChat,
            text: cuerpo.replace(/\*\*/g, '*'),
            parse_mode: 'Markdown',
          }),
        });
      } catch (e) {
        console.error('[watchdog] error enviando Telegram:', e);
      }
    }

    // 4) Marcar como alertada
    try {
      await sb.from('tareas').update({ watchdog_alertado_en: ahora.toISOString() }).eq('id', t.id);
    } catch {}

    notificadas.push(t.id);
  }

  return NextResponse.json({ ok: true, atascadas: atascadasReales.length, notificadas });
}
