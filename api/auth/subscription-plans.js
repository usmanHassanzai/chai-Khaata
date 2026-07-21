import { setCors, sendJson } from '../../server/httpUtils.js';
import { getSubscriptionPlans } from '../../server/subscriptions.js';

/** Dedicated subscription plans — used by laptop register / renew screens. */
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

  sendJson(res, 200, { plans: getSubscriptionPlans() });
}

export const config = { maxDuration: 10 };
