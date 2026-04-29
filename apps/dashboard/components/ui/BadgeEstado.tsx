import type { EstadoSolicitud } from '@agentes/shared';
import { clsx } from 'clsx';

interface Props {
  estado: EstadoSolicitud;
}

const estilos: Record<EstadoSolicitud, string> = {
  pendiente:    'bg-yellow-100 text-yellow-800',
  en_revision:  'bg-blue-100 text-blue-800',
  aprobada:     'bg-green-100 text-green-800',
  rechazada:    'bg-red-100 text-red-800',
  cancelada:    'bg-gray-100 text-gray-600',
};

const etiquetas: Record<EstadoSolicitud, string> = {
  pendiente:    'Pendiente',
  en_revision:  'En revisión',
  aprobada:     'Aprobada',
  rechazada:    'Rechazada',
  cancelada:    'Cancelada',
};

export default function BadgeEstado({ estado }: Props) {
  return (
    <span className={clsx('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap', estilos[estado])}>
      {etiquetas[estado]}
    </span>
  );
}
