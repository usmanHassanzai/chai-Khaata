import bcrypt from 'bcryptjs';
import { notifyAdminNewSignup } from './authHelpers.js';
import { ADMIN_EMAIL } from './env.js';
import { getPaymentConfig } from './paymentConfig.js';
import { withTimeout } from './httpUtils.js';
import { createUser, isValidEmail, publicUser } from './store.js';
import { getPlan, isValidPlanId } from './subscriptions.js';

const ADMIN_EMAIL_TIMEOUT_MS = 12_000;

/**
 * @param {Record<string, unknown>} body
 */
export async function registerNewUser(body) {
  const { username, email, phone, password, shopName, paymentFeeDate, subscriptionPlan } = body ?? {};

  if (!username?.trim() || !email?.trim() || !phone?.trim() || !password) {
    return {
      ok: false,
      status: 400,
      error: 'VALIDATION',
      message: 'Username, email, phone, and password are required',
    };
  }

  if (!subscriptionPlan || !isValidPlanId(String(subscriptionPlan))) {
    return { ok: false, status: 400, error: 'VALIDATION', message: 'Please select a subscription plan' };
  }

  const plan = getPlan(String(subscriptionPlan));
  const feeAmount = plan.price;

  if (!paymentFeeDate?.trim()) {
    return { ok: false, status: 400, error: 'VALIDATION', message: 'Payment date is required' };
  }

  if (String(username).trim().length < 3) {
    return { ok: false, status: 400, error: 'VALIDATION', message: 'Username must be at least 3 characters' };
  }

  if (!isValidEmail(String(email))) {
    return { ok: false, status: 400, error: 'VALIDATION', message: 'Please enter a valid email address' };
  }

  if (String(phone).trim().length < 10) {
    return { ok: false, status: 400, error: 'VALIDATION', message: 'Please enter a valid phone number' };
  }

  if (String(password).length < 6) {
    return { ok: false, status: 400, error: 'VALIDATION', message: 'Password must be at least 6 characters' };
  }

  const passwordHash = await bcrypt.hash(String(password), 10);
  const plainPassword = String(password);

  const user = await createUser({
    username: String(username).trim().toLowerCase(),
    email: String(email),
    phone: String(phone).trim(),
    passwordHash,
    registrationPassword: plainPassword,
    registrationFee: feeAmount,
    paymentFeeDate: String(paymentFeeDate).trim(),
    subscriptionPlan: plan.id,
    subscriptionPlanLabel: plan.label,
    shopName: shopName?.trim() || '',
    status: 'pending',
    role: 'user',
  });

  console.log(`[Chai Khata] Signup saved: ${user.username} | ref=${user.paymentRefId} | phone=${user.phone} | plan=${plan.label}`);

  let notifyResult = { sent: false, reason: 'Admin email not sent' };
  try {
    notifyResult = await withTimeout(
      notifyAdminNewSignup(ADMIN_EMAIL, user, plainPassword, feeAmount, plan),
      ADMIN_EMAIL_TIMEOUT_MS,
      'Admin signup email',
    );
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Admin email failed';
    console.warn(`[Chai Khata] Admin signup email failed/timed out for ${user.username}: ${reason}`);
    notifyResult = { sent: false, reason };
  }

  return {
    ok: true,
    status: 201,
    body: {
      message: notifyResult.sent
        ? `Sign up successful! Payment ID: ${user.paymentRefId}. Admin has been notified at ${ADMIN_EMAIL}. Send payment screenshot on WhatsApp with your Payment ID.`
        : `Sign up successful! Payment ID: ${user.paymentRefId}. Send Rs ${feeAmount.toLocaleString()} via Easypaisa/UBL/Nayapay/JS Bank and WhatsApp your screenshot with Payment ID ${user.paymentRefId}. Admin will approve after verification.`,
      user: publicUser(user),
      paymentRefId: user.paymentRefId,
      payment: getPaymentConfig(),
      adminNotified: notifyResult.sent === true,
      adminNotifyError: notifyResult.sent ? undefined : (notifyResult.reason || 'Admin email could not be sent'),
    },
  };
}

export function registerErrorResponse(err) {
  if (err instanceof Error && err.message === 'USERNAME_TAKEN') {
    return { status: 409, error: 'USERNAME_TAKEN', message: 'This username is already taken' };
  }
  if (err instanceof Error && err.message === 'EMAIL_TAKEN') {
    return { status: 409, error: 'EMAIL_TAKEN', message: 'This email is already registered' };
  }

  const errMsg = err instanceof Error ? err.message : String(err);
  let message = 'Could not register user';
  if (/column.*does not exist|last_expiry_reminder/i.test(errMsg)) {
    message = 'Database needs an update. Admin: run supabase/schema.sql migration in Supabase SQL Editor.';
  } else if (/supabase|fetch failed|timed out|connection/i.test(errMsg)) {
    message = 'Database temporarily unavailable. Please try again in a minute.';
  } else if (/JWT|service_role|SUPABASE/i.test(errMsg)) {
    message = 'Server database configuration error. Contact admin.';
  }

  return { status: 500, error: 'SERVER_ERROR', message };
}
