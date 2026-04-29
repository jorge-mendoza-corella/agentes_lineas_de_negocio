'use client';

import { useState, useTransition } from 'react';
import { AGENTES_META, agenteLabel } from '@/lib/agentes-meta';
import { setAgentesServicio } from '@/lib/actions/servicios';

interface AgenteServicio {
  agente_nombre: string;
  tarifa_hora: number | null;
}

interface Servicio {
  id: string;
  nombre: string;
  descripcion: string | null;
  icono: string | null;
  activo: boolean | null;
  agentes: AgenteServicio[];
}

interface Tarifa {
  agente_nombre: string;
  display_name: string;
  tarifa_hora: number;
  area: string;
}

interface Props {
  servicios: Servicio[];
  tarifas: Tarifa[];
}

interface AgenteEdit {
  agente_nombre: string;
  tarifa_hora: string; // string para el input, puede estar vacío
}

export default function CatalogoServicios({ servicios, tarifas }: Props) {
  const [editando, setEditando] = useState<string | null>(null);
  const [agentesEdit, setAgentesEdit] = useState<AgenteEdit[]>([]);
  const [isPending, startTransition] = useTransition();

  const globalMap = Object.fromEntries(tarifas.map(t => [t.agente_nombre, t.tarifa_hora]));

  function tarifaEfectiva(a: AgenteServicio): number {
    return a.tarifa_hora ?? globalMap[a.agente_nombre] ?? 0;
  }

  function abrirEditor(servicio: Servicio) {
    setEditando(servicio.id);
    setAgentesEdit(
      servicio.agentes.map(a => ({
        agente_nombre: a.agente_nombre,
        tarifa_hora: a.tarifa_hora != null ? String(a.tarifa_hora) : '',
      }))
    );
  }

  function cerrarEditor() {
    setEditando(null);
    setAgentesEdit([]);
  }

  function toggleAgente(nombre: string) {
    setAgentesEdit(prev => {
      if (prev.some(a => a.agente_nombre === nombre)) {
        return prev.filter(a => a.agente_nombre !== nombre);
      }
      return [...prev, { agente_nombre: nombre, tarifa_hora: '' }];
    });
  }

  function setTarifa(nombre: string, valor: string) {
    setAgentesEdit(prev =>
      prev.map(a => a.agente_nombre === nombre ? { ...a, tarifa_hora: valor } : a)
    );
  }

  function guardar(servicioId: string) {
    startTransition(async () => {
      await setAgentesServicio(
        servicioId,
        agentesEdit.map(a => ({
          agente_nombre: a.agente_nombre,
          // null = heredar tarifa global; número = precio propio del servicio
          tarifa_hora: a.tarifa_hora.trim() !== '' ? parseFloat(a.tarifa_hora) : null,
        }))
      );
      cerrarEditor();
    });
  }

  return (
    <div className="space-y-4">
      {servicios.map(s => {
        const estaEditando = editando === s.id;
        const agentesActuales = s.agentes;
        const costoHora = agentesActuales.reduce((sum, a) => sum + tarifaEfectiva(a), 0);

        return (
          <div key={s.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{s.icono ?? '⚙️'}</span>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{s.nombre}</p>
                  {s.descripcion && (
                    <p className="text-xs text-gray-500">{s.descripcion}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs text-gray-400">Costo acumulado</p>
                  <p className="text-sm font-semibold font-mono text-blue-700">
                    ${costoHora.toLocaleString('es-MX')}/hr
                  </p>
                </div>
                <button
                  onClick={() => estaEditando ? cerrarEditor() : abrirEditor(s)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  {estaEditando ? 'Cancelar' : 'Editar'}
                </button>
              </div>
            </div>

            {/* Vista lectura: agentes con sus precios */}
            {!estaEditando && (
              <div className="px-5 pb-4">
                {s.agentes.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Sin agentes configurados</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {s.agentes.map(a => {
                      const tienePropio = a.tarifa_hora != null;
                      const efectiva = tarifaEfectiva(a);
                      return (
                        <span
                          key={a.agente_nombre}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs ${
                            tienePropio
                              ? 'bg-purple-50 text-purple-800 border border-purple-200'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                          title={tienePropio ? 'Precio específico de este servicio' : 'Hereda precio global'}
                        >
                          {AGENTES_META[a.agente_nombre]?.emoji ?? '🤖'} {agenteLabel(a.agente_nombre)}
                          <span className="font-mono text-[11px] opacity-70">
                            ${efectiva.toLocaleString('es-MX')}/hr
                          </span>
                          {tienePropio && <span className="text-purple-400 text-[10px]">★</span>}
                        </span>
                      );
                    })}
                  </div>
                )}
                {s.agentes.some(a => a.tarifa_hora != null) && (
                  <p className="text-[10px] text-purple-500 mt-2">★ Precio personalizado para este servicio</p>
                )}
              </div>
            )}

            {/* Editor */}
            {estaEditando && (
              <div className="border-t border-gray-100 bg-gray-50">
                {/* Selección de agentes */}
                <div className="px-5 py-4">
                  <p className="text-xs font-medium text-gray-600 mb-3">
                    Selecciona agentes y ajusta el precio (dejar vacío = usar tarifa global):
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {tarifas.map(t => {
                      const seleccionado = agentesEdit.some(a => a.agente_nombre === t.agente_nombre);
                      const editItem = agentesEdit.find(a => a.agente_nombre === t.agente_nombre);
                      const placeholder = String(globalMap[t.agente_nombre] ?? 0);

                      return (
                        <div
                          key={t.agente_nombre}
                          className={`flex items-center gap-3 px-3 py-2 rounded-xl border-2 transition-all ${
                            seleccionado
                              ? 'border-blue-300 bg-blue-50'
                              : 'border-gray-200 bg-white opacity-50'
                          }`}
                        >
                          {/* Checkbox toggle */}
                          <button
                            onClick={() => toggleAgente(t.agente_nombre)}
                            className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                              seleccionado ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                            }`}
                          >
                            {seleccionado && (
                              <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 12 12">
                                <path d="M10 3L5 8.5 2 5.5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </button>

                          {/* Agente info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-800 truncate">
                              {AGENTES_META[t.agente_nombre]?.emoji ?? '🤖'} {t.display_name}
                            </p>
                            <p className="text-[10px] text-gray-400">Global: ${t.tarifa_hora.toLocaleString()}/hr</p>
                          </div>

                          {/* Campo de precio */}
                          {seleccionado && (
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-xs text-gray-400">$</span>
                              <input
                                type="number"
                                min="0"
                                step="50"
                                value={editItem?.tarifa_hora ?? ''}
                                onChange={e => setTarifa(t.agente_nombre, e.target.value)}
                                placeholder={placeholder}
                                className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-xs text-right font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                              />
                              <span className="text-[10px] text-gray-400">/hr</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Footer del editor */}
                <div className="px-5 pb-4 flex items-center justify-between border-t border-gray-100 pt-3">
                  <div className="text-xs text-gray-500 space-y-0.5">
                    <p>{agentesEdit.length} agentes seleccionados</p>
                    <p>
                      Costo acumulado:&nbsp;
                      <span className="font-semibold font-mono text-blue-700">
                        ${agentesEdit.reduce((sum, a) => {
                          const v = a.tarifa_hora.trim() !== '' ? parseFloat(a.tarifa_hora) : (globalMap[a.agente_nombre] ?? 0);
                          return sum + (isNaN(v) ? 0 : v);
                        }, 0).toLocaleString('es-MX')}/hr
                      </span>
                    </p>
                  </div>
                  <button
                    onClick={() => guardar(s.id)}
                    disabled={isPending}
                    className="px-4 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {isPending ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
