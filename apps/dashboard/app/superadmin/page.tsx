import { createClient } from '@/lib/supabase/server';
import TarjetaEstadisticas from '@/components/superadmin/TarjetaEstadisticas';
import TablaAprobaciones from '@/components/superadmin/TablaAprobaciones';

export default async function SuperadminPage() {
  const supabase = await createClient();

  const [{ data: solicitudes }, { data: stakeholders }] = await Promise.all([
    supabase
      .from('solicitudes_aprobacion')
      .select('*, perfiles(nombre, email)')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('perfiles')
      .select('id, nombre, email, created_at')
      .eq('rol', 'stakeholder'),
  ]);

  const pendientes = solicitudes?.filter((s) => s.estado === 'pendiente').length ?? 0;
  const aprobadas = solicitudes?.filter((s) => s.estado === 'aprobada').length ?? 0;
  const rechazadas = solicitudes?.filter((s) => s.estado === 'rechazada').length ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Panel General</h1>
        <p className="text-sm text-gray-500 mt-1">Vista completa del sistema</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <TarjetaEstadisticas titulo="Pendientes" valor={pendientes} color="yellow" />
        <TarjetaEstadisticas titulo="Aprobadas" valor={aprobadas} color="green" />
        <TarjetaEstadisticas titulo="Rechazadas" valor={rechazadas} color="red" />
      </div>

      <TablaAprobaciones solicitudes={solicitudes ?? []} />
    </div>
  );
}
