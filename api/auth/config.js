import { setCors, sendJson } from '../../server/httpUtils.js';
import { ADMIN_EMAIL } from '../../server/env.js';
import { getPaymentConfig } from '../../server/paymentConfig.js';
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

  const publicUrl =
    process.env.PUBLIC_SERVER_URL?.trim()
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

  sendJson(res, 200, {
    adminEmail: ADMIN_EMAIL,
    requiresApproval: true,
    subscriptionPlans: getSubscriptionPlans(),
    otpDelivery: {
      emailConfigured: Boolean(process.env.BREVO_API_KEY || process.env.SMTP_HOST),
      smsConfigured: Boolean(process.env.TWILIO_ACCOUNT_SID),
    },
    publicServerUrl: publicUrl,
    cloudSync: true,
    payment: getPaymentConfig(),
  });
}

export const config = { maxDuration: 10 };
