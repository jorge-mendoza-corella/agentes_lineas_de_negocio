import Link from 'next/link';
import BadgeEstado from '@/components/ui/BadgeEstado';
import type { EstadoSolicitud } from '@agentes/shared';

interface Solicitud {
  id: string;
  titulo: string;
  area: string;
  estado: string;
  created_at: string;
  perfiles: { nombre: string; email: string } | null;
}

interface Props {
  solicitudes: Solicitud[];
}

export default function TablaAprobaciones({ solicitudes }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">Todas las solicitudes</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <th className="px-6 py-3">Solicitud</th>
              <th className="px-6 py-3">Área</th>
              <th className="px-6 py-3">Stakeholder</th>
              <th className="px-6 py-3">Estado</th>
              <th className="px-6 py-3">Fecha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {solicitudes.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <Link href={`/aprobaciones/${s.id}`} className="font-medium text-blue-600 hover:underline">
                    {s.titulo}
                  </Link>
                </td>
                <td className="px-6 py-4 text-gray-600">{s.area}</td>
                <td className="px-6 py-4">
                  {s.perfiles ? (
                    <div>
                      <p className="font-medium text-gray-900">{s.perfiles.nombre}</p>
                      <p className="text-xs text-gray-400">{s.perfiles.email}</p>
                    </div>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <BadgeEstado estado={s.estado as EstadoSolicitud} />
                </td>
                <td className="px-6 py-4 text-gray-500">
                  {new Date(s.created_at).toLocaleDateString('es-MX')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {solicitudes.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">No hay solicitudes todavía</div>
        )}
      </div>
    </div>
  );
}
