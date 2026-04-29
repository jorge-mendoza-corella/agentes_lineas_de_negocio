import { createClient } from '@/lib/supabase/server';
import FormNuevaEmpresa from '@/components/superadmin/FormNuevaEmpresa';
import TablaEmpresas from '@/components/superadmin/TablaEmpresas';

export default async function EmpresasPage() {
  const supabase = await createClient();

  const { data: empresas } = await supabase
    .from('empresas')
    .select('*, empresa_servicios(servicio, activo)')
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Empresas</h1>
        <p className="text-sm text-gray-500 mt-1">
          Gestiona qué empresas tienen acceso y qué servicios contratan
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Registrar nueva empresa</h2>
        <FormNuevaEmpresa />
      </div>

      <TablaEmpresas empresas={empresas ?? []} />
    </div>
  );
}
