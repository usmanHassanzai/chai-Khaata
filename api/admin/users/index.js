import { sendJson, setCors, withTimeout } from '../../../server/httpUtils.js';

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

  const { requireAdmin } = await import('../../../server/adminAuth.js');
  if (!requireAdmin(req, res)) return;

  try {
    const { listAdminUsers, ADMIN_QUERY_TIMEOUT_MS } = await import('../../../server/adminUsersHandlers.js');
    const url = new URL(req.url || '/', 'http://localhost');
    const result = await withTimeout(listAdminUsers(url.searchParams), ADMIN_QUERY_TIMEOUT_MS, 'List users');
    sendJson(res, 200, result);
  } catch (err) {
    console.error('Admin list users error:', err);
    const { adminHandlerError } = await import('../../../server/adminUsersHandlers.js');
    const failure = adminHandlerError(err);
    sendJson(res, failure.status, failure.body);
  }
}

export const config = { maxDuration: 15 };
