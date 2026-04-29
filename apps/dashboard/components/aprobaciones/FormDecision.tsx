'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface Props {
  solicitudId: string;
}

type Decision = 'aprobada' | 'rechazada' | 'solicitar_cambios';

export default function FormDecision({ solicitudId }: Props) {
  const router = useRouter();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [comentarios, setComentarios] = useState('');
  const [cargando, setCargando] = useState(false);
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!decision) return;
    setCargando(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('aprobaciones').insert({
      solicitud_id: solicitudId,
      stakeholder_id: user.id,
      decision,
      comentarios: comentarios || null,
    });

    if (!error) {
      await supabase
        .from('solicitudes_aprobacion')
        .update({ estado: decision === 'solicitar_cambios' ? 'en_revision' : decision })
        .eq('id', solicitudId);

      router.push('/aprobaciones');
      router.refresh();
    }
    setCargando(false);
  }

  const opciones: { valor: Decision; etiqueta: string; clase: string }[] = [
    { valor: 'aprobada', etiqueta: '✅ Aprobar', clase: 'border-green-400 bg-green-50 text-green-800' },
    { valor: 'solicitar_cambios', etiqueta: '🔄 Solicitar cambios', clase: 'border-yellow-400 bg-yellow-50 text-yellow-800' },
    { valor: 'rechazada', etiqueta: '❌ Rechazar', clase: 'border-red-400 bg-red-50 text-red-800' },
  ];

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
      <h2 className="text-base font-semibold text-gray-900">Tu decisión</h2>

      <div className="grid grid-cols-3 gap-3">
        {opciones.map((op) => (
          <button
            key={op.valor}
            type="button"
            onClick={() => setDecision(op.valor)}
            className={`py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all ${
              decision === op.valor ? op.clase + ' ring-2 ring-offset-1' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {op.etiqueta}
          </button>
        ))}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Comentarios {decision !== 'aprobada' && <span className="text-red-500">*</span>}
        </label>
        <textarea
          value={comentarios}
          onChange={(e) => setComentarios(e.target.value)}
          rows={4}
          required={decision !== 'aprobada'}
          placeholder="Explica tu decisión o qué cambios necesitas..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={!decision || cargando}
        className="w-full bg-blue-600 text-white py-2.5 px-4 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {cargando ? 'Enviando...' : 'Confirmar decisión'}
      </button>
    </form>
  );
}
