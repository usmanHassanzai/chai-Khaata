import { requireAdmin } from '../../server/adminAuth.js';
import { listAdminUsers, adminHandlerError } from '../../server/adminUsersHandlers.js';
import { sendJson, setCors, withTimeout } from '../../server/httpUtils.js';

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'GET only' });
    return;
  }

  if (!requireAdmin(req, res)) return;

  try {
    const url = new URL(req.url || '/', 'http://localhost');
    const result = await withTimeout(listAdminUsers(url.searchParams), 8000, 'List users');
    sendJson(res, 200, result);
  } catch (err) {
    console.error('Admin list users error:', err);
    const failure = adminHandlerError(err);
    sendJson(res, failure.status, failure.body);
  }
}

export const config = { maxDuration: 15 };
