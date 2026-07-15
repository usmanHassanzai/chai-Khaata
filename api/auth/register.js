import { registerErrorResponse, registerNewUser } from '../../server/registerUser.js';
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
    const result = await registerNewUser(body);

    if (!result.ok) {
      sendJson(res, result.status, { error: result.error, message: result.message });
      return;
    }

    sendJson(res, result.status, result.body);
  } catch (err) {
    console.error('Register error:', err);
    const failure = registerErrorResponse(err);
    sendJson(res, failure.status, { error: failure.error, message: failure.message });
  }
}

export const config = { maxDuration: 30 };
