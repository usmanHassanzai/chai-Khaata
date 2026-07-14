import { ensureBootstrapAdmin } from '../server/bootstrap.js';
import { getStorageMode, testSupabaseConnection, validateSupabaseConfig } from '../server/supabase.js';
import { setCors } from '../server/httpUtils.js';

export default async function handler(_req, res) {
  setCors(res);
  const bootstrap = await ensureBootstrapAdmin();
  const storage = getStorageMode();
  const configCheck = validateSupabaseConfig();
  const connection = storage === 'supabase' ? await testSupabaseConnection() : { ok: true };

  res.statusCode = 200;
  res.end(JSON.stringify({
    ok: bootstrap.ok !== false && connection.ok !== false,
    service: 'chai-khata-auth',
    sync: true,
    storage,
    supabase: {
      envSet: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
      valid: configCheck.ok,
      connected: connection.ok,
      error: connection.ok ? null : connection.reason,
      hint: configCheck.hint ?? null,
    },
    bootstrap,
    publicUrl: process.env.PUBLIC_SERVER_URL?.trim()
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null),
  }));
}

export const config = { maxDuration: 10 };
