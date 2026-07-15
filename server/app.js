import bcrypt from 'bcryptjs';
import cors from 'cors';
import express from 'express';
import jwt from 'jsonwebtoken';
import { sendOtpEmail } from './email.js';
import { sendOtpSms } from './twilio.js';
import { readLedger, writeLedger, shouldAcceptIncoming, deleteLedger } from './ledgerStore.js';
import { deliverOtp, otpDeliveryStatus, otpDeliveryHealth } from './otpDelivery.js';
import { clearOtp, createOtp, getOtpForUser, verifyOtp } from './otpStore.js';
import { registerErrorResponse, registerNewUser } from './registerUser.js';
import { recoverPasswordByEmail, adminSendPasswordToUser } from './passwordRecovery.js';
import { clearExpiryReminderFields, runSubscriptionExpiryReminders } from './subscriptionReminders.js';
import {
  clearSubmissionsForUser,
  createSubmission,
  findPendingByUserId,
  listPendingSubmissions,
  publicSubmission,
  updateSubmission,
} from './paymentSubmissions.js';
import {
  adminUser,
  createUser,
  deleteUser,
  ensureDefaultAdmin,
  findUserById,
  findUserByLogin,
  isAccessBlocked,
  isPaymentBlocked,
  isValidEmail,
  paymentDueAmount,
  publicUser,
  readUsers,
  updateUser,
} from './store.js';
import {
  computeExpiryFrom,
  extendSubscription,
  getPlan,
  getSubscriptionPlans,
  isSubscriptionExpired,
  isValidPlanId,
} from './subscriptions.js';
import { ensureBootstrapAdmin } from './bootstrap.js';
import { performLogin } from './authLogin.js';
import { isSupabaseEnabled, getStorageMode, testSupabaseConnection, validateSupabaseConfig } from './supabase.js';
import { ADMIN_EMAIL, ADMIN_PASSWORD, JWT_SECRET, PORT } from './env.js';
import { getPaymentConfig } from './paymentConfig.js';
import { isTrialActive } from './trialAccess.js';
import { withTimeout } from './httpUtils.js';
import {
  listAdminUsers,
  getAdminUsersSummary,
  getAdminDashboard,
  listAdminOtpRequests,
  adminHandlerError,
} from './adminUsersHandlers.js';

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const CORS_ALLOW_ALL = process.env.CORS_ALLOW_ALL === 'true' || process.env.NODE_ENV === 'production';
const PUBLIC_SERVER_URL =
  process.env.PUBLIC_SERVER_URL ||
  process.env.SITE_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
  '';

function extraCorsOrigins() {
  const raw = process.env.ALLOWED_ORIGINS || '';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function normalizeEmailFromEnv(email) {
  return String(email).trim().toLowerCase();
}

const app = express();

const corsOrigins = [
  CLIENT_ORIGIN,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://localhost',
  'capacitor://localhost',
  'http://localhost',
  'https://patiwala.pk',
  'https://www.patiwala.pk',
  ...extraCorsOrigins(),
];

app.use(cors({
  origin(origin, callback) {
    // Mobile apps (Capacitor) often send no Origin header — allow for cloud sync
    if (!origin || CORS_ALLOW_ALL || corsOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));
app.use(express.json({ limit: '50mb' }));

app.use((req, _res, next) => {
  const raw = req.url || '';
  const path = raw.split('?')[0];
  if (!path.startsWith('/api') && path !== '/') {
    const query = raw.includes('?') ? raw.slice(raw.indexOf('?')) : '';
    req.url = `/api${path.startsWith('/') ? path : `/${path}`}${query}`;
  }
  next();
});

function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, username: user.username, email: user.email },
    JWT_SECRET,
    { expiresIn: '30d' },
  );
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Login required' });
  }

  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    req.userId = payload.sub;
    req.userRole = payload.role;
    next();
  } catch {
    return res.status(401).json({ error: 'INVALID_TOKEN', message: 'Session expired. Please login again.' });
  }
}

