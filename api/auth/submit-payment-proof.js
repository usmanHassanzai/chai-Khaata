import { setCors, sendJson, readJsonBody, withTimeout } from '../../server/httpUtils.js';

function resolveAction(req) {
  const url = new URL(req.url || '/', 'http://localhost');
  return url.searchParams.get('action') || '';
}

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

  const action = resolveAction(req);

  try {
    const body = await readJsonBody(req);
    const loginValue = body.login ?? body.email ?? body.username;

    if (action === 'check') {
      const { checkPaymentSubmissionByLogin } = await import('../../server/paymentProofHandlers.js');
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
      return;
    }

    const { submitPaymentProofByLogin } = await import('../../server/paymentProofHandlers.js');
    const result = await withTimeout(
      submitPaymentProofByLogin(loginValue, body.password, body.screenshot, body.subscriptionPlan),
      20000,
      'Submit payment proof',
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
    console.error(action === 'check' ? 'Check payment submission error:' : 'Submit payment proof error:', err);
    sendJson(res, 500, { error: 'SERVER_ERROR', message: 'Could not process payment request' });
  }
}

export const config = { maxDuration: 25 };
