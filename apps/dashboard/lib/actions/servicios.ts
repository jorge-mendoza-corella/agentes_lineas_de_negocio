'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

// ── Catálogo de servicios ──────────────────────────────────────────────────

export async function actualizarServicio(
  id: string,
  updates: { nombre?: string; descripcion?: string; icono?: string; activo?: boolean }
) {
  const supabase = await createClient();
  const { error } = await supabase.from('servicios').update(updates).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/superadmin/servicios');
}

export async function setAgentesServicio(
  servicio_id: string,
  agentes: { agente_nombre: string; tarifa_hora: number | null }[]
) {
  const supabase = await createClient();
  await supabase.from('servicio_agentes').delete().eq('servicio_id', servicio_id);
  if (agentes.length > 0) {
    const { error } = await supabase.from('servicio_agentes').insert(
      agentes.map(a => ({
        servicio_id,
        agente_nombre: a.agente_nombre,
        tarifa_hora: a.tarifa_hora ?? null,
      }))
    );
    if (error) throw new Error(error.message);
  }
  revalidatePath('/superadmin/servicios');
}

// ── Contratos empresa ─────────────────────────────────────────────────────

export async function toggleEmpresaContrato(empresa_id: string, servicio_id: string, activo: boolean) {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('empresa_contratos')
    .select('id')
    .eq('empresa_id', empresa_id)
    .eq('servicio_id', servicio_id)
    .single();

  if (existing) {
    await supabase.from('empresa_contratos').update({ activo }).eq('id', existing.id);
  } else {
    await supabase.from('empresa_contratos').insert({ empresa_id, servicio_id, activo });
  }
  revalidatePath(`/superadmin/empresas/${empresa_id}`);
}

// ── Tarifas por empresa ───────────────────────────────────────────────────

export async function upsertEmpresaTarifa(empresa_id: string, agente_nombre: string, tarifa_hora: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('empresa_agente_tarifas')
    .upsert({ empresa_id, agente_nombre, tarifa_hora }, { onConflict: 'empresa_id,agente_nombre' });
  if (error) throw new Error(error.message);
  revalidatePath(`/superadmin/empresas/${empresa_id}`);
}

export async function deleteEmpresaTarifa(empresa_id: string, agente_nombre: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('empresa_agente_tarifas')
    .delete()
    .eq('empresa_id', empresa_id)
    .eq('agente_nombre', agente_nombre);
  if (error) throw new Error(error.message);
  revalidatePath(`/superadmin/empresas/${empresa_id}`);
}

// ── Helpers para el formulario de cotización ──────────────────────────────

export async function getAgentesEmpresa(empresa_id: string): Promise<{
  agente_nombre: string;
  tarifa_hora: number;
  servicio_nombre: string;
}[]> {
  const supabase = await createClient();

  // Contratos activos de la empresa con sus servicios y agentes
  const { data: contratos } = await supabase
    .from('empresa_contratos')
    .select('servicio_id, servicios(nombre, servicio_agentes(agente_nombre))')
    .eq('empresa_id', empresa_id)
    .eq('activo', true);

  // Tarifas personalizadas de la empresa
  const { data: tarifasEmpresa } = await supabase
    .from('empresa_agente_tarifas')
    .select('agente_nombre, tarifa_hora')
    .eq('empresa_id', empresa_id);

  // Tarifas globales como fallback
  const { data: tarifasGlobales } = await supabase
    .from('tarifas_agentes')
    .select('agente_nombre, tarifa_hora');

  const tarifaEmpresaMap = Object.fromEntries(
    (tarifasEmpresa ?? []).map(t => [t.agente_nombre, t.tarifa_hora])
  );
  const tarifaGlobalMap = Object.fromEntries(
    (tarifasGlobales ?? []).map(t => [t.agente_nombre, t.tarifa_hora])
  );

  const seen = new Set<string>();
  const result: { agente_nombre: string; tarifa_hora: number; servicio_nombre: string }[] = [];

  for (const contrato of contratos ?? []) {
    const servicio = contrato.servicios as unknown as {
      nombre: string;
      servicio_agentes: { agente_nombre: string; tarifa_hora: number | null }[];
    } | null;
    if (!servicio) continue;
    for (const sa of servicio.servicio_agentes ?? []) {
      if (seen.has(sa.agente_nombre)) continue;
      seen.add(sa.agente_nombre);
      // Jerarquía: empresa-específico > servicio-específico > global
      result.push({
        agente_nombre: sa.agente_nombre,
        tarifa_hora: tarifaEmpresaMap[sa.agente_nombre] ?? sa.tarifa_hora ?? tarifaGlobalMap[sa.agente_nombre] ?? 0,
        servicio_nombre: servicio.nombre,
      });
    }
  }

  return result;
}
