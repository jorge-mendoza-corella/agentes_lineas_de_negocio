import { createClient } from '@/lib/supabase/server';
import CatalogoServicios from '@/components/superadmin/CatalogoServicios';

export default async function ServiciosPage() {
  const supabase = await createClient();

  const [{ data: servicios }, { data: tarifas }] = await Promise.all([
    supabase
      .from('servicios')
      .select('*, servicio_agentes(agente_nombre)')
      .order('nombre'),
    supabase
      .from('tarifas_agentes')
      .select('agente_nombre, display_name, tarifa_hora, area')
      .order('area'),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Catálogo de servicios</h1>
        <p className="text-sm text-gray-500 mt-1">
          Define qué agentes intervienen en cada servicio. Al contratar un servicio, estos agentes se precargan en las cotizaciones.
        </p>
      </div>
      <CatalogoServicios
        servicios={(servicios ?? []).map(s => ({
          ...s,
          agentes: (s.servicio_agentes ?? []).map((a: { agente_nombre: string }) => a.agente_nombre),
        }))}
        tarifas={tarifas ?? []}
      />
    </div>
  );
}