function adminMiddleware(req, res, next) {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Admin access required' });
  }
  next();
}

app.get('/api/health', async (_req, res) => {
  const bootstrap = await ensureBootstrapAdmin();
  const storage = getStorageMode();
  const supabaseCheck = storage === 'supabase' ? await testSupabaseConnection() : null;
  const configCheck = validateSupabaseConfig();

  res.json({
    ok: bootstrap.ok !== false && (storage !== 'supabase' || supabaseCheck?.ok !== false),
    service: 'chai-khata-auth',
    sync: true,
    storage,
    supabase: {
      envSet: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
      valid: configCheck.ok,
      connected: supabaseCheck?.ok ?? null,
      error: supabaseCheck?.ok === false ? supabaseCheck.reason : (configCheck.ok ? null : configCheck.error),
      hint: configCheck.hint ?? null,
    },
    publicUrl: PUBLIC_SERVER_URL || null,
    bootstrap,
  });
});

function cronAuthorized(req) {
  const secret = String(process.env.CRON_SECRET || '').trim();
  if (!secret) return process.env.NODE_ENV !== 'production';
  const auth = String(req.headers.authorization || '');
  if (auth === `Bearer ${secret}`) return true;
  return req.query?.secret === secret;
}

app.get('/api/cron/subscription-reminders', async (req, res) => {
  if (!cronAuthorized(req)) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid or missing CRON_SECRET' });
  }
  try {
    const result = await runSubscriptionExpiryReminders();
    res.json({
      ok: true,
      message: `Expiry reminders: ${result.sent} sent, ${result.skipped} skipped`,
      ...result,
    });
  } catch (err) {
    console.error('Subscription reminder cron error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Reminder job failed' });
  }
});

app.get('/api/auth/config', async (_req, res) => {
  const emailHealth = await otpDeliveryHealth();
  res.json({
    adminEmail: ADMIN_EMAIL,
    requiresApproval: true,
    subscriptionPlans: getSubscriptionPlans(),
    otpDelivery: emailHealth,
    publicServerUrl: PUBLIC_SERVER_URL || null,
    cloudSync: true,
    payment: getPaymentConfig(),
  });
});

app.get('/api/auth/subscription-plans', (_req, res) => {
  res.json({ plans: getSubscriptionPlans() });
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const result = await registerNewUser(req.body ?? {});
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error, message: result.message });
    }
    res.status(result.status).json(result.body);
  } catch (err) {
    const failure = registerErrorResponse(err);
    console.error('Register error:', err);
    res.status(failure.status).json({ error: failure.error, message: failure.message });
  }
});

function paymentBlockedResponse(user, res) {
  const due = paymentDueAmount(user);
  return res.status(403).json({
    error: 'PAYMENT_DUE',
    message: `Your account is suspended. Payment due: Rs ${due.toLocaleString()}. Upload payment screenshot below or contact admin at ${ADMIN_EMAIL}.`,
    user: publicUser(user),
    paymentDue: due,
  });
}

function subscriptionExpiredResponse(user, res) {
  const expires = user.subscriptionExpiresAt
    ? new Date(user.subscriptionExpiresAt).toLocaleDateString()
    : '';
  return res.status(403).json({
    error: 'SUBSCRIPTION_EXPIRED',
    message: `Your subscription expired${expires ? ` on ${expires}` : ''}. Renew your plan to continue using Chai Khata.`,
    user: publicUser(user),
  });
}

function accessBlockedResponse(user, res) {
  if (isPaymentBlocked(user)) return paymentBlockedResponse(user, res);
  if (isSubscriptionExpired(user)) return subscriptionExpiredResponse(user, res);
  return res.status(403).json({ error: 'FORBIDDEN', message: 'Access blocked', user: publicUser(user) });
}

