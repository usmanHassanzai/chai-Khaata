import { setCors, sendJson, withTimeout } from '../server/httpUtils.js';

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

  const { requireAdmin } = await import('../server/adminAuth.js');
  if (!requireAdmin(req, res)) return;

  const url = new URL(req.url || '/', 'http://localhost');
  const route = url.searchParams.get('route') || 'dashboard';

  const {
    listAdminUsers,
    getAdminUsersSummary,
    getAdminDashboard,
    listAdminOtpRequests,
    adminHandlerError,
    ADMIN_QUERY_TIMEOUT_MS,
  } = await import('../server/adminUsersHandlers.js');

  try {
    if (route === 'dashboard') {
      const result = await withTimeout(getAdminDashboard(url.searchParams), ADMIN_QUERY_TIMEOUT_MS, 'Admin dashboard');
      sendJson(res, 200, result);
      return;
    }

    if (route === 'users') {
      const result = await withTimeout(listAdminUsers(url.searchParams), ADMIN_QUERY_TIMEOUT_MS, 'List users');
      sendJson(res, 200, result);
      return;
    }

    if (route === 'summary') {
      const counts = await withTimeout(getAdminUsersSummary(), ADMIN_QUERY_TIMEOUT_MS, 'User summary');
      sendJson(res, 200, counts);
      return;
    }

    if (route === 'otp') {
      const result = await withTimeout(listAdminOtpRequests(), ADMIN_QUERY_TIMEOUT_MS, 'OTP requests');
      sendJson(res, 200, result);
      return;
    }

    if (route === 'payments') {
      const { listPendingSubmissionsMeta } = await import('../server/paymentSubmissions.js');
      const submissions = await withTimeout(listPendingSubmissionsMeta(), ADMIN_QUERY_TIMEOUT_MS, 'Payment submissions');
      sendJson(res, 200, { submissions });
      return;
    }

    sendJson(res, 404, { error: 'NOT_FOUND', message: 'Unknown admin route' });
  } catch (err) {
    console.error(`Admin ${route} error:`, err);
    const failure = adminHandlerError(err);
    sendJson(res, failure.status, failure.body);
  }
}

export const config = { maxDuration: 20 };
