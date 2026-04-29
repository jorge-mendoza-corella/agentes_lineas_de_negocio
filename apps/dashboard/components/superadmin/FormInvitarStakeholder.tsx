'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const AREAS = ['ventas', 'finanzas', 'marketing', 'cobranza', 'contabilidad', 'escrituracion', 'postventa', 'desarrollo'];

export default function FormInvitarStakeholder() {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [areas, setAreas] = useState<string[]>([]);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const supabase = createClient();

  function toggleArea(area: string) {
    setAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setMensaje('');

    // Invitar usuario con magic link via Supabase Admin API (edge function)
    const { error } = await supabase.functions.invoke('invitar-stakeholder', {
      body: { nombre, email, areas },
    });

    if (error) {
      setMensaje('Error al invitar. Verifica el email e intenta de nuevo.');
    } else {
      setMensaje(`✅ Invitación enviada a ${email}`);
      setNombre('');
      setEmail('');
      setAreas([]);
    }
    setCargando(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
          <input
            type="text"
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre completo"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="stakeholder@empresa.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Áreas que puede ver
        </label>
        <div className="flex flex-wrap gap-2">
          {AREAS.map((area) => (
            <button
              key={area}
              type="button"
              onClick={() => toggleArea(area)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                areas.includes(area)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {area}
            </button>
          ))}
        </div>
      </div>

      {mensaje && (
        <p className={`text-sm px-3 py-2 rounded-lg ${mensaje.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {mensaje}
        </p>
      )}

      <button
        type="submit"
        disabled={cargando || areas.length === 0}
        className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {cargando ? 'Enviando...' : 'Invitar stakeholder'}
      </button>
    </form>
  );
}
