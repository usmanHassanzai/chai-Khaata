export default async function handler(_req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const hasSupabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  let keyOk = hasSupabase && !key.startsWith('sb_publishable_');

  res.statusCode = 200;
  res.end(JSON.stringify({
    ok: true,
    service: 'chai-khata-auth',
    sync: true,
    storage: hasSupabase ? 'supabase' : 'file',
    supabaseKeyValid: keyOk,
    hint: !keyOk && hasSupabase
      ? 'Fix SUPABASE_SERVICE_ROLE_KEY — use Secret key (sb_secret_…), not Publishable'
      : !hasSupabase
        ? 'Add SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in Vercel'
        : 'Open /api/auth/login after creating admin in Supabase',
    publicUrl: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  }));
}

export const config = { maxDuration: 10 };
