import { createClient } from '@supabase/supabase-js';

let client = null;

const PLACEHOLDER_PATTERN = /YOUR_PROJECT|your-service-role|your-project|example\.com|placeholder|change-me/i;

export function supabaseEnvPresent() {
  return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
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

  if (PLACEHOLDER_PATTERN.test(url) || PLACEHOLDER_PATTERN.test(key)) {
    return {
      ok: false,
      error: 'Supabase credentials are still placeholders — replace with real values',
      hint: 'Copy Project URL + Secret key from Supabase dashboard into .env or Vercel env vars',
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

/** Use Supabase only when credentials are real and valid (not .env placeholders). */
export function isSupabaseEnabled() {
  if (process.env.STORAGE === 'file' || process.env.USE_FILE_STORAGE === 'true') return false;
  if (!supabaseEnvPresent()) return false;
  return validateSupabaseConfig().ok;
}

export function getStorageMode() {
  return isSupabaseEnabled() ? 'supabase' : 'file';
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

/** Quick connectivity check (used on health / bootstrap). */
export async function testSupabaseConnection() {
  if (!isSupabaseEnabled()) {
    return { ok: false, reason: 'Supabase not configured — using local file storage' };
  }
  try {
    const { error } = await getSupabase().from('users').select('id').limit(1);
    if (error) {
      return { ok: false, reason: error.message || 'Supabase query failed' };
    }
    return { ok: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Connection failed';
    return { ok: false, reason };
  }
}
