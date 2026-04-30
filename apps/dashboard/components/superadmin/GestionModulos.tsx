'use client';

import { useState, useTransition } from 'react';
import {
  crearModulo,
  actualizarModulo,
  toggleModuloActivo,
  setServiciosModulo,
} from '@/lib/actions/modulos';

interface Servicio { id: string; nombre: string; icono: string | null }

interface Modulo {
  id: string;
  nombre: string;
  descripcion: string | null;
  icono: string | null;
  activo: boolean;
  orden: number;
  servicios: Servicio[];
}

interface Props {
  modulos: Modulo[];
  todosServicios: Servicio[];
}

export default function GestionModulos({ modulos: modulosIniciales, todosServicios }: Props) {
  const [modulos, setModulos] = useState(modulosIniciales);
  const [mostrando, setMostrando] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [gestionandoId, setGestionandoId] = useState<string | null>(null);
  const [serviciosSel, setServiciosSel] = useState<Set<string>>(new Set());
  const [nuevoForm, setNuevoForm] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoIcono, setNuevoIcono] = useState('');
  const [nuevoDescripcion, setNuevoDescripcion] = useState('');
  const [editNombre, setEditNombre] = useState('');
  const [editIcono, setEditIcono] = useState('');
  const [editDescripcion, setEditDescripcion] = useState('');
  const [isPending, startTransition] = useTransition();

  function abrirGestion(modulo: Modulo) {
    setGestionandoId(modulo.id);
    setServiciosSel(new Set(modulo.servicios.map(s => s.id)));
  }

  function cerrarGestion() {
    setGestionandoId(null);
    setServiciosSel(new Set());
  }

  function abrirEditar(modulo: Modulo) {
    setEditando(modulo.id);
    setEditNombre(modulo.nombre);
    setEditIcono(modulo.icono ?? '');
    setEditDescripcion(modulo.descripcion ?? '');
  }

  function handleCrear(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevoNombre.trim()) return;
    startTransition(async () => {
      await crearModulo(nuevoNombre, nuevoIcono, nuevoDescripcion);
      setNuevoNombre(''); setNuevoIcono(''); setNuevoDescripcion('');
      setNuevoForm(false);
      window.location.reload();
    });
  }

  function handleEditar(id: string) {
    startTransition(async () => {
      await actualizarModulo(id, {
        nombre: editNombre.trim().toLowerCase(),
        icono: editIcono.trim() || undefined,
        descripcion: editDescripcion.trim() || undefined,
      });
      setEditando(null);
      window.location.reload();
    });
  }

  function handleToggle(id: string, activo: boolean) {
    startTransition(async () => {
      await toggleModuloActivo(id, activo);
      setModulos(prev => prev.map(m => m.id === id ? { ...m, activo } : m));
    });
  }

  function handleGuardarServicios(moduloId: string) {
    startTransition(async () => {
      await setServiciosModulo(moduloId, Array.from(serviciosSel));
      cerrarGestion();
      window.location.reload();
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Módulos de la plataforma</h1>
          <p className="text-sm text-gray-500 mt-1">
            Define qué módulos (áreas de negocio) ofrece la plataforma y qué servicios incluye cada uno.
          </p>
        </div>
        <button
          onClick={() => setNuevoForm(v => !v)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
        >
          {nuevoForm ? 'Cancelar' : '+ Nuevo módulo'}
        </button>
      </div>

      {/* Form nuevo módulo */}
      {nuevoForm && (
        <form onSubmit={handleCrear} className="bg-white rounded-2xl border border-blue-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-800">Nuevo módulo</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
              <input
                required
                value={nuevoNombre}
                onChange={e => setNuevoNombre(e.target.value)}
                placeholder="ej: crm"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Icono (emoji)</label>
              <input
                value={nuevoIcono}
                onChange={e => setNuevoIcono(e.target.value)}
                placeholder="ej: 🤝"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
              <input
                value={nuevoDescripcion}
                onChange={e => setNuevoDescripcion(e.target.value)}
                placeholder="Descripción breve"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Creando...' : 'Crear módulo'}
          </button>
        </form>
      )}

      {/* Lista de módulos */}
      <div className="space-y-3">
        {modulos.map(modulo => {
          const estaGestionando = gestionandoId === modulo.id;
          const estaEditando = editando === modulo.id;
          const estaExpandido = mostrando === modulo.id;

          return (
            <div
              key={modulo.id}
              className={`bg-white rounded-2xl border overflow-hidden transition-colors ${
                modulo.activo ? 'border-gray-200' : 'border-gray-100 opacity-60'
              }`}
            >
              {/* Header del módulo */}
              <div className="px-5 py-4 flex items-center gap-4">
                <span className="text-2xl w-8 text-center">{modulo.icono ?? '📦'}</span>
                {estaEditando ? (
                  <div className="flex-1 grid grid-cols-3 gap-3">
                    <input
                      value={editNombre}
                      onChange={e => setEditNombre(e.target.value)}
                      placeholder="nombre"
                      className="px-2 py-1 border border-gray-300 rounded-lg text-sm"
                    />
                    <input
                      value={editIcono}
                      onChange={e => setEditIcono(e.target.value)}
                      placeholder="icono"
                      className="px-2 py-1 border border-gray-300 rounded-lg text-sm"
                    />
                    <input
                      value={editDescripcion}
                      onChange={e => setEditDescripcion(e.target.value)}
                      placeholder="descripción"
                      className="px-2 py-1 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                ) : (
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 capitalize">{modulo.nombre}</p>
                    {modulo.descripcion && (
                      <p className="text-xs text-gray-400 truncate">{modulo.descripcion}</p>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-gray-400">#{modulo.orden}</span>
                  {/* Toggle activo */}
                  <button
                    onClick={() => handleToggle(modulo.id, !modulo.activo)}
                    disabled={isPending}
                    className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                      modulo.activo
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {modulo.activo ? 'Activo' : 'Inactivo'}
                  </button>
                  {estaEditando ? (
                    <>
                      <button
                        onClick={() => handleEditar(modulo.id)}
                        disabled={isPending}
                        className="px-3 py-1 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        Guardar
                      </button>
                      <button
                        onClick={() => setEditando(null)}
                        className="px-3 py-1 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => abrirEditar(modulo)}
                        className="px-3 py-1 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => estaGestionando ? cerrarGestion() : abrirGestion(modulo)}
                        className={`px-3 py-1 text-xs rounded-lg border transition-colors ${
                          estaGestionando
                            ? 'border-blue-300 bg-blue-50 text-blue-700'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {estaGestionando ? 'Cerrar' : 'Servicios'}
                      </button>
                      <button
                        onClick={() => setMostrando(estaExpandido ? null : modulo.id)}
                        className="text-gray-400 hover:text-gray-600 text-xs px-1"
                      >
                        {estaExpandido ? '▲' : '▼'}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Servicios actuales (expandido) */}
              {estaExpandido && !estaGestionando && (
                <div className="px-5 pb-4 border-t border-gray-50 pt-3">
                  <p className="text-xs text-gray-400 mb-2">Servicios incluidos en este módulo:</p>
                  {modulo.servicios.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">
                      Sin servicios asignados.{' '}
                      <button
                        onClick={() => abrirGestion(modulo)}
                        className="text-blue-500 hover:underline"
                      >
                        Agregar servicios →
                      </button>
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {modulo.servicios.map(s => (
                        <span
                          key={s.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs"
                        >
                          {s.icono && <span>{s.icono}</span>} {s.nombre}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Panel gestionar servicios */}
              {estaGestionando && (
                <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
                  <p className="text-xs font-medium text-gray-600 mb-3">
                    Selecciona qué servicios del catálogo pertenecen a este módulo:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
                    {todosServicios.map(s => {
                      const sel = serviciosSel.has(s.id);
                      return (
                        <button
                          key={s.id}
                          onClick={() => {
                            setServiciosSel(prev => {
                              const next = new Set(prev);
                              if (sel) next.delete(s.id); else next.add(s.id);
                              return next;
                            });
                          }}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-left text-sm transition-all ${
                            sel
                              ? 'border-blue-400 bg-blue-50 text-blue-800'
                              : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <span className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center ${
                            sel ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                          }`}>
                            {sel && (
                              <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 12 12">
                                <path d="M10 3L5 8.5 2 5.5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </span>
                          <span>{s.icono && `${s.icono} `}{s.nombre}</span>
                        </button>
                      );
                    })}
                    {todosServicios.length === 0 && (
                      <p className="text-xs text-gray-400 col-span-3">
                        No hay servicios en el catálogo.{' '}
                        <a href="/superadmin/servicios" className="text-blue-500 hover:underline">
                          Crear servicios →
                        </a>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleGuardarServicios(modulo.id)}
                      disabled={isPending}
                      className="px-4 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {isPending ? 'Guardando...' : `Guardar (${serviciosSel.size} seleccionados)`}
                    </button>
                    <button
                      onClick={cerrarGestion}
                      className="px-4 py-1.5 border border-gray-200 text-gray-600 text-xs rounded-lg hover:bg-gray-50"
                    >
                      Cancelar
                    </button>
                    <a
                      href="/superadmin/servicios"
                      className="text-xs text-blue-500 hover:underline ml-auto"
                    >
                      + Crear nuevo servicio →
                    </a>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
