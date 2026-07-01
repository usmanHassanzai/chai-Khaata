import { createClient } from '@supabase/supabase-js';

let client = null;

export function isSupabaseEnabled() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getSupabase() {
  if (!isSupabaseEnabled()) {
    throw new Error('Supabase is not configured (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)');
  }

  if (!client) {
    client = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }

  return client;
}
