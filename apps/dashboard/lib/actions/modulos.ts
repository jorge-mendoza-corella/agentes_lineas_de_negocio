'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

type Sb = Awaited<ReturnType<typeof createClient>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = (sb: Sb) => sb as any;

export async function crearModulo(nombre: string, icono: string, descripcion: string) {
  const supabase = await createClient();
  const { data: ultimo } = await db(supabase)
    .from('catalogo_modulos')
    .select('orden')
    .order('orden', { ascending: false })
    .limit(1)
    .single();
  const orden = ((ultimo?.orden as number | null) ?? 0) + 1;
  const { error } = await db(supabase).from('catalogo_modulos').insert({
    nombre: nombre.trim().toLowerCase(),
    icono: icono.trim() || null,
    descripcion: descripcion.trim() || null,
    orden,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/superadmin/modulos');
}

export async function actualizarModulo(
  id: string,
  updates: { nombre?: string; icono?: string; descripcion?: string; activo?: boolean; orden?: number }
) {
  const supabase = await createClient();
  const { error } = await db(supabase).from('catalogo_modulos').update(updates).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/superadmin/modulos');
  revalidatePath('/superadmin/empresas');
}

export async function toggleModuloActivo(id: string, activo: boolean) {
  const supabase = await createClient();
  const { error } = await db(supabase).from('catalogo_modulos').update({ activo }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/superadmin/modulos');
}

export async function setServiciosModulo(modulo_id: string, servicio_ids: string[]) {
  const supabase = await createClient();
  await db(supabase).from('modulo_servicios').delete().eq('modulo_id', modulo_id);
  if (servicio_ids.length > 0) {
    const { error } = await db(supabase).from('modulo_servicios').insert(
      servicio_ids.map(sid => ({ modulo_id, servicio_id: sid }))
    );
    if (error) throw new Error(error.message);
  }
  revalidatePath('/superadmin/modulos');
}

export async function toggleModuloEmpresa(
  empresaId: string,
  moduloId: string,
  activar: boolean,
  servicioIds: string[]
) {
  const supabase = await createClient();
  const sb = db(supabase);

  // 1. Upsert empresa_servicios
  const { data: existente } = await sb
    .from('empresa_servicios')
    .select('id')
    .eq('empresa_id', empresaId)
    .eq('modulo_id', moduloId)
    .maybeSingle();

  if (existente) {
    await sb.from('empresa_servicios').update({ activo: activar }).eq('id', existente.id);
  } else if (activar) {
    await sb.from('empresa_servicios').insert({ empresa_id: empresaId, modulo_id: moduloId, activo: true });
  }

  // 2. Sync empresa_contratos
  if (servicioIds.length > 0) {
    if (activar) {
      const { data: existentes } = await sb
        .from('empresa_contratos')
        .select('id, servicio_id')
        .eq('empresa_id', empresaId)
        .in('servicio_id', servicioIds);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const yaExistenIds = new Set((existentes ?? []).map((c: any) => c.servicio_id as string));
      const nuevos = servicioIds.filter(sid => !yaExistenIds.has(sid));

      if (nuevos.length > 0) {
        await sb.from('empresa_contratos').insert(
          nuevos.map(sid => ({ empresa_id: empresaId, servicio_id: sid, activo: true }))
        );
      }
      if ((existentes ?? []).length > 0) {
        await sb.from('empresa_contratos')
          .update({ activo: true })
          .eq('empresa_id', empresaId)
          .in('servicio_id', servicioIds);
      }
    } else {
      await sb.from('empresa_contratos')
        .update({ activo: false })
        .eq('empresa_id', empresaId)
        .in('servicio_id', servicioIds);
    }
  }

  revalidatePath(`/superadmin/empresas/${empresaId}`);
}

export async function crearServicio(nombre: string, icono: string, descripcion: string) {
  const supabase = await createClient();
  const { error } = await db(supabase).from('servicios').insert({
    nombre: nombre.trim(),
    icono: icono.trim() || null,
    descripcion: descripcion.trim() || null,
    activo: true,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/superadmin/servicios');
  revalidatePath('/superadmin/modulos');
}
