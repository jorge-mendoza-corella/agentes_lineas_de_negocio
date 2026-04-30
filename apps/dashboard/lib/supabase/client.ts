import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@agentes/db';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      'Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY deben estar en .env.local'
    );
  }
  return createBrowserClient<Database>(url, key);
}
