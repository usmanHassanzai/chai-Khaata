import bcrypt from 'bcryptjs';
import { findUserByLogin, isPaymentBlocked, paymentDueAmount } from './store.js';
import {
  getPlan,
  isSubscriptionExpired,
  isValidPlanId,
  subscriptionRenewalFields,
} from './subscriptions.js';
import { createSubmission, findPendingByUserId, publicSubmission } from './paymentSubmissions.js';

/** User can submit renewal if expired or within reminder window (7 days before). */
export function canSubmitSubscriptionRenewal(user) {
  return subscriptionRenewalFields(user).renewalAvailable;
}

/**
 * @param {import('./store.js').UserRecord} user
 * @param {string} screenshot
 * @param {string} [subscriptionPlan]
 */
export async function submitPaymentProofForUser(user, screenshot, subscriptionPlan) {
  if (!screenshot || typeof screenshot !== 'string' || !screenshot.startsWith('data:image/')) {
    return { ok: false, status: 400, error: 'VALIDATION', message: 'Payment screenshot image is required' };
  }

  if (screenshot.length > 4_000_000) {
    return { ok: false, status: 400, error: 'VALIDATION', message: 'Image is too large. Use a smaller screenshot.' };
  }

  if (user.status !== 'approved') {
    return { ok: false, status: 403, error: 'NOT_APPROVED', message: 'Account is not approved yet' };
  }

  const paymentBlocked = isPaymentBlocked(user);
  const subscriptionExpired = isSubscriptionExpired(user);
  const { renewalAvailable } = subscriptionRenewalFields(user);
  const earlyRenewal = renewalAvailable && !subscriptionExpired;

  if (!paymentBlocked && !subscriptionExpired && !earlyRenewal) {
    return {
      ok: false,
      status: 400,
      error: 'NO_PAYMENT_DUE',
      message: 'No payment or subscription renewal is required yet',
    };
  }

  let planId = subscriptionPlan ? String(subscriptionPlan) : '';
  let kind = 'payment_due';
  let amount = paymentDueAmount(user);

  if (subscriptionExpired || earlyRenewal) {
    if (!planId || !isValidPlanId(planId)) {
      return { ok: false, status: 400, error: 'VALIDATION', message: 'Select a subscription plan to renew' };
    }
    kind = 'subscription_renewal';
    amount = getPlan(planId).price;
  }

  const existing = await findPendingByUserId(user.id);
  if (existing) {
    return {
      ok: false,
      status: 409,
      error: 'ALREADY_SUBMITTED',
      message: 'Your payment proof is already submitted. Please wait for admin approval.',
    };
  }

  const submission = await createSubmission({
    userId: user.id,
    username: user.username,
    email: user.email ?? '',
    phone: user.phone ?? '',
    paymentDue: amount,
    subscriptionPlan: planId || user.subscriptionPlan || '',
    kind,
    screenshot,
  });

  const message = kind === 'subscription_renewal'
    ? (earlyRenewal
      ? 'Renewal payment submitted early. Admin will review and extend your subscription.'
      : 'Renewal payment submitted. Admin will review and extend your subscription.')
    : 'Payment screenshot submitted. Admin will review and unblock your account after approval.';

  return {
    ok: true,
    status: 201,
    body: { message, submission: publicSubmission(submission) },
  };
}

export async function submitPaymentProofByLogin(loginValue, password, screenshot, subscriptionPlan) {
  if (!loginValue?.trim() || !password) {
    return { ok: false, status: 400, error: 'VALIDATION', message: 'Email/username and password are required' };
  }

  const user = await findUserByLogin(String(loginValue));
  if (!user) {
    return { ok: false, status: 401, error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' };
  }

  const valid = await bcrypt.compare(String(password), user.passwordHash);
  if (!valid) {
    return { ok: false, status: 401, error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' };
  }

  return submitPaymentProofForUser(user, screenshot, subscriptionPlan);
}

export async function checkPaymentSubmissionByLogin(loginValue, password) {
  if (!loginValue?.trim() || !password) {
    return { ok: false, status: 400, error: 'VALIDATION', message: 'Email/username and password required' };
  }

  const user = await findUserByLogin(String(loginValue));
  if (!user) {
    return { ok: false, status: 401, error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' };
  }

  const valid = await bcrypt.compare(String(password), user.passwordHash);
  if (!valid) {
    return { ok: false, status: 401, error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' };
  }

  const pending = await findPendingByUserId(user.id);
  const { renewalAvailable, daysUntilExpiry: daysLeft } = subscriptionRenewalFields(user);

  return {
    ok: true,
    status: 200,
    body: {
      paymentDue: paymentDueAmount(user),
      paymentBlocked: isPaymentBlocked(user),
      subscriptionExpired: isSubscriptionExpired(user),
      accessBlocked: isPaymentBlocked(user) || isSubscriptionExpired(user),
      subscriptionExpiresAt: user.subscriptionExpiresAt ?? '',
      subscriptionPlan: user.subscriptionPlan ?? '',
      renewalAvailable,
      daysUntilExpiry: daysLeft,
      pendingSubmission: Boolean(pending),
      pendingSubmittedAt: pending?.createdAt,
    },
  };
}
