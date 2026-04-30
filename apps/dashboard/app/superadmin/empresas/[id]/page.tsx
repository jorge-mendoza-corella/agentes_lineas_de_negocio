import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import GestionEmpresa from '@/components/superadmin/GestionEmpresa';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EmpresaDetallePage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  type ModuloRow = { id: string; nombre: string; icono: string | null };
  type ModuloActivoRow = { id: string; modulo_id: string; activo: boolean };
  type ModuloServicioRow = { modulo_id: string; servicio_id: string };

  const [
    { data: empresa },
    { data: modulosActivos },
    { data: todosModulos },
    { data: usuarios },
    moduloServiciosRes,
  ] = await Promise.all([
    supabase.from('empresas').select('*').eq('id', id).single(),
    supabase.from('empresa_servicios').select('id, modulo_id, activo').eq('empresa_id', id),
    supabase.from('catalogo_modulos').select('id, nombre, icono').eq('activo', true).order('orden'),
    supabase.from('perfiles').select('*, stakeholder_areas(area)').eq('empresa_id', id).order('rol'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from('modulo_servicios').select('modulo_id, servicio_id'),
  ]);

  if (!empresa) notFound();

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <a href="/superadmin/empresas" className="text-sm text-blue-600 hover:underline">
          ← Volver a empresas
        </a>
      </div>

      <GestionEmpresa
        empresa={empresa}
        modulos={(todosModulos ?? []) as ModuloRow[]}
        modulosActivos={(modulosActivos ?? []) as ModuloActivoRow[]}
        moduloServicios={(moduloServiciosRes.data ?? []) as ModuloServicioRow[]}
        usuarios={usuarios ?? []}
      />
    </div>
  );
}
