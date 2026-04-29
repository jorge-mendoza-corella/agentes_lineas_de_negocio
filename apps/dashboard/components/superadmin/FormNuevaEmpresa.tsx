'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { ServicioEmpresa } from '@agentes/shared';

const SERVICIOS: ServicioEmpresa[] = [
  'desarrollo', 'finanzas', 'contabilidad', 'marketing',
  'cobranza', 'escrituracion', 'postventa', 'rrhh',
];

export default function FormNuevaEmpresa() {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [servicios, setServicios] = useState<ServicioEmpresa[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const supabase = createClient();

  function toggleServicio(s: ServicioEmpresa) {
    setServicios(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  }

  function generarSlug(nombre: string) {
    return nombre
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (servicios.length === 0) {
      setError('Selecciona al menos un servicio');
      return;
    }
    setCargando(true);
    setError('');

    const slug = generarSlug(nombre);

    const { data: empresa, error: errEmpresa } = await supabase
      .from('empresas')
      .insert({ nombre, slug, descripcion: descripcion || null })
      .select('id')
      .single();

    if (errEmpresa) {
      setError(errEmpresa.message);
      setCargando(false);
      return;
    }

    const serviciosRows = servicios.map(s => ({
      empresa_id: empresa.id,
      servicio: s,
      activo: true,
    }));

    const { error: errServ } = await supabase.from('empresa_servicios').insert(serviciosRows);

    if (errServ) {
      setError(errServ.message);
      setCargando(false);
      return;
    }

    router.push(`/superadmin/empresas/${empresa.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nombre de la empresa
          </label>
          <input
            type="text"
            required
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder="Ej: Inmobiliaria SOZU"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {nombre && (
            <p className="text-xs text-gray-400 mt-1">Slug: {generarSlug(nombre)}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Descripción (opcional)
          </label>
          <input
            type="text"
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            placeholder="Breve descripción del cliente"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Servicios contratados <span className="text-red-500">*</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {SERVICIOS.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => toggleServicio(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors capitalize ${
                servicios.includes(s)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-sm bg-red-50 text-red-700 px-3 py-2 rounded-lg">{error}</p>
      )}

      <button
        type="submit"
        disabled={cargando || servicios.length === 0}
        className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {cargando ? 'Creando...' : 'Crear empresa'}
      </button>
    </form>
  );
}
