export default async function handler(_req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  let bootstrap = null;
  let storage = 'file';

  try {
    const { isSupabaseEnabled } = await import('../server/supabase.js');
    storage = isSupabaseEnabled() ? 'supabase' : 'file';

    if (isSupabaseEnabled()) {
      const { ensureBootstrapAdmin } = await import('../server/bootstrap.js');
      bootstrap = await ensureBootstrapAdmin();
    } else {
      bootstrap = {
        ok: false,
        error: 'Supabase not configured on server',
        hint: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel, then Redeploy.',
      };
    }
  } catch (err) {
    bootstrap = {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      hint: 'Check Vercel function logs for details.',
    };
  }

  res.statusCode = 200;
  res.end(JSON.stringify({
    ok: true,
    service: 'chai-khata-auth',
    sync: true,
    storage,
    publicUrl: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    bootstrap,
  }));
}

export const config = {
  maxDuration: 60,
};
