import bcrypt from 'bcryptjs';
import {
  authDb,
  initAuthDatabase,
  type OtpRecord,
  type PaymentSubmissionRecord,
} from '../db/authDatabase';
import {
  getPlan,
  getSubscriptionPlans,
  isValidPlanId,
  extendSubscription,
  isSubscriptionExpired,
} from '../auth/subscriptions';
import {
  LOCAL_ADMIN_EMAIL,
  adminUser,
  createUser,
  deleteUser as deleteUserRecord,
  ensureDefaultAdmin,
  findUserById,
  findUserByLogin,
  isAccessBlocked,
  isPaymentBlocked,
  isValidEmail,
  paymentDueAmount,
  publicUser,
  updateUser,
} from '../auth/localStore';
import type {
  AuthConfig,
  AuthResponse,
  AuthUser,
  OtpRequest,
  PaymentSubmission,
  SubscriptionPlanId,
} from '../services/authApi';
import { ApiError, getStoredToken } from '../services/authCommon';

const OTP_TTL_MS = 10 * 60 * 1000;
export const LOCAL_TOKEN_PREFIX = 'local:';

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function userIdFromToken(token: string | null) {
  if (!token?.startsWith(LOCAL_TOKEN_PREFIX)) return null;
  return token.slice(LOCAL_TOKEN_PREFIX.length) || null;
}

function makeToken(userId: string) {
  return `${LOCAL_TOKEN_PREFIX}${userId}`;
}

async function requireUserId() {
  const id = userIdFromToken(getStoredToken());
  if (!id) throw new ApiError('UNAUTHORIZED', 'Login required');
  const user = await findUserById(id);
  if (!user) throw new ApiError('INVALID_TOKEN', 'Session expired. Please login again.');
  return user;
}

async function requireAdmin() {
  const user = await requireUserId();
  if (user.role !== 'admin') throw new ApiError('FORBIDDEN', 'Admin access required');
  return user;
}

function paymentDueError(user: Awaited<ReturnType<typeof findUserById>> & object) {
  const due = paymentDueAmount(user);
  throw new ApiError(
    'PAYMENT_DUE',
    `Your account is suspended. Payment due: Rs ${due.toLocaleString()}. Upload payment screenshot below or contact admin at ${LOCAL_ADMIN_EMAIL}.`,
    publicUser(user),
  );
}

function subscriptionExpiredError(user: Awaited<ReturnType<typeof findUserById>> & object) {
  const expires = user.subscriptionExpiresAt
    ? new Date(user.subscriptionExpiresAt).toLocaleDateString()
    : '';
  throw new ApiError(
    'SUBSCRIPTION_EXPIRED',
    `Your subscription expired${expires ? ` on ${expires}` : ''}. Renew your plan to continue using Chai Khata.`,
    publicUser(user),
  );
}

async function findPendingByUserId(userId: string) {
  await initAuthDatabase();
  const list = await authDb.submissions.where('userId').equals(userId).toArray();
  return list.find((s) => s.status === 'pending') ?? null;
}

async function listPendingSubmissions() {
  await initAuthDatabase();
  return authDb.submissions.filter((s) => s.status === 'pending').toArray();
}

function publicSubmission(s: PaymentSubmissionRecord): PaymentSubmission {
  return {
    id: s.id,
    userId: s.userId,
    username: s.username,
    email: s.email,
    phone: s.phone,
    paymentDue: s.paymentDue,
    subscriptionPlan: s.subscriptionPlan,
    kind: s.kind,
    screenshot: s.screenshot,
    status: s.status,
    createdAt: s.createdAt,
    reviewedAt: s.reviewedAt,
    rejectNote: s.rejectNote,
  };
}

async function createOtp(userId: string, channel: 'email' | 'phone', sentTo: string): Promise<OtpRecord> {
  await initAuthDatabase();
  const record: OtpRecord = {
    userId,
    otp: generateOtp(),
    channel,
    sentTo,
    expiresAt: new Date(Date.now() + OTP_TTL_MS).toISOString(),
    createdAt: new Date().toISOString(),
  };
  await authDb.otps.put(record);
  return record;
}

