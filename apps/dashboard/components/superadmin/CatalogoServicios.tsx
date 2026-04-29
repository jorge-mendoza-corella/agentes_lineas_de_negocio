'use client';

import { useState, useTransition } from 'react';
import { AGENTES_META, agenteLabel } from '@/lib/agentes-meta';
import { setAgentesServicio } from '@/lib/actions/servicios';

interface Servicio {
  id: string;
  nombre: string;
  descripcion: string | null;
  icono: string | null;
  activo: boolean | null;
  agentes: string[];
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

export default function CatalogoServicios({ servicios, tarifas }: Props) {
  const [editando, setEditando] = useState<string | null>(null);
  const [agentesEdit, setAgentesEdit] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  const tarifaMap = Object.fromEntries(tarifas.map(t => [t.agente_nombre, t.tarifa_hora]));
  const agentesDisponibles = tarifas;

  function abrirEditor(servicio: Servicio) {
    setEditando(servicio.id);
    setAgentesEdit([...servicio.agentes]);
  }

  function cerrarEditor() {
    setEditando(null);
    setAgentesEdit([]);
  }

  function toggleAgente(nombre: string) {
    setAgentesEdit(prev =>
      prev.includes(nombre) ? prev.filter(a => a !== nombre) : [...prev, nombre]
    );
  }

  function guardar(servicioId: string) {
    startTransition(async () => {
      await setAgentesServicio(servicioId, agentesEdit);
      cerrarEditor();
    });
  }

  return (
    <div className="space-y-4">
      {servicios.map(s => {
        const estaEditando = editando === s.id;
        const agentesActuales = estaEditando ? agentesEdit : s.agentes;
        const costoHora = agentesActuales.reduce((sum, a) => sum + (tarifaMap[a] ?? 0), 0);

        return (
          <div key={s.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {/* Header del servicio */}
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
                  <p className="text-xs text-gray-400">Costo hora acumulado</p>
                  <p className="text-sm font-semibold font-mono text-blue-700">
                    ${costoHora.toLocaleString('es-MX')}/hr
                  </p>
                </div>
                <button
                  onClick={() => estaEditando ? cerrarEditor() : abrirEditor(s)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  {estaEditando ? 'Cancelar' : 'Editar agentes'}
                </button>
              </div>
            </div>

            {/* Agentes actuales (lectura) */}
            {!estaEditando && (
              <div className="px-5 pb-4">
                {s.agentes.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Sin agentes configurados</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {s.agentes.map(a => (
                      <span key={a} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                        {AGENTES_META[a]?.emoji ?? '🤖'} {agenteLabel(a)}
                        <span className="text-gray-400 font-mono ml-1">${(tarifaMap[a] ?? 0).toLocaleString()}/hr</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Editor de agentes */}
            {estaEditando && (
              <div className="border-t border-gray-100 px-5 py-4 bg-gray-50">
                <p className="text-xs font-medium text-gray-600 mb-3">
                  Selecciona los agentes que intervienen en este servicio:
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mb-4">
                  {agentesDisponibles.map(t => {
                    const activo = agentesEdit.includes(t.agente_nombre);
                    return (
                      <button
                        key={t.agente_nombre}
                        onClick={() => toggleAgente(t.agente_nombre)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-xs text-left transition-all ${
                          activo
                            ? 'border-blue-400 bg-blue-50 text-blue-800'
                            : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        <span>{AGENTES_META[t.agente_nombre]?.emoji ?? '🤖'}</span>
                        <div>
                          <p className="font-medium">{t.display_name}</p>
                          <p className="text-[10px] font-mono text-gray-400">${t.tarifa_hora.toLocaleString()}/hr</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    {agentesEdit.length} agentes · costo total: <span className="font-semibold font-mono text-blue-700">${agentesEdit.reduce((s, a) => s + (tarifaMap[a] ?? 0), 0).toLocaleString()}/hr</span>
                  </p>
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
