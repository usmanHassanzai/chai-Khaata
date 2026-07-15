import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ADMIN_EMAIL, JWT_SECRET } from './env.js';
import { findUserByLogin, isPaymentBlocked, paymentDueAmount, publicUser, updateUser } from './store.js';
import { isRenewalGraceActive, isSubscriptionAccessBlocked } from './renewalGrace.js';
import { isSupabaseEnabled, validateSupabaseConfig } from './supabase.js';
import { withTimeout, sanitizeAuthErrorMessage } from './httpUtils.js';
import { ensurePendingTrial, getPendingTrialDays } from './trialAccess.js';
import { notifyAdminPendingLogin } from './authHelpers.js';

function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, username: user.username, email: user.email },
    JWT_SECRET,
    { expiresIn: '30d' },
  );
}

export async function performLogin(loginValue, password) {
  if (isSupabaseEnabled()) {
    const config = validateSupabaseConfig();
    if (!config.ok) {
      const err = new Error(config.error || 'Database not configured');
      err.code = 'SERVER_CONFIG';
      err.hint = config.hint;
      throw err;
    }
  }

  if (!loginValue?.trim() || !password) {
    const err = new Error('Email and password are required');
    err.code = 'VALIDATION';
    throw err;
  }

  const user = await withTimeout(
    findUserByLogin(String(loginValue)),
    8000,
    'Database lookup',
  );

  if (!user) {
    const err = new Error('Invalid email or password');
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  const valid = await bcrypt.compare(String(password), user.passwordHash);
  if (!valid) {
    const err = new Error('Invalid email or password');
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  if (user.status === 'pending') {
    void notifyAdminPendingLogin(ADMIN_EMAIL, user).catch((notifyErr) => {
      console.warn('[Chai Khata] Admin login notification failed:', notifyErr);
    });
    const trial = await ensurePendingTrial(user, updateUser);
    if (trial.active) {
      const refreshed = await findUserByLogin(String(loginValue));
      return { token: signToken(refreshed ?? user), user: publicUser(refreshed ?? user) };
    }
    const trialDays = getPendingTrialDays();
    const err = new Error(`Your account is waiting for admin approval (${ADMIN_EMAIL}). Your ${trialDays}-day preview has ended — send payment screenshot on WhatsApp with Payment ID ${user.paymentRefId || '—'}.`);
    err.code = 'PENDING_APPROVAL';
    err.user = publicUser(user);
    throw err;
  }

  if (user.status === 'rejected') {
    const err = new Error(`Your account was not approved. Contact admin at ${ADMIN_EMAIL}.`);
    err.code = 'REJECTED';
    err.user = publicUser(user);
    throw err;
  }

  if (isPaymentBlocked(user)) {
    const due = paymentDueAmount(user);
    const err = new Error(`Payment due: Rs ${due.toLocaleString()}. Contact admin at ${ADMIN_EMAIL}.`);
    err.code = 'PAYMENT_DUE';
    err.user = publicUser(user);
    throw err;
  }

  if (isSubscriptionAccessBlocked(user)) {
    const err = new Error('Your subscription expired. Renew to continue.');
    err.code = 'SUBSCRIPTION_EXPIRED';
    err.user = publicUser(user);
    throw err;
  }

  return { token: signToken(user), user: publicUser(user) };
}

export function getAuthConfig() {
  return {
    adminEmail: ADMIN_EMAIL,
    requiresApproval: true,
    cloudSync: true,
    storage: isSupabaseEnabled() ? 'supabase' : 'file',
    supabase: validateSupabaseConfig(),
  };
}
