import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import TablaTarifas from '@/components/superadmin/TablaTarifas';

export default async function TarifasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: tarifas } = await supabase
    .from('tarifas_agentes')
    .select('*')
    .order('area')
    .order('display_name');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Tarifas por Agente</h1>
        <p className="text-sm text-gray-500 mt-1">
          Define el costo por hora de cada agente. Se usan al generar cotizaciones.
        </p>
      </div>
      <TablaTarifas tarifas={tarifas ?? []} />
    </div>
  );
}
