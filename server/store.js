import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isSubscriptionExpired, subscriptionInfo, subscriptionRenewalFields } from './subscriptions.js';
import { isSupabaseEnabled } from './supabase.js';
import { generatePaymentRefId } from './paymentConfig.js';
import { buildPendingTrialFields, isTrialActive, trialFieldsForPublic } from './trialAccess.js';
import { isSubscriptionAccessBlocked, renewalGraceFieldsForPublic } from './renewalGrace.js';
import { dataFile, ensureDataDir, getDataDir, isServerlessEnv, readDataJson } from './dataPaths.js';
import * as sb from './persistence/supabase.js';

/** If Supabase fails once, fall back to file storage for this process. */
let supabaseUnavailable = false;

async function preferSupabase() {
  return isSupabaseEnabled() && !supabaseUnavailable;
}

function handleSupabaseFailure(err) {
  const reason = err instanceof Error ? err.message : String(err);
  if (isServerlessEnv()) {
    const wrapped = err instanceof Error ? err : new Error(reason);
    wrapped.code = wrapped.code || 'SERVER_CONFIG';
    throw wrapped;
  }
  supabaseUnavailable = true;
  console.warn(`[Chai Khata] Supabase unavailable — using file storage. (${reason})`);
}

/** @template T @param {() => Promise<T>} supabaseFn @param {() => Promise<T>} fileFn */
async function withStorage(supabaseFn, fileFn) {
  if (await preferSupabase()) {
    try {
      return await supabaseFn();
    } catch (err) {
      handleSupabaseFailure(err);
    }
  }
  return fileFn();
}

const USERS_FILE = () => dataFile('users.json');

async function ensureDataFile() {
  await ensureDataDir();
  await readDataJson('users.json', '[]');
}

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
 * @property {string} [paymentRefId]
 * @property {string} [trialStartedAt]
 * @property {string} [trialEndsAt]
 * @property {string} [lastExpiryReminderDate] YYYY-MM-DD — last daily expiry email sent
 * @property {string} [renewalGraceEndsAt] ISO — 24h access after renewal submit while pending approval
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
  return isPaymentBlocked(user) || isSubscriptionAccessBlocked(user);
}

export function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

async function readUsersFromFile() {
  await ensureDataFile();
  const raw = await readFile(USERS_FILE(), 'utf8');
  const users = JSON.parse(raw);
  return users.map((u) => ({
    ...u,
    email: u.email ? normalizeEmail(u.email) : '',
    phone: u.phone ? String(u.phone).trim() : '',
    paymentDue: paymentDueAmount(u),
  }));
}

/** @returns {Promise<UserRecord[]>} */
export async function readUsers() {
  return withStorage(() => sb.sbReadUsers(), readUsersFromFile);
}

/** @param {UserRecord[]} users */
async function writeUsers(users) {
  await ensureDataFile();
  const file = USERS_FILE();
  const tmp = join(getDataDir(), 'users.json.tmp');
  await writeFile(tmp, JSON.stringify(users, null, 2), 'utf8');
  await writeFile(file, JSON.stringify(users, null, 2), 'utf8');
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
  return withStorage(
    () => sb.sbFindUserByEmail(email),
    async () => {
      const users = await readUsersFromFile();
      return users.find((u) => u.email === normalizeEmail(email)) ?? null;
    },
  );
}

/** @param {string} username */
export async function findUserByUsername(username) {
  return withStorage(
    () => sb.sbFindUserByUsername(username),
    async () => {
      const users = await readUsersFromFile();
      const normalized = username.trim().toLowerCase();
      return users.find((u) => u.username === normalized) ?? null;
    },
  );
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
  return withStorage(
    () => sb.sbFindUserById(id),
    async () => {
      const users = await readUsersFromFile();
      return users.find((u) => u.id === id) ?? null;
    },
  );
}

/** Generate payment ref without loading all users (Supabase). */
function generatePaymentRefIdFast() {
  return `PAT-${Math.floor(100000 + Math.random() * 899999)}`;
}

/**
 * @param {Omit<UserRecord, 'id' | 'createdAt'> & { id?: string }}
 */
export async function createUser(user) {
  const normalizedUsername = user.username.trim().toLowerCase();
  const normalizedEmail = normalizeEmail(user.email);

  const [existingUsername, existingEmail] = await Promise.all([
    findUserByUsername(normalizedUsername),
    findUserByEmail(normalizedEmail),
  ]);

  if (existingUsername) {
    throw new Error('USERNAME_TAKEN');
  }

  if (existingEmail) {
    throw new Error('EMAIL_TAKEN');
  }

  const createdAt = new Date().toISOString();
  const signupSnapshot = buildSignupSnapshot({
    ...user,
    username: normalizedUsername,
    email: normalizedEmail,
  });

  let paymentRefId = user.paymentRefId;
  if (!paymentRefId) {
    if (await preferSupabase()) {
      paymentRefId = generatePaymentRefIdFast();
    } else {
      const users = await readUsersFromFile();
      paymentRefId = generatePaymentRefId(users);
    }
  }

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
    paymentRefId,
    status: user.status ?? 'pending',
    role: user.role ?? 'user',
    paymentDue: 0,
    paymentDueNote: '',
    signupSnapshot,
    createdAt,
    ...(user.approvedAt ? { approvedAt: user.approvedAt } : {}),
    ...((user.status ?? 'pending') === 'pending' && (user.role ?? 'user') !== 'admin'
      ? buildPendingTrialFields(new Date(createdAt))
      : {}),
  };

  if (await preferSupabase()) {
    try {
      return await sb.sbInsertUser(record);
    } catch (err) {
      handleSupabaseFailure(err);
    }
  }

  const fileUsers = await readUsersFromFile();
  fileUsers.push(record);
  await writeUsers(fileUsers);
  return record;
}

