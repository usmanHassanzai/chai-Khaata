import bcrypt from 'bcryptjs';
import {
  authDb,
  initAuthDatabase,
  type UserRecord,
  type UserRole,
  type UserStatus,
} from '../db/authDatabase';
import {
  extendSubscription,
  getPlan,
  isSubscriptionExpired,
  subscriptionInfo,
} from '../auth/subscriptions';

export const LOCAL_ADMIN_EMAIL = 'usmankhan14700@gmail.com';
export const LOCAL_ADMIN_PASSWORD = 'admin123';

export function paymentDueAmount(user: Pick<UserRecord, 'paymentDue'> | null | undefined) {
  return Math.max(0, Number(user?.paymentDue) || 0);
}

export function isPaymentBlocked(user: UserRecord) {
  return user.role !== 'admin' && paymentDueAmount(user) > 0;
}

export function isAccessBlocked(user: UserRecord) {
  return isPaymentBlocked(user) || isSubscriptionExpired(user);
}

export function normalizeEmail(email: string) {
  return String(email).trim().toLowerCase();
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

export function buildSignupSnapshot(input: Record<string, unknown>) {
  const registeredAt = new Date().toISOString();
  return {
    username: String(input.username ?? '').trim().toLowerCase(),
    email: normalizeEmail(String(input.email ?? '')),
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

export function getAdminSignupView(user: UserRecord) {
  const snap = user.signupSnapshot;
  return {
    username: user.username || snap?.username || '',
    email: user.email || snap?.email || '',
    phone: user.phone || snap?.phone || '',
    registrationPassword: user.registrationPassword || snap?.password || '',
    shopName: user.shopName || snap?.shopName || '',
    subscriptionPlan: user.subscriptionPlan || snap?.subscriptionPlan || '',
    subscriptionPlanLabel: snap?.subscriptionPlanLabel || '',
    paymentFeeDate: user.paymentFeeDate || snap?.paymentFeeDate || '',
    registrationFee: Number(user.registrationFee) || Number(snap?.registrationFee) || 0,
    registeredAt: snap?.registeredAt || user.createdAt || '',
  };
}

export async function readUsers() {
  await initAuthDatabase();
  return authDb.users.toArray();
}

export async function findUserByEmail(email: string) {
  const normalized = normalizeEmail(email);
  return authDb.users.where('email').equals(normalized).first() ?? null;
}

export async function findUserByUsername(username: string) {
  const normalized = username.trim().toLowerCase();
  return authDb.users.where('username').equals(normalized).first() ?? null;
}

export async function findUserByLogin(login: string) {
  const value = String(login).trim().toLowerCase();
  if (value.includes('@')) return findUserByEmail(value);
  return findUserByUsername(value);
}

export async function findUserById(id: string) {
  return authDb.users.get(id) ?? null;
}

export async function createUser(user: Omit<UserRecord, 'id' | 'createdAt'> & { id?: string }) {
  await initAuthDatabase();
  const normalizedUsername = user.username.trim().toLowerCase();
  const normalizedEmail = normalizeEmail(user.email);

  if (await findUserByUsername(normalizedUsername)) throw new Error('USERNAME_TAKEN');
  if (await findUserByEmail(normalizedEmail)) throw new Error('EMAIL_TAKEN');

  const createdAt = new Date().toISOString();
  const signupSnapshot = buildSignupSnapshot({
    ...user,
    username: normalizedUsername,
    email: normalizedEmail,
  });

  const record: UserRecord = {
    id: user.id ?? crypto.randomUUID(),
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
    ...(user.subscriptionStartsAt ? { subscriptionStartsAt: user.subscriptionStartsAt } : {}),
    ...(user.subscriptionExpiresAt ? { subscriptionExpiresAt: user.subscriptionExpiresAt } : {}),
  };

  await authDb.users.put(record);
  return record;
}

export async function updateUser(id: string, patch: Partial<UserRecord>) {
  const existing = await findUserById(id);
  if (!existing) throw new Error('NOT_FOUND');

  const next: UserRecord = { ...existing, ...patch };
  if (patch.email) next.email = normalizeEmail(patch.email);
  if (patch.username) next.username = patch.username.trim().toLowerCase();

  if (next.email) {
    const clash = await authDb.users.where('email').equals(next.email).first();
    if (clash && clash.id !== id) throw new Error('EMAIL_TAKEN');
  }
  if (next.username) {
    const clash = await authDb.users.where('username').equals(next.username).first();
    if (clash && clash.id !== id) throw new Error('USERNAME_TAKEN');
  }

  if ('registrationPassword' in patch && patch.registrationPassword === undefined) {
    delete next.registrationPassword;
  }

  await authDb.users.put(next);
  return next;
}

export async function deleteUser(id: string) {
  const user = await findUserById(id);
  if (!user) throw new Error('NOT_FOUND');
  if (user.role === 'admin') throw new Error('CANNOT_DELETE_ADMIN');
  await authDb.users.delete(id);
  return user;
}

export async function ensureDefaultAdmin() {
  await initAuthDatabase();
  const users = await readUsers();
  const existingAdmin = users.find((u) => u.role === 'admin');

  if (existingAdmin) {
    const patch: Partial<UserRecord> = {};
    const normalizedEmail = normalizeEmail(LOCAL_ADMIN_EMAIL);
    if (!existingAdmin.email || existingAdmin.email !== normalizedEmail) {
      patch.email = normalizedEmail;
    }
    if (Object.keys(patch).length > 0) {
      return updateUser(existingAdmin.id, patch);
    }
    return existingAdmin;
  }

  const passwordHash = await bcrypt.hash(LOCAL_ADMIN_PASSWORD, 10);
  return createUser({
    username: 'admin',
    email: LOCAL_ADMIN_EMAIL,
    phone: '03462204903',
    passwordHash,
    registrationPassword: LOCAL_ADMIN_PASSWORD,
    shopName: 'Chai Khata Admin',
    status: 'approved',
    role: 'admin',
    approvedAt: new Date().toISOString(),
  });
}

export function publicUser(user: UserRecord) {
  const due = paymentDueAmount(user);
  const sub = subscriptionInfo(user);
  return {
    id: user.id,
    username: user.username,
    email: user.email ?? '',
    shopName: user.shopName ?? '',
    phone: user.phone ?? '',
    status: user.status as UserStatus,
    role: user.role as UserRole,
    createdAt: user.createdAt,
    approvedAt: user.approvedAt,
    paymentDue: due,
    paymentDueNote: user.paymentDueNote ?? '',
    paymentBlocked: isPaymentBlocked(user),
    accessBlocked: isAccessBlocked(user),
    ...sub,
  };
}

export function adminUser(user: UserRecord) {
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

export { extendSubscription, getPlan, isSubscriptionExpired };
