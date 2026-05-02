'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import BtnReejecutar from './BtnReejecutar';
import BtnDiagnosticar from './BtnDiagnosticar';

const ESTADO_BADGE: Record<string, string> = {
  pendiente:   'bg-yellow-100 text-yellow-700',
  en_progreso: 'bg-blue-100  text-blue-700',
  completada:  'bg-green-100 text-green-700',
  cancelada:   'bg-gray-100  text-gray-500',
};
const ESTADO_COLOR: Record<string, string> = {
  pendiente: '#eab308', en_progreso: '#3b82f6', completada: '#22c55e', cancelada: '#64748b',
};
const AGENTE_EMOJI: Record<string, string> = {
  'pm-global':'🎯','dev-pm':'👨‍💼','dev-backend':'⚙️','dev-bd':'🗄️',
  'dev-frontend':'🎨','dev-devops':'🚀','dev-testing':'🧪','dev-diseno':'✏️',
  'dev-documentador':'📚','dev-ciberseguridad':'🛡️','dev-redes':'🌐','dev-soporte':'🎧',
  'trans-investigador':'🔍',
};
const STALL_MINUTOS = 30;

function isStalled(t: any) {
  if (t.estado !== 'en_progreso' || !t.iniciado_en) return false;
  return (Date.now() - new Date(t.iniciado_en).getTime()) / 60000 > STALL_MINUTOS;
}
function parsePasos(plan: string | null): string[] {
  if (!plan) return [];
  return plan.replace(/^===.*===\s*$/gm, '').split('\n')
    .map((l: string) => l.trim())
    .filter((l: string) =>
      /^\d+[\.\)\-]\s+\S/.test(l) || /^\*\*\d+[\.\)]\*?\*?\s+\S/.test(l) ||
      /^[-*•]\s+\S/.test(l) || /^Paso\s+\d+/i.test(l)
    )
    .map((l: string) => l
      .replace(/^\d+[\.\)\-]\s*/, '').replace(/^\*\*\d+[\.\)]\*?\*?\s*/, '')
      .replace(/^[-*•]\s*/, '').replace(/^Paso\s+\d+[\.\:\-]?\s*/i, '')
      .replace(/\*\*/g, '').trim()
    ).filter((l: string) => l.length > 4);
}

const PAGE_SIZE = 5;
const ESTADOS = ['pendiente', 'en_progreso', 'completada', 'cancelada'] as const;

interface Props {
  tareasDirectas: any[];
  bitacora: any[];
}

