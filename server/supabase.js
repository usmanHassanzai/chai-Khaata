import { createClient } from '@supabase/supabase-js';
import { isServerlessEnv } from './dataPaths.js';

let client = null;

const PLACEHOLDER_PATTERN = /YOUR_PROJECT|your-service-role|your-project|example\.com|placeholder|change-me/i;

export function supabaseEnvPresent() {
  return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

/** Fail fast with a clear message before any DB call. */
export function normalizeSupabaseUrl(url) {
  let normalized = String(url || '').trim();
  if (!normalized) return normalized;
  normalized = normalized.replace(/\/+$/, '');
  normalized = normalized.replace(/\/rest\/v1$/i, '');
  return normalized;
}

export function validateSupabaseConfig() {
  const url = normalizeSupabaseUrl(process.env.SUPABASE_URL);
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
  if (process.env.STORAGE === 'file') return false;
  // Local dev file storage — never on Vercel (read-only filesystem)
  if (process.env.USE_FILE_STORAGE === 'true' && !isServerlessEnv()) return false;
  if (!supabaseEnvPresent()) return false;
  return validateSupabaseConfig().ok;
}

/** On Vercel/serverless, Supabase is required for persistent data. */
export function requiresSupabaseOnServerless() {
  return isServerlessEnv() && !isSupabaseEnabled();
}

export function getStorageMode() {
  if (isSupabaseEnabled()) return 'supabase';
  if (isServerlessEnv()) return 'file-tmp';
  return 'file';
}

function fetchWithTimeout(url, options = {}) {
  const ms = 60000;
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
    const url = normalizeSupabaseUrl(process.env.SUPABASE_URL);
    client = createClient(
      url,
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
    const { error: usersError } = await getSupabase().from('users').select('id').limit(1);
    if (usersError) {
      return { ok: false, reason: usersError.message || 'Supabase query failed' };
    }

    const { error: ledgerError } = await getSupabase().from('ledger_snapshots').select('user_id').limit(1);
    if (ledgerError) {
      const msg = ledgerError.message || 'ledger_snapshots query failed';
      if (/relation.*ledger_snapshots.*does not exist|could not find.*ledger_snapshots/i.test(msg)) {
        return {
          ok: false,
          reason: 'ledger_snapshots table missing — run supabase/schema.sql in Supabase SQL Editor',
        };
      }
      return { ok: false, reason: msg };
    }

    return { ok: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Connection failed';
    return { ok: false, reason };
  }
}
