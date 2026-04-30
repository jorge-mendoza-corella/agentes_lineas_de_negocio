import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import AccionesCotizacion from '@/components/cotizaciones/AccionesCotizacion';
import PrintButton from '@/components/cotizaciones/PrintButton';
import { agenteLabel } from '@/lib/agentes-meta';

const ESTADO_STYLE: Record<string, string> = {
  borrador:  'bg-gray-100 text-gray-700',
  enviada:   'bg-blue-100 text-blue-700',
  aceptada:  'bg-green-100 text-green-700',
  rechazada: 'bg-red-100 text-red-600',
};

interface Props { params: Promise<{ id: string }> }

export default async function DetalleCotizacionPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: c } = await (supabase as any)
    .from('cotizaciones')
    .select(`id, folio, estado, subtotal, descuento_pct, total, moneda, notas, created_at, updated_at, proyectos(id, nombre), empresas(id, nombre), cotizacion_lineas(id, agente_nombre, descripcion, horas, precio_hora, subtotal, orden)`)
    .eq('id', id)
    .single() as {
      data: {
        id: string; folio: string; estado: string; subtotal: number | null; descuento_pct: number | null;
        total: number | null; moneda: string; notas: string | null; created_at: string; updated_at: string;
        proyectos: { id: string; nombre: string } | null;
        empresas: { id: string; nombre: string } | null;
        cotizacion_lineas: { id: string; agente_nombre: string; descripcion: string; horas: number; precio_hora: number; subtotal: number; orden: number }[];
      } | null
    };

  if (!c) notFound();

  const lineas = (c.cotizacion_lineas ?? []).sort((a, b) => a.orden - b.orden);
  const proyecto = c.proyectos;
  const empresa  = c.empresas;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900 font-mono">{c.folio}</h1>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${ESTADO_STYLE[c.estado]}`}>
              {c.estado}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Creada {new Date(c.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Link
            href="/superadmin/cotizaciones"
            className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            ← Volver
          </Link>
          <PrintButton />
        </div>
      </div>

      {/* Info */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Proyecto</p>
          <p className="text-gray-800 font-medium">{proyecto?.nombre ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Empresa</p>
          <p className="text-gray-800 font-medium">{empresa?.nombre ?? '—'}</p>
        </div>
        {c.notas && (
          <div className="col-span-2">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Notas</p>
            <p className="text-gray-700 whitespace-pre-wrap">{c.notas}</p>
          </div>
        )}
      </div>

      {/* Líneas */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Desglose por agente</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider">
              <th className="text-left px-5 py-2.5 font-medium">Agente</th>
              <th className="text-left px-5 py-2.5 font-medium">Descripción</th>
              <th className="text-right px-5 py-2.5 font-medium w-20">Horas</th>
              <th className="text-right px-5 py-2.5 font-medium w-32">$/hora</th>
              <th className="text-right px-5 py-2.5 font-medium w-36">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {lineas.map(l => (
              <tr key={l.id} className="border-b border-gray-50 last:border-0">
                <td className="px-5 py-3 font-medium text-gray-800">{agenteLabel(l.agente_nombre)}</td>
                <td className="px-5 py-3 text-gray-600">{l.descripcion}</td>
                <td className="px-5 py-3 text-right font-mono text-gray-700">{l.horas}</td>
                <td className="px-5 py-3 text-right font-mono text-gray-700">
                  ${l.precio_hora.toLocaleString('es-MX')}
                </td>
                <td className="px-5 py-3 text-right font-mono font-semibold text-gray-900">
                  ${(l.subtotal ?? l.horas * l.precio_hora).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totales */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex justify-end">
          <div className="w-72 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span className="font-mono">${(c.subtotal ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
            </div>
            {(c.descuento_pct ?? 0) > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Descuento ({c.descuento_pct}%)</span>
                <span className="font-mono text-red-600">
                  −${((c.subtotal ?? 0) * (c.descuento_pct ?? 0) / 100).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-gray-200 font-bold text-gray-900">
              <span>Total</span>
              <span className="font-mono text-xl text-blue-700">
                ${(c.total ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} {c.moneda}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Acciones de estado */}
      <AccionesCotizacion id={c.id} estado={c.estado} />
    </div>
  );
}
