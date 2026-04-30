import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

const ESTADO_BADGE: Record<string, string> = {
  pendiente:   'bg-yellow-100 text-yellow-800',
  en_progreso: 'bg-blue-100 text-blue-800 animate-pulse',
  completada:  'bg-green-100 text-green-800',
  cancelada:   'bg-gray-100 text-gray-500',
};

const AGENTE_EMOJI: Record<string, string> = {
  'pm-global': '🎯', 'dev-pm': '👨‍💼', 'dev-backend': '⚙️', 'dev-bd': '🗄️',
  'dev-frontend': '🎨', 'dev-devops': '🚀', 'dev-testing': '🧪', 'dev-diseno': '✏️',
  'dev-documentador': '📚', 'dev-ciberseguridad': '🛡️', 'dev-redes': '🌐', 'dev-soporte': '🎧',
};

export default async function SuperadminPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = (await createClient()) as any;

  const [tareasRes, bitacoraRes, avatarRes] = await Promise.all([
    sb.from('tareas')
      .select('id, agente_asignado, descripcion, estado, plan_ejecucion, notas, creado_en, iniciado_en, completado_en')
      .order('creado_en', { ascending: false })
      .limit(50),
    sb.from('bitacora_actividad')
      .select('id, agente, accion, creado_en, tarea_id')
      .order('creado_en', { ascending: false })
      .limit(15),
    sb.from('avatares')
      .select('agente_nombre, estado_animacion')
      .neq('estado_animacion', 'idle'),
  ]);

  const tareas: any[] = tareasRes.data ?? [];
  const bitacora: any[] = bitacoraRes.data ?? [];
  // Deduplicar por agente_nombre (la tabla puede tener filas duplicadas)
  const avatarActivos: any[] = Object.values(
    ((avatarRes.data ?? []) as any[]).reduce((acc: Record<string, any>, av: any) => {
      acc[av.agente_nombre] = av;
      return acc;
    }, {})
  );

  const pendientes   = tareas.filter(t => t.estado === 'pendiente').length;
  const enProgreso   = tareas.filter(t => t.estado === 'en_progreso').length;
  const completadas  = tareas.filter(t => t.estado === 'completada').length;
  const canceladas   = tareas.filter(t => t.estado === 'cancelada').length;

  const tareasActivas = tareas.filter(t => t.estado === 'en_progreso' || t.estado === 'pendiente');

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Panel General</h1>
          <p className="text-sm text-gray-500 mt-1">Estado en tiempo real del equipo de agentes</p>
        </div>
        <Link
          href="/superadmin/sims"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          🏢 Vista de agentes
        </Link>
      </div>

      {/* ── Tarjetas de resumen ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'En progreso', valor: enProgreso,  color: 'border-blue-400  bg-blue-50  text-blue-700'  },
          { label: 'Pendientes',  valor: pendientes,  color: 'border-yellow-400 bg-yellow-50 text-yellow-700' },
          { label: 'Completadas', valor: completadas, color: 'border-green-400 bg-green-50  text-green-700' },
          { label: 'Canceladas',  valor: canceladas,  color: 'border-gray-300   bg-gray-50   text-gray-500'  },
        ].map(({ label, valor, color }) => (
          <div key={label} className={`rounded-2xl border-2 p-5 ${color}`}>
            <p className="text-sm font-medium">{label}</p>
            <p className="text-4xl font-bold mt-1">{valor}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Tareas activas ── */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">Tareas activas</span>
            <span className="text-xs text-gray-400">{tareasActivas.length} tarea{tareasActivas.length !== 1 ? 's' : ''}</span>
          </div>
          {tareasActivas.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              No hay tareas activas. Ve a <Link href="/superadmin/solicitar" className="text-indigo-600 hover:underline">Solicitar</Link> para asignar trabajo.
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {tareasActivas.map(t => (
                <div key={t.id} className="px-6 py-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xl shrink-0 mt-0.5">{AGENTE_EMOJI[t.agente_asignado] ?? '🤖'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-gray-500">{t.agente_asignado}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${ESTADO_BADGE[t.estado] ?? 'bg-gray-100 text-gray-500'}`}>
                          {t.estado.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-800 mt-0.5 leading-snug">{t.descripcion}</p>
                      {t.plan_ejecucion && (
                        <details className="mt-2">
                          <summary className="text-xs text-indigo-600 cursor-pointer hover:text-indigo-800 select-none">
                            Ver plan de ejecución
                          </summary>
                          <pre className="mt-2 text-xs text-gray-600 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap leading-relaxed border border-gray-100">
                            {t.plan_ejecucion}
                          </pre>
                        </details>
                      )}
                      {t.notas && (
                        <p className="text-xs text-gray-500 mt-1 italic">{t.notas}</p>
                      )}
                      <p className="text-[10px] text-gray-400 mt-1">
                        Creada {new Date(t.creado_en).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        {t.iniciado_en && ` · Iniciada ${new Date(t.iniciado_en).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Sidebar: Agentes activos + actividad reciente ── */}
        <div className="space-y-4">

          {/* Agentes trabajando */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-700">Agentes activos</span>
              {avatarActivos.length > 0 && (
                <span className="ml-auto w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              )}
            </div>
            {avatarActivos.length === 0 ? (
              <p className="px-5 py-4 text-xs text-gray-400 italic">Todos en descanso</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {avatarActivos.map(av => (
                  <div key={av.agente_nombre} className="px-5 py-3 flex items-center gap-3">
                    <span className="text-lg">{AGENTE_EMOJI[av.agente_nombre] ?? '🤖'}</span>
                    <div>
                      <p className="text-xs font-semibold text-gray-700">{av.agente_nombre}</p>
                      <p className="text-[10px] text-gray-400 capitalize">{av.estado_animacion}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actividad reciente */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-700">Actividad reciente</span>
            </div>
            <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
              {bitacora.length === 0 ? (
                <p className="px-5 py-4 text-xs text-gray-400 italic">Sin actividad aún</p>
              ) : bitacora.map(b => (
                <div key={b.id} className="px-5 py-3 flex gap-3 items-start">
                  <span className="text-base shrink-0">{AGENTE_EMOJI[b.agente] ?? '🤖'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-gray-500">{b.agente}</p>
                    <p className="text-xs text-gray-700 leading-snug">{b.accion}</p>
                  </div>
                  <span className="text-[10px] text-gray-400 shrink-0 mt-0.5">
                    {new Date(b.creado_en).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
