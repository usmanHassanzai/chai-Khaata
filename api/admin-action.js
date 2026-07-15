import { setCors, sendJson, readJsonBody, withTimeout } from '../server/httpUtils.js';

const ACTION_TIMEOUT_MS = 15000;

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const { requireAdmin } = await import('../server/adminAuth.js');
  if (!requireAdmin(req, res)) return;

  const url = new URL(req.url || '/', 'http://localhost');
  const action = url.searchParams.get('action');
  const id = url.searchParams.get('id');

  if (!action || !id) {
    sendJson(res, 400, { error: 'VALIDATION', message: 'Missing action or id' });
    return;
  }

  try {
    const body = req.method === 'GET' ? {} : await readJsonBody(req);
    const actions = await import('../server/adminUserActions.js');
    let result;

    const run = async () => {
      switch (action) {
        case 'approve':
          if (req.method !== 'PATCH') throw methodError();
          return actions.approveUserById(id);
        case 'reject':
          if (req.method !== 'PATCH') throw methodError();
          return actions.rejectUserById(id);
        case 'delete':
          if (req.method !== 'POST') throw methodError();
          return actions.deleteUserById(id);
        case 'payment-due':
          if (req.method !== 'PATCH') throw methodError();
          return actions.setPaymentDueById(id, Number(body.amount), body.note);
        case 'mark-paid':
          if (req.method !== 'PATCH') throw methodError();
          return actions.markPaidById(id);
        case 'send-otp':
          if (req.method !== 'POST') throw methodError();
          return actions.sendOtpToUserById(id, body.channel);
        case 'send-password':
          if (req.method !== 'POST') throw methodError();
          return actions.sendPasswordToUserById(id);
        case 'approve-payment':
          if (req.method !== 'PATCH') throw methodError();
          return actions.approvePaymentSubmissionById(id);
        case 'reject-payment':
          if (req.method !== 'PATCH') throw methodError();
          return actions.rejectPaymentSubmissionById(id, body.note);
        default:
          return { status: 404, body: { error: 'NOT_FOUND', message: 'Unknown admin action' } };
      }
    };

    result = await withTimeout(run(), ACTION_TIMEOUT_MS, `Admin ${action}`);
    sendJson(res, result.status, result.body);
  } catch (err) {
    if (err?.code === 'METHOD_NOT_ALLOWED') {
      sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'Invalid method for action' });
      return;
    }
    const { mapAdminActionError } = await import('../server/adminUserActions.js');
    const failure = mapAdminActionError(err);
    sendJson(res, failure.status, failure.body);
  }
}

function methodError() {
  const err = new Error('METHOD_NOT_ALLOWED');
  err.code = 'METHOD_NOT_ALLOWED';
  throw err;
}

export const config = { maxDuration: 20 };
