import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Brauzerdə yalnız ictimai (publishable / anon) açar istifadə olunur.
 * `service_role` açarı heç vaxt frontend kodunda və VITE_* dəyişənlərində olmamalıdır;
 * icazələr Postgres RLS siyasətləri ilə serverdə yoxlanılır.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

export const isConfigured = Boolean(url && key);

export const supabase = (isConfigured
  ? createClient(url as string, key as string, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : undefined) as SupabaseClient;

export class NotConfiguredError extends Error {
  constructor() {
    super('not-configured');
    this.name = 'NotConfiguredError';
  }
}
