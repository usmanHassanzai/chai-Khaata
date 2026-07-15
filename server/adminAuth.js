import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './env.js';
import { sendJson } from './httpUtils.js';

/** @returns {{ userId: string, role: string } | null} Sends JSON error and returns null when unauthorized. */
export function requireAdmin(req, res) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header?.startsWith('Bearer ')) {
    sendJson(res, 401, { error: 'UNAUTHORIZED', message: 'Login required' });
    return null;
  }

  try {
    const payload = jwt.verify(String(header).slice(7), JWT_SECRET);
    if (payload.role !== 'admin') {
      sendJson(res, 403, { error: 'FORBIDDEN', message: 'Admin access required' });
      return null;
    }
    return { userId: payload.sub, role: payload.role };
  } catch {
    sendJson(res, 401, { error: 'INVALID_TOKEN', message: 'Session expired. Please login again.' });
    return null;
  }
}
