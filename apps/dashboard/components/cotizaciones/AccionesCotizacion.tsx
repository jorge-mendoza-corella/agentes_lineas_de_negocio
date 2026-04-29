'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cambiarEstadoCotizacion, eliminarCotizacion } from '@/lib/actions/cotizaciones';

const TRANSICIONES: Record<string, { label: string; siguiente: string; color: string }[]> = {
  borrador:  [{ label: 'Marcar como enviada', siguiente: 'enviada', color: 'bg-blue-600 hover:bg-blue-700 text-white' }],
  enviada:   [
    { label: 'Marcar como aceptada',  siguiente: 'aceptada',  color: 'bg-green-600 hover:bg-green-700 text-white' },
    { label: 'Marcar como rechazada', siguiente: 'rechazada', color: 'bg-red-100 hover:bg-red-200 text-red-700' },
  ],
  aceptada:  [],
  rechazada: [{ label: 'Volver a borrador', siguiente: 'borrador', color: 'bg-gray-200 hover:bg-gray-300 text-gray-700' }],
};

export default function AccionesCotizacion({ id, estado }: { id: string; estado: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const transiciones = TRANSICIONES[estado] ?? [];

  function cambiar(siguiente: string) {
    startTransition(async () => {
      await cambiarEstadoCotizacion(id, siguiente);
      router.refresh();
    });
  }

  function eliminar() {
    if (!confirm('¿Eliminar esta cotización? Esta acción no se puede deshacer.')) return;
    startTransition(async () => { await eliminarCotizacion(id); });
  }

  if (transiciones.length === 0 && estado !== 'borrador') return null;

  return (
    <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-200 px-5 py-4">
      <div className="flex gap-2">
        {transiciones.map(t => (
          <button
            key={t.siguiente}
            onClick={() => cambiar(t.siguiente)}
            disabled={isPending}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 ${t.color}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {estado === 'borrador' && (
        <button
          onClick={eliminar}
          disabled={isPending}
          className="text-sm text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          Eliminar cotización
        </button>
      )}
    </div>
  );
}
