'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const AREAS = ['ventas', 'finanzas', 'marketing', 'cobranza', 'contabilidad', 'escrituracion', 'postventa', 'desarrollo'];

interface Props {
  empresas: { id: string; nombre: string }[];
  empresaIdInicial?: string;
}

export default function FormInvitarStakeholder({ empresas, empresaIdInicial }: Props) {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [empresaId, setEmpresaId] = useState(empresaIdInicial ?? '');
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
    if (!empresaId) {
      setMensaje('Selecciona la empresa del stakeholder.');
      return;
    }
    setCargando(true);
    setMensaje('');

    const { error } = await supabase.functions.invoke('invitar-stakeholder', {
      body: { nombre, email, areas, empresa_id: empresaId },
    });

    if (error) {
      setMensaje('Error al invitar. Verifica el email e intenta de nuevo.');
    } else {
      setMensaje(`✅ Invitación enviada a ${email}`);
      setNombre('');
      setEmail('');
      setAreas([]);
      if (!empresaIdInicial) setEmpresaId('');
    }
    setCargando(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Empresa <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={empresaId}
            onChange={(e) => setEmpresaId(e.target.value)}
            disabled={!!empresaIdInicial}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
          >
            <option value="">— Seleccionar empresa —</option>
            {empresas.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Áreas que puede ver <span className="text-red-500">*</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {AREAS.map((area) => (
            <button
              key={area}
              type="button"
              onClick={() => toggleArea(area)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors capitalize ${
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
        disabled={cargando || areas.length === 0 || !empresaId}
        className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {cargando ? 'Enviando...' : 'Invitar stakeholder'}
      </button>
    </form>
  );
}
