import { createVercelApiHandler, normalizeVercelUrl, vercelFunctionConfig } from '../server/vercelHandler.js';
import { handleSyncLedgerRequest } from '../server/syncLedgerApi.js';
import { setCors, sendJson } from '../server/httpUtils.js';

const expressHandler = createVercelApiHandler();

/**
 * Catch-all API for laptop/admin routes.
 * Critical auth/sync paths use dedicated functions; this covers the rest.
 * NODEJS_HELPERS=0 is set in Vercel env recommendation — body stream stays readable.
 */
export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  normalizeVercelUrl(req);
  const path = String(req.url || '').split('?')[0];

  if (path === '/api/sync/ledger' || path.endsWith('/sync/ledger')) {
    return handleSyncLedgerRequest(req, res);
  }

  try {
    await Promise.race([
      expressHandler(req, res),
      new Promise((_, reject) => {
        setTimeout(() => {
          const err = new Error('API cold start timed out');
          err.code = 'TIMEOUT';
          reject(err);
        }, 28000);
      }),
    ]);
  } catch (err) {
    if (res.headersSent || res.writableEnded) return;
    console.error('api/server error:', err);
    sendJson(res, err?.code === 'TIMEOUT' ? 503 : 500, {
      error: err?.code === 'TIMEOUT' ? 'TIMEOUT' : 'SERVER_ERROR',
      message: err?.code === 'TIMEOUT'
        ? 'Server is warming up. Please refresh and try again.'
        : (err?.message || 'API unavailable'),
    });
  }
}

export const config = {
  ...vercelFunctionConfig,
};
