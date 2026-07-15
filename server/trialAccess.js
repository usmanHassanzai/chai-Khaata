import { getPaymentConfig } from './paymentConfig.js';

export const DEFAULT_PENDING_TRIAL_DAYS = 7;

export function getPendingTrialMs() {
  const hours = Number(getPaymentConfig().pendingTrialHours);
  if (Number.isFinite(hours) && hours > 0) return hours * 60 * 60 * 1000;
  return DEFAULT_PENDING_TRIAL_DAYS * 24 * 60 * 60 * 1000;
}

export function getPendingTrialDays() {
  return Math.max(1, Math.round(getPendingTrialMs() / (24 * 60 * 60 * 1000)));
}

/** @param {Date} [start] */
export function buildPendingTrialFields(start = new Date()) {
  const trialStartedAt = start.toISOString();
  const trialEndsAt = new Date(start.getTime() + getPendingTrialMs()).toISOString();
  return { trialStartedAt, trialEndsAt };
}

/** @param {{ status?: string, trialEndsAt?: string }} user */
export function isTrialActive(user) {
  if (user?.status !== 'pending') return false;
  if (!user.trialEndsAt) return false;
  return new Date() < new Date(user.trialEndsAt);
}

/**
 * Ensure pending users have a trial window (7 days from registration, or from first login for older accounts).
 * @param {import('./store.js').UserRecord} user
 * @param {(id: string, patch: object) => Promise<import('./store.js').UserRecord>} updateUserFn
 */
export async function ensurePendingTrial(user, updateUserFn) {
  const now = new Date();
  if (user.trialEndsAt && new Date(user.trialEndsAt) > now) {
    return { active: true, endsAt: user.trialEndsAt };
  }
  if (user.trialStartedAt && user.trialEndsAt) {
    return { active: false, endsAt: user.trialEndsAt };
  }
  const fields = buildPendingTrialFields(now);
  await updateUserFn(user.id, fields);
  return { active: true, endsAt: fields.trialEndsAt };
}

/** @param {import('./store.js').UserRecord} user */
export function trialFieldsForPublic(user) {
  const active = isTrialActive(user);
  return {
    trialActive: active,
    trialEndsAt: user.trialEndsAt ?? '',
    trialStartedAt: user.trialStartedAt ?? '',
  };
}
