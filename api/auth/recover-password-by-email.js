import { recoverPasswordByEmail } from '../../server/passwordRecovery.js';
import { readJsonBody, sendJson, setCors } from '../../server/httpUtils.js';

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
    const result = await recoverPasswordByEmail(body.email ?? body.login);

    if (!result.ok) {
      const status = result.error === 'EMAIL_FAILED' ? 503 : 400;
      sendJson(res, status, { error: result.error, message: result.message });
      return;
    }

    sendJson(res, 200, {
      message: result.message,
      sent: result.sent,
      maskedEmail: result.maskedEmail,
    });
  } catch (err) {
    console.error('Recover password error:', err);
    sendJson(res, 500, {
      error: 'SERVER_ERROR',
      message: err instanceof Error ? err.message : 'Could not process password recovery',
    });
  }
}

export const config = { maxDuration: 30 };
