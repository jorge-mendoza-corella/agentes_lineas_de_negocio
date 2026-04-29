import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import GestionEmpresa from '@/components/superadmin/GestionEmpresa';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EmpresaDetallePage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: empresa }, { data: servicios }, { data: usuarios }] = await Promise.all([
    supabase.from('empresas').select('*').eq('id', id).single(),
    supabase.from('empresa_servicios').select('*').eq('empresa_id', id),
    supabase
      .from('perfiles')
      .select('*, stakeholder_areas(area)')
      .eq('empresa_id', id)
      .order('rol'),
  ]);

  if (!empresa) notFound();

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <a href="/superadmin/empresas" className="text-sm text-blue-600 hover:underline">
          ← Volver a empresas
        </a>
      </div>

      <GestionEmpresa empresa={empresa} servicios={servicios ?? []} usuarios={usuarios ?? []} />
    </div>
  );
}
