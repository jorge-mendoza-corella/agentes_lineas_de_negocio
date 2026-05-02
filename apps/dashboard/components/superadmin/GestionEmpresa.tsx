'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toggleModuloEmpresa } from '@/lib/actions/modulos';

interface Modulo { id: string; nombre: string; icono: string | null }
interface ModuloActivo { id: string; modulo_id: string; activo: boolean }
interface ModuloServicio { modulo_id: string; servicio_id: string }

interface Props {
  empresa: {
    id: string;
    nombre: string;
    slug: string;
    descripcion: string | null;
    activa: boolean;
  };
  modulos: Modulo[];
  modulosActivos: ModuloActivo[];
  moduloServicios: ModuloServicio[];
  usuarios: {
    id: string;
    nombre: string;
    email: string;
    rol: string;
    stakeholder_areas: { area: string }[];
  }[];
}

export default function GestionEmpresa({
  empresa, modulos, modulosActivos, moduloServicios, usuarios,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activando, setActivando] = useState<string | null>(null);

  const modulosActivosSet = new Set(
    modulosActivos.filter(m => m.activo).map(m => m.modulo_id)
  );

  function handleToggle(moduloId: string) {
    const activar = !modulosActivosSet.has(moduloId);
    const servicioIds = moduloServicios
      .filter(ms => ms.modulo_id === moduloId)
      .map(ms => ms.servicio_id);

    setActivando(moduloId);
    startTransition(async () => {
      await toggleModuloEmpresa(empresa.id, moduloId, activar, servicioIds);
      setActivando(null);
      router.refresh();
    });
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

      {/* Módulos habilitados */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Módulos habilitados</h2>
        <p className="text-xs text-gray-400 mb-4">
          Acceso a áreas de la plataforma.{' '}
          <a href="/superadmin/modulos" className="text-blue-500 hover:underline">Configurar módulos →</a>
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {modulos.map(m => {
            const activo = modulosActivosSet.has(m.id);
            const cargando = activando === m.id && isPending;
            const serviciosCount = moduloServicios.filter(ms => ms.modulo_id === m.id).length;
            return (
              <button
                key={m.id}
                onClick={() => handleToggle(m.id)}
                disabled={cargando}
                className={`p-3 rounded-xl border-2 text-sm font-medium text-left transition-all capitalize ${
                  activo
                    ? 'border-blue-400 bg-blue-50 text-blue-800'
                    : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                } disabled:opacity-50`}
              >
                <span className="block text-lg mb-1">
                  {cargando ? '⏳' : activo ? '✅' : (m.icono ?? '⬜')}
                </span>
                <span className="block">{m.nombre}</span>
                {serviciosCount > 0 && (
                  <span className="block text-[10px] mt-0.5 opacity-60">
                    {serviciosCount} servicio{serviciosCount !== 1 ? 's' : ''}
                  </span>
                )}
              </button>
            );
          })}
          {modulos.length === 0 && (
            <p className="col-span-4 text-sm text-gray-400 italic">
              No hay módulos configurados.{' '}
              <a href="/superadmin/modulos" className="text-blue-500 hover:underline">Crear módulos →</a>
            </p>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Al habilitar un módulo, sus servicios se activan automáticamente para cotizaciones.
        </p>
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
