'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { ejecutarEspecialista, makeDb } from '@/lib/agent/especialista';

export async function reejecutarTarea(tareaId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Limpiar el bloqueante y volver a pendiente
  await sb.from('tareas').update({
    estado: 'pendiente',
    notas: null,
    iniciado_en: null,
    completado_en: null,
  }).eq('id', tareaId);

  // Disparar especialista en segundo plano (fire-and-forget)
  ejecutarEspecialista(tareaId, makeDb()).catch(console.error);

  revalidatePath('/superadmin/proyectos', 'layout');
}
