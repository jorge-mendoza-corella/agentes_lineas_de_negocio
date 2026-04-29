import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

export type DbClient = SupabaseClient<Database>;

/**
 * Cliente con service_role: bypasea RLS. Usar solo en servidor / scripts / edge functions.
 */
export function createServiceClient(): DbClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('SUPABASE_URL no está definida');
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY no está definida');
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Cliente con anon key: respeta RLS. Usar en navegador o cuando se requiere identidad del usuario.
 */
export function createAnonClient(): DbClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url) throw new Error('SUPABASE_URL no está definida');
  if (!key) throw new Error('SUPABASE_ANON_KEY no está definida');
  return createClient<Database>(url, key);
}
