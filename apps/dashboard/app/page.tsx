import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function HomePage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .single() as { data: { rol: string } | null };

  if (perfil?.rol === 'superadmin' || perfil?.rol === 'plataforma_admin') redirect('/superadmin');
  redirect('/aprobaciones');
}
