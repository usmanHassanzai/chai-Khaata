import { runSubscriptionExpiryReminders } from '../../server/subscriptionReminders.js';
import { sendJson, setCors } from '../../server/httpUtils.js';

function isAuthorized(req) {
  const secret = String(process.env.CRON_SECRET || '').trim();
  if (!secret) {
    // Allow in local dev when no secret is set
    return process.env.NODE_ENV !== 'production' && !process.env.VERCEL;
  }

  const auth = String(req.headers?.authorization || '');
  if (auth === `Bearer ${secret}`) return true;

  const url = new URL(req.url || '/', 'http://localhost');
  return url.searchParams.get('secret') === secret;
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'GET or POST only' });
    return;
  }

  if (!isAuthorized(req)) {
    sendJson(res, 401, { error: 'UNAUTHORIZED', message: 'Invalid or missing CRON_SECRET' });
    return;
  }

  try {
    const result = await runSubscriptionExpiryReminders();
    sendJson(res, 200, {
      ok: true,
      message: `Expiry reminders: ${result.sent} sent, ${result.skipped} skipped`,
      ...result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Reminder job failed';
    console.error('[Chai Khata] Subscription reminder cron error:', err);
    sendJson(res, 500, { error: 'SERVER_ERROR', message });
  }
}

export const config = { maxDuration: 60 };
