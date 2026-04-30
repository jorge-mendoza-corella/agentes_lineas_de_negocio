'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const AGENTES = [
  'dev-analista','dev-backend','dev-bd','dev-ciberseguridad','dev-devops',
  'dev-diseno','dev-documentador','dev-frontend','dev-imagenes','dev-pm',
  'dev-presentaciones','dev-redes','dev-seguridad','dev-soporte',
  'dev-testing','dev-videojuegos',
];

interface Props { proyectoId: string }

export default function FormNuevoRequerimiento({ proyectoId }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [prioridad, setPrioridad] = useState<'baja'|'media'|'alta'|'critica'>('media');
  const [agente, setAgente] = useState('dev-pm');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError('');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const { data: req, error: errReq } = await sb
      .from('requerimientos')
      .insert({ titulo, descripcion: descripcion || null, prioridad, proyecto_id: proyectoId })
      .select('id')
      .single() as { data: { id: string } | null; error: { message: string } | null };

    if (errReq) { setError(errReq.message); setCargando(false); return; }

    const { error: errTarea } = await sb.from('tareas').insert({
      requerimiento_id: req!.id,
      agente_asignado: agente,
      descripcion: titulo,
    }) as { error: { message: string } | null };

    if (errTarea) { setError(errTarea.message); setCargando(false); return; }

    setTitulo(''); setDescripcion(''); setPrioridad('media'); setAgente('dev-pm');
    setCargando(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
        <input
          required
          value={titulo}
          onChange={e => setTitulo(e.target.value)}
          placeholder="Ej: Implementar módulo de login"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
        <select
          value={prioridad}
          onChange={e => setPrioridad(e.target.value as typeof prioridad)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="baja">Baja</option>
          <option value="media">Media</option>
          <option value="alta">Alta</option>
          <option value="critica">Crítica</option>
        </select>
      </div>
      <div className="md:col-span-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
        <input
          value={descripcion}
          onChange={e => setDescripcion(e.target.value)}
          placeholder="Detalle adicional..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Agente asignado</label>
        <select
          value={agente}
          onChange={e => setAgente(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {AGENTES.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      {error && <p className="md:col-span-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      <div>
        <button
          type="submit"
          disabled={cargando}
          className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
        >
          {cargando ? 'Agregando...' : 'Agregar'}
        </button>
      </div>
    </form>
  );
}
