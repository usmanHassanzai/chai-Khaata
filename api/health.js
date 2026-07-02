import { ensureBootstrapAdmin } from '../server/bootstrap.js';
import { isSupabaseEnabled } from '../server/supabase.js';

export default async function handler(_req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  let bootstrap = null;
  if (isSupabaseEnabled()) {
    bootstrap = await ensureBootstrapAdmin();
  } else {
    bootstrap = {
      ok: false,
      error: 'Supabase not configured on server',
      hint: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel, then Redeploy.',
    };
  }

  res.status(200).json({
    ok: true,
    service: 'chai-khata-auth',
    sync: true,
    storage: isSupabaseEnabled() ? 'supabase' : 'file',
    publicUrl: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    bootstrap,
  });
}
