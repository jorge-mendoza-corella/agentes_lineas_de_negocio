import { createClient } from '@/lib/supabase/server';
import FormInvitarStakeholder from '@/components/superadmin/FormInvitarStakeholder';
import TablaStakeholders from '@/components/superadmin/TablaStakeholders';

export default async function StakeholdersPage() {
  const supabase = await createClient();

  const { data: stakeholders } = await supabase
    .from('perfiles')
    .select('id, nombre, email, created_at, stakeholder_areas(area)')
    .eq('rol', 'stakeholder')
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Stakeholders</h1>
        <p className="text-sm text-gray-500 mt-1">Gestiona quién puede aprobar solicitudes</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Invitar nuevo stakeholder</h2>
        <FormInvitarStakeholder />
      </div>

      <TablaStakeholders stakeholders={stakeholders ?? []} />
    </div>
  );
}
