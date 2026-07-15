import jwt from 'jsonwebtoken';
import { setCors, sendJson, readJsonBody, withTimeout } from '../../server/httpUtils.js';
import { JWT_SECRET } from '../../server/env.js';

function readUserId(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header?.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(String(header).slice(7), JWT_SECRET);
    return payload.sub;
  } catch {
    return null;
  }
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

  const userId = readUserId(req);
  if (!userId) {
    sendJson(res, 401, { error: 'UNAUTHORIZED', message: 'Login required' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const { changePasswordForUser, mapChangePasswordError } = await import('../../server/changePassword.js');
    const result = await withTimeout(
      changePasswordForUser(userId, body.currentPassword, body.newPassword),
      20000,
      'Change password',
    );
    sendJson(res, 200, result);
  } catch (err) {
    const { mapChangePasswordError } = await import('../../server/changePassword.js');
    mapChangePasswordError(err, res, sendJson);
  }
}

export const config = { maxDuration: 25 };
