import { setCors, sendJson, readJsonBody, withTimeout, sanitizeAuthErrorMessage } from '../../server/httpUtils.js';
import { registerNewUser, registerErrorResponse } from '../../server/registerUser.js';

/** Dedicated register — bypasses hanging Express catch-all on Vercel. */
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
    const result = await withTimeout(registerNewUser(body ?? {}), 20000, 'Register');
    if (!result.ok) {
      sendJson(res, result.status, { error: result.error, message: result.message });
      return;
    }
    sendJson(res, result.status, result.body);
  } catch (err) {
    const failure = registerErrorResponse(err);
    if (failure) {
      sendJson(res, failure.status, { error: failure.error, message: failure.message });
      return;
    }
    console.error('Register error:', err);
    sendJson(res, 500, { error: 'SERVER_ERROR', message: sanitizeAuthErrorMessage(err) });
  }
}

export const config = { maxDuration: 30 };
