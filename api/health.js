import { ensureBootstrapAdmin } from '../server/bootstrap.js';
import { getStorageMode, validateSupabaseConfig } from '../server/supabase.js';
import { setCors } from '../server/httpUtils.js';

export default async function handler(_req, res) {
  setCors(res);
  const bootstrap = await ensureBootstrapAdmin();
  const storage = getStorageMode();
  const configCheck = validateSupabaseConfig();

  res.statusCode = 200;
  res.end(JSON.stringify({
    ok: bootstrap.ok !== false,
    service: 'chai-khata-auth',
    sync: true,
    storage,
    supabase: {
      envSet: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
      valid: configCheck.ok,
      hint: configCheck.hint ?? null,
    },
    bootstrap,
    publicUrl: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  }));
}

export const config = { maxDuration: 10 };
