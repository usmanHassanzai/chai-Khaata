import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import * as sb from './persistence/supabase.js';
import { isSupabaseEnabled } from './supabase.js';
import { dataFile, ensureDataDir, readDataJson } from './dataPaths.js';

const FILE = () => dataFile('payment-submissions.json');

/** @typedef {'pending' | 'approved' | 'rejected'} SubmissionStatus */

/**
 * @typedef {Object} PaymentSubmission
 * @property {string} id
 * @property {string} userId
 * @property {string} username
 * @property {string} email
 * @property {string} phone
 * @property {number} paymentDue
 * @property {string} [subscriptionPlan]
 * @property {'payment_due' | 'subscription_renewal' | 'signup_payment'} [kind]
 * @property {string} [paymentRefId]
 * @property {string} screenshot
 * @property {SubmissionStatus} status
 * @property {string} createdAt
 * @property {string} [reviewedAt]
 * @property {string} [rejectNote]
 */

async function ensureFile() {
  await ensureDataDir();
  await readDataJson('payment-submissions.json', '[]');
}

/** @returns {Promise<PaymentSubmission[]>} */
export async function readSubmissions() {
  await ensureFile();
  return JSON.parse(await readFile(FILE(), 'utf8'));
}

/** @param {PaymentSubmission[]} list */
async function writeSubmissions(list) {
  await ensureFile();
  await writeFile(FILE(), JSON.stringify(list, null, 2), 'utf8');
}

/** @param {string} userId */
export async function findPendingByUserId(userId) {
  if (isSupabaseEnabled()) return sb.sbFindPendingSubmission(userId);

  const list = await readSubmissions();
  return list.find((s) => s.userId === userId && s.status === 'pending') ?? null;
}

/** @param {Omit<PaymentSubmission, 'id' | 'createdAt' | 'status'>} data */
export async function createSubmission(data) {
  const record = {
    ...data,
    id: randomUUID(),
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  if (isSupabaseEnabled()) return sb.sbCreateSubmission(record);

  const list = await readSubmissions();

  const withoutOldPending = list.filter(
    (s) => !(s.userId === data.userId && s.status === 'pending'),
  );
  withoutOldPending.push(record);
  await writeSubmissions(withoutOldPending);
  return record;
}

/** @param {string} id @param {Partial<PaymentSubmission>} patch */
export async function updateSubmission(id, patch) {
  if (isSupabaseEnabled()) return sb.sbUpdateSubmission(id, patch);

  const list = await readSubmissions();
  const index = list.findIndex((s) => s.id === id);
  if (index === -1) throw new Error('NOT_FOUND');
  list[index] = { ...list[index], ...patch };
  await writeSubmissions(list);
  return list[index];
}

/** @returns {Promise<PaymentSubmission[]>} */
export async function listPendingSubmissions() {
  if (isSupabaseEnabled()) return sb.sbListPendingSubmissions();

  const list = await readSubmissions();
  return list
    .filter((s) => s.status === 'pending')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/** List metadata only — excludes heavy screenshot payloads. */
export async function listPendingSubmissionsMeta() {
  if (isSupabaseEnabled()) return sb.sbListPendingSubmissionsMeta();

  const list = await listPendingSubmissions();
  return list.map(publicSubmissionListItem);
}

/** @param {string} id */
export async function findSubmissionById(id) {
  if (isSupabaseEnabled()) return sb.sbFindSubmissionById(id);

  const list = await readSubmissions();
  return list.find((s) => s.id === id) ?? null;
}

/** @param {PaymentSubmission} s */
export function publicSubmissionListItem(s) {
  return {
    id: s.id,
    userId: s.userId,
    username: s.username,
    email: s.email,
    phone: s.phone,
    paymentDue: s.paymentDue,
    subscriptionPlan: s.subscriptionPlan ?? '',
    kind: s.kind ?? 'payment_due',
    paymentRefId: s.paymentRefId ?? '',
    hasScreenshot: Boolean(s.screenshot),
    status: s.status,
    createdAt: s.createdAt,
    reviewedAt: s.reviewedAt,
    rejectNote: s.rejectNote,
  };
}

/** @param {PaymentSubmission} s */
export function publicSubmission(s) {
  return {
    id: s.id,
    userId: s.userId,
    username: s.username,
    email: s.email,
    phone: s.phone,
    paymentDue: s.paymentDue,
    subscriptionPlan: s.subscriptionPlan ?? '',
    kind: s.kind ?? 'payment_due',
    paymentRefId: s.paymentRefId ?? '',
    screenshot: s.screenshot,
    status: s.status,
    createdAt: s.createdAt,
    reviewedAt: s.reviewedAt,
    rejectNote: s.rejectNote,
  };
}

/** @param {string} userId — safe cleanup; never throws */
export async function clearSubmissionsForUser(userId) {
  try {
    if (isSupabaseEnabled()) {
      await sb.sbClearSubmissionsForUser(userId);
      return;
    }

    const list = await readSubmissions();
    await writeSubmissions(list.filter((s) => s.userId !== userId));
  } catch (err) {
    console.warn('[Chai Khata] Could not clear payment submissions for user:', userId, err?.message);
  }
}
