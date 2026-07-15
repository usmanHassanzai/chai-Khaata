import { sendJson, setCors, withTimeout } from '../../server/httpUtils.js';
import { createVercelApiHandler, normalizeVercelUrl } from '../../server/vercelHandler.js';

/** Lightweight GET routes — avoid loading Express for admin list reads. */
const LIGHT_GET_ROUTES = new Set([
  'dashboard',
  'users',
  'users/summary',
  'otp-requests',
  'payment-submissions',
]);

function adminSubPath(req) {
  const url = new URL(req.url || '/', 'http://localhost');
  const match = url.pathname.match(/^\/api\/admin\/?(.*)$/);
  return (match?.[1] ?? '').replace(/\/$/, '');
}

async function handleLightGet(req, res, subPath) {
  const { requireAdmin } = await import('../../server/adminAuth.js');
  if (!requireAdmin(req, res)) return;

  const {
    listAdminUsers,
    getAdminUsersSummary,
    getAdminDashboard,
    listAdminOtpRequests,
    adminHandlerError,
    ADMIN_QUERY_TIMEOUT_MS,
  } = await import('../../server/adminUsersHandlers.js');

  const url = new URL(req.url || '/', 'http://localhost');

  try {
    if (subPath === 'dashboard') {
      const result = await withTimeout(getAdminDashboard(url.searchParams), ADMIN_QUERY_TIMEOUT_MS, 'Admin dashboard');
      sendJson(res, 200, result);
      return;
    }

    if (subPath === 'users') {
      const result = await withTimeout(listAdminUsers(url.searchParams), ADMIN_QUERY_TIMEOUT_MS, 'List users');
      sendJson(res, 200, result);
      return;
    }

    if (subPath === 'users/summary') {
      const counts = await withTimeout(getAdminUsersSummary(), ADMIN_QUERY_TIMEOUT_MS, 'User summary');
      sendJson(res, 200, counts);
      return;
    }

    if (subPath === 'otp-requests') {
      const result = await withTimeout(listAdminOtpRequests(), ADMIN_QUERY_TIMEOUT_MS, 'OTP requests');
      sendJson(res, 200, result);
      return;
    }

    if (subPath === 'payment-submissions') {
      const { listPendingSubmissions, publicSubmission } = await import('../../server/paymentSubmissions.js');
      const submissions = await withTimeout(listPendingSubmissions(), ADMIN_QUERY_TIMEOUT_MS, 'Payment submissions');
      sendJson(res, 200, { submissions: submissions.map(publicSubmission) });
    }
  } catch (err) {
    console.error(`Admin ${subPath} error:`, err);
    const failure = adminHandlerError(err);
    sendJson(res, failure.status, failure.body);
  }
}

async function forwardToExpress(req, res) {
  normalizeVercelUrl(req);
  const handler = createVercelApiHandler();
  return handler(req, res);
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const subPath = adminSubPath(req);

  if (req.method === 'GET' && LIGHT_GET_ROUTES.has(subPath)) {
    await handleLightGet(req, res, subPath);
    return;
  }

  await forwardToExpress(req, res);
}

export const config = { maxDuration: 60 };
