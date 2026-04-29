'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface Area    { id: string; nombre: string }
interface Empresa { id: string; nombre: string }

interface Props {
  areas: Area[];
  empresas: Empresa[];
}

export default function FormNuevoProyecto({ areas, empresas }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [areaId, setAreaId] = useState('');
  const [empresaId, setEmpresaId] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError('');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: err } = await (supabase as any)
      .from('proyectos')
      .insert({
        nombre,
        descripcion: descripcion || null,
        area_negocio_id: areaId || null,
        empresa_id: empresaId || null,
        repo_url: repoUrl || null,
      })
      .select('id')
      .single() as { data: { id: string } | null; error: { message: string } | null };

    if (err) { setError(err.message); setCargando(false); return; }
    router.push(`/superadmin/proyectos/${data!.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
        <input
          required
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          placeholder="Ej: Dashboard de cobranza"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Área <span className="text-gray-400 font-normal">(opcional)</span></label>
        <select
          value={areaId}
          onChange={e => setAreaId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Sin área asignada</option>
          {areas.map(a => (
            <option key={a.id} value={a.id}>{a.nombre}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Empresa</label>
        <select
          value={empresaId}
          onChange={e => setEmpresaId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Sin empresa asignada</option>
          {empresas.map(emp => (
            <option key={emp.id} value={emp.id}>{emp.nombre}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">URL del repo</label>
        <input
          value={repoUrl}
          onChange={e => setRepoUrl(e.target.value)}
          placeholder="https://github.com/org/repo"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
        <input
          value={descripcion}
          onChange={e => setDescripcion(e.target.value)}
          placeholder="Descripción breve del proyecto"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {error && <p className="md:col-span-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      <div className="md:col-span-2">
        <button
          type="submit"
          disabled={cargando}
          className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
        >
          {cargando ? 'Creando...' : 'Crear proyecto'}
        </button>
      </div>
    </form>
  );
}
