import { createClient } from '@/lib/supabase/server';
import FormInvitarStakeholder from '@/components/superadmin/FormInvitarStakeholder';
import TablaStakeholders from '@/components/superadmin/TablaStakeholders';

type Empresa = { id: string; nombre: string };
type StakeholderRow = {
  id: string;
  nombre: string;
  email: string;
  empresa_id: string | null;
  created_at: string;
  empresas: { nombre: string } | null;
  stakeholder_areas: { area: string }[];
};

interface Props {
  searchParams: Promise<{ empresa?: string }>;
}

export default async function StakeholdersPage({ searchParams }: Props) {
  const { empresa: empresaIdInicial } = await searchParams;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any;

  const [{ data: stakeholdersRaw }, { data: empresasRaw }] = await Promise.all([
    supabase
      .from('perfiles')
      .select('id, nombre, email, empresa_id, created_at, empresas(nombre), stakeholder_areas(area)')
      .eq('rol', 'stakeholder')
      .order('created_at', { ascending: false }),
    supabase
      .from('empresas')
      .select('id, nombre')
      .eq('activa', true)
      .order('nombre'),
  ]);

  const stakeholders = (stakeholdersRaw ?? []) as StakeholderRow[];
  const empresas = (empresasRaw ?? []) as Empresa[];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Stakeholders</h1>
        <p className="text-sm text-gray-500 mt-1">Gestiona quién puede aprobar solicitudes, por empresa y área</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Invitar nuevo stakeholder</h2>
        <FormInvitarStakeholder empresas={empresas} empresaIdInicial={empresaIdInicial} />
      </div>

      <TablaStakeholders stakeholders={stakeholders} />
    </div>
  );
}