app.post('/api/auth/submit-payment-proof', async (req, res) => {
  try {
    const { login, email, username, password, screenshot, subscriptionPlan } = req.body ?? {};
    const loginValue = login ?? email ?? username;

    if (!loginValue?.trim() || !password) {
      return res.status(400).json({ error: 'VALIDATION', message: 'Email/username and password are required' });
    }

    if (!screenshot || typeof screenshot !== 'string' || !screenshot.startsWith('data:image/')) {
      return res.status(400).json({ error: 'VALIDATION', message: 'Payment screenshot image is required' });
    }

    if (screenshot.length > 4_000_000) {
      return res.status(400).json({ error: 'VALIDATION', message: 'Image is too large. Use a smaller screenshot.' });
    }

    const user = await findUserByLogin(String(loginValue));
    if (!user) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(String(password), user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
    }

    if (user.status !== 'approved') {
      return res.status(403).json({ error: 'NOT_APPROVED', message: 'Account is not approved yet' });
    }

    const paymentBlocked = isPaymentBlocked(user);
    const subscriptionExpired = isSubscriptionExpired(user);

    if (!paymentBlocked && !subscriptionExpired) {
      return res.status(400).json({ error: 'NO_PAYMENT_DUE', message: 'No payment or subscription renewal is required' });
    }

    let planId = subscriptionPlan ? String(subscriptionPlan) : '';
    let kind = 'payment_due';
    let amount = paymentDueAmount(user);

    if (subscriptionExpired) {
      if (!planId || !isValidPlanId(planId)) {
        return res.status(400).json({ error: 'VALIDATION', message: 'Select a subscription plan to renew' });
      }
      kind = 'subscription_renewal';
      amount = getPlan(planId).price;
    }

    const existing = await findPendingByUserId(user.id);
    if (existing) {
      return res.status(409).json({
        error: 'ALREADY_SUBMITTED',
        message: 'Your payment proof is already submitted. Please wait for admin approval.',
      });
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

    console.log(`[Chai Khata] Payment proof submitted by ${user.username} — Rs ${submission.paymentDue} (${kind})`);

    res.status(201).json({
      message: kind === 'subscription_renewal'
        ? 'Renewal payment submitted. Admin will review and extend your subscription.'
        : 'Payment screenshot submitted. Admin will review and unblock your account after approval.',
      submission: publicSubmission(submission),
    });
  } catch (err) {
    console.error('Submit payment proof error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Could not submit payment proof' });
  }
});

app.post('/api/auth/submit-signup-payment', async (req, res) => {
  try {
    const { login, email, username, password, screenshot } = req.body ?? {};
    const loginValue = login ?? email ?? username;

    if (!loginValue?.trim() || !password) {
      return res.status(400).json({ error: 'VALIDATION', message: 'Email/username and password are required' });
    }

    if (!screenshot || typeof screenshot !== 'string' || !screenshot.startsWith('data:image/')) {
      return res.status(400).json({ error: 'VALIDATION', message: 'Payment screenshot image is required' });
    }

    if (screenshot.length > 4_000_000) {
      return res.status(400).json({ error: 'VALIDATION', message: 'Image is too large. Use a smaller screenshot.' });
    }

    const user = await findUserByLogin(String(loginValue));
    if (!user) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(String(password), user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
    }

    if (user.status !== 'pending') {
      return res.status(400).json({ error: 'NOT_PENDING', message: 'Signup payment is only for pending new accounts' });
    }

    const existing = await findPendingByUserId(user.id);
    if (existing) {
      return res.status(409).json({
        error: 'ALREADY_SUBMITTED',
        message: 'Payment screenshot already submitted. Admin will review soon.',
      });
    }

    const plan = getPlan(user.subscriptionPlan ?? 'monthly');
    const amount = plan?.price ?? (Number(user.registrationFee) || 0);

    const submission = await createSubmission({
      userId: user.id,
      username: user.username,
      email: user.email ?? '',
      phone: user.phone ?? '',
      paymentDue: amount,
      subscriptionPlan: user.subscriptionPlan || '',
      kind: 'signup_payment',
      paymentRefId: user.paymentRefId ?? '',
      screenshot,
    });

    console.log(`[Chai Khata] Signup payment proof: ${user.paymentRefId} — ${user.username}`);

    res.status(201).json({
      message: `Payment screenshot received for Payment ID ${user.paymentRefId}. Admin will verify and approve your account.`,
      submission: publicSubmission(submission),
      paymentRefId: user.paymentRefId,
    });
  } catch (err) {
    console.error('Submit signup payment error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Could not submit payment screenshot' });
  }
});

