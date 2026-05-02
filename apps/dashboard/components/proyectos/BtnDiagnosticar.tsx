'use client';

import { useState, useTransition } from 'react';
import { diagnosticarYReparar } from '@/lib/actions/tareas';

export default function BtnDiagnosticar({ tareaId }: { tareaId: string }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);

  if (done) return (
    <span className="text-xs text-emerald-600 font-medium px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200">
      ✓ Diagnóstico enviado
    </span>
  );

  return (
    <button
      disabled={pending}
      onClick={() => start(async () => { await diagnosticarYReparar(tareaId); setDone(true); })}
      className="text-xs font-semibold px-2.5 py-1 rounded-full transition-all"
      style={{ background: pending ? 'rgba(234,179,8,0.1)' : 'rgba(234,179,8,0.12)', color: '#b45309', border: '1px solid rgba(234,179,8,0.3)', opacity: pending ? 0.6 : 1 }}>
      {pending ? '🔍 Diagnosticando...' : '🔧 Diagnosticar y reparar'}
    </button>
  );
}
