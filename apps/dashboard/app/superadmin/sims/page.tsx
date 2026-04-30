import { createClient } from '@/lib/supabase/server';
import SimsCanvas from '@/components/sims/SimsCanvas';

export default async function SimsPage() {
  const supabase = await createClient();

  const [{ data: avatares }, { data: bitacora }, tareasRes] = await Promise.all([
    supabase.from('avatares').select('*'),
    supabase
      .from('bitacora_actividad')
      .select('id, agente, accion, creado_en, tarea_id')
      .order('creado_en', { ascending: false })
      .limit(120),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('tareas')
      .select('id, agente_asignado, descripcion, estado, notas, plan_ejecucion, creado_en')
      .order('creado_en', { ascending: false })
      .limit(50),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Vista de agentes</h1>
        <p className="text-sm text-gray-500 mt-1">
          Estado en tiempo real del equipo de desarrollo
        </p>
      </div>
      <SimsCanvas
        avatoresIniciales={avatares ?? []}
        bitacoraInicial={bitacora ?? []}
        tareasIniciales={tareasRes.data ?? []}
      />
    </div>
  );
}
