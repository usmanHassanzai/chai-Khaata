import { setCors, sendJson } from '../server/httpUtils.js';
import { getStorageMode, testSupabaseConnection, validateSupabaseConfig } from '../server/supabase.js';

/** Fast health ping — no bootstrap or email checks (those slow every page load). */
export default async function handler(_req, res) {
  setCors(res);
  const storage = getStorageMode();
  const configCheck = validateSupabaseConfig();
  const connection = storage === 'supabase'
    ? await testSupabaseConnection()
    : { ok: true };

  sendJson(res, 200, {
    ok: configCheck.ok && connection.ok !== false,
    service: 'chai-khata-auth',
    sync: true,
    storage,
    supabase: {
      envSet: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
      valid: configCheck.ok,
      connected: connection.ok,
      error: connection.ok ? null : connection.reason,
    },
    publicUrl: process.env.PUBLIC_SERVER_URL?.trim()
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null),
  });
}

export const config = { maxDuration: 10 };
