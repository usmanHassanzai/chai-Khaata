import bcrypt from 'bcryptjs';
import { notifyAdminNewSignup } from './authHelpers.js';
import { ADMIN_EMAIL } from './env.js';
import { getPaymentConfig } from './paymentConfig.js';
import { withTimeout } from './httpUtils.js';
import { createUser, isValidEmail, publicUser } from './store.js';
import { getPlan, isValidPlanId } from './subscriptions.js';
import { isSupabaseEnabled, validateSupabaseConfig } from './supabase.js';

const ADMIN_EMAIL_TIMEOUT_MS = 12_000;

/**
 * @param {Record<string, unknown>} body
 */
export async function registerNewUser(body) {
  if (process.env.VERCEL && !isSupabaseEnabled()) {
    const config = validateSupabaseConfig();
    return {
      ok: false,
      status: 503,
      error: 'SERVER_CONFIG',
      message: config.error || 'Database not configured on server',
    };
  }

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

  const user = await withTimeout(
    createUser({
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
    }),
    15_000,
    'Create user',
  );

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
    return {
      status: 409,
      error: 'EMAIL_TAKEN',
      message: 'This email is already registered. Try logging in with your password, or use Forgot Password on the login page.',
    };
  }

  const errMsg = err instanceof Error ? err.message : String(err);
  const errCode = err instanceof Error ? err.code : '';

  console.error('[Chai Khata] Register failure detail:', errMsg, errCode || '');

  if (errCode === 'SERVER_CONFIG') {
    return {
      status: 503,
      error: 'SERVER_CONFIG',
      message: 'Server database not configured. Admin: check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel, then redeploy.',
    };
  }

  if (/Create user timed out/i.test(errMsg)) {
    return { status: 503, error: 'SERVER_ERROR', message: 'Registration timed out. Please try again.' };
  }

  if (/invalid path specified|requested path is invalid/i.test(errMsg)) {
    return {
      status: 503,
      error: 'SERVER_CONFIG',
      message: 'Supabase URL is wrong. Admin: set SUPABASE_URL to https://YOUR_PROJECT.supabase.co only (no /rest/v1), then redeploy.',
    };
  }

  if (/could not find|schema cache|PGRST204|column.*does not exist|unknown column/i.test(errMsg)) {
    return {
      status: 503,
      error: 'SERVER_CONFIG',
      message: 'Database schema outdated. Admin: open Supabase → SQL Editor → run supabase/migrate-production.sql',
    };
  }

  if (/permission denied|row-level security|42501/i.test(errMsg)) {
    return {
      status: 503,
      error: 'SERVER_CONFIG',
      message: 'Database permission error. Admin: use Supabase Secret key (sb_secret_…) in SUPABASE_SERVICE_ROLE_KEY on Vercel.',
    };
  }

  if (/invalid api key|jwt|jws|service.role|service_role/i.test(errMsg)) {
    return {
      status: 503,
      error: 'SERVER_CONFIG',
      message: 'Supabase key is invalid. Admin: copy Secret key (sb_secret_…) into SUPABASE_SERVICE_ROLE_KEY on Vercel, then redeploy.',
    };
  }

  if (/duplicate key|23505|unique constraint/i.test(errMsg)) {
    return { status: 409, error: 'VALIDATION', message: 'Username or email is already registered. Try a different one.' };
  }

  if (/JSON object requested, multiple/i.test(errMsg)) {
    return { status: 500, error: 'SERVER_ERROR', message: 'Database has duplicate accounts. Contact admin to clean up users table.' };
  }

  if (/supabase|fetch failed|timed out|connection|abort|ECONNREFUSED|ENOTFOUND/i.test(errMsg)) {
    return { status: 503, error: 'SERVER_ERROR', message: 'Database temporarily unavailable. Please try again in a minute.' };
  }

  const short = errMsg.replace(/\s+/g, ' ').trim().slice(0, 140);
  return {
    status: 500,
    error: 'SERVER_ERROR',
    message: short
      ? `Registration failed: ${short}`
      : 'Could not register user. Please try again or contact admin.',
  };
}
