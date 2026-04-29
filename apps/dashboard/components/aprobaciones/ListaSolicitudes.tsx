import Link from 'next/link';
import BadgeEstado from '@/components/ui/BadgeEstado';
import type { EstadoSolicitud } from '@agentes/shared';

interface Solicitud {
  id: string;
  titulo: string;
  area: string;
  estado: string;
  created_at: string;
}

interface Props {
  solicitudes: Solicitud[];
}

export default function ListaSolicitudes({ solicitudes }: Props) {
  return (
    <div className="space-y-3">
      {solicitudes.map((s) => (
        <Link
          key={s.id}
          href={`/aprobaciones/${s.id}`}
          className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{s.titulo}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {s.area} · {new Date(s.created_at).toLocaleDateString('es-MX')}
              </p>
            </div>
            <BadgeEstado estado={s.estado as EstadoSolicitud} />
          </div>
        </Link>
      ))}
    </div>
  );
}