export default function TareasProyectoList({ tareasDirectas, bitacora }: Props) {
  const [filtroEstado,  setFiltroEstado]  = useState('');
  const [filtroAgente,  setFiltroAgente]  = useState('');
  const [page,          setPage]          = useState(PAGE_SIZE);
  const [cambioId,      setCambioId]      = useState<string | null>(null);
  const [localEstados,  setLocalEstados]  = useState<Record<string, string>>({});

  const agentesUnicos = [...new Set(tareasDirectas.map(t => t.agente_asignado).filter(Boolean))];

  const filtradas = tareasDirectas
    .filter(t => !filtroEstado || (localEstados[t.id] ?? t.estado) === filtroEstado)
    .filter(t => !filtroAgente || t.agente_asignado === filtroAgente);

  const visibles   = filtradas.slice(0, page);
  const hayMas     = filtradas.length > page;
  const limpiar    = () => { setFiltroEstado(''); setFiltroAgente(''); setPage(PAGE_SIZE); };

  async function cambiarEstado(tareaId: string, nuevoEstado: string) {
    setCambioId(tareaId);
    const sb = createClient() as any;
    await sb.from('tareas').update({ estado: nuevoEstado }).eq('id', tareaId);
    setLocalEstados(p => ({ ...p, [tareaId]: nuevoEstado }));
    setCambioId(null);
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Cabecera + barra de progreso */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
        <span className="text-sm font-semibold text-gray-900">Tareas de agentes IA</span>
        <span className="text-xs text-gray-400">{tareasDirectas.length} tarea{tareasDirectas.length !== 1 ? 's' : ''}</span>
        {filtradas.length !== tareasDirectas.length && (
          <span className="text-xs text-indigo-500 font-medium">({filtradas.length} filtradas)</span>
        )}
      </div>

      <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-4 flex-wrap">
        {[
          { label:'Completadas', v:'completada',  color:'text-green-700 bg-green-100'  },
          { label:'En progreso', v:'en_progreso', color:'text-blue-700  bg-blue-100'   },
          { label:'Pendientes',  v:'pendiente',   color:'text-yellow-700 bg-yellow-100'},
          { label:'Estancadas',  v:'_stalled',    color:'text-amber-700 bg-amber-100'  },
        ].map(s => {
          const count = s.v === '_stalled'
            ? tareasDirectas.filter(isStalled).length
            : tareasDirectas.filter(t => t.estado === s.v).length;
          if (!count) return null;
          return (
            <span key={s.v} className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.color}`}>
              {count} {s.label}
            </span>
          );
        })}
        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden ml-2">
          <div className="h-full bg-green-500 rounded-full transition-all"
            style={{ width: `${tareasDirectas.length ? (tareasDirectas.filter(t => t.estado === 'completada').length / tareasDirectas.length * 100) : 0}%` }} />
        </div>
      </div>

      {/* Filtros */}
      <div className="px-6 py-2 border-b border-gray-100 flex flex-wrap gap-2 items-center">
        {ESTADOS.map(e => (
          <button key={e} onClick={() => { setFiltroEstado(filtroEstado === e ? '' : e); setPage(PAGE_SIZE); }}
            className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full border transition-colors"
            style={{
              background:   filtroEstado === e ? `${ESTADO_COLOR[e]}18` : 'transparent',
              color:        filtroEstado === e ? ESTADO_COLOR[e]          : '#94a3b8',
              borderColor:  filtroEstado === e ? `${ESTADO_COLOR[e]}44`   : '#e2e8f0',
            }}>
            {e.replace('_', ' ')}
          </button>
        ))}
        {agentesUnicos.length > 1 && (
          <select value={filtroAgente} onChange={e => { setFiltroAgente(e.target.value); setPage(PAGE_SIZE); }}
            className="text-[10px] border border-gray-200 rounded px-2 py-0.5 text-gray-500 bg-white cursor-pointer">
            <option value="">Todos los agentes</option>
            {agentesUnicos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
        {(filtroEstado || filtroAgente) && (
          <button onClick={limpiar} className="text-[10px] text-gray-400 hover:text-gray-600 px-1">✕ limpiar</button>
        )}
      </div>

      {filtradas.length === 0 ? (
        <p className="px-6 py-6 text-sm text-gray-400 italic">No hay tareas con estos filtros.</p>
      ) : (
        <>
          <div className="divide-y divide-gray-50">
            {visibles.map(t => {
              const estadoActual = localEstados[t.id] ?? t.estado;
              const pasos    = parsePasos(t.plan_ejecucion);
              const logCount = bitacora.filter(b => b.tarea_id === t.id).length;
              const total    = pasos.length || logCount;
              const finaliz  = estadoActual === 'en_progreso' && total > 0 && logCount >= total;
              const done     = estadoActual === 'completada' ? total : Math.min(logCount, finaliz ? total - 1 : total);
              const pct      = total > 0 ? Math.round(done / total * 100) : 0;
              const rem      = total - done;

              return (
                <div key={t.id} className="px-6 py-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xl shrink-0 mt-0.5">{AGENTE_EMOJI[t.agente_asignado] ?? '🤖'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-gray-500">{t.agente_asignado}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${ESTADO_BADGE[estadoActual] ?? 'bg-gray-100 text-gray-500'}`}>
                          {estadoActual.replace('_', ' ')}
                        </span>
                        {(estadoActual === 'pendiente' || estadoActual === 'cancelada') && (
                          <BtnReejecutar tareaId={t.id} />
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-800 mt-0.5 leading-snug">{t.descripcion}</p>

                      {total > 0 && (
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all"
                                style={{ width:`${pct}%`, background: estadoActual === 'completada' ? '#22c55e' : estadoActual === 'en_progreso' ? '#3b82f6' : done > 0 ? '#f59e0b' : '#d1d5db' }} />
                            </div>
                            <span className="text-[11px] font-semibold text-gray-600 shrink-0">{pct}%</span>
                          </div>
                          <div className="flex items-center gap-3 text-[10px]">
                            {done > 0 && <span className="text-green-600 font-medium">✅ {done} completados</span>}
                            {finaliz ? <span className="text-blue-500 font-medium">⏳ Verificando último paso...</span>
                                     : rem > 0 && <span className="text-gray-400">⬜ {rem} pendientes</span>}
                            <span className="text-gray-300">· {total} {pasos.length > 0 ? 'pasos' : 'acciones'}</span>
                          </div>
                        </div>
                      )}

                      {pasos.length > 0 && (
                        <details className="mt-2" open={estadoActual === 'en_progreso' || estadoActual === 'completada'}>
                          <summary className="text-[10px] text-indigo-500 font-semibold uppercase tracking-wider cursor-pointer select-none hover:text-indigo-700">
                            Plan — {pasos.length} pasos
                          </summary>
                          <div className="mt-2 space-y-1 border-l-2 border-indigo-50 pl-3">
                            {pasos.map((paso: string, i: number) => {
                              const isC = estadoActual === 'completada';
                              const isA = estadoActual === 'en_progreso';
                              const sd  = isC || i < done;
                              const sa  = ((isA || estadoActual === 'pendiente') && i === Math.min(done, pasos.length - 1) && done < pasos.length) || (finaliz && i === pasos.length - 1);
                              return (
                                <div key={i} className="flex items-start gap-1.5">
                                  <span className="text-[10px] shrink-0 mt-0.5">{sd ? '✅' : sa ? '🔵' : '⚪'}</span>
                                  <p className={`text-[11px] leading-snug ${sd ? 'line-through text-gray-300' : sa ? 'text-blue-700 font-semibold' : 'text-gray-500'}`}>
                                    <span className="text-[9px] text-gray-300 mr-1">{i + 1}.</span>{paso}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </details>
                      )}

                      {isStalled(t) && estadoActual === 'en_progreso' && (
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            ⚠️ Sin actividad {Math.floor((Date.now() - new Date(t.iniciado_en).getTime()) / 60000)} min
                          </span>
                          <BtnDiagnosticar tareaId={t.id} />
                        </div>
                      )}

                      {/* Bypass de estado */}
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <span className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider">Mover a:</span>
                        {ESTADOS.filter(e => e !== estadoActual).map(e => (
                          <button key={e} disabled={cambioId === t.id}
                            onClick={() => cambiarEstado(t.id, e)}
                            className="text-[9px] font-semibold px-2 py-0.5 rounded-md border transition-opacity"
                            style={{ background:`${ESTADO_COLOR[e]}12`, color:ESTADO_COLOR[e], borderColor:`${ESTADO_COLOR[e]}30`, opacity: cambioId === t.id ? 0.4 : 1 }}>
                            {cambioId === t.id ? '…' : e.replace('_', ' ')}
                          </button>
                        ))}
                      </div>

                      {t.notas && (
                        <p className="text-xs text-gray-500 mt-1.5 italic leading-snug border-l-2 border-gray-200 pl-2">{t.notas}</p>
                      )}
                      <p className="text-[10px] text-gray-400 mt-1">
                        {new Date(t.creado_en).toLocaleString('es-MX', { dateStyle:'short', timeStyle:'short' })}
                        {t.iniciado_en && ` · Iniciada ${new Date(t.iniciado_en).toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' })}`}
                        {t.completado_en && ` · Completada ${new Date(t.completado_en).toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' })}`}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {hayMas && (
            <div className="px-6 py-3 border-t border-gray-100">
              <button onClick={() => setPage(p => p + PAGE_SIZE)}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors">
                Ver 5 más · {filtradas.length - page} restantes
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
