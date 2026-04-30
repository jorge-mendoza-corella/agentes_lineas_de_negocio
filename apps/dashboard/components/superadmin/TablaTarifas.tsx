'use client';

import { useState, useTransition } from 'react';
import { updateTarifa } from '@/lib/actions/tarifas';
import { AGENTES_META } from '@/lib/agentes-meta';

interface Tarifa {
  agente_nombre: string;
  display_name: string;
  area: string;
  tarifa_hora: number;
  moneda: string;
  activo: boolean;
}

export default function TablaTarifas({ tarifas }: { tarifas: Tarifa[] }) {
  const [valores, setValores] = useState<Record<string, string>>(
    Object.fromEntries(tarifas.map(t => [t.agente_nombre, String(t.tarifa_hora)]))
  );
  const [guardando, setGuardando] = useState<string | null>(null);
  const [guardados, setGuardados] = useState<Set<string>>(new Set());
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [, startTransition] = useTransition();

  const grupos = tarifas.reduce<Record<string, Tarifa[]>>((acc, t) => {
    (acc[t.area] ??= []).push(t);
    return acc;
  }, {});

  function handleChange(nombre: string, val: string) {
    setValores(prev => ({ ...prev, [nombre]: val }));
    setGuardados(prev => { const s = new Set(prev); s.delete(nombre); return s; });
    setErrores(prev => { const e = { ...prev }; delete e[nombre]; return e; });
  }

  function guardar(nombre: string) {
    const raw = valores[nombre] ?? '';
    const num = parseFloat(raw);
    if (isNaN(num) || num < 0) {
      setErrores(prev => ({ ...prev, [nombre]: 'Valor inválido' }));
      return;
    }
    setGuardando(nombre);
    startTransition(async () => {
      try {
        await updateTarifa(nombre, num);
        setGuardados(prev => new Set(prev).add(nombre));
      } catch (e) {
        setErrores(prev => ({ ...prev, [nombre]: String(e) }));
      } finally {
        setGuardando(null);
      }
    });
  }

  const AREA_LABELS: Record<string, string> = {
    sistemas: 'Sistemas',
    desarrollo: 'Área de Desarrollo',
  };

  return (
    <div className="space-y-6">
      {Object.entries(grupos).map(([area, rows]) => (
        <div key={area} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {AREA_LABELS[area] ?? area}
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-5 py-2.5 font-medium text-gray-500 text-xs">Agente</th>
                <th className="text-right px-5 py-2.5 font-medium text-gray-500 text-xs w-52">Tarifa / hora</th>
                <th className="text-right px-5 py-2.5 font-medium text-gray-500 text-xs w-24">Moneda</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {rows.map(t => {
                const meta = AGENTES_META[t.agente_nombre];
                const isGuardando = guardando === t.agente_nombre;
                const isGuardado  = guardados.has(t.agente_nombre);
                const error       = errores[t.agente_nombre];
                const changed     = valores[t.agente_nombre] !== String(t.tarifa_hora) && !isGuardado;

                return (
                  <tr key={t.agente_nombre} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-2">
                        <span className="text-base">{meta?.emoji ?? '🤖'}</span>
                        <span className="font-medium text-gray-800">{t.display_name}</span>
                        <span className="text-xs text-gray-400 font-mono">{t.agente_nombre}</span>
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {error && <span className="text-xs text-red-500">{error}</span>}
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                          <input
                            type="number"
                            min="0"
                            step="50"
                            value={valores[t.agente_nombre] ?? ''}
                            onChange={e => handleChange(t.agente_nombre, e.target.value)}
                            onBlur={() => { if (changed) guardar(t.agente_nombre); }}
                            onKeyDown={e => { if (e.key === 'Enter') guardar(t.agente_nombre); }}
                            className={`w-36 pl-6 pr-3 py-1.5 rounded-lg border text-right text-sm font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                              error         ? 'border-red-300 bg-red-50' :
                              changed       ? 'border-blue-300 bg-blue-50' :
                              isGuardado    ? 'border-green-300 bg-green-50' :
                                              'border-gray-200 bg-white'
                            }`}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right text-gray-500 text-xs">{t.moneda}</td>
                    <td className="px-4 py-3 text-center w-16">
                      {isGuardando ? (
                        <span className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin inline-block" />
                      ) : isGuardado ? (
                        <span className="text-green-500 text-base">✓</span>
                      ) : changed ? (
                        <button
                          onClick={() => guardar(t.agente_nombre)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Guardar
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
      <p className="text-xs text-gray-400 text-center">
        Los cambios se aplican al presionar Enter, al salir del campo o al hacer clic en Guardar.
      </p>
    </div>
  );
}
