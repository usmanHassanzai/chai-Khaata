import bcrypt from 'bcryptjs';
import { ensureDefaultAdmin } from './store.js';
import { isSupabaseEnabled } from './supabase.js';

let bootstrapped = false;

function formatError(err) {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object') {
    if ('message' in err && err.message) return String(err.message);
    if ('details' in err && err.details) return String(err.details);
    if ('hint' in err && err.hint) return String(err.hint);
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}

function supabaseConfigHint() {
  const hasUrl = Boolean(process.env.SUPABASE_URL);
  const hasKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!hasUrl && !hasKey) {
    return 'Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel → Settings → Environment Variables, then Redeploy.';
  }
  if (!hasUrl) return 'SUPABASE_URL is missing in Vercel env vars.';
  if (!hasKey) return 'SUPABASE_SERVICE_ROLE_KEY is missing in Vercel env vars.';
  return 'Use the Secret key (sb_secret_… or legacy service_role JWT), not the Publishable key.';
}

/** Creates default admin in Supabase on first API call. */
export async function ensureBootstrapAdmin() {
  if (!isSupabaseEnabled()) {
    return {
      ok: false,
      storage: 'file',
      error: 'Supabase not connected — server is using temporary file storage',
      hint: supabaseConfigHint(),
    };
  }

  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  if (key.startsWith('sb_publishable_')) {
    return {
      ok: false,
      storage: 'supabase',
      error: 'Wrong Supabase key: Publishable key cannot write to the database',
      hint: 'In Supabase → Project Settings → API, copy the Secret key into SUPABASE_SERVICE_ROLE_KEY on Vercel, then Redeploy.',
    };
  }

  if (bootstrapped) {
    return { ok: true, storage: 'supabase', skipped: true };
  }

  try {
    const adminEmail = String(process.env.ADMIN_EMAIL || 'usmankhan14700@gmail.com').trim().toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const admin = await ensureDefaultAdmin(adminEmail, passwordHash);

    bootstrapped = true;
    return {
      ok: true,
      storage: 'supabase',
      email: admin.email,
      username: admin.username,
      role: admin.role,
      status: admin.status,
    };
  } catch (err) {
    const message = formatError(err);
    return {
      ok: false,
      storage: 'supabase',
      error: message,
      hint: message.includes('row-level security') || message.includes('permission')
        ? 'Use the Secret (service_role) key, not Publishable/anon key.'
        : supabaseConfigHint(),
    };
  }
}
