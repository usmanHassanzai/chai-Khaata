export function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export function sendJson(res, statusCode, data) {
  setCors(res);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

export async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

/** Map internal errors to safe login messages for the client. */
export function sanitizeAuthErrorMessage(err) {
  const msg = err instanceof Error ? err.message : String(err || '');
  if (/fetch failed|econnrefused|enotfound|etimedout|network|abort|enoent.*mkdir|read-only/i.test(msg)) {
    if (process.env.VERCEL) {
      return 'Database storage unavailable on server. Add SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in Vercel env vars, run supabase/schema.sql, then Redeploy.';
    }
    return 'Database connection failed. Run: npm run seed:local-admin && npm run dev';
  }
  if (/supabase|relation.*does not exist|permission denied|invalid api key/i.test(msg)) {
    return 'Database setup incomplete. Run supabase/schema.sql in Supabase SQL Editor, or use local file storage (npm run dev without SUPABASE_* in .env).';
  }
  return msg || 'Could not login';
}

export function withTimeout(promise, ms, label = 'Operation') {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    }),
  ]);
}
