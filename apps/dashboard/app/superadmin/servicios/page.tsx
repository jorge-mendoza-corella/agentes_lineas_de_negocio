import { createClient } from '@/lib/supabase/server';
import CatalogoServicios from '@/components/superadmin/CatalogoServicios';

type ServicioRow = {
  id: string;
  nombre: string;
  descripcion: string | null;
  icono: string | null;
  activo: boolean | null;
  servicio_agentes: { agente_nombre: string; tarifa_hora: number | null }[];
};

export default async function ServiciosPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  const [{ data: serviciosRaw }, { data: tarifas }] = await Promise.all([
    supabase
      .from('servicios')
      .select('*, servicio_agentes(agente_nombre, tarifa_hora)')
      .order('nombre'),
    supabase
      .from('tarifas_agentes')
      .select('agente_nombre, display_name, tarifa_hora, area')
      .order('area'),
  ]);

  const servicios = (serviciosRaw ?? []) as ServicioRow[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Catálogo de servicios</h1>
        <p className="text-sm text-gray-500 mt-1">
          Define qué agentes intervienen en cada servicio y su precio base. Al contratar un servicio, estos agentes se precargan en las cotizaciones.
        </p>
      </div>
      <CatalogoServicios
        servicios={servicios.map(s => ({
          ...s,
          agentes: (s.servicio_agentes ?? []).map(a => ({
            agente_nombre: a.agente_nombre,
            tarifa_hora: a.tarifa_hora,
          })),
        }))}
        tarifas={tarifas ?? []}
      />
    </div>
  );
}
