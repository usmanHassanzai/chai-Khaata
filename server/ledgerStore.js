import { readFile, writeFile } from 'node:fs/promises';
import * as sb from './persistence/supabase.js';
import { isSupabaseEnabled } from './supabase.js';
import { ledgerFile } from './dataPaths.js';

/** @typedef {Object} LedgerSnapshot
 * @property {string} updatedAt
 * @property {unknown[]} dealers
 * @property {unknown[]} customers
 * @property {unknown[]} purchases
 * @property {unknown[]} sales
 * @property {unknown[]} payments
 * @property {unknown[]} settings
 * @property {string} [userId]
 */

/** @param {string} userId */
export async function getLedgerUpdatedAt(userId) {
  if (isSupabaseEnabled()) {
    const { sbGetLedgerUpdatedAt } = await import('./persistence/ledgerTables.js');
    return sbGetLedgerUpdatedAt(userId);
  }

  const ledger = await readLedger(userId);
  return ledger?.updatedAt ?? null;
}

/** @param {string} userId @param {{ lite?: boolean }} [options] */
export async function readLedger(userId, options = {}) {
  if (isSupabaseEnabled()) return sb.sbReadLedger(userId, options);

  try {
    const raw = await readFile(await ledgerFile(userId), 'utf8');
    const ledger = /** @type {LedgerSnapshot} */ (JSON.parse(raw));
    if (options.lite) return slimFileLedger(ledger);
    return ledger;
  } catch {
    return null;
  }
}

function slimFileLedger(snapshot) {
  const stripRow = (row) => {
    if (!row || typeof row !== 'object') return row;
    const next = { ...row };
    delete next.billImage;
    delete next.profilePicture;
    delete next.receiveReceiptImage;
    delete next.paymentReceiptImage;
    delete next.receiptImage;
    delete next.shopLogo;
    return next;
  };
  return {
    ...snapshot,
    dealers: (snapshot.dealers ?? []).map(stripRow),
    customers: (snapshot.customers ?? []).map(stripRow),
    purchases: (snapshot.purchases ?? []).map(stripRow),
    sales: (snapshot.sales ?? []).map(stripRow),
    payments: (snapshot.payments ?? []).map(stripRow),
    settings: (snapshot.settings ?? []).map(stripRow),
  };
}

/** @param {string} userId @param {LedgerSnapshot} snapshot */
export async function writeLedger(userId, snapshot) {
  if (isSupabaseEnabled()) return sb.sbWriteLedger(userId, snapshot);

  const record = {
    ...snapshot,
    userId,
    updatedAt: snapshot.updatedAt || new Date().toISOString(),
  };
  await writeFile(await ledgerFile(userId), JSON.stringify(record, null, 2), 'utf8');
  return record;
}

/** @param {string} userId @param {LedgerSnapshot} incoming @param {LedgerSnapshot | null} existing */
export function shouldAcceptIncoming(incoming, existing) {
  if (!existing?.updatedAt) return true;
  if (!incoming?.updatedAt) return false;
  return new Date(incoming.updatedAt).getTime() >= new Date(existing.updatedAt).getTime();
}

/**
 * @param {string} userId
 * @param {Array<{ table: string, op: 'upsert'|'delete', row?: Record<string, unknown>, id?: number|string, updatedAt?: string }>} changes
 */
export async function applyLedgerChanges(userId, changes) {
  if (isSupabaseEnabled()) {
    const { sbApplyLedgerChanges } = await import('./persistence/ledgerTables.js');
    return sbApplyLedgerChanges(userId, changes);
  }

  // File storage fallback: merge row changes into the JSON snapshot (so PATCH never hard-fails)
  const existing = await readLedger(userId);
  const snapshot = {
    updatedAt: existing?.updatedAt || new Date().toISOString(),
    dealers: [...(existing?.dealers ?? [])],
    customers: [...(existing?.customers ?? [])],
    purchases: [...(existing?.purchases ?? [])],
    sales: [...(existing?.sales ?? [])],
    payments: [...(existing?.payments ?? [])],
    settings: [...(existing?.settings ?? [])],
  };

  let applied = 0;
  const skipped = [];

  for (const change of changes) {
    const table = change.table;
    if (!Array.isArray(snapshot[table])) {
      skipped.push({ ...change, reason: 'UNKNOWN_TABLE' });
      continue;
    }

    if (change.op === 'delete') {
      const id = change.id ?? change.row?.id;
      if (id == null) {
        skipped.push({ ...change, reason: 'MISSING_ID' });
        continue;
      }
      const before = snapshot[table].length;
      snapshot[table] = snapshot[table].filter((row) => String(row?.id) !== String(id));
      if (snapshot[table].length < before) applied += 1;
      else skipped.push({ ...change, reason: 'NOT_FOUND' });
      continue;
    }

    if (change.op !== 'upsert' || !change.row) {
      skipped.push({ ...change, reason: 'INVALID_OP' });
      continue;
    }

    const row = {
      ...change.row,
      updatedAt: change.updatedAt || change.row.updatedAt || new Date().toISOString(),
    };
    const id = table === 'settings' ? 'settings' : row.id;
    if (id == null) {
      skipped.push({ ...change, reason: 'MISSING_ID' });
      continue;
    }

    const idx = snapshot[table].findIndex((existingRow) =>
      table === 'settings' ? true : String(existingRow?.id) === String(id),
    );
    if (idx >= 0) {
      const existingAt = snapshot[table][idx]?.updatedAt || '';
      if (existingAt && new Date(row.updatedAt).getTime() < new Date(existingAt).getTime()) {
        skipped.push({ ...change, reason: 'STALE' });
        continue;
      }
      snapshot[table][idx] = table === 'settings' ? { ...snapshot[table][idx], ...row, id: 'settings' } : row;
    } else {
      snapshot[table].push(table === 'settings' ? { ...row, id: 'settings' } : row);
    }
    applied += 1;
  }

  snapshot.updatedAt = new Date().toISOString();
  const saved = await writeLedger(userId, snapshot);
  return { applied, skipped, updatedAt: saved.updatedAt };
}

/** @param {string} userId */
export async function deleteLedger(userId) {
  if (isSupabaseEnabled()) {
    await sb.sbDeleteLedger(userId);
    return;
  }

  try {
    const { unlink } = await import('node:fs/promises');
    await unlink(await ledgerFile(userId));
  } catch {
    /* ignore */
  }
}
