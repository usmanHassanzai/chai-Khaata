import { performLogin } from '../../server/authLogin.js';
import { readJsonBody, sendJson, setCors, sanitizeAuthErrorMessage } from '../../server/httpUtils.js';

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'POST only' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const loginValue = body.login ?? body.email ?? body.username;
    const result = await performLogin(loginValue, body.password);
    sendJson(res, 200, result);
  } catch (err) {
    const code = err?.code || 'SERVER_ERROR';
    const status =
      code === 'VALIDATION' ? 400
        : code === 'INVALID_CREDENTIALS' ? 401
          : code === 'PENDING_APPROVAL' || code === 'REJECTED' || code === 'PAYMENT_DUE' || code === 'SUBSCRIPTION_EXPIRED' ? 403
            : code === 'SERVER_CONFIG' ? 503
              : 500;

    sendJson(res, status, {
      error: code,
      message: code === 'SERVER_ERROR' ? sanitizeAuthErrorMessage(err) : (err instanceof Error ? err.message : 'Login failed'),
      user: err?.user,
      hint: code === 'SERVER_CONFIG'
        ? 'Fix SUPABASE_SERVICE_ROLE_KEY in Vercel (use Secret key sb_secret_…), then Redeploy'
        : undefined,
    });
  }
}

export const config = { maxDuration: 30 };
