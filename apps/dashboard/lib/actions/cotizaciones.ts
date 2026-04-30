'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export interface LineaInput {
  agente_nombre: string;
  descripcion: string;
  horas: number;
  precio_hora: number;
  tarea_id?: string;
}

export async function crearCotizacion(data: {
  proyecto_id?: string;
  empresa_id?: string;
  notas?: string;
  descuento_pct?: number;
  lineas: LineaInput[];
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: cotizacion, error } = await sb
    .from('cotizaciones')
    .insert({
      proyecto_id: data.proyecto_id || null,
      empresa_id: data.empresa_id || null,
      generada_por: user.id,
      notas: data.notas || null,
      descuento_pct: data.descuento_pct ?? 0,
    })
    .select('id')
    .single() as { data: { id: string } | null; error: { message: string } | null };

  if (error || !cotizacion) throw new Error(error?.message ?? 'Error creando cotización');

  if (data.lineas.length > 0) {
    const { error: errLineas } = await sb.from('cotizacion_lineas').insert(
      data.lineas.map((l, i) => ({
        cotizacion_id: cotizacion.id,
        agente_nombre: l.agente_nombre,
        descripcion: l.descripcion,
        horas: l.horas,
        precio_hora: l.precio_hora,
        tarea_id: l.tarea_id || null,
        orden: i,
      }))
    ) as { error: { message: string } | null };
    if (errLineas) throw new Error(errLineas.message);
  }

  revalidatePath('/superadmin/cotizaciones');
  redirect(`/superadmin/cotizaciones/${cotizacion.id}`);
}

export async function actualizarCotizacion(
  id: string,
  updates: { notas?: string; descuento_pct?: number }
) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('cotizaciones')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id) as { error: { message: string } | null };
  if (error) throw new Error(error.message);
  revalidatePath(`/superadmin/cotizaciones/${id}`);
}

export async function cambiarEstadoCotizacion(id: string, estado: string) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('cotizaciones')
    .update({ estado, updated_at: new Date().toISOString() })
    .eq('id', id) as { error: { message: string } | null };
  if (error) throw new Error(error.message);
  revalidatePath(`/superadmin/cotizaciones/${id}`);
  revalidatePath('/superadmin/cotizaciones');
}

export async function eliminarCotizacion(id: string) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('cotizaciones').delete().eq('id', id) as { error: { message: string } | null };
  if (error) throw new Error(error.message);
  revalidatePath('/superadmin/cotizaciones');
  redirect('/superadmin/cotizaciones');
}

export async function getAgentesDelProyecto(proyecto_id: string): Promise<{
  agente_nombre: string;
  horas: number;
}[]> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('tareas')
    .select('agente_asignado, requerimientos!inner(proyecto_id)')
    .eq('requerimientos.proyecto_id', proyecto_id) as { data: { agente_asignado: string }[] | null };

  if (!data) return [];
  const seen = new Set<string>();
  const result: { agente_nombre: string; horas: number }[] = [];
  for (const t of data) {
    if (t.agente_asignado && !seen.has(t.agente_asignado)) {
      seen.add(t.agente_asignado);
      result.push({ agente_nombre: t.agente_asignado, horas: 1 });
    }
  }
  return result;
}
