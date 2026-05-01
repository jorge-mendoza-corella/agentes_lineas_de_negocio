'use client';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface TareaEstancada {
  id: string;
  descripcion: string;
  agente_asignado: string | null;
  minutos: number;
}

const MINUTOS_LIMITE = 15;
const INTERVALO_MS = 3 * 60 * 1000;
const STORAGE_KEY = 'pm_tareas_alertadas';

function getAlertadas(): string[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); } catch { return []; }
}
function marcarAlertada(id: string) {
  const prev = getAlertadas();
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...new Set([...prev, id])]));
}

export default function MonitorTareasEstancadas({ userId }: { userId: string }) {
  const [alerta, setAlerta] = useState<TareaEstancada | null>(null);
  const [estado, setEstado] = useState<'idle' | 'notificando' | 'listo'>('idle');
  const router = useRouter();
  const verificandoRef = useRef(false);

  async function verificar() {
    if (verificandoRef.current) return;
    verificandoRef.current = true;
    try {
      const supabase = createClient();
      const { data: tareas } = await (supabase as any)
        .from('tareas')
        .select('id, descripcion, agente_asignado, iniciado_en')
        .eq('estado', 'en_progreso');

      if (!tareas?.length) return;

      const alertadas = getAlertadas();

      for (const tarea of tareas) {
        if (alertadas.includes(tarea.id)) continue;

        const { data: lastEntry } = await (supabase as any)
          .from('bitacora_actividad')
          .select('creado_en')
          .eq('tarea_id', tarea.id)
          .order('creado_en', { ascending: false })
          .limit(1)
          .maybeSingle();

        const ultimaActividad = lastEntry?.creado_en
          ? new Date(lastEntry.creado_en)
          : tarea.iniciado_en ? new Date(tarea.iniciado_en) : null;

        if (!ultimaActividad) continue;

        const minutos = Math.floor((Date.now() - ultimaActividad.getTime()) / 60000);

        if (minutos >= MINUTOS_LIMITE) {
          marcarAlertada(tarea.id);
          const info: TareaEstancada = {
            id: tarea.id,
            descripcion: tarea.descripcion,
            agente_asignado: tarea.agente_asignado,
            minutos,
          };
          setAlerta(info);
          setEstado('idle');
          await notificarPM(info, supabase);
          break;
        }
      }
    } finally {
      verificandoRef.current = false;
    }
  }

  async function notificarPM(tarea: TareaEstancada, supabase: any) {
    setEstado('notificando');
    try {
      // Encontrar o crear conversación de monitoreo
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

      await fetch('/api/pm-global', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversacion_id: conv.id,
          mensaje: `🚨 Alerta automática del sistema: la tarea "${tarea.descripcion}" asignada a ${tarea.agente_asignado ?? 'agente desconocido'} lleva ${tarea.minutos} minutos sin actividad. ¿Qué recomiendas hacer? ¿Reanudar, reasignar o escalar con el stakeholder?`,
        }),
      });
      setEstado('listo');
    } catch (e) {
      console.error('[Monitor] error al notificar PM:', e);
      setEstado('idle');
    }
  }

  useEffect(() => {
    // Esperar 30s tras carga inicial para no interferir con el render
    const delay = setTimeout(() => {
      verificar();
      const interval = setInterval(verificar, INTERVALO_MS);
      return () => clearInterval(interval);
    }, 30_000);
    return () => clearTimeout(delay);
  }, []);

  if (!alerta) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 w-80 bg-gray-900 border border-yellow-600/60 rounded-2xl shadow-2xl overflow-hidden">
      <div className="flex items-start gap-3 p-4">
        <span className="text-xl mt-0.5 flex-shrink-0">⚠️</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-yellow-300">Agente sin actividad</p>
          <p className="text-xs text-gray-300 mt-0.5 leading-relaxed line-clamp-2">{alerta.descripcion}</p>
          <p className="text-[11px] text-gray-500 mt-1.5">
            {alerta.agente_asignado} · {alerta.minutos} min sin respuesta
          </p>
          {estado === 'notificando' && (
            <p className="text-[11px] text-blue-400 mt-1.5 animate-pulse">Consultando al PM Global…</p>
          )}
          {estado === 'listo' && (
            <p className="text-[11px] text-green-400 mt-1.5">
              PM Global notificado — revisa el chat en Solicitar.
            </p>
          )}
        </div>
        <button
          onClick={() => setAlerta(null)}
          className="text-gray-500 hover:text-gray-300 text-xl leading-none flex-shrink-0"
        >
          ×
        </button>
      </div>
      <div className="flex gap-2 px-4 pb-4">
        <button
          onClick={() => { setAlerta(null); router.push('/superadmin/sims'); }}
          className="flex-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 py-1.5 rounded-lg font-medium transition-colors"
        >
          Ver en Sims
        </button>
        <button
          onClick={() => { setAlerta(null); router.push('/superadmin/solicitar'); }}
          className="flex-1 text-xs bg-yellow-600/80 hover:bg-yellow-500 text-white py-1.5 rounded-lg font-medium transition-colors"
        >
          Ver chat PM
        </button>
      </div>
    </div>
  );
}
