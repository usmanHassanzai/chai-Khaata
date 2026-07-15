import bcrypt from 'bcryptjs';
import { findUserById, updateUser } from './store.js';

export async function changePasswordForUser(userId, currentPassword, newPassword) {
  if (!currentPassword || !newPassword) {
    const err = new Error('Current password and new password are required');
    err.code = 'VALIDATION';
    throw err;
  }

  if (String(newPassword).length < 6) {
    const err = new Error('Password must be at least 6 characters');
    err.code = 'VALIDATION';
    throw err;
  }

  if (String(currentPassword) === String(newPassword)) {
    const err = new Error('New password must be different from current password');
    err.code = 'VALIDATION';
    throw err;
  }

  const user = await findUserById(userId);
  if (!user) {
    const err = new Error('User not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const valid = await bcrypt.compare(String(currentPassword), user.passwordHash);
  if (!valid) {
    const err = new Error('Current password is incorrect');
    err.code = 'INVALID_CURRENT_PASSWORD';
    throw err;
  }

  const passwordHash = await bcrypt.hash(String(newPassword), 10);
  await updateUser(user.id, {
    passwordHash,
    registrationPassword: user.role === 'admin' ? undefined : String(newPassword),
  });

  return { message: 'Password changed successfully.' };
}

export function mapChangePasswordError(err, res, sendJson) {
  const code = err?.code || 'SERVER_ERROR';
  if (code === 'VALIDATION') return sendJson(res, 400, { error: code, message: err.message });
  if (code === 'NOT_FOUND') return sendJson(res, 404, { error: code, message: err.message });
  if (code === 'INVALID_CURRENT_PASSWORD') return sendJson(res, 401, { error: code, message: err.message });
  if (/timed out after/i.test(String(err?.message || ''))) {
    return sendJson(res, 503, { error: 'TIMEOUT', message: 'Password change took too long. Please retry.' });
  }
  console.error('Change password error:', err);
  return sendJson(res, 500, { error: 'SERVER_ERROR', message: 'Could not change password' });
}
