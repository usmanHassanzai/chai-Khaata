import jwt from 'jsonwebtoken';
import { setCors, sendJson, withTimeout } from '../../server/httpUtils.js';
import { ADMIN_EMAIL, JWT_SECRET } from '../../server/env.js';
import {
  findUserById,
  isPaymentBlocked,
  paymentDueAmount,
  publicUser,
} from '../../server/store.js';
import { isSubscriptionAccessBlocked } from '../../server/renewalGrace.js';
import { isTrialActive } from '../../server/trialAccess.js';

/**
 * Dedicated session profile — bypasses hanging Express /api/server.
 */
export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'Use GET' });
    return;
  }

  const header = req.headers.authorization || req.headers.Authorization;
  if (!header?.startsWith('Bearer ')) {
    sendJson(res, 401, { error: 'UNAUTHORIZED', message: 'Login required' });
    return;
  }

  let userId;
  try {
    const payload = jwt.verify(String(header).slice(7), JWT_SECRET);
    userId = payload.sub;
  } catch {
    sendJson(res, 401, { error: 'INVALID_TOKEN', message: 'Session expired. Please login again.' });
    return;
  }

  try {
    const user = await withTimeout(findUserById(userId), 10000, 'Profile lookup');
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
        message: `Your account is suspended. Payment due: Rs ${due.toLocaleString()}. Upload payment screenshot below or contact admin at ${ADMIN_EMAIL}.`,
        user: publicUser(user),
        paymentDue: due,
      });
      return;
    }

    if (isSubscriptionAccessBlocked(user)) {
      const expires = user.subscriptionExpiresAt
        ? new Date(user.subscriptionExpiresAt).toLocaleDateString()
        : '';
      sendJson(res, 403, {
        error: 'SUBSCRIPTION_EXPIRED',
        message: `Your subscription expired${expires ? ` on ${expires}` : ''}. Renew your plan to continue using Chai Khata.`,
        user: publicUser(user),
      });
      return;
    }

    sendJson(res, 200, { user: publicUser(user) });
  } catch (err) {
    console.error('Me error:', err);
    const code = err?.code === 'TIMEOUT' ? 503 : 500;
    sendJson(res, code, {
      error: err?.code === 'TIMEOUT' ? 'TIMEOUT' : 'SERVER_ERROR',
      message: err?.code === 'TIMEOUT' ? 'Profile lookup timed out' : 'Could not fetch profile',
    });
  }
}

export const config = { maxDuration: 20 };
