import { requireAdmin } from '../../server/adminAuth.js';
import { listAdminOtpRequests, adminHandlerError } from '../../server/adminUsersHandlers.js';
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
    const result = await withTimeout(listAdminOtpRequests(), 8000, 'OTP requests');
    sendJson(res, 200, result);
  } catch (err) {
    console.error('Admin OTP requests error:', err);
    const failure = adminHandlerError(err);
    sendJson(res, failure.status, failure.body);
  }
}

export const config = { maxDuration: 10 };
