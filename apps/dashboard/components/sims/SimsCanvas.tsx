'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type EstadoAnim = 'idle'|'caminando'|'trabajando'|'hablando'|'celebrando';

interface Oficina {
  id: string; nombre: string; piso: number;
  ancho: number; alto: number; color_hex: string | null;
}
interface Avatar {
  id: string; tipo: string; nombre_mostrar: string;
  agente_nombre: string | null; oficina_id: string | null;
  posicion_actual_x: number | null; posicion_actual_y: number | null;
  estado_animacion: EstadoAnim;
}
interface Entrada { id: string; agente: string; accion: string; creado_en: string }

interface Props {
  oficinasIniciales: Oficina[];
  avatoresIniciales: Avatar[];
  bitacoraInicial: Entrada[];
}

const EMOJI: Record<string, string> = {
  'pm-global':'🎯','dev-pm':'👨‍💼','dev-analista':'🔍','dev-backend':'⚙️',
  'dev-bd':'🗄️','dev-devops':'🚀','dev-diseno':'🎨','dev-frontend':'🖥️',
  'dev-imagenes':'🖼️','dev-presentaciones':'📊','dev-seguridad':'🔒',
  'dev-testing':'🧪','dev-videojuegos':'🎮','dev-documentador':'📝',
  'dev-soporte':'🛟','dev-redes':'🌐','dev-ciberseguridad':'🛡️',
  'marketing-pm':'📣','marketing-seo':'🔎',
};

const ANIM_CLASS: Record<EstadoAnim, string> = {
  idle: '',
  caminando: 'animate-bounce',
  trabajando: 'animate-pulse',
  hablando: 'animate-ping',
  celebrando: 'animate-spin',
};

const ANIM_LABEL: Record<EstadoAnim, string> = {
  idle: '', caminando: '🚶', trabajando: '💻', hablando: '💬', celebrando: '🎉',
};

export default function SimsCanvas({ oficinasIniciales, avatoresIniciales, bitacoraInicial }: Props) {
  const [oficinas, setOficinas] = useState<Oficina[]>(oficinasIniciales);
  const [avatares, setAvatares] = useState<Avatar[]>(avatoresIniciales);
  const [bitacora, setBitacora] = useState<Entrada[]>(bitacoraInicial);
  const supabase = createClient();

  // Carga inicial desde el cliente si los props llegaron vacíos
  useEffect(() => {
    if (oficinasIniciales.length === 0) {
      supabase.from('oficinas').select('*').order('piso').then(({ data }) => {
        if (data) setOficinas(data);
      });
    }
    if (avatoresIniciales.length === 0) {
      supabase.from('avatares').select('*').then(({ data }) => {
        if (data) setAvatares(data);
      });
    }
    if (bitacoraInicial.length === 0) {
      supabase.from('bitacora_actividad')
        .select('id, agente, accion, creado_en')
        .order('creado_en', { ascending: false })
        .limit(30)
        .then(({ data }) => { if (data) setBitacora(data); });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime
  useEffect(() => {
    const canal = supabase
      .channel('sims-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'avatares' }, payload => {
        if (payload.eventType === 'UPDATE') {
          setAvatares(prev => prev.map(a =>
            a.id === (payload.new as Avatar).id ? { ...a, ...(payload.new as Avatar) } : a
          ));
        }
        if (payload.eventType === 'INSERT') {
          setAvatares(prev => [...prev, payload.new as Avatar]);
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bitacora_actividad' }, payload => {
        setBitacora(prev => [payload.new as Entrada, ...prev].slice(0, 30));
      })
      .subscribe();

    return () => { supabase.removeChannel(canal); };
  }, [supabase]);

  const ESCALA = 0.55;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto">
        <div className="p-4 border-b border-gray-100 flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">Edificio de agentes</span>
          <span className="ml-auto flex items-center gap-1.5 text-xs text-green-600">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
            En vivo
          </span>
        </div>

        <div className="p-4">
          {oficinas.length === 0 ? (
            <div className="text-center py-10 text-sm text-gray-400">Cargando edificio...</div>
          ) : (
            <div className="space-y-2" style={{ minWidth: `${1200 * ESCALA + 32}px` }}>
              {oficinas.map(oficina => {
                const ocupantes = avatares.filter(a => a.oficina_id === oficina.id);
                return (
                  <div key={oficina.id} className="relative rounded-xl overflow-hidden border border-gray-100"
                    style={{ background: oficina.color_hex ?? '#f9fafb', height: `${oficina.alto * ESCALA}px`, width: `${oficina.ancho * ESCALA}px` }}
                  >
                    <span className="absolute top-1.5 left-2 text-xs font-semibold text-gray-500 opacity-70 select-none">
                      {oficina.nombre}
                    </span>
                    {ocupantes.map(av => {
                      const x = (av.posicion_actual_x ?? 100) * ESCALA;
                      const y = (av.posicion_actual_y ?? 60) * ESCALA;
                      const emoji = av.agente_nombre ? EMOJI[av.agente_nombre] ?? '🤖' : '👤';
                      const animClass = ANIM_CLASS[av.estado_animacion] ?? '';
                      const animLabel = ANIM_LABEL[av.estado_animacion] ?? '';
                      return (
                        <div
                          key={av.id}
                          className="absolute flex flex-col items-center gap-0.5 transition-all duration-700"
                          style={{ left: `${x}px`, top: `${y}px`, transform: 'translate(-50%,-50%)' }}
                          title={`${av.nombre_mostrar} — ${av.estado_animacion}`}
                        >
                          <div className={`text-xl leading-none ${animClass}`}>{emoji}</div>
                          <div className="flex items-center gap-0.5">
                            <span className="text-[9px] font-medium text-gray-600 bg-white/80 px-1 rounded-full leading-tight max-w-[64px] truncate">
                              {av.nombre_mostrar.replace('dev-', '')}
                            </span>
                            {animLabel && <span className="text-[9px]">{animLabel}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {/* Avatares sin oficina */}
          {(() => {
            const sinOficina = avatares.filter(a => !a.oficina_id);
            if (!sinOficina.length) return null;
            return (
              <div className="mt-2 flex flex-wrap gap-3 px-2 py-2 rounded-xl bg-gray-50 border border-gray-100">
                <span className="text-xs text-gray-400 w-full">Sin oficina fija</span>
                {sinOficina.map(av => {
                  const emoji = av.agente_nombre ? EMOJI[av.agente_nombre] ?? '🤖' : '👤';
                  return (
                    <div key={av.id} className="flex items-center gap-1.5 bg-white rounded-full px-3 py-1 border border-gray-200 shadow-sm">
                      <span className="text-base">{emoji}</span>
                      <span className="text-xs font-medium text-gray-700">{av.nombre_mostrar}</span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Feed de actividad */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">Actividad reciente</span>
          <span className="ml-auto flex items-center gap-1.5 text-xs text-green-600">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
            En vivo
          </span>
        </div>
        <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
          {bitacora.length === 0 && (
            <div className="text-center py-8 text-sm text-gray-400">Sin actividad registrada aún</div>
          )}
          {bitacora.map(b => {
            const emoji = EMOJI[b.agente] ?? '🤖';
            return (
              <div key={b.id} className="px-6 py-3 flex items-start gap-3">
                <span className="text-lg shrink-0">{emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-700">{b.agente}</p>
                  <p className="text-sm text-gray-600 leading-snug">{b.accion}</p>
                </div>
                <span className="text-xs text-gray-400 shrink-0">
                  {new Date(b.creado_en).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
