import { clearOtp, createOtp } from './otpStore.js';
import { sendOtpEmail } from './email.js';
import { sendOtpSms } from './twilio.js';
import { adminSendPasswordToUser } from './passwordRecovery.js';
import {
  clearSubmissionsForUser,
  listPendingSubmissions,
  publicSubmission,
  updateSubmission,
} from './paymentSubmissions.js';
import { deleteLedger } from './ledgerStore.js';
import {
  adminUser,
  deleteUser,
  findUserById,
  updateUser,
} from './store.js';
import {
  computeExpiryFrom,
  extendSubscription,
  getPlan,
  isSubscriptionExpired,
  isValidPlanId,
} from './subscriptions.js';
import { clearExpiryReminderFields } from './subscriptionReminders.js';
import { clearRenewalGraceFields } from './renewalGrace.js';

export async function approveUserById(id) {
  const user = await findUserById(id);
  if (!user) {
    return { status: 404, body: { error: 'NOT_FOUND', message: 'User not found' } };
  }
  if (user.role === 'admin') {
    return { status: 400, body: { error: 'VALIDATION', message: 'Cannot change admin account status' } };
  }

  const now = new Date().toISOString();
  const planId = user.subscriptionPlan;
  const approvePatch = { status: 'approved', approvedAt: now };

  if (planId && isValidPlanId(planId)) {
    approvePatch.subscriptionStartsAt = now;
    approvePatch.subscriptionExpiresAt = computeExpiryFrom(now, planId);
    Object.assign(approvePatch, clearExpiryReminderFields());
  }

  const updated = await updateUser(user.id, approvePatch);
  const plan = planId ? getPlan(planId) : null;

  return {
    status: 200,
    body: {
      user: adminUser(updated),
      message: plan
        ? `User approved with ${plan.label} subscription until ${new Date(updated.subscriptionExpiresAt).toLocaleDateString()}.`
        : 'User approved — they can now log in.',
    },
  };
}

export async function rejectUserById(id) {
  const user = await findUserById(id);
  if (!user) {
    return { status: 404, body: { error: 'NOT_FOUND', message: 'User not found' } };
  }
  if (user.role === 'admin') {
    return { status: 400, body: { error: 'VALIDATION', message: 'Cannot change admin account status' } };
  }

  const updated = await updateUser(user.id, { status: 'rejected' });
  return { status: 200, body: { user: adminUser(updated), message: 'User rejected' } };
}

export async function deleteUserById(id) {
  const trimmed = String(id ?? '').trim();
  if (!trimmed) {
    return { status: 400, body: { error: 'VALIDATION', message: 'User id is required' } };
  }

  const user = await findUserById(trimmed);
  if (!user) {
    return { status: 404, body: { error: 'NOT_FOUND', message: 'User not found (may already be deleted)' } };
  }
  if (user.role === 'admin') {
    return { status: 400, body: { error: 'VALIDATION', message: 'Cannot delete admin account' } };
  }

  const removed = await deleteUser(user.id);

  try {
    await clearOtp(user.id);
  } catch (otpErr) {
    console.warn('[Chai Khata] OTP cleanup failed:', otpErr?.message);
  }

  await clearSubmissionsForUser(user.id);

  try {
    await deleteLedger(user.id);
  } catch (ledgerErr) {
    console.warn('[Chai Khata] Ledger cleanup failed:', ledgerErr?.message);
  }

  return {
    status: 200,
    body: {
      message: `User "${removed.username}" permanently removed from database.`,
      deletedId: removed.id,
      deletedUsername: removed.username,
    },
  };
}

export async function setPaymentDueById(id, amount, note) {
  const user = await findUserById(id);
  if (!user) {
    return { status: 404, body: { error: 'NOT_FOUND', message: 'User not found' } };
  }
  if (user.role === 'admin') {
    return { status: 400, body: { error: 'VALIDATION', message: 'Cannot set payment due for admin' } };
  }
  if (!Number.isFinite(amount) || amount < 0) {
    return { status: 400, body: { error: 'VALIDATION', message: 'Enter a valid payment amount (0 or more)' } };
  }

  const updated = await updateUser(user.id, {
    paymentDue: amount,
    paymentDueNote: String(note ?? '').trim(),
  });
  const msg = amount > 0
    ? `Payment due set to Rs ${amount.toLocaleString()} for ${user.username}.`
    : `Payment due cleared for ${user.username}.`;

  return { status: 200, body: { user: adminUser(updated), message: msg } };
}

export async function markPaidById(id) {
  const user = await findUserById(id);
  if (!user) {
    return { status: 404, body: { error: 'NOT_FOUND', message: 'User not found' } };
  }
  if (user.role === 'admin') {
    return { status: 400, body: { error: 'VALIDATION', message: 'Cannot update admin payment' } };
  }

  const updated = await updateUser(user.id, {
    paymentDue: 0,
    paymentDueNote: '',
    lastPaidAt: new Date().toISOString(),
  });

  return {
    status: 200,
    body: {
      user: adminUser(updated),
      message: `Payment recorded for ${user.username}. App access restored.`,
    },
  };
}

