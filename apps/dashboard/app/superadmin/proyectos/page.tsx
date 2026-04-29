import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import FormNuevoProyecto from '@/components/proyectos/FormNuevoProyecto';

const BADGE_ESTADO: Record<string, string> = {
  activo: 'bg-green-100 text-green-700',
  pausado: 'bg-yellow-100 text-yellow-700',
  cerrado: 'bg-gray-100 text-gray-500',
};

export default async function ProyectosPage() {
  const supabase = await createClient();

  const [{ data: areas }, { data: proyectos }] = await Promise.all([
    supabase.from('areas_negocio').select('id, nombre, pm_agente, es_servicio').order('nombre'),
    supabase
      .from('proyectos')
      .select(`
        id, nombre, descripcion, estado, creado_en,
        areas_negocio ( nombre ),
        requerimientos ( id, estado )
      `)
      .order('creado_en', { ascending: false }),
  ]);

  const porArea = (areas ?? []).map(area => ({
    ...area,
    proyectos: (proyectos ?? []).filter(p =>
      (p.areas_negocio as unknown as { nombre: string })?.nombre === area.nombre
    ),
  }));

  const total = proyectos?.length ?? 0;
  const activos = proyectos?.filter(p => p.estado === 'activo').length ?? 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Proyectos</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total} proyectos &middot; {activos} activos
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Nuevo proyecto</h2>
        <FormNuevoProyecto areas={areas ?? []} />
      </div>

      {porArea.filter(a => a.proyectos.length > 0).map(area => (
        <div key={area.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
              {area.nombre}
            </span>
            {area.es_servicio && (
              <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full">servicio</span>
            )}
            <span className="ml-auto text-xs text-gray-400">{area.proyectos.length} proyectos</span>
          </div>
          <div className="divide-y divide-gray-50">
            {area.proyectos.map(p => {
              const reqs = (p.requerimientos as { id: string; estado: string }[]) ?? [];
              const completados = reqs.filter(r => r.estado === 'completado').length;
              return (
                <Link
                  key={p.id}
                  href={`/superadmin/proyectos/${p.id}`}
                  className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{p.nombre}</p>
                    {p.descripcion && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate max-w-md">{p.descripcion}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {reqs.length > 0 && (
                      <span className="text-xs text-gray-400">
                        {completados}/{reqs.length} reqs
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${BADGE_ESTADO[p.estado] ?? ''}`}>
                      {p.estado}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ))}

      {total === 0 && (
        <div className="text-center py-16 text-sm text-gray-400">
          Aún no hay proyectos. Crea el primero arriba.
        </div>
      )}
    </div>
  );
}
