import { createClient } from '@/lib/supabase/server';
import SimsCanvas from '@/components/sims/SimsCanvas';

export default async function SimsPage() {
  const supabase = await createClient();

  const [{ data: oficinas }, { data: avatares }, { data: bitacora }] = await Promise.all([
    supabase.from('oficinas').select('*').order('piso'),
    supabase.from('avatares').select('*'),
    supabase
      .from('bitacora_actividad')
      .select('id, agente, accion, creado_en')
      .order('creado_en', { ascending: false })
      .limit(30),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Vista de agentes</h1>
        <p className="text-sm text-gray-500 mt-1">
          Estado en tiempo real de los agentes activos
        </p>
      </div>

      <SimsCanvas
        oficinasIniciales={oficinas ?? []}
        avatoresIniciales={avatares ?? []}
        bitacoraInicial={bitacora ?? []}
      />
    </div>
  );
}
