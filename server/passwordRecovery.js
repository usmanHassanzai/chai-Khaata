import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { ADMIN_EMAIL } from './env.js';
import { sendAdminPasswordRecoveryEmail, sendUserPasswordRecoveryEmail } from './email.js';
import { findUserByLogin, isValidEmail, normalizeEmail, updateUser } from './store.js';

function maskEmail(email) {
  const [local, domain] = String(email).split('@');
  if (!domain) return '***';
  return `${local.slice(0, 2)}***@${domain}`;
}

function generateTempPassword() {
  return `Pk${randomBytes(4).toString('hex')}9`;
}

/**
 * Send account password to user's registered email. Generates a temp password if none stored.
 * @param {string} loginOrEmail
 */
export async function recoverPasswordByEmail(loginOrEmail) {
  const login = String(loginOrEmail ?? '').trim();
  if (!login) {
    return { ok: false, error: 'VALIDATION', message: 'Email is required' };
  }

  const user = await findUserByLogin(login);
  const genericMessage = 'If this email is registered, your password has been sent to your inbox. Check spam folder too.';

  if (!user || !user.email?.trim()) {
    return { ok: true, sent: false, message: genericMessage };
  }

  if (user.role === 'admin') {
    return {
      ok: false,
      error: 'VALIDATION',
      message: 'Admin password cannot be recovered by email. Contact system administrator.',
    };
  }

  let password = user.registrationPassword?.trim();
  let generated = false;

  if (!password) {
    password = generateTempPassword();
    generated = true;
    const passwordHash = await bcrypt.hash(password, 10);
    await updateUser(user.id, {
      passwordHash,
      registrationPassword: password,
    });
  }

  const [userResult] = await Promise.all([
    sendUserPasswordRecoveryEmail(user.email, user, password, generated),
    sendAdminPasswordRecoveryEmail(ADMIN_EMAIL, user, generated),
  ]);

  if (!userResult.sent) {
    return {
      ok: false,
      error: 'EMAIL_FAILED',
      message: userResult.reason || `Could not send email. Contact admin at ${ADMIN_EMAIL}.`,
    };
  }

  console.log(`[Chai Khata] Password recovery email sent to ${user.email} (${user.username})`);

  return {
    ok: true,
    sent: true,
    message: `Your password has been sent to ${maskEmail(user.email)}. Check your inbox and spam folder.`,
    maskedEmail: maskEmail(user.email),
    generated,
  };
}

/** Admin manually resends password to user's registered email. */
export async function adminSendPasswordToUser(userId) {
  const { findUserById } = await import('./store.js');
  const user = await findUserById(userId);
  if (!user) {
    return { ok: false, error: 'NOT_FOUND', message: 'User not found' };
  }
  if (user.role === 'admin') {
    return { ok: false, error: 'VALIDATION', message: 'Cannot send admin password by email' };
  }
  if (!user.email?.trim()) {
    return { ok: false, error: 'VALIDATION', message: 'User has no email on file' };
  }

  return recoverPasswordByEmail(user.email);
}

export { maskEmail, normalizeEmail, isValidEmail };
