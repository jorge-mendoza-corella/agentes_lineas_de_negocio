'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function updateTarifa(agente_nombre: string, tarifa_hora: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('tarifas_agentes')
    .update({ tarifa_hora })
    .eq('agente_nombre', agente_nombre);
  if (error) throw new Error(error.message);
  revalidatePath('/superadmin/tarifas');
  revalidatePath('/superadmin/cotizaciones');
}
