import { setCors, sendJson, readJsonBody, withTimeout, sanitizeAuthErrorMessage } from '../../server/httpUtils.js';

function mapLoginError(err, res) {
  const code = err?.code || 'SERVER_ERROR';
  if (code === 'VALIDATION') return sendJson(res, 400, { error: code, message: err.message });
  if (code === 'INVALID_CREDENTIALS') return sendJson(res, 401, { error: code, message: err.message });
  if (code === 'PENDING_APPROVAL' || code === 'REJECTED') {
    return sendJson(res, 403, { error: code, message: err.message, user: err.user });
  }
  if (code === 'PAYMENT_DUE' || code === 'SUBSCRIPTION_EXPIRED') {
    return sendJson(res, 403, { error: code, message: err.message, user: err.user });
  }
  if (code === 'SERVER_CONFIG') {
    return sendJson(res, 503, { error: code, message: err.message, hint: err.hint });
  }
  if (/timed out after/i.test(String(err?.message || ''))) {
    return sendJson(res, 503, { error: 'TIMEOUT', message: 'Login took too long. Please retry.' });
  }
  console.error('Login error:', err);
  return sendJson(res, 500, { error: 'SERVER_ERROR', message: sanitizeAuthErrorMessage(err) });
}

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
    const { performLogin } = await import('../../server/authLogin.js');
    const result = await withTimeout(
      performLogin(loginValue, body.password),
      15000,
      'Login',
    );
    sendJson(res, 200, result);
  } catch (err) {
    mapLoginError(err, res);
  }
}

export const config = { maxDuration: 20 };
