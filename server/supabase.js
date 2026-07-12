import { createClient } from '@supabase/supabase-js';

let client = null;

export function isSupabaseEnabled() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Fail fast with a clear message before any DB call. */
export function validateSupabaseConfig() {
  const url = String(process.env.SUPABASE_URL || '').trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!url || !key) {
    return {
      ok: false,
      error: 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in Vercel',
      hint: 'Supabase → Project Settings → API → copy Project URL + Secret key',
    };
  }

  if (key.startsWith('sb_publishable_')) {
    return {
      ok: false,
      error: 'Wrong key: Publishable key cannot access the database',
      hint: 'Use the Secret key (sb_secret_…) in SUPABASE_SERVICE_ROLE_KEY',
    };
  }

  if (!url.includes('supabase.co') && !url.includes('supabase.in')) {
    return {
      ok: false,
      error: 'SUPABASE_URL does not look like a Supabase project URL',
      hint: 'Should be like https://xxxxx.supabase.co',
    };
  }

  return { ok: true };
}

function fetchWithTimeout(url, options = {}) {
  const ms = 8000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export function getSupabase() {
  const config = validateSupabaseConfig();
  if (!config.ok) {
    throw new Error(config.error);
  }

  if (!client) {
    client = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: fetchWithTimeout },
      },
    );
  }

  return client;
}
