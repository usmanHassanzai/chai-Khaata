import { setCors, sendJson, readJsonBody, withTimeout } from '../../server/httpUtils.js';
import { performLogin } from '../../server/authLogin.js';
import { sanitizeAuthErrorMessage } from '../../server/httpUtils.js';

/** Dedicated login function — avoids the heavy Express serverless entry. */
export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'Use POST' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const loginValue = body?.login ?? body?.email ?? body?.username;
    const result = await withTimeout(performLogin(loginValue, body?.password), 18000, 'Login');
    sendJson(res, 200, result);
  } catch (err) {
    const code = err?.code || 'SERVER_ERROR';
    if (code === 'VALIDATION') {
      sendJson(res, 400, { error: code, message: err.message });
      return;
    }
    if (code === 'INVALID_CREDENTIALS') {
      sendJson(res, 401, { error: code, message: err.message });
      return;
    }
    if (code === 'PENDING_APPROVAL' || code === 'REJECTED') {
      sendJson(res, 403, { error: code, message: err.message, user: err.user });
      return;
    }
    if (code === 'PAYMENT_DUE' || code === 'SUBSCRIPTION_EXPIRED') {
      sendJson(res, 403, { error: code, message: err.message, user: err.user });
      return;
    }
    if (code === 'SERVER_CONFIG' || code === 'TIMEOUT') {
      sendJson(res, 503, { error: code, message: err.message, hint: err.hint });
      return;
    }
    console.error('Login error:', err);
    sendJson(res, 500, { error: 'SERVER_ERROR', message: sanitizeAuthErrorMessage(err) });
  }
}

export const config = { maxDuration: 30 };