app.post('/api/auth/check-payment-submission', async (req, res) => {
  try {
    const { login, email, username, password } = req.body ?? {};
    const loginValue = login ?? email ?? username;
    if (!loginValue?.trim() || !password) {
      return res.status(400).json({ error: 'VALIDATION', message: 'Email/username and password required' });
    }

    const user = await findUserByLogin(String(loginValue));
    if (!user) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(String(password), user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
    }

    const pending = await findPendingByUserId(user.id);
    res.json({
      paymentDue: paymentDueAmount(user),
      paymentBlocked: isPaymentBlocked(user),
      subscriptionExpired: isSubscriptionExpired(user),
      accessBlocked: isAccessBlocked(user),
      subscriptionExpiresAt: user.subscriptionExpiresAt ?? '',
      subscriptionPlan: user.subscriptionPlan ?? '',
      pendingSubmission: Boolean(pending),
      pendingSubmittedAt: pending?.createdAt,
    });
  } catch (err) {
    console.error('Check payment submission error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Could not check status' });
  }
});

app.get('/api/admin/payment-submissions', authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    const submissions = await listPendingSubmissions();
    res.json({ submissions: submissions.map(publicSubmission) });
  } catch (err) {
    console.error('List payment submissions error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Could not list payment submissions' });
  }
});

app.patch('/api/admin/payment-submissions/:id/approve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const list = await listPendingSubmissions();
    const submission = list.find((s) => s.id === req.params.id);
    if (!submission) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Submission not found or already reviewed' });
    }

    const user = await findUserById(submission.userId);
    if (!user) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User no longer exists' });
    }

    const patch = {
      paymentDue: 0,
      paymentDueNote: '',
      lastPaidAt: new Date().toISOString(),
    };

    const renewalPlan = submission.subscriptionPlan || user.subscriptionPlan;
    if (submission.kind === 'subscription_renewal' && renewalPlan && isValidPlanId(renewalPlan)) {
      Object.assign(patch, extendSubscription(user, renewalPlan));
      Object.assign(patch, clearExpiryReminderFields());
      patch.registrationFee = getPlan(renewalPlan).price;
    } else if (user.status === 'approved' && renewalPlan && isValidPlanId(renewalPlan) && isSubscriptionExpired(user)) {
      Object.assign(patch, extendSubscription(user, renewalPlan));
      Object.assign(patch, clearExpiryReminderFields());
    }

    await updateUser(user.id, patch);

    const updated = await updateSubmission(submission.id, {
      status: 'approved',
      reviewedAt: new Date().toISOString(),
    });

    res.json({
      message: `Payment approved for ${user.username}. Account unblocked.`,
      submission: publicSubmission(updated),
      user: adminUser(await findUserById(user.id)),
    });
  } catch (err) {
    console.error('Approve payment submission error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Could not approve payment' });
  }
});