async function verifyOtp(userId: string, otp: string) {
  await initAuthDatabase();
  const record = await authDb.otps.get(userId);
  if (!record) return { valid: false as const, reason: 'NO_OTP' };
  if (new Date(record.expiresAt) < new Date()) {
    await authDb.otps.delete(userId);
    return { valid: false as const, reason: 'EXPIRED' };
  }
  if (record.otp !== String(otp).trim()) {
    return { valid: false as const, reason: 'INVALID' };
  }
  return { valid: true as const, record };
}

async function clearOtp(userId: string) {
  await authDb.otps.delete(userId);
}

async function listActiveOtps() {
  await initAuthDatabase();
  const now = new Date();
  const all = await authDb.otps.toArray();
  const active = all.filter((o) => new Date(o.expiresAt) > now);
  for (const o of all) {
    if (new Date(o.expiresAt) <= now) await authDb.otps.delete(o.userId);
  }
  return active;
}

async function bootstrap() {
  await ensureDefaultAdmin();
}

export async function localHealth() {
  await bootstrap();
  return { ok: true, service: 'chai-khata-local' };
}

export const localAuthApi = {
  async config(): Promise<AuthConfig> {
    await bootstrap();
    return {
      adminEmail: LOCAL_ADMIN_EMAIL,
      requiresApproval: true,
      subscriptionPlans: getSubscriptionPlans(),
      otpDelivery: {
        emailConfigured: false,
        smsConfigured: false,
        twilio: { configured: false, from: null },
      },
    };
  },

  async login(emailOrLogin: string, password: string): Promise<AuthResponse> {
    await bootstrap();
    const user = await findUserByLogin(emailOrLogin);
    if (!user) throw new ApiError('INVALID_CREDENTIALS', 'Invalid email or password');

    const valid = await bcrypt.compare(String(password), user.passwordHash);
    if (!valid) throw new ApiError('INVALID_CREDENTIALS', 'Invalid email or password');

    if (user.status === 'pending') {
      throw new ApiError(
        'PENDING_APPROVAL',
        `Your account is waiting for admin approval (${LOCAL_ADMIN_EMAIL}). Please try again after approval.`,
        publicUser(user),
      );
    }

    if (user.status === 'rejected') {
      throw new ApiError(
        'REJECTED',
        `Your account was not approved. Contact admin at ${LOCAL_ADMIN_EMAIL}.`,
        publicUser(user),
      );
    }

    if (isPaymentBlocked(user)) paymentDueError(user);
    if (isSubscriptionExpired(user)) subscriptionExpiredError(user);

    return { token: makeToken(user.id), user: publicUser(user) };
  },

  async register(
    username: string,
    email: string,
    phone: string,
    password: string,
    subscriptionPlan: SubscriptionPlanId,
    paymentFeeDate: string,
    shopName?: string,
  ) {
    await bootstrap();

    if (!username?.trim() || !email?.trim() || !phone?.trim() || !password) {
      throw new ApiError('VALIDATION', 'Username, email, phone, and password are required');
    }
    if (!isValidPlanId(subscriptionPlan)) {
      throw new ApiError('VALIDATION', 'Please select a subscription plan');
    }
    const plan = getPlan(subscriptionPlan)!;
    if (!paymentFeeDate?.trim()) {
      throw new ApiError('VALIDATION', 'Payment date is required');
    }
    if (username.trim().length < 3) {
      throw new ApiError('VALIDATION', 'Username must be at least 3 characters');
    }
    if (!isValidEmail(email)) {
      throw new ApiError('VALIDATION', 'Please enter a valid email address');
    }
    if (phone.trim().length < 10) {
      throw new ApiError('VALIDATION', 'Please enter a valid phone number');
    }
    if (password.length < 6) {
      throw new ApiError('VALIDATION', 'Password must be at least 6 characters');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    try {
      const user = await createUser({
        username: username.trim().toLowerCase(),
        email,
        phone: phone.trim(),
        passwordHash,
        registrationPassword: password,
        registrationFee: plan.price,
        paymentFeeDate: paymentFeeDate.trim(),
        subscriptionPlan: plan.id,
        shopName: shopName?.trim() || '',
        status: 'pending',
        role: 'user',
      });

      return {
        message: `Sign up successful. The admin (${LOCAL_ADMIN_EMAIL}) will approve your account before you can log in.`,
        user: publicUser(user),
      };
    } catch (err) {
      if (err instanceof Error && err.message === 'USERNAME_TAKEN') {
        throw new ApiError('USERNAME_TAKEN', 'This username is already taken');
      }
      if (err instanceof Error && err.message === 'EMAIL_TAKEN') {
        throw new ApiError('EMAIL_TAKEN', 'This email is already registered');
      }
      throw err;
    }
  },

  async submitSignupPayment(_login: string, _password: string, _screenshot: string) {
    throw new ApiError('NETWORK_ERROR', 'Payment upload requires the online server.');
  },

  async subscriptionPlans() {
    return { plans: getSubscriptionPlans() };
  },

  async forgotPassword(login: string, channel: 'email' | 'phone') {
    await bootstrap();
    const user = await findUserByLogin(login);
    if (!user) throw new ApiError('NOT_FOUND', 'No account found with that email or username');

    const useChannel = channel === 'phone' ? 'phone' : 'email';
    let sentTo = useChannel === 'phone' ? user.phone : user.email;
    if (!sentTo) {
      if (useChannel === 'phone' && user.email) sentTo = user.email;
      else {
        throw new ApiError(
          'VALIDATION',
          useChannel === 'phone'
            ? 'No phone on this account. Try email or contact admin.'
            : 'No email on this account. Try phone or contact admin.',
        );
      }
    }

    const otpRecord = await createOtp(user.id, useChannel, sentTo);
    return {
      message: 'OTP created. Use the code shown below (offline mode — SMS/email not sent from phone).',
      otp: otpRecord.otp,
      userId: user.id,
      channel: useChannel,
      maskedTarget: sentTo.length > 4 ? `***${sentTo.slice(-4)}` : '****',
      expiresAt: otpRecord.expiresAt,
      delivery: { sent: false, reason: 'Offline app — OTP shown on screen', via: 'screen' },
    };
  },

  async resetPassword(login: string, otp: string, newPassword: string) {
    await bootstrap();
    const user = await findUserByLogin(login);
    if (!user) throw new ApiError('NOT_FOUND', 'No account found');

    const check = await verifyOtp(user.id, otp);
    if (!check.valid) {
      const msg =
        check.reason === 'EXPIRED' ? 'OTP expired. Request a new one.'
        : check.reason === 'INVALID' ? 'Invalid OTP.'
        : 'No OTP found. Request a new one.';
      throw new ApiError('INVALID_OTP', msg);
    }

    if (newPassword.length < 6) {
      throw new ApiError('VALIDATION', 'Password must be at least 6 characters');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await updateUser(user.id, { passwordHash, registrationPassword: newPassword });
    await clearOtp(user.id);

    return { message: 'Password updated. You can log in with your new password.' };
  },

  async submitPaymentProof(
    login: string,
    password: string,
    screenshot: string,
    subscriptionPlan?: SubscriptionPlanId,
  ) {
    await bootstrap();
    const user = await findUserByLogin(login);
    if (!user) throw new ApiError('INVALID_CREDENTIALS', 'Invalid email or password');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new ApiError('INVALID_CREDENTIALS', 'Invalid email or password');

    if (user.status !== 'approved') {
      throw new ApiError('NOT_APPROVED', 'Account is not approved yet');
    }

    const paymentBlocked = isPaymentBlocked(user);
    const subExpired = isSubscriptionExpired(user);
    if (!paymentBlocked && !subExpired) {
      throw new ApiError('NO_PAYMENT_DUE', 'No payment or subscription renewal is required');
    }

    if (!screenshot?.startsWith('data:image/')) {
      throw new ApiError('VALIDATION', 'Payment screenshot image is required');
    }

    let planId = subscriptionPlan ? String(subscriptionPlan) : '';
    let kind: 'payment_due' | 'subscription_renewal' = 'payment_due';
    let amount = paymentDueAmount(user);

    if (subExpired) {
      if (!planId || !isValidPlanId(planId)) {
        throw new ApiError('VALIDATION', 'Select a subscription plan to renew');
      }
      kind = 'subscription_renewal';
      amount = getPlan(planId)!.price;
    }

    const existing = await findPendingByUserId(user.id);
    if (existing) {
      throw new ApiError(
        'ALREADY_SUBMITTED',
        'Your payment proof is already submitted. Please wait for admin approval.',
      );
    }

    const record: PaymentSubmissionRecord = {
      id: crypto.randomUUID(),
      userId: user.id,
      username: user.username,
      email: user.email ?? '',
      phone: user.phone ?? '',
      paymentDue: amount,
      subscriptionPlan: planId || user.subscriptionPlan || '',
      kind,
      screenshot,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    await authDb.submissions.put(record);

    return {
      message: kind === 'subscription_renewal'
        ? 'Renewal payment submitted. Admin will review and extend your subscription.'
        : 'Payment screenshot submitted. Admin will review and unblock your account after approval.',
    };
  },

  async checkPaymentSubmission(login: string, password: string) {
    await bootstrap();
    const user = await findUserByLogin(login);
    if (!user) throw new ApiError('INVALID_CREDENTIALS', 'Invalid email or password');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new ApiError('INVALID_CREDENTIALS', 'Invalid email or password');

    const pending = await findPendingByUserId(user.id);
    return {
      paymentDue: paymentDueAmount(user),
      paymentBlocked: isPaymentBlocked(user),
      subscriptionExpired: isSubscriptionExpired(user),
      accessBlocked: isAccessBlocked(user),
      subscriptionExpiresAt: user.subscriptionExpiresAt ?? '',
      subscriptionPlan: user.subscriptionPlan ?? '',
      pendingSubmission: Boolean(pending),
      pendingSubmittedAt: pending?.createdAt,
    };
  },

  async me(): Promise<{ user: AuthUser }> {
    await bootstrap();
    const user = await requireUserId();

    if (user.status !== 'approved' && user.role !== 'admin') {
      throw new ApiError(
        user.status === 'pending' ? 'PENDING_APPROVAL' : 'REJECTED',
        user.status === 'pending'
          ? `Your account is waiting for admin approval (${LOCAL_ADMIN_EMAIL}).`
          : `Your account was not approved. Contact admin at ${LOCAL_ADMIN_EMAIL}.`,
        publicUser(user),
      );
    }

    if (isPaymentBlocked(user)) paymentDueError(user);
    if (isSubscriptionExpired(user)) subscriptionExpiredError(user);

    return { user: publicUser(user) };
  },

  async listUsers() {
    await requireAdmin();
    const users = await authDb.users.toArray();
    return {
      users: users
        .map(adminUser)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    };
  },

  async listOtpRequests(): Promise<{ requests: OtpRequest[] }> {
    await requireAdmin();
    const otps = await listActiveOtps();
    const users = await authDb.users.toArray();
    return {
      requests: otps.map((o) => {
        const user = users.find((u) => u.id === o.userId);
        return {
          userId: o.userId,
          username: user?.username ?? '—',
          email: user?.email ?? '',
          phone: user?.phone ?? '',
          otp: o.otp,
          channel: o.channel,
          sentTo: o.sentTo,
          expiresAt: o.expiresAt,
          createdAt: o.createdAt,
        };
      }),
    };
  },

  async listPaymentSubmissions() {
    await requireAdmin();
    const submissions = await listPendingSubmissions();
    return { submissions: submissions.map(publicSubmission) };
  },

  async approvePaymentSubmission(id: string) {
    await requireAdmin();
    const submission = (await listPendingSubmissions()).find((s) => s.id === id);
    if (!submission) throw new ApiError('NOT_FOUND', 'Submission not found or already reviewed');

    const user = await findUserById(submission.userId);
    if (!user) throw new ApiError('NOT_FOUND', 'User no longer exists');

    const patch: Partial<typeof user> = {
      paymentDue: 0,
      paymentDueNote: '',
      lastPaidAt: new Date().toISOString(),
    };

    const renewalPlan = submission.subscriptionPlan || user.subscriptionPlan;
    if (submission.kind === 'subscription_renewal' && renewalPlan && isValidPlanId(renewalPlan)) {
      Object.assign(patch, extendSubscription(user, renewalPlan));
      patch.registrationFee = getPlan(renewalPlan)!.price;
    } else if (
      user.status === 'approved'
      && renewalPlan
      && isValidPlanId(renewalPlan)
      && isSubscriptionExpired(user)
    ) {
      Object.assign(patch, extendSubscription(user, renewalPlan));
    }

    await updateUser(user.id, patch);
    await authDb.submissions.update(id, {
      status: 'approved',
      reviewedAt: new Date().toISOString(),
    });

    return { message: `Payment approved for ${user.username}. Account unblocked.` };
  },

  async rejectPaymentSubmission(id: string, note?: string) {
    await requireAdmin();
    const submission = (await listPendingSubmissions()).find((s) => s.id === id);
    if (!submission) throw new ApiError('NOT_FOUND', 'Submission not found');

    await authDb.submissions.update(id, {
      status: 'rejected',
      reviewedAt: new Date().toISOString(),
      rejectNote: note?.trim() || 'Payment proof rejected. Please submit again.',
    });

    return { message: `Payment proof rejected for ${submission.username}.` };
  },

  async approveUser(id: string) {
    await requireAdmin();
    const user = await findUserById(id);
    if (!user) throw new ApiError('NOT_FOUND', 'User not found');

    const planId = user.subscriptionPlan || user.signupSnapshot?.subscriptionPlan || '';
    const now = new Date().toISOString();
    const patch: Partial<typeof user> = {
      status: 'approved',
      approvedAt: now,
      paymentDue: 0,
    };

    if (planId && isValidPlanId(planId)) {
      Object.assign(patch, {
        subscriptionPlan: planId,
        subscriptionStartsAt: now,
        subscriptionExpiresAt: extendSubscription({ ...user, subscriptionStartsAt: now }, planId, new Date(now)).subscriptionExpiresAt,
      });
    }

    const updated = await updateUser(id, patch);
    return {
      user: adminUser(updated),
      message: `User "${updated.username}" approved.`,
    };
  },

  async rejectUser(id: string) {
    await requireAdmin();
    const updated = await updateUser(id, { status: 'rejected' });
    return {
      user: adminUser(updated),
      message: `User "${updated.username}" rejected.`,
    };
  },

  async deleteUser(id: string) {
    await requireAdmin();
    const user = await findUserById(id);
    if (!user) throw new ApiError('NOT_FOUND', 'User not found');
    if (user.role === 'admin') throw new ApiError('VALIDATION', 'Cannot delete admin account');

    const removed = await deleteUserRecord(user.id);
    await clearOtp(user.id);
    const subs = await authDb.submissions.where('userId').equals(user.id).toArray();
    for (const s of subs) await authDb.submissions.delete(s.id);

    return {
      message: `User "${removed.username}" permanently removed from database.`,
      deletedId: removed.id,
      deletedUsername: removed.username,
    };
  },

  async setPaymentDue(id: string, amount: number, note?: string) {
    await requireAdmin();
    const user = await findUserById(id);
    if (!user) throw new ApiError('NOT_FOUND', 'User not found');
    if (user.role === 'admin') throw new ApiError('VALIDATION', 'Cannot set payment due for admin');

    const updated = await updateUser(id, {
      paymentDue: Math.max(0, Number(amount) || 0),
      paymentDueNote: note?.trim() || '',
    });

    return {
      user: adminUser(updated),
      message: `Payment due set for ${updated.username}.`,
    };
  },

  async markPaid(id: string) {
    await requireAdmin();
    const updated = await updateUser(id, {
      paymentDue: 0,
      paymentDueNote: '',
      lastPaidAt: new Date().toISOString(),
    });
    return {
      user: adminUser(updated),
      message: `Marked ${updated.username} as paid.`,
    };
  },

  async sendOtpToUser(id: string, channel: 'email' | 'phone') {
    await requireAdmin();
    const user = await findUserById(id);
    if (!user) throw new ApiError('NOT_FOUND', 'User not found');
    if (user.role === 'admin') throw new ApiError('VALIDATION', 'Cannot send OTP for admin');

    const useChannel = channel === 'phone' ? 'phone' : 'email';
    const sentTo = useChannel === 'phone' ? user.phone : user.email;
    if (!sentTo) {
      throw new ApiError('VALIDATION', `User has no ${useChannel} on file`);
    }

    const otpRecord = await createOtp(user.id, useChannel, sentTo);
    return {
      message: 'OTP created — share with user (offline mode)',
      otp: otpRecord.otp,
      sentTo,
    };
  },
};
