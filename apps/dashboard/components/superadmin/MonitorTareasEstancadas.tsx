'use client';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface TareaAlerta {
  id: string;
  descripcion: string;
  agente_asignado: string | null;
  minutos: number;
  tipo: 'estancada' | 'reiniciada';
}

const MINUTOS_ALERTA    = 20;   // alertar al PM si lleva más de esto sin actividad
const MINUTOS_REINTENTO = 12;   // reintentar ejecución si lleva más de esto inactivo
const INTERVALO_MS      = 90_000; // revisar cada 90 segundos
const STORAGE_ALERTAS   = 'pm_tareas_alertadas';
const STORAGE_INTENTOS  = 'pm_tareas_intentadas'; // { id: timestamp }

function getSet(key: string): string[] {
  try { return JSON.parse(localStorage.getItem(key) ?? '[]'); } catch { return []; }
}
function getMap(key: string): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(key) ?? '{}'); } catch { return {}; }
}
function setMap(key: string, map: Record<string, number>) {
  localStorage.setItem(key, JSON.stringify(map));
}
function marcarEnSet(key: string, id: string) {
  const prev = getSet(key);
  localStorage.setItem(key, JSON.stringify([...new Set([...prev, id])]));
}

export default function MonitorTareasEstancadas({ userId }: { userId: string }) {
  const [alerta, setAlerta] = useState<TareaAlerta | null>(null);
  const [estado, setEstado] = useState<'idle' | 'notificando' | 'listo'>('idle');
  const router = useRouter();
  const corriendo = useRef(false);

  async function ejecutarTarea(tareaId: string, reanudar = false) {
    await fetch('/api/ejecutar-tarea', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tarea_id: tareaId, reanudar }),
    });
    // Registrar intento
    const intentos = getMap(STORAGE_INTENTOS);
    intentos[tareaId] = Date.now();
    setMap(STORAGE_INTENTOS, intentos);
  }

  async function barrer() {
    if (corriendo.current) return;
    corriendo.current = true;
    try {
      const supabase = createClient();
      const ahora = Date.now();
      const intentos = getMap(STORAGE_INTENTOS);
      const alertadas = getSet(STORAGE_ALERTAS);

      // ── 1. Tareas PENDIENTES sin intento reciente ─────────────────────────
      const { data: pendientes } = await (supabase as any)
        .from('tareas')
        .select('id, descripcion, agente_asignado, notas')
        .eq('estado', 'pendiente')
        .order('creado_en', { ascending: true })
        .limit(10);

      for (const t of pendientes ?? []) {
        const ultimoIntento = intentos[t.id] ?? 0;
        const minDesdeIntento = (ahora - ultimoIntento) / 60000;
        const bloqueada = typeof t.notas === 'string' &&
          (t.notas.includes('🚧 BLOQUEANTE') || t.notas.includes('Acción requerida') || t.notas.includes('necesita'));

        if (!bloqueada && minDesdeIntento > 10) {
          // Auto-ejecutar esta tarea pendiente
          await ejecutarTarea(t.id, false);
          setAlerta({ id: t.id, descripcion: t.descripcion, agente_asignado: t.agente_asignado, minutos: 0, tipo: 'reiniciada' });
          return; // Una tarea por ciclo
        }
      }

      // ── 2. Tareas EN_PROGRESO sin actividad reciente ─────────────────────
      const { data: enProgreso } = await (supabase as any)
        .from('tareas')
        .select('id, descripcion, agente_asignado, iniciado_en')
        .eq('estado', 'en_progreso')
        .limit(10);

      for (const t of enProgreso ?? []) {
        const ultimoIntento = intentos[t.id] ?? 0;
        const minDesdeIntento = (ahora - ultimoIntento) / 60000;
        if (minDesdeIntento < 12) continue; // evitar ciclo infinito

        const { data: lastEntry } = await (supabase as any)
          .from('bitacora_actividad')
          .select('creado_en')
          .eq('tarea_id', t.id)
          .order('creado_en', { ascending: false })
          .limit(1)
          .maybeSingle();

        const ultimaActividad = lastEntry?.creado_en
          ? new Date(lastEntry.creado_en)
          : t.iniciado_en ? new Date(t.iniciado_en) : null;

        if (!ultimaActividad) continue;
        const minutos = Math.floor((ahora - ultimaActividad.getTime()) / 60000);

        if (minutos >= MINUTOS_REINTENTO) {
          // Reintentar automáticamente
          await ejecutarTarea(t.id, true);
          setAlerta({ id: t.id, descripcion: t.descripcion, agente_asignado: t.agente_asignado, minutos, tipo: 'reiniciada' });

          // Si lleva mucho tiempo, además alertar al PM Global
          if (minutos >= MINUTOS_ALERTA && !alertadas.includes(t.id)) {
            marcarEnSet(STORAGE_ALERTAS, t.id);
            setEstado('notificando');
            await notificarPM(t, minutos, supabase);
          }
          return; // Una tarea por ciclo
        }
      }
    } finally {
      corriendo.current = false;
    }
  }

  async function notificarPM(tarea: { id: string; descripcion: string; agente_asignado: string | null }, minutos: number, supabase: any) {
    try {
      let { data: conv } = await supabase
        .from('conversaciones_pm')
        .select('id')
        .eq('usuario_id', userId)
        .ilike('titulo', '%Monitoreo%')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!conv) {
        const { data: newConv } = await supabase
          .from('conversaciones_pm')
          .insert({ usuario_id: userId, titulo: '🤖 Monitoreo de agentes' })
          .select('id')
          .single();
        conv = newConv;
      }
      if (!conv?.id) return;

      const mensajePM = `🚨 Tarea estancada (${minutos} min): "${tarea.descripcion}" (${tarea.agente_asignado ?? 'agente desconocido'}). La reejecuté automáticamente. ¿Qué recomiendas si vuelve a bloquearse?`;

      await Promise.all([
        fetch('/api/pm-global', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversacion_id: conv.id, mensaje: mensajePM }),
        }),
        fetch('/api/notificar-telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mensaje: `🚨 <b>Agente bloqueado</b>\n<b>Agente:</b> ${tarea.agente_asignado ?? 'desconocido'}\n<b>Tarea:</b> ${tarea.descripcion.slice(0, 200)}\n<b>Sin actividad:</b> ${minutos} min\n\nYa se reinició automáticamente. Revisa el chat del PM Global para detalles.`,
          }),
        }),
      ]);
      setEstado('listo');
    } catch { setEstado('idle'); }
  }

  useEffect(() => {
    const delay = setTimeout(() => {
      barrer();
      const interval = setInterval(barrer, INTERVALO_MS);
      return () => clearInterval(interval);
    }, 15_000); // esperar 15s al cargar
    return () => clearTimeout(delay);
  }, []);

  if (!alerta) return null;

  const esReinicio = alerta.tipo === 'reiniciada';

  return (
    <div className="fixed bottom-5 right-5 z-50 w-80 bg-gray-900 border border-blue-600/40 rounded-2xl shadow-2xl overflow-hidden">
      <div className="flex items-start gap-3 p-4">
        <span className="text-xl mt-0.5 flex-shrink-0">{esReinicio ? '⚡' : '⚠️'}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-blue-300">
            {esReinicio ? 'Tarea reanudada automáticamente' : 'Agente sin actividad'}
          </p>
          <p className="text-xs text-gray-300 mt-0.5 leading-relaxed line-clamp-2">{alerta.descripcion}</p>
          <p className="text-[11px] text-gray-500 mt-1.5">
            {alerta.agente_asignado}
            {alerta.minutos > 0 && ` · ${alerta.minutos} min inactivo`}
          </p>
          {estado === 'notificando' && (
            <p className="text-[11px] text-blue-400 mt-1 animate-pulse">Avisando al PM Global…</p>
          )}
          {estado === 'listo' && (
            <p className="text-[11px] text-green-400 mt-1">PM Global notificado.</p>
          )}
        </div>
        <button onClick={() => setAlerta(null)} className="text-gray-500 hover:text-gray-300 text-xl leading-none flex-shrink-0">×</button>
      </div>
      <div className="flex gap-2 px-4 pb-4">
        <button onClick={() => { setAlerta(null); router.push('/superadmin/sims'); }}
          className="flex-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 py-1.5 rounded-lg font-medium transition-colors">
          Ver en Sims
        </button>
        <button onClick={() => { setAlerta(null); router.push('/superadmin/solicitar'); }}
          className="flex-1 text-xs bg-blue-700/80 hover:bg-blue-600 text-white py-1.5 rounded-lg font-medium transition-colors">
          Ver chat PM
        </button>
      </div>
    </div>
  );
}