app.patch('/api/admin/payment-submissions/:id/reject', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const list = await listPendingSubmissions();
    const submission = list.find((s) => s.id === req.params.id);
    if (!submission) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Submission not found' });
    }

    const note = String(req.body?.note ?? 'Payment proof rejected. Please submit again.').trim();
    const updated = await updateSubmission(submission.id, {
      status: 'rejected',
      reviewedAt: new Date().toISOString(),
      rejectNote: note,
    });

    res.json({
      message: `Payment proof rejected for ${submission.username}.`,
      submission: publicSubmission(updated),
    });
  } catch (err) {
    console.error('Reject payment submission error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Could not reject payment' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, email, login, password } = req.body ?? {};
    const loginValue = login ?? email ?? username;
    const result = await performLogin(loginValue, password);
    res.json(result);
  } catch (err) {
    const code = err?.code || 'SERVER_ERROR';
    if (code === 'VALIDATION') {
      return res.status(400).json({ error: code, message: err.message });
    }
    if (code === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ error: code, message: err.message });
    }
    if (code === 'PENDING_APPROVAL' || code === 'REJECTED') {
      return res.status(403).json({ error: code, message: err.message, user: err.user });
    }
    if (code === 'PAYMENT_DUE' || code === 'SUBSCRIPTION_EXPIRED') {
      return res.status(403).json({ error: code, message: err.message, user: err.user });
    }
    if (code === 'SERVER_CONFIG') {
      return res.status(503).json({ error: code, message: err.message, hint: err.hint });
    }
    console.error('Login error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: sanitizeAuthErrorMessage(err) });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await findUserById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
    }

    if (user.status !== 'approved' && user.role !== 'admin') {
      if (user.status === 'pending' && isTrialActive(user)) {
        return res.json({ user: publicUser(user) });
      }
      return res.status(403).json({
        error: user.status === 'pending' ? 'PENDING_APPROVAL' : 'REJECTED',
        message: user.status === 'pending'
          ? `Your account is waiting for admin approval (${ADMIN_EMAIL}).`
          : `Your account was not approved. Contact admin at ${ADMIN_EMAIL}.`,
        user: publicUser(user),
      });
    }

    if (isPaymentBlocked(user)) {
      return paymentBlockedResponse(user, res);
    }

    if (isSubscriptionExpired(user)) {
      return subscriptionExpiredResponse(user, res);
    }

    res.json({ user: publicUser(user) });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Could not fetch profile' });
  }
});

app.get('/api/admin/users/summary', authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    const counts = await withTimeout(getAdminUsersSummary(), 8000, 'User summary');
    res.json(counts);
  } catch (err) {
    console.error('Admin user summary error:', err);
    const failure = adminHandlerError(err);
    res.status(failure.status).json(failure.body);
  }
});

app.get('/api/admin/dashboard', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const params = new URLSearchParams(req.query ?? {});
    const result = await withTimeout(getAdminDashboard(params), 8000, 'Admin dashboard');
    res.json(result);
  } catch (err) {
    console.error('Admin dashboard error:', err);
    const failure = adminHandlerError(err);
    res.status(failure.status).json(failure.body);
  }
});

app.get('/api/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const params = new URLSearchParams(req.query ?? {});
    const result = await withTimeout(listAdminUsers(params), 8000, 'List users');
    res.json(result);
  } catch (err) {
    console.error('List users error:', err);
    const failure = adminHandlerError(err);
    res.status(failure.status).json(failure.body);
  }
});

app.get('/api/admin/otp-requests', authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    const result = await withTimeout(listAdminOtpRequests(), 8000, 'OTP requests');
    res.json(result);
  } catch (err) {
    console.error('OTP requests error:', err);
    const failure = adminHandlerError(err);
    res.status(failure.status).json(failure.body);
  }
});

app.post('/api/admin/users/:id/send-otp', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const user = await findUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
    }
    if (user.role === 'admin') {
      return res.status(400).json({ error: 'VALIDATION', message: 'Cannot send OTP for admin' });
    }

    const channel = req.body?.channel === 'phone' ? 'phone' : 'email';
    const sentTo = channel === 'phone' ? user.phone : user.email;
    if (!sentTo) {
      return res.status(400).json({ error: 'VALIDATION', message: `User has no ${channel} on file` });
    }

    const otpRecord = await createOtp(user.id, channel, sentTo);
    let delivery = { sent: false, reason: 'Unknown' };

    if (channel === 'email') {
      delivery = await sendOtpEmail(sentTo, otpRecord.otp, user.username);
    } else {
      delivery = await sendOtpSms(sentTo, otpRecord.otp, user.username);
    }

    res.json({
      message: delivery.sent
        ? `OTP sent to user ${channel}`
        : `OTP created — share manually (${delivery.reason})`,
      otp: otpRecord.otp,
      channel,
      sentTo,
      expiresAt: otpRecord.expiresAt,
      delivery,
    });
  } catch (err) {
    console.error('Admin send OTP error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Could not send OTP' });
  }
});

