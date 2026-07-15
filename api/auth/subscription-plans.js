import { setCors, sendJson } from '../../server/httpUtils.js';
import { getSubscriptionPlans } from '../../server/subscriptions.js';

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

  sendJson(res, 200, { plans: getSubscriptionPlans() });
}

export const config = { maxDuration: 10 };
