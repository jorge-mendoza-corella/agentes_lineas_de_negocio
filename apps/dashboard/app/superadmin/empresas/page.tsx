import { createClient } from '@/lib/supabase/server';
import FormNuevaEmpresa from '@/components/superadmin/FormNuevaEmpresa';
import TablaEmpresas from '@/components/superadmin/TablaEmpresas';

type ModuloRow = { id: string; nombre: string; icono: string | null };
type ModuloServicioRow = { modulo_id: string; servicio_id: string };

export default async function EmpresasPage() {
  const supabase = await createClient();

  const [empresasRes, modulosRes, moduloServiciosRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('empresas')
      .select('*, empresa_servicios(modulo_id, activo, catalogo_modulos(nombre, icono))')
      .order('created_at', { ascending: false }),
    supabase
      .from('catalogo_modulos')
      .select('id, nombre, icono')
      .eq('activo', true)
      .order('orden'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('modulo_servicios')
      .select('modulo_id, servicio_id'),
  ]);

  const modulos = (modulosRes.data ?? []) as ModuloRow[];
  const moduloServicios = (moduloServiciosRes.data ?? []) as ModuloServicioRow[];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Empresas</h1>
        <p className="text-sm text-gray-500 mt-1">
          Gestiona qué empresas tienen acceso y qué módulos contratan
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Registrar nueva empresa</h2>
        <FormNuevaEmpresa modulos={modulos} moduloServicios={moduloServicios} />
      </div>

      <TablaEmpresas empresas={empresasRes.data ?? []} />
    </div>
  );
}