app.post('/api/admin/users/:id/send-password', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await adminSendPasswordToUser(req.params.id);
    if (!result.ok) {
      const status = result.error === 'NOT_FOUND' ? 404 : result.error === 'EMAIL_FAILED' ? 503 : 400;
      return res.status(status).json({ error: result.error, message: result.message });
    }
    res.json({
      message: result.message || `Password sent to user's registered email.`,
      sent: result.sent,
    });
  } catch (err) {
    console.error('Admin send password error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Could not send password email' });
  }
});

app.delete('/api/admin/users/:id', authMiddleware, adminMiddleware, deleteUserHandler);
app.post('/api/admin/users/:id/delete', authMiddleware, adminMiddleware, deleteUserHandler);

async function deleteUserHandler(req, res) {
  try {
    const id = String(req.params.id ?? '').trim();
    if (!id) {
      return res.status(400).json({ error: 'VALIDATION', message: 'User id is required' });
    }

    const user = await findUserById(id);
    if (!user) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found (may already be deleted)' });
    }
    if (user.role === 'admin') {
      return res.status(400).json({ error: 'VALIDATION', message: 'Cannot delete admin account' });
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

    console.log(`[Chai Khata] User permanently deleted from database: ${removed.username} (${removed.id})`);
    res.json({
      message: `User "${removed.username}" permanently removed from database.`,
      deletedId: removed.id,
      deletedUsername: removed.username,
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'CANNOT_DELETE_ADMIN') {
      return res.status(400).json({ error: 'VALIDATION', message: 'Cannot delete admin account' });
    }
    if (err instanceof Error && err.message === 'NOT_FOUND') {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
    }
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Could not delete user from database' });
  }
}

app.post('/api/auth/recover-password-by-email', async (req, res) => {
  try {
    const { email } = req.body ?? {};
    const result = await recoverPasswordByEmail(email);
    if (!result.ok) {
      const status = result.error === 'EMAIL_FAILED' ? 503 : 400;
      return res.status(status).json({ error: result.error, message: result.message });
    }
    res.json({
      message: result.message,
      sent: result.sent,
      maskedEmail: result.maskedEmail,
    });
  } catch (err) {
    console.error('Recover password by email error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Could not process password recovery' });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { login, channel } = req.body ?? {};
    if (!login?.trim()) {
      return res.status(400).json({ error: 'VALIDATION', message: 'Email or username is required' });
    }

    const user = await findUserByLogin(String(login));
    if (!user) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'No account found with that email or username' });
    }

    const useChannel = channel === 'phone' ? 'phone' : 'email';
    let sentTo = useChannel === 'phone' ? user.phone : user.email;

    if (!sentTo) {
      if (useChannel === 'phone' && user.email) {
        sentTo = user.email;
      } else {
        return res.status(400).json({
          error: 'VALIDATION',
          message: useChannel === 'phone'
            ? 'No phone on this account. Try email or contact admin.'
            : 'No email on this account. Try phone or contact admin.',
        });
      }
    }

    const otpRecord = await createOtp(user.id, useChannel, sentTo);
    const delivery = await deliverOtp({
      channel: useChannel,
      email: user.email ?? '',
      phone: user.phone ?? '',
      username: user.username,
      otp: otpRecord.otp,
    });

    const sentVia = delivery.via === 'email' && useChannel === 'phone' ? 'email (SMS fallback)' : useChannel;

    /** Show OTP on screen when auto-delivery failed so user can still reset password */
    const showOtpOnScreen = !delivery.sent;

    res.json({
      message: delivery.sent
        ? (delivery.reason || `OTP sent to your ${sentVia}`)
        : 'OTP created. Auto-send is not configured — use the code shown below.',
      otp: showOtpOnScreen ? otpRecord.otp : undefined,
      userId: user.id,
      channel: useChannel,
      maskedTarget: maskContact(sentTo, useChannel),
      expiresAt: otpRecord.expiresAt,
      delivery,
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Could not start password reset' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { login, otp, newPassword } = req.body ?? {};

    if (!login?.trim() || !otp || !newPassword) {
      return res.status(400).json({ error: 'VALIDATION', message: 'Email/username, OTP, and new password are required' });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: 'VALIDATION', message: 'Password must be at least 6 characters' });
    }

    const user = await findUserByLogin(String(login));
    if (!user) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Account not found' });
    }

    const check = await verifyOtp(user.id, String(otp));
    if (!check.valid) {
      const msg = check.reason === 'EXPIRED'
        ? 'OTP expired. Request a new one.'
        : 'Invalid OTP. Please check and try again.';
      return res.status(400).json({ error: 'INVALID_OTP', message: msg });
    }

    const passwordHash = await bcrypt.hash(String(newPassword), 10);
    await updateUser(user.id, {
      passwordHash,
      registrationPassword: undefined,
    });
    await clearOtp(user.id);

    res.json({ message: 'Password changed successfully. You can now log in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Could not reset password' });
  }
});

