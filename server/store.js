import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSubscriptionExpired, subscriptionInfo } from './subscriptions.js';
import { isSupabaseEnabled } from './supabase.js';
import * as sb from './persistence/supabase.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const USERS_FILE = join(DATA_DIR, 'users.json');

/** @typedef {'pending' | 'approved' | 'rejected'} UserStatus */
/** @typedef {'user' | 'admin'} UserRole */

/**
 * @typedef {Object} UserRecord
 * @property {string} id
 * @property {string} username
 * @property {string} email
 * @property {string} [phone]
 * @property {string} passwordHash
 * @property {string} [registrationPassword]
 * @property {string} [shopName]
 * @property {UserStatus} status
 * @property {UserRole} role
 * @property {string} createdAt
 * @property {string} [approvedAt]
 * @property {number} [paymentDue]
 * @property {string} [paymentDueNote]
 * @property {string} [lastPaidAt]
 * @property {number} [registrationFee]
 * @property {string} [paymentFeeDate]
 * @property {string} [subscriptionPlan]
 * @property {string} [subscriptionStartsAt]
 * @property {string} [subscriptionExpiresAt]
 * @property {SignupSnapshot} [signupSnapshot]
 */

/**
 * @typedef {Object} SignupSnapshot
 * @property {string} username
 * @property {string} email
 * @property {string} phone
 * @property {string} password
 * @property {string} shopName
 * @property {string} subscriptionPlan
 * @property {string} [subscriptionPlanLabel]
 * @property {string} paymentFeeDate
 * @property {number} registrationFee
 * @property {string} registeredAt
 */

export function paymentDueAmount(user) {
  return Math.max(0, Number(user?.paymentDue) || 0);
}

export function isPaymentBlocked(user) {
  return user?.role !== 'admin' && paymentDueAmount(user) > 0;
}

export function isAccessBlocked(user) {
  return isPaymentBlocked(user) || isSubscriptionExpired(user);
}

export function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

async function ensureDataFile() {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    await readFile(USERS_FILE, 'utf8');
  } catch {
    await writeFile(USERS_FILE, '[]', 'utf8');
  }
}

/** @returns {Promise<UserRecord[]>} */
export async function readUsers() {
  if (isSupabaseEnabled()) return sb.sbReadUsers();

  await ensureDataFile();
  const raw = await readFile(USERS_FILE, 'utf8');
  const users = JSON.parse(raw);
  return users.map((u) => ({
    ...u,
    email: u.email ? normalizeEmail(u.email) : '',
    phone: u.phone ? String(u.phone).trim() : '',
    paymentDue: paymentDueAmount(u),
  }));
}

