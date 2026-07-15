import bcrypt from 'bcryptjs';
import { ADMIN_EMAIL } from './env.js';
import { notifyAdminRenewalPayment } from './authHelpers.js';
import { findUserByLogin, isPaymentBlocked, paymentDueAmount, updateUser } from './store.js';
import { getPaymentConfig } from './paymentConfig.js';
import { withTimeout } from './httpUtils.js';
import {
  getPlan,
  isSubscriptionExpired,
  isValidPlanId,
  subscriptionRenewalFields,
} from './subscriptions.js';
import { createSubmission, findPendingByUserId, publicSubmission } from './paymentSubmissions.js';
import { buildRenewalGraceFields, isRenewalGraceActive, renewalGraceHours } from './renewalGrace.js';

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

  let activeUser = user;
  if (kind === 'subscription_renewal') {
    activeUser = await updateUser(user.id, buildRenewalGraceFields());
  }

  let adminNotified = false;
  let adminNotifyError = '';
  const payment = getPaymentConfig();

  if (kind === 'subscription_renewal') {
    try {
      const plan = getPlan(planId || user.subscriptionPlan || '');
      const notifyResult = await withTimeout(
        notifyAdminRenewalPayment(ADMIN_EMAIL, activeUser, submission, plan, screenshot),
        12_000,
        'Admin renewal email',
      );
      adminNotified = notifyResult.sent === true;
      if (!adminNotified) adminNotifyError = notifyResult.reason || 'Admin email could not be sent';
    } catch (err) {
      adminNotifyError = err instanceof Error ? err.message : 'Admin email failed';
      console.warn('[Chai Khata] Admin renewal email failed:', adminNotifyError);
    }
  }

  const graceHours = renewalGraceHours();
  const graceNote = kind === 'subscription_renewal'
    ? ` You have ${graceHours} hours of free access while admin reviews.`
    : '';
  const whatsappHint = kind === 'subscription_renewal'
    ? ` Also send the same screenshot on WhatsApp (${payment.whatsappDisplay}) with Payment ID ${activeUser.paymentRefId || '—'}.`
    : '';

  const message = kind === 'subscription_renewal'
    ? (earlyRenewal
      ? `Renewal payment submitted early.${graceNote}${adminNotified ? ' Admin was emailed your screenshot.' : ''}${whatsappHint}`
      : `Renewal payment submitted.${graceNote}${adminNotified ? ' Admin was emailed your screenshot.' : ''}${whatsappHint}`)
    : 'Payment screenshot submitted. Admin will review and unblock your account after approval.';

  return {
    ok: true,
    status: 201,
    body: {
      message,
      submission: publicSubmission(submission),
      adminNotified,
      adminNotifyError: adminNotified ? undefined : adminNotifyError || undefined,
      paymentRefId: activeUser.paymentRefId ?? '',
      whatsappLink: payment.whatsappLink,
      whatsappDisplay: payment.whatsappDisplay,
      renewalGraceActive: kind === 'subscription_renewal',
      renewalGraceEndsAt: activeUser.renewalGraceEndsAt ?? '',
    },
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
      accessBlocked: isPaymentBlocked(user) || (isSubscriptionExpired(user) && !isRenewalGraceActive(user)),
      subscriptionExpiresAt: user.subscriptionExpiresAt ?? '',
      subscriptionPlan: user.subscriptionPlan ?? '',
      renewalAvailable,
      daysUntilExpiry: daysLeft,
      renewalGraceActive: isRenewalGraceActive(user),
      renewalGraceEndsAt: user.renewalGraceEndsAt ?? '',
      pendingSubmission: Boolean(pending),
      pendingSubmittedAt: pending?.createdAt,
    },
  };
}
