import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import KanbanTareas from '@/components/proyectos/KanbanTareas';
import FormNuevoRequerimiento from '@/components/proyectos/FormNuevoRequerimiento';
import BtnReejecutar from '@/components/proyectos/BtnReejecutar';
import BtnDiagnosticar from '@/components/proyectos/BtnDiagnosticar';

interface Props {
  params: Promise<{ id: string }>;
}

const ESTADO_BADGE: Record<string, string> = {
  pendiente:   'bg-yellow-100 text-yellow-700',
  en_progreso: 'bg-blue-100 text-blue-700',
  completada:  'bg-green-100 text-green-700',
  cancelada:   'bg-gray-100 text-gray-500',
};

const AGENTE_EMOJI: Record<string, string> = {
  'pm-global': '🎯', 'dev-pm': '👨‍💼', 'dev-backend': '⚙️', 'dev-bd': '🗄️',
  'dev-frontend': '🎨', 'dev-devops': '🚀', 'dev-testing': '🧪', 'dev-diseno': '✏️',
  'dev-documentador': '📚', 'dev-ciberseguridad': '🛡️', 'dev-redes': '🌐', 'dev-soporte': '🎧',
};

export default async function ProyectoDetallePage({ params }: Props) {
  const { id } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  const [proyectoRes, requerimientosRes, tareasDirectasRes, bitacoraRes] = await Promise.all([
    supabase.from('proyectos').select(`*, areas_negocio ( nombre )`).eq('id', id).single(),
    supabase.from('requerimientos').select(`*, tareas ( * )`).eq('proyecto_id', id).order('creado_en', { ascending: false }),
    supabase.from('tareas')
      .select('id, agente_asignado, descripcion, estado, plan_ejecucion, notas, creado_en, iniciado_en, completado_en')
      .eq('proyecto_id', id)
      .order('creado_en', { ascending: false }),
    supabase.from('bitacora_actividad')
      .select('id, agente, accion, creado_en, tarea_id')
      .eq('proyecto_id', id)
      .order('creado_en', { ascending: false })
      .limit(300),
  ]);

  if (!proyectoRes.data) notFound();

  const proyecto = proyectoRes.data;
  const requerimientos = requerimientosRes.data ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tareasDirectas: any[] = tareasDirectasRes.data ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bitacora: any[] = bitacoraRes.data ?? [];
  const areaNombre = (proyecto.areas_negocio as unknown as { nombre: string })?.nombre ?? '';

  const STALL_MINUTOS = 30;
  function isStalled(t: any): boolean {
    if (t.estado !== 'en_progreso') return false;
    if (!t.iniciado_en) return false;
    const mins = (Date.now() - new Date(t.iniciado_en).getTime()) / 60000;
    return mins > STALL_MINUTOS;
  }
  function parsePasos(plan: string | null): string[] {
    if (!plan) return [];
    const sinEncabezados = plan.replace(/^===.*===\s*$/gm, '');
    return sinEncabezados
      .split('\n')
      .map((l: string) => l.trim())
      .filter((l: string) =>
        /^\d+[\.\)\-]\s+\S/.test(l) ||
        /^\*\*\d+[\.\)]\*?\*?\s+\S/.test(l) ||
        /^[-*•]\s+\S/.test(l) ||
        /^Paso\s+\d+/i.test(l) ||
        /^Step\s+\d+/i.test(l)
      )
      .map((l: string) => l
        .replace(/^\d+[\.\)\-]\s*/, '')
        .replace(/^\*\*\d+[\.\)]\*?\*?\s*/, '')
        .replace(/^[-*•]\s*/, '')
        .replace(/^Paso\s+\d+[\.\:\-]?\s*/i, '')
        .replace(/^Step\s+\d+[\.\:\-]?\s*/i, '')
        .replace(/\*\*/g, '')
        .trim()
      )
      .filter((l: string) => l.length > 4);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <a href="/superadmin/proyectos" className="text-sm text-blue-600 hover:underline">
          ← Proyectos
        </a>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">{areaNombre}</p>
          <h1 className="text-2xl font-bold text-gray-900">{proyecto.nombre}</h1>
          {proyecto.descripcion && (
            <p className="text-sm text-gray-500 mt-1">{proyecto.descripcion}</p>
          )}
          {proyecto.repo_url && (
            <a href={proyecto.repo_url} target="_blank" rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline mt-1 inline-block">
              {proyecto.repo_url}
            </a>
          )}
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
          proyecto.estado === 'activo'  ? 'bg-green-100 text-green-700'
          : proyecto.estado === 'pausado' ? 'bg-yellow-100 text-yellow-700'
          : 'bg-gray-100 text-gray-500'
        }`}>
          {proyecto.estado}
        </span>
      </div>

      {/* ── Tareas de agentes IA (asignadas por PM Global) ── */}
      {tareasDirectas.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-900">Tareas de agentes IA</span>
            <span className="text-xs text-gray-400">{tareasDirectas.length} tarea{tareasDirectas.length !== 1 ? 's' : ''}</span>
          </div>
          {/* Barra de progreso */}
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-4">
            {[
              { label: 'Completadas', count: tareasDirectas.filter((t: any) => t.estado === 'completada').length, color: 'text-green-700 bg-green-100' },
              { label: 'En progreso', count: tareasDirectas.filter((t: any) => t.estado === 'en_progreso').length, color: 'text-blue-700 bg-blue-100' },
              { label: 'Pendientes', count: tareasDirectas.filter((t: any) => t.estado === 'pendiente').length, color: 'text-gray-600 bg-gray-100' },
              { label: 'Estancadas', count: tareasDirectas.filter((t: any) => isStalled(t)).length, color: 'text-amber-700 bg-amber-100' },
            ].filter(s => s.count > 0).map(s => (
              <span key={s.label} className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.color}`}>
                {s.count} {s.label}
              </span>
            ))}
            <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden ml-2">
              <div className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${tareasDirectas.length ? (tareasDirectas.filter((t: any) => t.estado === 'completada').length / tareasDirectas.length * 100) : 0}%` }} />
            </div>
          </div>
          <div className="divide-y divide-gray-50">
            {tareasDirectas.map(t => {
              const pasos       = parsePasos(t.plan_ejecucion);
              const logCount    = bitacora.filter((b: any) => b.tarea_id === t.id).length;
              const total       = pasos.length || logCount;
              const finalizando = t.estado === 'en_progreso' && total > 0 && logCount >= total;
              const doneCount   = t.estado === 'completada' ? total
                                : Math.min(logCount, finalizando ? total - 1 : total);
              const pct         = total > 0 ? Math.round(doneCount / total * 100) : 0;
              const remaining   = total - doneCount;

              return (
                <div key={t.id} className="px-6 py-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xl shrink-0 mt-0.5">{AGENTE_EMOJI[t.agente_asignado] ?? '🤖'}</span>
                    <div className="flex-1 min-w-0">

                      {/* Cabecera */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-gray-500">{t.agente_asignado}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${ESTADO_BADGE[t.estado] ?? 'bg-gray-100 text-gray-500'}`}>
                          {t.estado.replace('_', ' ')}
                        </span>
                        {(t.estado === 'pendiente' || t.estado === 'cancelada') && (
                          <BtnReejecutar tareaId={t.id} />
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-800 mt-0.5 leading-snug">{t.descripcion}</p>

                      {/* Barra de progreso por pasos */}
                      {total > 0 && (
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${pct}%`,
                                  background: t.estado === 'completada' ? '#22c55e'
                                            : t.estado === 'en_progreso' ? '#3b82f6'
                                            : doneCount > 0 ? '#f59e0b'
                                            : '#d1d5db',
                                }}
                              />
                            </div>
                            <span className="text-[11px] font-semibold text-gray-600 shrink-0">{pct}%</span>
                          </div>
                          <div className="flex items-center gap-3 text-[10px]">
                            {doneCount > 0 && <span className="text-green-600 font-medium">✅ {doneCount} completados</span>}
                            {finalizando
                              ? <span className="text-blue-500 font-medium">⏳ Verificando último paso...</span>
                              : remaining > 0 && <span className="text-gray-400">⬜ {remaining} pendientes</span>
                            }
                            <span className="text-gray-300">· {total} {pasos.length > 0 ? 'pasos' : 'acciones'} total</span>
                          </div>
                        </div>
                      )}

                      {/* Checklist del plan */}
                      {pasos.length > 0 && (
                        <details className="mt-2" open={t.estado === 'en_progreso' || t.estado === 'completada'}>
                          <summary className="text-[10px] text-indigo-500 font-semibold uppercase tracking-wider cursor-pointer select-none hover:text-indigo-700">
                            Plan de ejecución — {pasos.length} pasos
                          </summary>
                          <div className="mt-2 space-y-1 border-l-2 border-indigo-50 pl-3">
                            {pasos.map((paso: string, i: number) => {
                              const isCompleted = t.estado === 'completada';
                              const isActive    = t.estado === 'en_progreso';
                              const stepDone    = isCompleted || i < doneCount;
                              const stepActive  = ((isActive || t.estado === 'pendiente') && i === Math.min(doneCount, pasos.length - 1) && doneCount < pasos.length)
                                               || (finalizando && i === pasos.length - 1);
                              return (
                                <div key={i} className="flex items-start gap-1.5">
                                  <span className="text-[10px] shrink-0 mt-0.5">
                                    {stepDone ? '✅' : stepActive ? '🔵' : '⚪'}
                                  </span>
                                  <p className={`text-[11px] leading-snug ${
                                    stepDone   ? 'line-through text-gray-300'
                                    : stepActive ? 'text-blue-700 font-semibold'
                                    : 'text-gray-500'
                                  }`}>
                                    <span className="text-[9px] text-gray-300 mr-1">{i + 1}.</span>
                                    {paso}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </details>
                      )}

                      {/* Indicador de estancamiento */}
                      {isStalled(t) && (
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            ⚠️ Sin actividad {Math.floor((Date.now() - new Date(t.iniciado_en).getTime()) / 60000)} min
                          </span>
                          <BtnDiagnosticar tareaId={t.id} />
                        </div>
                      )}

                      {t.notas && (
                        <p className="text-xs text-gray-500 mt-1 italic leading-snug border-l-2 border-gray-200 pl-2">{t.notas}</p>
                      )}
                      <p className="text-[10px] text-gray-400 mt-1">
                        {new Date(t.creado_en).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                        {t.iniciado_en && ` · Iniciada ${new Date(t.iniciado_en).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`}
                        {t.completado_en && ` · Completada ${new Date(t.completado_en).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Kanban de requerimientos (flujo manual) ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Agregar requerimiento</h2>
        <FormNuevoRequerimiento proyectoId={id} />
      </div>

      <KanbanTareas requerimientos={requerimientos} proyectoId={id} tareasIa={tareasDirectas} />

      {/* ── Bitácora del proyecto ── */}
      {bitacora.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Bitácora del proyecto</h2>
          </div>
          <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
            {bitacora.map(b => (
              <div key={b.id} className="px-6 py-3 flex items-start gap-3">
                <span className="text-base shrink-0">{AGENTE_EMOJI[b.agente] ?? '🤖'}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-semibold text-gray-500">{b.agente}</span>
                  <p className="text-sm text-gray-700 leading-snug">{b.accion}</p>
                </div>
                <span className="text-xs text-gray-400 shrink-0">
                  {new Date(b.creado_en).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
