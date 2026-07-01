import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sb from './persistence/supabase.js';
import { isSupabaseEnabled } from './supabase.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LEDGER_DIR = join(__dirname, 'data', 'ledger');

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

async function ledgerPath(userId) {
  await mkdir(LEDGER_DIR, { recursive: true });
  return join(LEDGER_DIR, `${userId}.json`);
}

/** @param {string} userId */
export async function readLedger(userId) {
  if (isSupabaseEnabled()) return sb.sbReadLedger(userId);

  try {
    const raw = await readFile(await ledgerPath(userId), 'utf8');
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
  await writeFile(await ledgerPath(userId), JSON.stringify(record, null, 2), 'utf8');
  return record;
}

/** @param {string} userId @param {LedgerSnapshot} incoming @param {LedgerSnapshot | null} existing */
export function shouldAcceptIncoming(incoming, existing) {
  if (!existing?.updatedAt) return true;
  if (!incoming?.updatedAt) return false;
  return new Date(incoming.updatedAt).getTime() >= new Date(existing.updatedAt).getTime();
}

/** @param {string} userId */
export async function deleteLedger(userId) {
  if (isSupabaseEnabled()) {
    await sb.sbDeleteLedger(userId);
    return;
  }

  try {
    const { unlink } = await import('node:fs/promises');
    await unlink(await ledgerPath(userId));
  } catch {
    /* ignore */
  }
}
