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
export async function readLedger(userId) {
  if (isSupabaseEnabled()) return sb.sbReadLedger(userId);

  try {
    const raw = await readFile(await ledgerFile(userId), 'utf8');
    return /** @type {LedgerSnapshot} */ (JSON.parse(raw));
  } catch {
    return null;
  }
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
  throw new Error('Row-level sync requires Supabase');
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
