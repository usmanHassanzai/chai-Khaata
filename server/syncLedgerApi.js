import jwt from 'jsonwebtoken';
import { sendJson, readJsonBody, withTimeout } from './httpUtils.js';
import { JWT_SECRET } from './env.js';
import { isServerlessEnv } from './dataPaths.js';
import { readLedger, writeLedger, shouldAcceptIncoming, applyLedgerChanges, getLedgerUpdatedAt } from './ledgerStore.js';
import { isSupabaseEnabled } from './supabase.js';

function readUserId(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header?.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(String(header).slice(7), JWT_SECRET);
    return payload.sub;
  } catch {
    return null;
  }
}

function syncNotConfigured(res) {
  sendJson(res, 503, {
    error: 'SERVER_CONFIG',
    message: 'Cloud database not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel, run supabase/schema.sql, then redeploy.',
  });
}

function formatSyncError(err) {
  const msg = err instanceof Error ? err.message : String(err || '');
  if (/relation.*ledger_.*does not exist|could not find.*ledger_/i.test(msg)) {
    return 'Cloud sync tables missing. Run supabase/schema.sql (ledger_* tables) in Supabase SQL Editor, then redeploy.';
  }
  if (/relation.*ledger_snapshots.*does not exist|could not find.*ledger_snapshots/i.test(msg)) {
    return 'Cloud sync table missing. Run supabase/schema.sql in Supabase SQL Editor, then redeploy.';
  }
  if (/invalid api key|jwt|unregistered api key/i.test(msg)) {
    return 'Supabase credentials invalid on server. Check SUPABASE_SERVICE_ROLE_KEY in Vercel.';
  }
  return msg || 'Sync failed';
}

function parseSinceParam(req) {
  const raw = req.url || '';
  const qIndex = raw.indexOf('?');
  if (qIndex < 0) return null;
  const params = new URLSearchParams(raw.slice(qIndex + 1));
  const since = params.get('since')?.trim();
  return since || null;
}

export async function handleSyncLedgerRequest(req, res) {
  const userId = readUserId(req);
  if (!userId) {
    sendJson(res, 401, { error: 'UNAUTHORIZED', message: 'Login required' });
    return;
  }

  if (!isSupabaseEnabled() && isServerlessEnv()) {
    syncNotConfigured(res);
    return;
  }

  if (req.method === 'GET') {
    try {
      const since = parseSinceParam(req);
      if (since) {
        const serverUpdated = await withTimeout(getLedgerUpdatedAt(userId), 8000, 'Sync meta');
        if (!serverUpdated || new Date(serverUpdated).getTime() <= new Date(since).getTime()) {
          sendJson(res, 200, { unchanged: true, updatedAt: serverUpdated });
          return;
        }
      }

      const ledger = await withTimeout(readLedger(userId), 20000, 'Sync pull');
      if (!ledger) {
        sendJson(res, 200, { empty: true, ledger: null, source: 'tables' });
        return;
      }
      sendJson(res, 200, { empty: false, ledger, source: 'tables' });
    } catch (err) {
      if (/timed out after/i.test(String(err?.message || ''))) {
        sendJson(res, 503, { error: 'TIMEOUT', message: 'Cloud download timed out. Please retry.' });
        return;
      }
      console.error('Sync pull error:', err);
      sendJson(res, 500, { error: 'SERVER_ERROR', message: formatSyncError(err) });
    }
    return;
  }

  if (req.method === 'PATCH') {
    try {
      const body = await readJsonBody(req);
      const changes = Array.isArray(body?.changes) ? body.changes : [];
      if (!changes.length) {
        sendJson(res, 400, { error: 'VALIDATION', message: 'changes array required' });
        return;
      }

      const result = await withTimeout(applyLedgerChanges(userId, changes), 45000, 'Sync patch');
      sendJson(res, 200, {
        accepted: true,
        applied: result.applied,
        skipped: result.skipped,
        updatedAt: result.updatedAt,
      });
    } catch (err) {
      if (/timed out after/i.test(String(err?.message || ''))) {
        sendJson(res, 503, { error: 'TIMEOUT', message: 'Cloud sync timed out. Please retry.' });
        return;
      }
      console.error('Sync patch error:', err);
      sendJson(res, 500, { error: 'SERVER_ERROR', message: formatSyncError(err) });
    }
    return;
  }

  if (req.method === 'PUT') {
    try {
      const incoming = await readJsonBody(req);
      const existing = await withTimeout(readLedger(userId), 20000, 'Sync read');

      if (!shouldAcceptIncoming(incoming, existing)) {
        sendJson(res, 409, {
          error: 'CONFLICT',
          message: 'Cloud has newer data. Pulling latest…',
          ledger: existing,
        });
        return;
      }

      const saved = await withTimeout(
        writeLedger(userId, {
          updatedAt: incoming.updatedAt || new Date().toISOString(),
          dealers: incoming.dealers ?? [],
          customers: incoming.customers ?? [],
          purchases: incoming.purchases ?? [],
          sales: incoming.sales ?? [],
          payments: incoming.payments ?? [],
          settings: incoming.settings ?? [],
        }),
        45000,
        'Sync push',
      );

      sendJson(res, 200, { accepted: true, ledger: saved });
    } catch (err) {
      if (/timed out after/i.test(String(err?.message || ''))) {
        sendJson(res, 503, { error: 'TIMEOUT', message: 'Cloud upload timed out. Please retry.' });
        return;
      }
      console.error('Sync push error:', err);
      sendJson(res, 500, { error: 'SERVER_ERROR', message: formatSyncError(err) });
    }
    return;
  }

  sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'GET, PUT, or PATCH only' });
}

export function isLedgerSyncRequest(req) {
  const raw = req.url || '';
  return raw.includes('__ledger_sync=1');
}
