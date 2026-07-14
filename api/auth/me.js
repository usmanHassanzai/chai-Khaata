import jwt from 'jsonwebtoken';
import { findUserById, isPaymentBlocked, publicUser } from '../../server/store.js';
import { isSubscriptionExpired } from '../../server/subscriptions.js';
import { sendJson, setCors } from '../../server/httpUtils.js';
import { ADMIN_EMAIL, JWT_SECRET } from '../../server/env.js';
import { isTrialActive } from '../../server/trialAccess.js';

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const header = req.headers.authorization || req.headers.Authorization;
  if (!header?.startsWith('Bearer ')) {
    sendJson(res, 401, { error: 'UNAUTHORIZED', message: 'Login required' });
    return;
  }

  try {
    const payload = jwt.verify(String(header).slice(7), JWT_SECRET);
    const user = await findUserById(payload.sub);
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
          : `Your account was not approved.`,
        user: publicUser(user),
      });
      return;
    }

    if (isPaymentBlocked(user)) {
      sendJson(res, 403, { error: 'PAYMENT_DUE', message: 'Payment due', user: publicUser(user) });
      return;
    }

    if (isSubscriptionExpired(user)) {
      sendJson(res, 403, { error: 'SUBSCRIPTION_EXPIRED', message: 'Subscription expired', user: publicUser(user) });
      return;
    }

    sendJson(res, 200, { user: publicUser(user) });
  } catch {
    sendJson(res, 401, { error: 'INVALID_TOKEN', message: 'Session expired. Please login again.' });
  }
}

export const config = { maxDuration: 15 };
