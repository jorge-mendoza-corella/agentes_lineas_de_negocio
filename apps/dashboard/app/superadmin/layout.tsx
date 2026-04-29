import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import NavSuperadmin from '@/components/nav/NavSuperadmin';

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('rol, nombre')
    .eq('id', user.id)
    .single();

  if (perfil?.rol !== 'superadmin' && perfil?.rol !== 'plataforma_admin') redirect('/aprobaciones');

  return (
    <div className="min-h-screen flex">
      <NavSuperadmin nombre={perfil.nombre} />
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}
