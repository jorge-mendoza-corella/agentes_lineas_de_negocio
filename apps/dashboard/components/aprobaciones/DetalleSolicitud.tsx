import BadgeEstado from '@/components/ui/BadgeEstado';
import type { EstadoSolicitud } from '@agentes/shared';

interface Props {
  solicitud: {
    titulo: string;
    descripcion: string;
    area: string;
    estado: string;
    plan_detallado: Record<string, unknown>;
    created_at: string;
  };
}

export default function DetalleSolicitud({ solicitud }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{solicitud.titulo}</h1>
          <p className="text-sm text-gray-500 mt-1">Área: {solicitud.area}</p>
        </div>
        <BadgeEstado estado={solicitud.estado as EstadoSolicitud} />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Descripción</h2>
        <p className="text-sm text-gray-600 leading-relaxed">{solicitud.descripcion}</p>
      </div>

      {Object.keys(solicitud.plan_detallado).length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Plan detallado</h2>
          <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs text-gray-700 overflow-auto whitespace-pre-wrap">
            {JSON.stringify(solicitud.plan_detallado, null, 2)}
          </pre>
        </div>
      )}

      <p className="text-xs text-gray-400">
        Recibida el {new Date(solicitud.created_at).toLocaleDateString('es-MX', {
          day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
        })}
      </p>
    </div>
  );
}
