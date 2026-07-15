import jwt from 'jsonwebtoken';
import { setCors, sendJson, withTimeout } from '../../server/httpUtils.js';
import { JWT_SECRET, ADMIN_EMAIL } from '../../server/env.js';
import { findUserById, isPaymentBlocked, paymentDueAmount, publicUser } from '../../server/store.js';
import { isSubscriptionExpired } from '../../server/subscriptions.js';
import { isTrialActive } from '../../server/trialAccess.js';

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

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'GET only' });
    return;
  }

  const userId = readUserId(req);
  if (!userId) {
    sendJson(res, 401, { error: 'UNAUTHORIZED', message: 'Login required' });
    return;
  }

  try {
    const user = await withTimeout(findUserById(userId), 8000, 'Profile lookup');
    if (!user) {
      sendJson(res, 404, { error: 'NOT_FOUND', message: 'User not found' });
      return;
    }

    if (user.status !== 'approved' && user.role !== 'admin') {
      if (user.status === 'pending' && isTrialActive(user)) {
        sendJson(res, 200, { user: publicUser(user) });
        return;
      }
      sendJson(res, 403, {
        error: user.status === 'pending' ? 'PENDING_APPROVAL' : 'REJECTED',
        message: user.status === 'pending'
          ? `Your account is waiting for admin approval (${ADMIN_EMAIL}).`
          : `Your account was not approved. Contact admin at ${ADMIN_EMAIL}.`,
        user: publicUser(user),
      });
      return;
    }

    if (isPaymentBlocked(user)) {
      const due = paymentDueAmount(user);
      sendJson(res, 403, {
        error: 'PAYMENT_DUE',
        message: `Your account is suspended. Payment due: Rs ${due.toLocaleString()}.`,
        user: publicUser(user),
        paymentDue: due,
      });
      return;
    }

    if (isSubscriptionExpired(user)) {
      sendJson(res, 403, {
        error: 'SUBSCRIPTION_EXPIRED',
        message: 'Your subscription expired. Renew to continue.',
        user: publicUser(user),
      });
      return;
    }

    sendJson(res, 200, { user: publicUser(user) });
  } catch (err) {
    if (/timed out after/i.test(String(err?.message || ''))) {
      sendJson(res, 503, { error: 'TIMEOUT', message: 'Profile load timed out. Please retry.' });
      return;
    }
    console.error('Me error:', err);
    sendJson(res, 500, { error: 'SERVER_ERROR', message: 'Could not fetch profile' });
  }
}

export const config = { maxDuration: 15 };
