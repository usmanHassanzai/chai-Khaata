import { ensureBootstrapAdmin } from '../server/bootstrap.js';
import { isSupabaseEnabled } from '../server/supabase.js';

export default async function handler(_req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  let bootstrap = null;
  if (isSupabaseEnabled()) {
    try {
      bootstrap = await ensureBootstrapAdmin();
    } catch (err) {
      bootstrap = {
        ok: false,
        error: err instanceof Error ? err.message : 'Bootstrap failed',
        hint: 'Check Vercel env: SUPABASE_URL + Secret key (not Publishable key)',
      };
    }
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