app.post('/api/auth/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body ?? {};

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'VALIDATION',
        message: 'Current password and new password are required',
      });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: 'VALIDATION', message: 'Password must be at least 6 characters' });
    }

    if (String(currentPassword) === String(newPassword)) {
      return res.status(400).json({
        error: 'VALIDATION',
        message: 'New password must be different from current password',
      });
    }

    const user = await findUserById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
    }

    const valid = await bcrypt.compare(String(currentPassword), user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'INVALID_CURRENT_PASSWORD', message: 'Current password is incorrect' });
    }

    const passwordHash = await bcrypt.hash(String(newPassword), 10);
    await updateUser(user.id, {
      passwordHash,
      registrationPassword: user.role === 'admin' ? undefined : String(newPassword),
    });

    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Could not change password' });
  }
});

function maskContact(value, channel) {
  if (channel === 'email') {
    const [local, domain] = value.split('@');
    if (!domain) return '***';
    return `${local.slice(0, 2)}***@${domain}`;
  }
  return `***${String(value).slice(-4)}`;
}

app.patch('/api/admin/users/:id/approve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const user = await findUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
    }

    if (user.role === 'admin') {
      return res.status(400).json({ error: 'VALIDATION', message: 'Cannot change admin account status' });
    }

    const now = new Date().toISOString();
    const planId = user.subscriptionPlan;
    const approvePatch = {
      status: 'approved',
      approvedAt: now,
    };

    if (planId && isValidPlanId(planId)) {
      approvePatch.subscriptionStartsAt = now;
      approvePatch.subscriptionExpiresAt = computeExpiryFrom(now, planId);
      Object.assign(approvePatch, clearExpiryReminderFields());
    }

    const updated = await updateUser(user.id, approvePatch);

    const plan = planId ? getPlan(planId) : null;
    res.json({
      user: adminUser(updated),
      message: plan
        ? `User approved with ${plan.label} subscription until ${new Date(updated.subscriptionExpiresAt).toLocaleDateString()}.`
        : 'User approved — they can now log in.',
    });
  } catch (err) {
    console.error('Approve error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Could not approve user' });
  }
});

app.patch('/api/admin/users/:id/reject', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const user = await findUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
    }

    if (user.role === 'admin') {
      return res.status(400).json({ error: 'VALIDATION', message: 'Cannot change admin account status' });
    }

    const updated = await updateUser(user.id, { status: 'rejected' });
    res.json({ user: adminUser(updated), message: 'User rejected' });
  } catch (err) {
    console.error('Reject error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Could not reject user' });
  }
});

