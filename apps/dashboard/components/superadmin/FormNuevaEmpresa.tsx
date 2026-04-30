'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface Modulo { id: string; nombre: string; icono: string | null }
interface ModuloServicio { modulo_id: string; servicio_id: string }

interface Props {
  modulos: Modulo[];
  moduloServicios: ModuloServicio[];
}

function generarSlug(nombre: string) {
  return nombre
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function mensajeError(raw: string): string {
  if (raw.includes('empresas_slug_key') || raw.includes('empresas_nombre_key')) {
    return 'Ya existe una empresa registrada con ese nombre. Elige un nombre diferente.';
  }
  if (raw.includes('unique constraint')) {
    return 'Ya existe un registro con esos datos. Verifica el nombre e intenta de nuevo.';
  }
  if (raw.includes('violates foreign key')) {
    return 'Error de referencia en la base de datos. Recarga la página e intenta de nuevo.';
  }
  if (raw.includes('not-null')) {
    return 'Faltan datos requeridos. Completa todos los campos obligatorios.';
  }
  return 'Ocurrió un error al guardar. Intenta de nuevo en unos momentos.';
}

export default function FormNuevaEmpresa({ modulos, moduloServicios }: Props) {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [modulosSel, setModulosSel] = useState<string[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [slugError, setSlugError] = useState('');
  const [verificando, setVerificando] = useState(false);
  const supabase = createClient();

  const slug = generarSlug(nombre);

  function toggleModulo(id: string) {
    setModulosSel(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  async function verificarSlugDisponible() {
    if (!nombre.trim()) return;
    setVerificando(true);
    setSlugError('');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('empresas')
      .select('id')
      .eq('slug', slug)
      .maybeSingle() as { data: { id: string } | null };
    setVerificando(false);
    if (data) {
      setSlugError('Ya existe una empresa con ese nombre. Elige un nombre diferente.');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (slugError) return;
    if (modulosSel.length === 0) {
      setError('Selecciona al menos un módulo habilitado para esta empresa.');
      return;
    }
    setCargando(true);
    setError('');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;

    const { data: empresa, error: errEmpresa } = await sb
      .from('empresas')
      .insert({ nombre, slug, descripcion: descripcion || null })
      .select('id')
      .single() as { data: { id: string } | null; error: { message: string } | null };

    if (errEmpresa) {
      setError(mensajeError(errEmpresa.message));
      setCargando(false);
      return;
    }

    const { error: errMod } = await sb.from('empresa_servicios').insert(
      modulosSel.map((mid: string) => ({ empresa_id: empresa!.id, modulo_id: mid, activo: true }))
    );

    if (errMod) {
      setError(mensajeError((errMod as { message: string }).message));
      setCargando(false);
      return;
    }

    // Auto-contratar servicios de los módulos seleccionados
    const servicioIds = [...new Set(
      modulosSel.flatMap((mid: string) =>
        moduloServicios.filter(ms => ms.modulo_id === mid).map(ms => ms.servicio_id)
      )
    )];
    if (servicioIds.length > 0) {
      await sb.from('empresa_contratos').insert(
        servicioIds.map((sid: string) => ({ empresa_id: empresa!.id, servicio_id: sid, activo: true }))
      );
    }

    router.push(`/superadmin/empresas/${empresa!.id}`);
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
            onChange={e => { setNombre(e.target.value); setSlugError(''); }}
            onBlur={verificarSlugDisponible}
            placeholder="Ej: Inmobiliaria SOZU"
            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              slugError ? 'border-red-400 bg-red-50' : 'border-gray-300'
            }`}
          />
          {nombre && !slugError && (
            <p className="text-xs text-gray-400 mt-1">
              {verificando ? 'Verificando disponibilidad...' : `Slug: ${slug}`}
            </p>
          )}
          {slugError && (
            <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
              <span>⚠️</span> {slugError}
            </p>
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
          Módulos habilitados <span className="text-red-500">*</span>
          <span className="text-xs font-normal text-gray-400 ml-2">¿A qué áreas de la plataforma tendrá acceso?</span>
        </label>
        {modulos.length === 0 ? (
          <p className="text-sm text-gray-400 italic">
            No hay módulos configurados.{' '}
            <a href="/superadmin/modulos" className="text-blue-500 hover:underline">Crear módulos →</a>
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {modulos.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => toggleModulo(m.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors capitalize ${
                  modulosSel.includes(m.id)
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {m.icono && `${m.icono} `}{m.nombre}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm bg-red-50 text-red-700 px-3 py-2 rounded-lg flex items-start gap-2">
          <span className="mt-0.5">⚠️</span>
          <span>{error}</span>
        </p>
      )}

      <button
        type="submit"
        disabled={cargando || modulosSel.length === 0 || !!slugError}
        className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {cargando ? 'Creando...' : 'Crear empresa'}
      </button>
    </form>
  );
}
