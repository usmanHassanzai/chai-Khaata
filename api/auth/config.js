import { getAuthConfig } from '../../server/authLogin.js';
import { sendJson, setCors } from '../../server/httpUtils.js';
import { getSubscriptionPlans } from '../../server/subscriptions.js';
import { otpDeliveryStatus } from '../../server/otpDelivery.js';

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const base = getAuthConfig();
  sendJson(res, 200, {
    adminEmail: base.adminEmail,
    requiresApproval: base.requiresApproval,
    subscriptionPlans: getSubscriptionPlans(),
    otpDelivery: otpDeliveryStatus(),
    publicServerUrl: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    cloudSync: true,
    supabase: base.supabase,
  });
}

export const config = { maxDuration: 10 };