export async function sendOtpToUserById(id, channel) {
  const user = await findUserById(id);
  if (!user) {
    return { status: 404, body: { error: 'NOT_FOUND', message: 'User not found' } };
  }
  if (user.role === 'admin') {
    return { status: 400, body: { error: 'VALIDATION', message: 'Cannot send OTP for admin' } };
  }

  const otpChannel = channel === 'phone' ? 'phone' : 'email';
  const sentTo = otpChannel === 'phone' ? user.phone : user.email;
  if (!sentTo) {
    return { status: 400, body: { error: 'VALIDATION', message: `User has no ${otpChannel} on file` } };
  }

  const otpRecord = await createOtp(user.id, otpChannel, sentTo);
  let delivery = { sent: false, reason: 'Unknown' };

  if (otpChannel === 'email') {
    delivery = await sendOtpEmail(sentTo, otpRecord.otp, user.username);
  } else {
    delivery = await sendOtpSms(sentTo, otpRecord.otp, user.username);
  }

  return {
    status: 200,
    body: {
      message: delivery.sent
        ? `OTP sent to user ${otpChannel}`
        : `OTP created — share manually (${delivery.reason})`,
      otp: otpRecord.otp,
      channel: otpChannel,
      sentTo,
      expiresAt: otpRecord.expiresAt,
      delivery,
    },
  };
}

export async function sendPasswordToUserById(id) {
  const result = await adminSendPasswordToUser(id);
  if (!result.ok) {
    const status = result.error === 'NOT_FOUND' ? 404 : result.error === 'EMAIL_FAILED' ? 503 : 400;
    return { status, body: { error: result.error, message: result.message } };
  }
  return {
    status: 200,
    body: {
      message: result.message || 'Password sent to user\'s registered email.',
      sent: result.sent,
    },
  };
}

export async function approvePaymentSubmissionById(id) {
  const list = await listPendingSubmissions();
  const submission = list.find((s) => s.id === id);
  if (!submission) {
    return { status: 404, body: { error: 'NOT_FOUND', message: 'Submission not found or already reviewed' } };
  }

  const user = await findUserById(submission.userId);
  if (!user) {
    return { status: 404, body: { error: 'NOT_FOUND', message: 'User no longer exists' } };
  }

  const patch = {
    paymentDue: 0,
    paymentDueNote: '',
    lastPaidAt: new Date().toISOString(),
    ...clearRenewalGraceFields(),
  };

  const renewalPlan = submission.subscriptionPlan || user.subscriptionPlan;
  let renewalMessage = `Payment approved for ${user.username}. Account unblocked.`;

  if (submission.kind === 'subscription_renewal' && renewalPlan && isValidPlanId(renewalPlan)) {
    Object.assign(patch, extendSubscription(user, renewalPlan));
    Object.assign(patch, clearExpiryReminderFields());
    patch.registrationFee = getPlan(renewalPlan).price;
    const plan = getPlan(renewalPlan);
    const updatedExpiry = patch.subscriptionExpiresAt || user.subscriptionExpiresAt;
    renewalMessage = `Subscription renewed for ${user.username} (${plan.label}) until ${updatedExpiry ? new Date(updatedExpiry).toLocaleDateString() : '—'}.`;
  } else if (user.status === 'approved' && renewalPlan && isValidPlanId(renewalPlan) && isSubscriptionExpired(user)) {
    Object.assign(patch, extendSubscription(user, renewalPlan));
    Object.assign(patch, clearExpiryReminderFields());
  }

  await updateUser(user.id, patch);

  const updated = await updateSubmission(submission.id, {
    status: 'approved',
    reviewedAt: new Date().toISOString(),
  });

  return {
    status: 200,
    body: {
      message: renewalMessage,
      submission: publicSubmission(updated),
      user: adminUser(await findUserById(user.id)),
    },
  };
}

export async function rejectPaymentSubmissionById(id, note) {
  const list = await listPendingSubmissions();
  const submission = list.find((s) => s.id === id);
  if (!submission) {
    return { status: 404, body: { error: 'NOT_FOUND', message: 'Submission not found' } };
  }

  const user = await findUserById(submission.userId);
  if (user && submission.kind === 'subscription_renewal') {
    await updateUser(user.id, clearRenewalGraceFields());
  }

  const updated = await updateSubmission(submission.id, {
    status: 'rejected',
    reviewedAt: new Date().toISOString(),
    rejectNote: String(note ?? 'Payment proof rejected. Please submit again.').trim(),
  });

  return {
    status: 200,
    body: {
      message: `Payment proof rejected for ${submission.username}.`,
      submission: publicSubmission(updated),
    },
  };
}

export function mapAdminActionError(err) {
  if (/timed out after/i.test(String(err?.message || ''))) {
    return { status: 503, body: { error: 'TIMEOUT', message: 'Request timed out. Please retry.' } };
  }
  if (err instanceof Error && err.message === 'CANNOT_DELETE_ADMIN') {
    return { status: 400, body: { error: 'VALIDATION', message: 'Cannot delete admin account' } };
  }
  if (err instanceof Error && err.message === 'NOT_FOUND') {
    return { status: 404, body: { error: 'NOT_FOUND', message: 'User not found' } };
  }
  console.error('Admin action error:', err);
  return { status: 500, body: { error: 'SERVER_ERROR', message: 'Could not complete admin action' } };
}
