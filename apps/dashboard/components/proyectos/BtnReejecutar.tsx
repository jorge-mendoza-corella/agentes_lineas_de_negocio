'use client';

import { useTransition } from 'react';
import { reejecutarTarea } from '@/lib/actions/tareas';

export default function BtnReejecutar({ tareaId }: { tareaId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      onClick={() => startTransition(() => reejecutarTarea(tareaId))}
      disabled={isPending}
      className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors font-medium"
    >
      {isPending ? '⏳ Iniciando...' : '▶ Re-ejecutar'}
    </button>
  );
}
