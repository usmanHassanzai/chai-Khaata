import { setCors, sendJson, readJsonBody, withTimeout } from '../../server/httpUtils.js';

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'POST only' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const { checkPaymentSubmissionByLogin } = await import('../../server/paymentProofHandlers.js');
    const loginValue = body.login ?? body.email ?? body.username;
    const result = await withTimeout(
      checkPaymentSubmissionByLogin(loginValue, body.password),
      12000,
      'Check payment submission',
    );

    if (!result.ok) {
      sendJson(res, result.status, { error: result.error, message: result.message });
      return;
    }

    sendJson(res, result.status, result.body);
  } catch (err) {
    if (/timed out after/i.test(String(err?.message || ''))) {
      sendJson(res, 503, { error: 'TIMEOUT', message: 'Request timed out. Please retry.' });
      return;
    }
    console.error('Check payment submission error:', err);
    sendJson(res, 500, { error: 'SERVER_ERROR', message: 'Could not check payment status' });
  }
}

export const config = { maxDuration: 15 };
