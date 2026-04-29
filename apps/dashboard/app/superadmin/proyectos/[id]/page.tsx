import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import KanbanTareas from '@/components/proyectos/KanbanTareas';
import FormNuevoRequerimiento from '@/components/proyectos/FormNuevoRequerimiento';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProyectoDetallePage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: proyecto } = await supabase
    .from('proyectos')
    .select(`*, areas_negocio ( nombre )`)
    .eq('id', id)
    .single();

  if (!proyecto) notFound();

  const { data: requerimientos } = await supabase
    .from('requerimientos')
    .select(`*, tareas ( * )`)
    .eq('proyecto_id', id)
    .order('creado_en', { ascending: false });

  const { data: bitacora } = await supabase
    .from('bitacora_actividad')
    .select('id, agente, accion, creado_en, payload')
    .eq('proyecto_id', id)
    .order('creado_en', { ascending: false })
    .limit(20);

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
            <a
              href={proyecto.repo_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline mt-1 inline-block"
            >
              {proyecto.repo_url}
            </a>
          )}
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
          proyecto.estado === 'activo' ? 'bg-green-100 text-green-700'
          : proyecto.estado === 'pausado' ? 'bg-yellow-100 text-yellow-700'
          : 'bg-gray-100 text-gray-500'
        }`}>
          {proyecto.estado}
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Agregar requerimiento</h2>
        <FormNuevoRequerimiento proyectoId={id} />
      </div>

      <KanbanTareas requerimientos={requerimientos ?? []} proyectoId={id} />

      {(bitacora ?? []).length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Bitácora</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {bitacora!.map(b => (
              <div key={b.id} className="px-6 py-3 flex items-start gap-3">
                <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded shrink-0">
                  {b.agente}
                </span>
                <p className="text-sm text-gray-700 flex-1">{b.accion}</p>
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
