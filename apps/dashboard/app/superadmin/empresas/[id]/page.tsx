import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import GestionEmpresa from '@/components/superadmin/GestionEmpresa';
import PanelContratosEmpresa from '@/components/superadmin/PanelContratosEmpresa';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EmpresaDetallePage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: empresa },
    { data: serviciosOld },
    { data: usuarios },
    { data: servicios },
    { data: contratos },
    { data: tarifasGlobales },
    { data: tarifasEmpresa },
    { data: cotizaciones },
  ] = await Promise.all([
    supabase.from('empresas').select('*').eq('id', id).single(),
    supabase.from('empresa_servicios').select('*').eq('empresa_id', id),
    supabase.from('perfiles').select('*, stakeholder_areas(area)').eq('empresa_id', id).order('rol'),
    supabase.from('servicios').select('*, servicio_agentes(agente_nombre)').order('nombre'),
    supabase.from('empresa_contratos').select('*').eq('empresa_id', id),
    supabase.from('tarifas_agentes').select('agente_nombre, display_name, tarifa_hora').order('area'),
    supabase.from('empresa_agente_tarifas').select('*').eq('empresa_id', id),
    supabase.from('cotizaciones').select('total, estado').eq('empresa_id', id),
  ]);

  if (!empresa) notFound();

  const serviciosConAgentes = (servicios ?? []).map(s => ({
    id: s.id,
    nombre: s.nombre,
    icono: s.icono,
    descripcion: s.descripcion,
    agentes: (s.servicio_agentes ?? []).map((a: { agente_nombre: string }) => a.agente_nombre),
  }));

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <a href="/superadmin/empresas" className="text-sm text-blue-600 hover:underline">
          ← Volver a empresas
        </a>
      </div>

      <GestionEmpresa empresa={empresa} servicios={serviciosOld ?? []} usuarios={usuarios ?? []} />

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Facturación y servicios</h2>
        <PanelContratosEmpresa
          empresa_id={id}
          servicios={serviciosConAgentes}
          contratos={contratos ?? []}
          tarifasGlobales={tarifasGlobales ?? []}
          tarifasEmpresa={tarifasEmpresa ?? []}
          cotizaciones={cotizaciones ?? []}
        />
      </div>
    </div>
  );
}
