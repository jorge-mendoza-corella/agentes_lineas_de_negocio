'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { crearCotizacion, getAgentesDelProyecto } from '@/lib/actions/cotizaciones';
import { getAgentesEmpresa } from '@/lib/actions/servicios';
import { AGENTES_META, agenteLabel } from '@/lib/agentes-meta';

interface Proyecto  { id: string; nombre: string }
interface Empresa   { id: string; nombre: string }
interface Tarifa    { agente_nombre: string; display_name: string; tarifa_hora: number }

interface LineaUI {
  uid: string;
  agente_nombre: string;
  descripcion: string;
  horas: number;
  precio_hora: number;
}

interface Props {
  proyectos: Proyecto[];
  empresas:  Empresa[];
  tarifas:   Tarifa[];
}

function uid() { return crypto.randomUUID(); }

export default function FormCotizacion({ proyectos, empresas, tarifas }: Props) {
  const router = useRouter();
  const tarifaMap = Object.fromEntries(tarifas.map(t => [t.agente_nombre, t.tarifa_hora]));

  const [proyectoId,   setProyectoId]   = useState('');
  const [empresaId,    setEmpresaId]    = useState('');
  const [importandoEmpresa, setImportandoEmpresa] = useState(false);
  const [notas,        setNotas]        = useState('');
  const [descuento,    setDescuento]    = useState(0);
  const [lineas,       setLineas]       = useState<LineaUI[]>([]);
  const [importando,   setImportando]   = useState(false);
  const [isPending,    startTransition] = useTransition();

  const subtotal = lineas.reduce((s, l) => s + l.horas * l.precio_hora, 0);
  const total    = subtotal * (1 - descuento / 100);

  function addLinea() {
    const primera = tarifas[0];
    setLineas(prev => [...prev, {
      uid: uid(),
      agente_nombre: primera?.agente_nombre ?? '',
      descripcion:   '',
      horas:         1,
      precio_hora:   primera ? tarifaMap[primera.agente_nombre] ?? 0 : 0,
    }]);
  }

  function removeLinea(u: string) {
    setLineas(prev => prev.filter(l => l.uid !== u));
  }

  function updateLinea(u: string, patch: Partial<LineaUI>) {
    setLineas(prev => prev.map(l => {
      if (l.uid !== u) return l;
      const next = { ...l, ...patch };
      if (patch.agente_nombre && patch.agente_nombre !== l.agente_nombre) {
        next.precio_hora = tarifaMap[patch.agente_nombre] ?? 0;
      }
      return next;
    }));
  }

  async function importarDesdeEmpresa() {
    if (!empresaId) return;
    setImportandoEmpresa(true);
    try {
      const agentes = await getAgentesEmpresa(empresaId);
      if (agentes.length === 0) {
        alert('La empresa no tiene servicios contratados con agentes configurados.');
        return;
      }
      const nuevas: LineaUI[] = agentes
        .filter(a => !lineas.some(l => l.agente_nombre === a.agente_nombre))
        .map(a => ({
          uid:           uid(),
          agente_nombre: a.agente_nombre,
          descripcion:   `Trabajo de ${agenteLabel(a.agente_nombre)} (${a.servicio_nombre})`,
          horas:         1,
          precio_hora:   a.tarifa_hora,
        }));
      setLineas(prev => [...prev, ...nuevas]);
    } finally {
      setImportandoEmpresa(false);
    }
  }

  async function importarDesdeProyecto() {
    if (!proyectoId) return;
    setImportando(true);
    try {
      const agentes = await getAgentesDelProyecto(proyectoId);
      if (agentes.length === 0) {
        alert('El proyecto no tiene tareas con agentes asignados.');
        return;
      }
      const nuevas: LineaUI[] = agentes
        .filter(a => !lineas.some(l => l.agente_nombre === a.agente_nombre))
        .map(a => ({
          uid:          uid(),
          agente_nombre: a.agente_nombre,
          descripcion:  `Trabajo de ${agenteLabel(a.agente_nombre)}`,
          horas:        a.horas,
          precio_hora:  tarifaMap[a.agente_nombre] ?? 0,
        }));
      setLineas(prev => [...prev, ...nuevas]);
    } finally {
      setImportando(false);
    }
  }

  function submit() {
    startTransition(async () => {
      await crearCotizacion({
        proyecto_id:   proyectoId || undefined,
        empresa_id:    empresaId  || undefined,
        notas:         notas      || undefined,
        descuento_pct: descuento,
        lineas: lineas.map(l => ({
          agente_nombre: l.agente_nombre,
          descripcion:   l.descripcion || `Trabajo de ${agenteLabel(l.agente_nombre)}`,
          horas:         l.horas,
          precio_hora:   l.precio_hora,
        })),
      });
    });
  }

  const agentesOrdenados = tarifas.sort((a, b) => a.display_name.localeCompare(b.display_name));

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Datos generales */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Datos generales</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Proyecto (opcional)</label>
            <select
              value={proyectoId}
              onChange={e => setProyectoId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Sin proyecto —</option>
              {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Empresa (opcional)</label>
            <select
              value={empresaId}
              onChange={e => setEmpresaId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Sin empresa —</option>
              {empresas.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Notas (opcional)</label>
          <textarea
            value={notas}
            onChange={e => setNotas(e.target.value)}
            rows={2}
            placeholder="Condiciones, alcance, observaciones..."
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Líneas */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Líneas de cotización</h2>
          <div className="flex gap-2">
            {empresaId && (
              <button
                onClick={importarDesdeEmpresa}
                disabled={importandoEmpresa}
                className="text-xs px-3 py-1.5 rounded-lg border border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100 disabled:opacity-50 transition-colors"
              >
                {importandoEmpresa ? 'Importando...' : '🏢 Importar desde servicios contratados'}
              </button>
            )}
            {proyectoId && (
              <button
                onClick={importarDesdeProyecto}
                disabled={importando}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {importando ? 'Importando...' : '⬇ Importar agentes del proyecto'}
              </button>
            )}
            <button
              onClick={addLinea}
              className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors font-medium"
            >
              + Agregar línea
            </button>
          </div>
        </div>

        {lineas.length === 0 ? (
          <p className="text-center py-10 text-sm text-gray-400">
            Agrega líneas manualmente, importa desde los servicios contratados de la empresa, o desde los agentes del proyecto.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <th className="text-left px-4 py-2.5 font-medium">Agente</th>
                <th className="text-left px-4 py-2.5 font-medium">Descripción</th>
                <th className="text-right px-4 py-2.5 font-medium w-24">Horas</th>
                <th className="text-right px-4 py-2.5 font-medium w-32">$/hora</th>
                <th className="text-right px-4 py-2.5 font-medium w-32">Subtotal</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {lineas.map(l => (
                <tr key={l.uid} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-2">
                    <select
                      value={l.agente_nombre}
                      onChange={e => updateLinea(l.uid, { agente_nombre: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {agentesOrdenados.map(a => (
                        <option key={a.agente_nombre} value={a.agente_nombre}>
                          {AGENTES_META[a.agente_nombre]?.emoji ?? '🤖'} {a.display_name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={l.descripcion}
                      onChange={e => updateLinea(l.uid, { descripcion: e.target.value })}
                      placeholder="Descripción del trabajo..."
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number" min="0.5" step="0.5"
                      value={l.horas}
                      onChange={e => updateLinea(l.uid, { horas: parseFloat(e.target.value) || 1 })}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-right font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                      <input
                        type="number" min="0" step="50"
                        value={l.precio_hora}
                        onChange={e => updateLinea(l.uid, { precio_hora: parseFloat(e.target.value) || 0 })}
                        className="w-full border border-gray-200 rounded-lg pl-5 pr-2 py-1.5 text-xs text-right font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-xs font-semibold text-gray-800">
                    ${(l.horas * l.precio_hora).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => removeLinea(l.uid)} className="text-gray-300 hover:text-red-400 transition-colors text-base leading-none">
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Totales */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex justify-end">
          <div className="w-72 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span className="font-mono">${subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center text-gray-600">
              <span>Descuento</span>
              <div className="flex items-center gap-1">
                <input
                  type="number" min="0" max="100" step="1"
                  value={descuento}
                  onChange={e => setDescuento(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                  className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-xs text-right font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-400">%</span>
              </div>
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-200 font-semibold text-gray-900">
              <span>Total</span>
              <span className="font-mono text-lg text-blue-700">
                ${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex justify-end gap-3">
        <button
          onClick={() => router.back()}
          className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={submit}
          disabled={isPending || lineas.length === 0}
          className="px-6 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? (
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" />
              Guardando...
            </span>
          ) : 'Guardar cotización'}
        </button>
      </div>
    </div>
  );
}
