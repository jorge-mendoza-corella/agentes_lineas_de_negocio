'use client';

import { useState, useTransition } from 'react';
import { AGENTES_META, agenteLabel } from '@/lib/agentes-meta';
import { toggleEmpresaContrato, upsertEmpresaTarifa, deleteEmpresaTarifa } from '@/lib/actions/servicios';

interface Servicio {
  id: string;
  nombre: string;
  icono: string | null;
  descripcion: string | null;
  agentes: string[];
}

interface Contrato {
  id: string;
  servicio_id: string;
  activo: boolean | null;
}

interface TarifaGlobal {
  agente_nombre: string;
  display_name: string;
  tarifa_hora: number;
}

interface TarifaEmpresa {
  empresa_id: string;
  agente_nombre: string;
  tarifa_hora: number;
}

interface Cotizacion {
  total: number;
  estado: string;
}

interface Props {
  empresa_id: string;
  servicios: Servicio[];
  contratos: Contrato[];
  tarifasGlobales: TarifaGlobal[];
  tarifasEmpresa: TarifaEmpresa[];
  cotizaciones: Cotizacion[];
}

export default function PanelContratosEmpresa({
  empresa_id,
  servicios,
  contratos,
  tarifasGlobales,
  tarifasEmpresa: tarifasEmpresaInit,
  cotizaciones,
}: Props) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [tarifasEmpresa, setTarifasEmpresa] = useState<TarifaEmpresa[]>(tarifasEmpresaInit);
  const [editandoTarifa, setEditandoTarifa] = useState<string | null>(null);
  const [valorTarifa, setValorTarifa] = useState('');
  const [isPending, startTransition] = useTransition();

  const tarifaGlobalMap = Object.fromEntries(tarifasGlobales.map(t => [t.agente_nombre, t.tarifa_hora]));
  const tarifaEmpresaMap = Object.fromEntries(tarifasEmpresa.map(t => [t.agente_nombre, t.tarifa_hora]));
  const contratosMap = Object.fromEntries(contratos.map(c => [c.servicio_id, c]));

  function tarifaEfectiva(agente: string): number {
    return tarifaEmpresaMap[agente] ?? tarifaGlobalMap[agente] ?? 0;
  }

  function toggleContrato(servicio_id: string, activo: boolean) {
    setPendingId(servicio_id);
    startTransition(async () => {
      await toggleEmpresaContrato(empresa_id, servicio_id, activo);
      setPendingId(null);
    });
  }

  function abrirEditTarifa(agente: string) {
    setEditandoTarifa(agente);
    setValorTarifa(String(tarifaEfectiva(agente)));
  }

  function guardarTarifa(agente: string) {
    const valor = parseFloat(valorTarifa);
    if (isNaN(valor) || valor < 0) return;
    startTransition(async () => {
      await upsertEmpresaTarifa(empresa_id, agente, valor);
      setTarifasEmpresa(prev => {
        const idx = prev.findIndex(t => t.agente_nombre === agente);
        if (idx >= 0) return prev.map(t => t.agente_nombre === agente ? { ...t, tarifa_hora: valor } : t);
        return [...prev, { empresa_id, agente_nombre: agente, tarifa_hora: valor }];
      });
      setEditandoTarifa(null);
    });
  }

  function resetearTarifa(agente: string) {
    startTransition(async () => {
      await deleteEmpresaTarifa(empresa_id, agente);
      setTarifasEmpresa(prev => prev.filter(t => t.agente_nombre !== agente));
      setEditandoTarifa(null);
    });
  }

  // Resumen financiero
  const totalAceptado = cotizaciones.filter(c => c.estado === 'aceptada').reduce((s, c) => s + c.total, 0);
  const totalEnviado  = cotizaciones.filter(c => c.estado === 'enviada').reduce((s, c) => s + c.total, 0);
  const totalBorrador = cotizaciones.filter(c => c.estado === 'borrador').reduce((s, c) => s + c.total, 0);

  // Servicios contratados activos
  const serviciosContratados = servicios.filter(s => contratosMap[s.id]?.activo);
  const allAgentesContratados = [...new Set(serviciosContratados.flatMap(s => s.agentes))];
  const costoHoraContratado = allAgentesContratados.reduce((sum, a) => sum + tarifaEfectiva(a), 0);

  return (
    <div className="space-y-6">

      {/* Resumen financiero */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Costo/hora contratado', value: `$${costoHoraContratado.toLocaleString('es-MX')}/hr`, color: 'text-blue-700', bg: 'bg-blue-50' },
          { label: 'Total aceptado', value: `$${totalAceptado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, color: 'text-green-700', bg: 'bg-green-50' },
          { label: 'Total enviado', value: `$${totalEnviado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, color: 'text-yellow-700', bg: 'bg-yellow-50' },
          { label: 'Total borrador', value: `$${totalBorrador.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, color: 'text-gray-600', bg: 'bg-gray-50' },
        ].map(stat => (
          <div key={stat.label} className={`${stat.bg} rounded-2xl p-4`}>
            <p className="text-xs text-gray-500">{stat.label}</p>
            <p className={`text-lg font-bold font-mono mt-1 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Servicios del catálogo */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Servicios contratados (Facturación)</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Activa los servicios que esta empresa ha contratado. Los agentes se precargarán al cotizar.
          </p>
        </div>

        <div className="divide-y divide-gray-50">
          {servicios.map(s => {
            const contrato = contratosMap[s.id];
            const activo = contrato?.activo ?? false;
            const isPendingThis = pendingId === s.id;
            const costoServicio = s.agentes.reduce((sum, a) => sum + tarifaEfectiva(a), 0);

            return (
              <div key={s.id} className={`px-5 py-4 transition-colors ${activo ? 'bg-blue-50/30' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleContrato(s.id, !activo)}
                      disabled={isPendingThis}
                      className={`w-10 h-6 rounded-full transition-colors relative shrink-0 ${
                        activo ? 'bg-blue-500' : 'bg-gray-200'
                      } disabled:opacity-50`}
                    >
                      <span className={`block w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                        activo ? 'translate-x-5' : 'translate-x-1'
                      }`} />
                    </button>
                    <span className="text-xl">{s.icono ?? '⚙️'}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{s.nombre}</p>
                      <p className="text-xs text-gray-400">{s.descripcion}</p>
                    </div>
                  </div>
                  {activo && (
                    <div className="text-right shrink-0">
                      <p className="text-xs text-gray-400">Costo/hora</p>
                      <p className="text-sm font-semibold font-mono text-blue-700">${costoServicio.toLocaleString('es-MX')}/hr</p>
                    </div>
                  )}
                </div>

                {/* Agentes del servicio con tarifas */}
                {activo && s.agentes.length > 0 && (
                  <div className="mt-3 ml-16 space-y-1.5">
                    {s.agentes.map(agente => {
                      const tieneCustom = !!tarifaEmpresaMap[agente];
                      const tarifaEf = tarifaEfectiva(agente);
                      const estaEditandoEste = editandoTarifa === agente;
                      return (
                        <div key={agente} className="flex items-center justify-between gap-2">
                          <span className="text-xs text-gray-600 flex items-center gap-1">
                            {AGENTES_META[agente]?.emoji ?? '🤖'} {agenteLabel(agente)}
                            {tieneCustom && (
                              <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] ml-1">personalizado</span>
                            )}
                          </span>
                          {estaEditandoEste ? (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-400">$</span>
                              <input
                                type="number"
                                value={valorTarifa}
                                onChange={e => setValorTarifa(e.target.value)}
                                className="w-24 border border-gray-200 rounded-lg px-2 py-0.5 text-xs text-right font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                onKeyDown={e => { if (e.key === 'Enter') guardarTarifa(agente); if (e.key === 'Escape') setEditandoTarifa(null); }}
                                autoFocus
                              />
                              <span className="text-[10px] text-gray-400">/hr</span>
                              <button onClick={() => guardarTarifa(agente)} disabled={isPending} className="text-[10px] px-2 py-0.5 bg-blue-600 text-white rounded-md">✓</button>
                              {tieneCustom && (
                                <button onClick={() => resetearTarifa(agente)} title="Resetear a global" className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md">↺ Global</button>
                              )}
                              <button onClick={() => setEditandoTarifa(null)} className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-md">✗</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => abrirEditTarifa(agente)}
                              className="text-xs font-mono text-gray-700 hover:text-blue-600 hover:underline transition-colors"
                            >
                              ${tarifaEf.toLocaleString('es-MX')}/hr
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-gray-400">
        Haz clic en el precio de un agente para personalizarlo. El precio personalizado aplica solo a esta empresa; deja en blanco para volver al precio global.
      </p>
    </div>
  );
}
