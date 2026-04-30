import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

const ESTADO_STYLE: Record<string, string> = {
  borrador:  'bg-gray-100 text-gray-600',
  enviada:   'bg-blue-100 text-blue-700',
  aceptada:  'bg-green-100 text-green-700',
  rechazada: 'bg-red-100 text-red-600',
};

export default async function CotizacionesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cotizaciones } = await (supabase as any)
    .from('cotizaciones')
    .select(`id, folio, estado, total, moneda, created_at, proyectos(nombre), empresas(nombre)`)
    .order('created_at', { ascending: false }) as {
      data: { id: string; folio: string; estado: string; total: number | null; moneda: string; created_at: string; proyectos: { nombre: string } | null; empresas: { nombre: string } | null }[] | null
    };

  const stats = {
    borrador:  (cotizaciones ?? []).filter(c => c.estado === 'borrador').length,
    enviada:   (cotizaciones ?? []).filter(c => c.estado === 'enviada').length,
    aceptada:  (cotizaciones ?? []).filter(c => c.estado === 'aceptada').length,
    rechazada: (cotizaciones ?? []).filter(c => c.estado === 'rechazada').length,
  };

  const totalAceptado = (cotizaciones ?? [])
    .filter(c => c.estado === 'aceptada')
    .reduce((s, c) => s + (c.total ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Cotizaciones</h1>
          <p className="text-sm text-gray-500 mt-0.5">Genera y gestiona cotizaciones por proyecto y agentes involucrados.</p>
        </div>
        <Link
          href="/superadmin/cotizaciones/nueva"
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
        >
          + Nueva cotización
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Borradores',  val: stats.borrador,  color: 'text-gray-700' },
          { label: 'Enviadas',    val: stats.enviada,   color: 'text-blue-700' },
          { label: 'Aceptadas',   val: stats.aceptada,  color: 'text-green-700' },
          { label: 'Total aceptado', val: `$${totalAceptado.toLocaleString('es-MX')}`, color: 'text-emerald-700' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-200 px-5 py-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {(!cotizaciones || cotizaciones.length === 0) ? (
          <p className="text-center py-16 text-sm text-gray-400">No hay cotizaciones aún.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Folio</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Proyecto</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Empresa</th>
                <th className="text-right px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Total</th>
                <th className="text-center px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Estado</th>
                <th className="text-right px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Fecha</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {cotizaciones.map(c => (
                <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                  <td className="px-5 py-3 font-mono text-xs text-gray-700">{c.folio}</td>
                  <td className="px-5 py-3 text-gray-800">
                    {c.proyectos?.nombre ?? <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-5 py-3 text-gray-800">
                    {c.empresas?.nombre ?? <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-gray-900 font-mono">
                    ${(c.total ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    <span className="text-xs text-gray-400 font-sans ml-1">{c.moneda}</span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${ESTADO_STYLE[c.estado] ?? ''}`}>
                      {c.estado}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right text-xs text-gray-400">
                    {new Date(c.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/superadmin/cotizaciones/${c.id}`} className="text-xs text-blue-600 hover:underline">
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
