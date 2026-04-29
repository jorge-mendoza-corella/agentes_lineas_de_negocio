import Link from 'next/link';

interface Empresa {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string | null;
  activa: boolean;
  created_at: string;
  empresa_servicios: { servicio: string; activo: boolean }[];
}

interface Props {
  empresas: Empresa[];
}

export default function TablaEmpresas({ empresas }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">
          Empresas registradas ({empresas.length})
        </h2>
      </div>
      <div className="divide-y divide-gray-100">
        {empresas.map(e => (
          <Link
            key={e.id}
            href={`/superadmin/empresas/${e.id}`}
            className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-gray-50 transition-colors"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-gray-900">{e.nombre}</p>
                {!e.activa && (
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">
                    Inactiva
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {e.descripcion ?? e.slug}
              </p>
            </div>
            <div className="flex flex-wrap gap-1 justify-end">
              {e.empresa_servicios
                .filter(s => s.activo)
                .map(s => (
                  <span
                    key={s.servicio}
                    className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full capitalize"
                  >
                    {s.servicio}
                  </span>
                ))}
            </div>
          </Link>
        ))}
        {empresas.length === 0 && (
          <div className="text-center py-12 text-sm text-gray-400">
            No hay empresas registradas todavía
          </div>
        )}
      </div>
    </div>
  );
}
