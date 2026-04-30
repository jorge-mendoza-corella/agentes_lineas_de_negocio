'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function updateTarifa(agente_nombre: string, tarifa_hora: number) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('tarifas_agentes')
    .update({ tarifa_hora })
    .eq('agente_nombre', agente_nombre) as { error: { message: string } | null };
  if (error) throw new Error(error.message);
  revalidatePath('/superadmin/tarifas');
  revalidatePath('/superadmin/cotizaciones');
}
