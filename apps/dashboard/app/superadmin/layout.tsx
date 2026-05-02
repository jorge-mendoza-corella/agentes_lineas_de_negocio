import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import NavSuperadmin from '@/components/nav/NavSuperadmin';
import MonitorTareasEstancadas from '@/components/superadmin/MonitorTareasEstancadas';

type Perfil = { rol: string; nombre: string };

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('rol, nombre')
    .eq('id', user.id)
    .single() as { data: Perfil | null };

  if (perfil?.rol !== 'superadmin' && perfil?.rol !== 'plataforma_admin') redirect('/aprobaciones');

  return (
    <div className="min-h-screen flex">
      <NavSuperadmin nombre={perfil?.nombre ?? ''} userId={user.id} />
      <main className="flex-1 p-8 overflow-auto">{children}</main>
      <MonitorTareasEstancadas userId={user.id} />
    </div>
  );
}
