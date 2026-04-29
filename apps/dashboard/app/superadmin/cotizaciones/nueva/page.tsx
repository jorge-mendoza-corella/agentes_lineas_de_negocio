import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import FormCotizacion from '@/components/cotizaciones/FormCotizacion';

export default async function NuevaCotizacionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: proyectos }, { data: empresas }, { data: tarifas }] = await Promise.all([
    supabase.from('proyectos').select('id,nombre').order('nombre'),
    supabase.from('empresas').select('id,nombre').order('nombre'),
    supabase.from('tarifas_agentes').select('agente_nombre,display_name,tarifa_hora').eq('activo', true).order('display_name'),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Nueva cotización</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Selecciona un proyecto, agrega los agentes que intervinieron y ajusta las horas.
        </p>
      </div>
      <FormCotizacion
        proyectos={proyectos ?? []}
        empresas={empresas ?? []}
        tarifas={tarifas ?? []}
      />
    </div>
  );
}
