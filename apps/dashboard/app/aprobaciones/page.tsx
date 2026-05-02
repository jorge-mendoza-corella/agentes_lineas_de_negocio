import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ListaSolicitudes from '@/components/aprobaciones/ListaSolicitudes';
import NavStakeholder from '@/components/nav/NavStakeholder';

export default async function AprobacionesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: perfil } = await sb
    .from('perfiles')
    .select('nombre, rol')
    .eq('id', user.id)
    .single() as { data: { nombre: string; rol: string } | null };

  // Superadmin y plataforma_admin acceden desde su propia ruta
  if (perfil?.rol === 'superadmin' || perfil?.rol === 'plataforma_admin') redirect('/superadmin');

  const { data: solicitudes } = await sb
    .from('solicitudes_aprobacion')
    .select('*')
    .eq('stakeholder_id', user.id)
    .order('created_at', { ascending: false }) as {
      data: { id: string; estado: string; titulo: string; descripcion: string; area: string; plan_detallado: Record<string, unknown>; created_at: string }[] | null
    };

  const pendientes = solicitudes?.filter((s) => s.estado === 'pendiente') ?? [];
  const historial = solicitudes?.filter((s) => s.estado !== 'pendiente') ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <NavStakeholder nombre={perfil?.nombre ?? ''} />
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mis solicitudes</h1>
          <p className="text-sm text-gray-500 mt-1">Revisa y aprueba las solicitudes que te han asignado</p>
        </div>

        {pendientes.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-yellow-700 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
              Pendientes ({pendientes.length})
            </h2>
            <ListaSolicitudes solicitudes={pendientes} />
          </section>
        )}

        {historial.length > 0 && (
          <section>
            <h2 className="text-base font-semibold text-gray-500 mb-3">Historial</h2>
            <ListaSolicitudes solicitudes={historial} />
          </section>
        )}

        {solicitudes?.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-4">✅</p>
            <p className="text-sm">No tienes solicitudes pendientes</p>
          </div>
        )}
      </main>
    </div>
  );
}
