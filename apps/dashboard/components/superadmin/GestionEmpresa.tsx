'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { ServicioEmpresa } from '@agentes/shared';

const TODOS_SERVICIOS: ServicioEmpresa[] = [
  'desarrollo', 'finanzas', 'contabilidad', 'marketing',
  'cobranza', 'escrituracion', 'postventa', 'rrhh',
];

interface Props {
  empresa: {
    id: string;
    nombre: string;
    slug: string;
    descripcion: string | null;
    activa: boolean;
  };
  servicios: { id: string; servicio: string; activo: boolean }[];
  usuarios: {
    id: string;
    nombre: string;
    email: string;
    rol: string;
    stakeholder_areas: { area: string }[];
  }[];
}

export default function GestionEmpresa({ empresa, servicios, usuarios }: Props) {
  const supabase = createClient();
  const [activando, setActivando] = useState<string | null>(null);

  const serviciosActivos = new Set(
    servicios.filter(s => s.activo).map(s => s.servicio)
  );

  async function toggleServicio(servicio: ServicioEmpresa) {
    setActivando(servicio);
    const existente = servicios.find(s => s.servicio === servicio);

    if (existente) {
      await supabase
        .from('empresa_servicios')
        .update({ activo: !existente.activo })
        .eq('id', existente.id);
    } else {
      await supabase.from('empresa_servicios').insert({
        empresa_id: empresa.id,
        servicio,
        activo: true,
      });
    }
    setActivando(null);
    window.location.reload();
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{empresa.nombre}</h1>
          {empresa.descripcion && (
            <p className="text-sm text-gray-500 mt-1">{empresa.descripcion}</p>
          )}
          <p className="text-xs text-gray-400 mt-1">slug: {empresa.slug}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
          empresa.activa ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
        }`}>
          {empresa.activa ? 'Activa' : 'Inactiva'}
        </span>
      </div>

      {/* Servicios contratados */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Servicios contratados</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {TODOS_SERVICIOS.map(s => {
            const activo = serviciosActivos.has(s);
            return (
              <button
                key={s}
                onClick={() => toggleServicio(s)}
                disabled={activando === s}
                className={`p-3 rounded-xl border-2 text-sm font-medium text-left transition-all capitalize ${
                  activo
                    ? 'border-blue-400 bg-blue-50 text-blue-800'
                    : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                } disabled:opacity-50`}
              >
                <span className="block text-lg mb-1">
                  {activo ? '✅' : '⬜'}
                </span>
                {s}
              </button>
            );
          })}
        </div>
      </div>

      {/* Usuarios */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            Usuarios ({usuarios.length})
          </h2>
          <a
            href={`/superadmin/stakeholders?empresa=${empresa.id}`}
            className="text-sm text-blue-600 hover:underline"
          >
            + Invitar usuario
          </a>
        </div>
        <div className="divide-y divide-gray-100">
          {usuarios.map(u => (
            <div key={u.id} className="px-6 py-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">{u.nombre}</p>
                <p className="text-xs text-gray-400">{u.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  u.rol === 'empresa_admin'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {u.rol === 'empresa_admin' ? 'Admin' : 'Stakeholder'}
                </span>
                {u.stakeholder_areas.map(({ area }) => (
                  <span key={area} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">
                    {area}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {usuarios.length === 0 && (
            <div className="text-center py-10 text-sm text-gray-400">
              No hay usuarios en esta empresa todavía
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