app.patch('/api/admin/users/:id/payment-due', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const user = await findUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
    }
    if (user.role === 'admin') {
      return res.status(400).json({ error: 'VALIDATION', message: 'Cannot set payment due for admin' });
    }

    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      return res.status(400).json({ error: 'VALIDATION', message: 'Enter a valid payment amount (0 or more)' });
    }

    const updated = await updateUser(user.id, {
      paymentDue: amount,
      paymentDueNote: String(req.body?.note ?? '').trim(),
    });

    const msg = amount > 0
      ? `Payment due set to Rs ${amount.toLocaleString()} — user app access is now blocked.`
      : 'Payment due cleared — user can access the app.';

    res.json({ user: adminUser(updated), message: msg });
  } catch (err) {
    console.error('Set payment due error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Could not update payment due' });
  }
});

app.patch('/api/admin/users/:id/mark-paid', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const user = await findUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
    }
    if (user.role === 'admin') {
      return res.status(400).json({ error: 'VALIDATION', message: 'Cannot update admin payment' });
    }

    const updated = await updateUser(user.id, {
      paymentDue: 0,
      paymentDueNote: '',
      lastPaidAt: new Date().toISOString(),
    });

    res.json({
      user: adminUser(updated),
      message: `Payment recorded for ${user.username}. App access restored.`,
    });
  } catch (err) {
    console.error('Mark paid error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Could not mark payment' });
  }
});

app.get('/api/sync/ledger', authMiddleware, async (req, res) => {
  try {
    const ledger = await readLedger(req.userId);
    if (!ledger) {
      return res.json({ empty: true, ledger: null });
    }
    res.json({ empty: false, ledger });
  } catch (err) {
    console.error('Sync pull error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Could not load cloud data' });
  }
});

app.put('/api/sync/ledger', authMiddleware, async (req, res) => {
  try {
    const incoming = req.body ?? {};
    const existing = await readLedger(req.userId);

    if (!shouldAcceptIncoming(incoming, existing)) {
      return res.status(409).json({
        error: 'CONFLICT',
        message: 'Cloud has newer data. Pulling latest…',
        ledger: existing,
      });
    }

    const saved = await writeLedger(req.userId, {
      updatedAt: incoming.updatedAt || new Date().toISOString(),
      dealers: incoming.dealers ?? [],
      customers: incoming.customers ?? [],
      purchases: incoming.purchases ?? [],
      sales: incoming.sales ?? [],
      payments: incoming.payments ?? [],
      settings: incoming.settings ?? [],
    });

    res.json({ accepted: true, ledger: saved });
  } catch (err) {
    console.error('Sync push error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Could not save cloud data' });
  }
});

async function startServer() {
  await ensureBootstrapAdmin();
  const admin = await findUserByLogin(ADMIN_EMAIL);
  console.log(`Admin ready: ${admin?.email ?? ADMIN_EMAIL} (login with this email or username "${admin?.username ?? 'admin'}")`);
  console.log(`Storage: ${isSupabaseEnabled() ? 'Supabase ✓' : 'Local files (set SUPABASE_* for production)'}`);

  const otp = otpDeliveryStatus();
  console.log(`OTP email: ${otp.emailConfigured ? 'configured ✓' : 'NOT configured (add SMTP_* to .env)'}`);
  console.log(`OTP SMS (Twilio): ${otp.smsConfigured ? `configured ✓ from ${otp.twilio?.from}` : 'NOT configured (add TWILIO_* to .env)'}`);

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Chai Khata auth server running on http://0.0.0.0:${PORT}`);
    if (PUBLIC_SERVER_URL) {
      console.log(`Public URL (any network): ${PUBLIC_SERVER_URL}`);
    } else if (CORS_ALLOW_ALL) {
      console.log('Cloud sync: phones on ANY network can connect (CORS_ALLOW_ALL=true)');
    } else {
      console.log('For phones on other Wi‑Fi / mobile data: deploy to Vercel or run npm run tunnel');
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ Port ${PORT} is already in use.`);
      console.error('   Close the other terminal running the server, or run:');
      console.error(`   fuser -k ${PORT}/tcp\n`);
      process.exit(1);
    }
    console.error('Server error:', err);
    process.exit(1);
  });
}

export default app;
export { startServer };