/** @param {string} id @param {Partial<UserRecord>} patch */
export async function updateUser(id, patch) {
  if (await preferSupabase()) {
    try {
      return await sb.sbUpdateUser(id, patch);
    } catch (err) {
      handleSupabaseFailure(err);
    }
  }

  const users = await readUsersFromFile();
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
  if ('lastExpiryReminderDate' in patch && patch.lastExpiryReminderDate === undefined) {
    delete next.lastExpiryReminderDate;
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
    /** Only sync password when explicitly requested — avoids Vercel env overwriting a working hash. */
    const syncPassword = process.env.ADMIN_SYNC_PASSWORD === 'true';
    return updateUser(existingAdmin.id, {
      email: normalizedEmail,
      ...(syncPassword ? { passwordHash } : {}),
      status: 'approved',
      role: 'admin',
      approvedAt: existingAdmin.approvedAt || new Date().toISOString(),
    });
  }

  const emailUser = users.find((u) => u.email === normalizedEmail);
  if (emailUser) {
    return updateUser(emailUser.id, {
      role: 'admin',
      status: 'approved',
      approvedAt: emailUser.approvedAt || new Date().toISOString(),
      passwordHash,
      shopName: emailUser.shopName || 'Chai Khata Admin',
    });
  }

  const localPart = normalizedEmail.split('@')[0] || 'admin';
  let username = 'admin';
  if (users.some((u) => u.username === username)) {
    username = localPart.replace(/[^a-z0-9._-]/g, '') || 'admin';
  }
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
  if (await preferSupabase()) {
    try {
      return await sb.sbDeleteUser(id);
    } catch (err) {
      handleSupabaseFailure(err);
    }
  }

  const users = await readUsersFromFile();
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
    paymentRefId: user.paymentRefId ?? '',
    paymentDue: due,
    paymentDueNote: user.paymentDueNote ?? '',
    paymentBlocked: isPaymentBlocked(user),
    accessBlocked: isAccessBlocked(user) && !isTrialActive(user),
    ...trialFieldsForPublic(user),
    ...renewalGraceFieldsForPublic(user),
    ...sub,
    ...subscriptionRenewalFields(user),
  };
}

/** Admin list view — omits heavy signupSnapshot blob */
export function adminUserListItem(user) {
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
    paymentRefId: user.paymentRefId ?? '',
    subscriptionPlan: signup.subscriptionPlan || sub.subscriptionPlan,
    subscriptionPlanLabel: signup.subscriptionPlanLabel || sub.subscriptionPlanLabel,
    subscriptionStartsAt: user.subscriptionStartsAt ?? sub.subscriptionStartsAt ?? '',
    subscriptionExpiresAt: user.subscriptionExpiresAt ?? sub.subscriptionExpiresAt ?? '',
  };
}

/** @param {{ statuses?: string[], excludeAdmin?: boolean, limit?: number, offset?: number }} [opts] */
export async function readUsersForAdmin(opts = {}) {
  const { statuses, excludeAdmin = true, limit = 500, offset = 0 } = opts;
  return withStorage(
    () => sb.sbReadUsersForAdmin({ statuses, excludeAdmin, limit, offset }),
    async () => {
      let users = await readUsersFromFile();
      if (excludeAdmin) users = users.filter((u) => u.role !== 'admin');
      if (statuses?.length) users = users.filter((u) => statuses.includes(u.status));
      users.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const cappedLimit = Math.min(Math.max(1, limit), 1000);
      const safeOffset = Math.max(0, Number(offset) || 0);
      return users.slice(safeOffset, safeOffset + cappedLimit);
    },
  );
}

/** @param {string[]} ids */
export async function findUsersByIds(ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return [];
  return withStorage(
    () => sb.sbFindUsersByIds(unique),
    async () => {
      const users = await readUsersFromFile();
      const set = new Set(unique);
      return users.filter((u) => set.has(u.id));
    },
  );
}

/** Counts for admin nav badge — no full user load */
export async function adminUserCounts() {
  return withStorage(
    () => sb.sbAdminUserCounts(),
    async () => {
      const users = await readUsersFromFile();
      const shop = users.filter((u) => u.role !== 'admin');
      return {
        pending: shop.filter((u) => u.status === 'pending').length,
        rejected: shop.filter((u) => u.status === 'rejected').length,
        approved: shop.filter((u) => u.status === 'approved').length,
        total: shop.length,
      };
    },
  );
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
    paymentRefId: user.paymentRefId ?? '',
    subscriptionPlan: signup.subscriptionPlan || sub.subscriptionPlan,
    subscriptionPlanLabel: signup.subscriptionPlanLabel || sub.subscriptionPlanLabel,
    subscriptionStartsAt: user.subscriptionStartsAt ?? sub.subscriptionStartsAt ?? '',
    subscriptionExpiresAt: user.subscriptionExpiresAt ?? sub.subscriptionExpiresAt ?? '',
    signupSnapshot: user.signupSnapshot ?? null,
  };
}
