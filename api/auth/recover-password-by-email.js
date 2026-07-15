import { setCors, sendJson, readJsonBody, withTimeout } from '../../server/httpUtils.js';

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
    const { recoverPasswordByEmail } = await import('../../server/passwordRecovery.js');
    const result = await withTimeout(
      recoverPasswordByEmail(body.email),
      15000,
      'Password recovery',
    );
    sendJson(res, 200, result);
  } catch (err) {
    const code = err?.code || 'SERVER_ERROR';
    const status = code === 'VALIDATION' ? 400 : code === 'NOT_FOUND' ? 404 : code === 'EMAIL_FAILED' ? 503 : 500;
    sendJson(res, status, {
      error: code,
      message: err instanceof Error ? err.message : 'Could not recover password',
    });
  }
}

export const config = { maxDuration: 20 };
