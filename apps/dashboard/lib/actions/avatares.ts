'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { ejecutarEspecialista, makeDb } from '@/lib/agent/especialista';

export async function moverAvatarADescanso(agenteNombre: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const db = makeDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any).from('avatares')
    .update({ estado_animacion: 'idle' })
    .eq('agente_nombre', agenteNombre);

  revalidatePath('/superadmin/sims');
}

export async function reanudarTrabajo(agenteNombre: string): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const db = makeDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = db as any;

  // Buscar la tarea pendiente más antigua del agente
  const { data: tareasPendientes } = await sb
    .from('tareas')
    .select('id, descripcion')
    .eq('agente_asignado', agenteNombre)
    .eq('estado', 'pendiente')
    .order('creado_en', { ascending: true })
    .limit(1);

  if (!tareasPendientes || tareasPendientes.length === 0) {
    // Sin tareas — poner en idle
    await sb.from('avatares')
      .update({ estado_animacion: 'idle' })
      .eq('agente_nombre', agenteNombre);
    revalidatePath('/superadmin/sims');
    return false;
  }

  const tareaId = tareasPendientes[0].id as string;

  // Animar al pasillo primero
  await sb.from('avatares')
    .update({ estado_animacion: 'caminando' })
    .eq('agente_nombre', agenteNombre);

  // Disparar especialista en background
  ejecutarEspecialista(tareaId, db).catch(console.error);

  revalidatePath('/superadmin/sims');
  return true;
}
