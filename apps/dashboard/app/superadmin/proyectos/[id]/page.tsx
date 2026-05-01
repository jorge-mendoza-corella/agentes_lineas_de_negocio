import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import KanbanTareas from '@/components/proyectos/KanbanTareas';
import FormNuevoRequerimiento from '@/components/proyectos/FormNuevoRequerimiento';
import TareasProyectoList from '@/components/proyectos/TareasProyectoList';

interface Props {
  params: Promise<{ id: string }>;
}

const AGENTE_EMOJI: Record<string, string> = {
  'pm-global': '🎯', 'dev-pm': '👨‍💼', 'dev-backend': '⚙️', 'dev-bd': '🗄️',
  'dev-frontend': '🎨', 'dev-devops': '🚀', 'dev-testing': '🧪', 'dev-diseno': '✏️',
  'dev-documentador': '📚', 'dev-ciberseguridad': '🛡️', 'dev-redes': '🌐', 'dev-soporte': '🎧',
  'trans-investigador': '🔍',
};

export default async function ProyectoDetallePage({ params }: Props) {
  const { id } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  // Batch 1: proyecto + tareas (bitácora necesita los IDs de tareas primero)
  const [proyectoRes, requerimientosRes, tareasDirectasRes] = await Promise.all([
    supabase.from('proyectos').select(`*, areas_negocio ( nombre )`).eq('id', id).single(),
    supabase.from('requerimientos').select(`*, tareas ( * )`).eq('proyecto_id', id).order('creado_en', { ascending: false }),
    supabase.from('tareas')
      .select('id, agente_asignado, descripcion, estado, plan_ejecucion, notas, creado_en, iniciado_en, completado_en')
      .eq('proyecto_id', id)
      .order('creado_en', { ascending: false }),
  ]);

  if (!proyectoRes.data) notFound();

  // Recopilar todos los tarea_ids del proyecto para buscar bitácora
  // (ejecutarEspecialista inserta con tarea_id pero sin proyecto_id)
  const tareaIdsDirectas = ((tareasDirectasRes.data ?? []) as any[]).map((t: any) => t.id as string);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tareaIdsReqs = ((requerimientosRes.data ?? []) as any[])
    .flatMap((r: any) => ((r.tareas ?? []) as any[]).map((t: any) => t.id as string));
  const todosTareaIds = [...new Set([...tareaIdsDirectas, ...tareaIdsReqs])];

  // Batch 2: bitácora filtrada por proyecto_id O por tarea_id (cubre entradas sin proyecto_id)
  const orFilter = todosTareaIds.length > 0
    ? `proyecto_id.eq.${id},tarea_id.in.(${todosTareaIds.join(',')})`
    : `proyecto_id.eq.${id}`;

  const bitacoraRes = await supabase
    .from('bitacora_actividad')
    .select('id, agente, accion, creado_en, tarea_id')
    .or(orFilter)
    .order('creado_en', { ascending: false })
    .limit(500);

  const proyecto = proyectoRes.data;
  const requerimientos = requerimientosRes.data ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tareasDirectas: any[] = tareasDirectasRes.data ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bitacora: any[] = bitacoraRes.data ?? [];
  const areaNombre = (proyecto.areas_negocio as unknown as { nombre: string })?.nombre ?? '';

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
        <TareasProyectoList tareasDirectas={tareasDirectas} bitacora={bitacora} />
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