/** @param {UserRecord[]} users */
async function writeUsers(users) {
  await ensureDataFile();
  const tmp = join(DATA_DIR, 'users.json.tmp');
  await writeFile(tmp, JSON.stringify(users, null, 2), 'utf8');
  await writeFile(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
  try {
    const { unlink } = await import('node:fs/promises');
    await unlink(tmp);
  } catch {
    /* ignore */
  }
}

/** @param {Partial<UserRecord> & { password?: string }} input */
export function buildSignupSnapshot(input) {
  const registeredAt = new Date().toISOString();
  return {
    username: String(input.username ?? '').trim().toLowerCase(),
    email: normalizeEmail(input.email ?? ''),
    phone: String(input.phone ?? '').trim(),
    password: String(input.registrationPassword ?? input.password ?? ''),
    shopName: String(input.shopName ?? '').trim(),
    subscriptionPlan: String(input.subscriptionPlan ?? ''),
    subscriptionPlanLabel: String(input.subscriptionPlanLabel ?? ''),
    paymentFeeDate: String(input.paymentFeeDate ?? '').trim(),
    registrationFee: Number(input.registrationFee) || 0,
    registeredAt,
  };
}

/** Merge live user fields with immutable signup snapshot for admin display */
export function getAdminSignupView(user) {
  const snap = user.signupSnapshot ?? {};
  return {
    username: user.username || snap.username || '',
    email: user.email || snap.email || '',
    phone: user.phone || snap.phone || '',
    registrationPassword: user.registrationPassword || snap.password || '',
    shopName: user.shopName || snap.shopName || '',
    subscriptionPlan: user.subscriptionPlan || snap.subscriptionPlan || '',
    subscriptionPlanLabel: snap.subscriptionPlanLabel || '',
    paymentFeeDate: user.paymentFeeDate || snap.paymentFeeDate || '',
    registrationFee: Number(user.registrationFee) || Number(snap.registrationFee) || 0,
    registeredAt: snap.registeredAt || user.createdAt || '',
  };
}

/** @param {string} email */
export async function findUserByEmail(email) {
  if (isSupabaseEnabled()) return sb.sbFindUserByEmail(email);

  const users = await readUsers();
  const normalized = normalizeEmail(email);
  return users.find((u) => u.email === normalized) ?? null;
}

/** @param {string} username */
export async function findUserByUsername(username) {
  if (isSupabaseEnabled()) return sb.sbFindUserByUsername(username);

  const users = await readUsers();
  const normalized = username.trim().toLowerCase();
  return users.find((u) => u.username === normalized) ?? null;
}

/** Login with email or username */
export async function findUserByLogin(login) {
  const value = String(login).trim().toLowerCase();
  if (value.includes('@')) {
    return findUserByEmail(value);
  }
  return findUserByUsername(value);
}

/** @param {string} id */
export async function findUserById(id) {
  if (isSupabaseEnabled()) return sb.sbFindUserById(id);

  const users = await readUsers();
  return users.find((u) => u.id === id) ?? null;
}

/**
 * @param {Omit<UserRecord, 'id' | 'createdAt'> & { id?: string }}
 */
export async function createUser(user) {
  const users = isSupabaseEnabled() ? await sb.sbReadUsers() : await readUsers();
  const normalizedUsername = user.username.trim().toLowerCase();
  const normalizedEmail = normalizeEmail(user.email);

  if (users.some((u) => u.username === normalizedUsername)) {
    throw new Error('USERNAME_TAKEN');
  }

  if (users.some((u) => u.email === normalizedEmail)) {
    throw new Error('EMAIL_TAKEN');
  }

  const createdAt = new Date().toISOString();
  const signupSnapshot = buildSignupSnapshot({
    ...user,
    username: normalizedUsername,
    email: normalizedEmail,
  });

  /** @type {UserRecord} */
  const record = {
    id: user.id ?? randomUUID(),
    username: normalizedUsername,
    email: normalizedEmail,
    phone: signupSnapshot.phone,
    passwordHash: user.passwordHash,
    registrationPassword: signupSnapshot.password,
    shopName: signupSnapshot.shopName,
    registrationFee: signupSnapshot.registrationFee,
    paymentFeeDate: signupSnapshot.paymentFeeDate,
    subscriptionPlan: signupSnapshot.subscriptionPlan,
    status: user.status ?? 'pending',
    role: user.role ?? 'user',
    paymentDue: 0,
    paymentDueNote: '',
    signupSnapshot,
    createdAt,
    ...(user.approvedAt ? { approvedAt: user.approvedAt } : {}),
  };

  if (isSupabaseEnabled()) {
    return sb.sbInsertUser(record);
  }

  users.push(record);
  await writeUsers(users);
  return record;
}

/** @param {string} id @param {Partial<UserRecord>} patch */
export async function updateUser(id, patch) {
  if (isSupabaseEnabled()) return sb.sbUpdateUser(id, patch);

  const users = await readUsers();
  const index = users.findIndex((u) => u.id === id);
  if (index === -1) throw new Error('NOT_FOUND');

  const next = { ...users[index], ...patch };
  if (patch.email) next.email = normalizeEmail(patch.email);
  if (patch.username) next.username = patch.username.trim().toLowerCase();

  if (next.email && users.some((u) => u.id !== id && u.email === next.email)) {
    throw new Error('EMAIL_TAKEN');
  }
  if (next.username && users.some((u) => u.id !== id && u.username === next.username)) {
    throw new Error('USERNAME_TAKEN');
  }

  if ('registrationPassword' in patch && patch.registrationPassword === undefined) {
    delete next.registrationPassword;
  }

  users[index] = next;
  await writeUsers(users);
  return users[index];
}

/** @returns {Promise<UserRecord>} */
export async function ensureDefaultAdmin(email, passwordHash) {
  const normalizedEmail = normalizeEmail(email);
  const users = await readUsers();
  const existingAdmin = users.find((u) => u.role === 'admin');

  if (existingAdmin) {
    const patch = {};
    if (!existingAdmin.email || existingAdmin.email !== normalizedEmail) {
      patch.email = normalizedEmail;
    }
    if (Object.keys(patch).length > 0) {
      return updateUser(existingAdmin.id, patch);
    }
    return existingAdmin;
  }

  const localPart = normalizedEmail.split('@')[0] || 'admin';
  let username = localPart.replace(/[^a-z0-9._-]/g, '') || 'admin';
  if (users.some((u) => u.username === username)) {
    username = `admin_${Date.now().toString(36)}`;
  }

  return createUser({
    username,
    email: normalizedEmail,
    passwordHash,
    shopName: 'Chai Khata Admin',
    status: 'approved',
    role: 'admin',
    approvedAt: new Date().toISOString(),
  });
}

/** Permanently remove user from database. */
export async function deleteUser(id) {
  if (isSupabaseEnabled()) return sb.sbDeleteUser(id);

  const users = await readUsers();
  const index = users.findIndex((u) => u.id === id);
  if (index === -1) throw new Error('NOT_FOUND');
  if (users[index].role === 'admin') throw new Error('CANNOT_DELETE_ADMIN');

  const removed = users[index];
  users.splice(index, 1);
  await writeUsers(users);
  return removed;
}

/** @param {UserRecord} user */
export function publicUser(user) {
  const due = paymentDueAmount(user);
  const sub = subscriptionInfo(user);
  return {
    id: user.id,
    username: user.username,
    email: user.email ?? '',
    shopName: user.shopName ?? '',
    phone: user.phone ?? '',
    status: user.status,
    role: user.role,
    createdAt: user.createdAt,
    approvedAt: user.approvedAt,
    paymentDue: due,
    paymentDueNote: user.paymentDueNote ?? '',
    paymentBlocked: isPaymentBlocked(user),
    accessBlocked: isAccessBlocked(user),
    ...sub,
  };
}

/** Admin-only view — full signup & subscription details */
export function adminUser(user) {
  const signup = getAdminSignupView(user);
  const mergedForSub = { ...user, subscriptionPlan: signup.subscriptionPlan || user.subscriptionPlan };
  const base = publicUser(user);
  const sub = subscriptionInfo(mergedForSub);

  return {
    ...base,
    ...sub,
    username: signup.username || base.username,
    email: signup.email || base.email,
    phone: signup.phone,
    shopName: signup.shopName || base.shopName,
    registrationPassword: signup.registrationPassword,
    registrationFee: signup.registrationFee,
    paymentFeeDate: signup.paymentFeeDate,
    paymentDueNote: user.paymentDueNote ?? '',
    lastPaidAt: user.lastPaidAt ?? '',
    subscriptionPlan: signup.subscriptionPlan || sub.subscriptionPlan,
    subscriptionPlanLabel: signup.subscriptionPlanLabel || sub.subscriptionPlanLabel,
    subscriptionStartsAt: user.subscriptionStartsAt ?? sub.subscriptionStartsAt ?? '',
    subscriptionExpiresAt: user.subscriptionExpiresAt ?? sub.subscriptionExpiresAt ?? '',
    signupSnapshot: user.signupSnapshot ?? null,
  };
}
