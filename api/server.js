import { createVercelApiHandler, normalizeVercelUrl, vercelFunctionConfig } from '../server/vercelHandler.js';
import { handleSyncLedgerRequest } from '../server/syncLedgerApi.js';
import { setCors, sendJson } from '../server/httpUtils.js';

const expressHandler = createVercelApiHandler();

/**
 * Catch-all API. Sync is handled here too as a safety net (dedicated
 * /api/sync/ledger is preferred via vercel.json rewrite).
 * Express import is raced so a hung cold-start returns 503 instead of infinite hang.
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
        }, 25000);
      }),
    ]);
  } catch (err) {
    if (res.headersSent || res.writableEnded) return;
    console.error('api/server error:', err);
    sendJson(res, err?.code === 'TIMEOUT' ? 503 : 500, {
      error: err?.code === 'TIMEOUT' ? 'TIMEOUT' : 'SERVER_ERROR',
      message: err?.code === 'TIMEOUT'
        ? 'Server is warming up. Please retry in a few seconds.'
        : (err?.message || 'API unavailable'),
    });
  }
}

export const config = vercelFunctionConfig;
