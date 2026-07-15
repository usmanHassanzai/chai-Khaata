import { isSubscriptionExpired } from './subscriptions.js';

/** 24-hour app access while admin reviews a submitted renewal. */
export const RENEWAL_GRACE_MS = (Number(process.env.RENEWAL_GRACE_HOURS) || 24) * 60 * 60 * 1000;

/** @param {Date} [start] */
export function buildRenewalGraceFields(start = new Date()) {
  return { renewalGraceEndsAt: new Date(start.getTime() + RENEWAL_GRACE_MS).toISOString() };
}

export function clearRenewalGraceFields() {
  return { renewalGraceEndsAt: '' };
}

/** @param {{ role?: string, renewalGraceEndsAt?: string }} user */
export function isRenewalGraceActive(user) {
  if (user?.role === 'admin') return false;
  if (!user?.renewalGraceEndsAt) return false;
  return new Date() < new Date(user.renewalGraceEndsAt);
}

/** @param {import('./store.js').UserRecord} user */
export function renewalGraceFieldsForPublic(user) {
  const active = isRenewalGraceActive(user);
  return {
    renewalGraceActive: active,
    renewalGraceEndsAt: user.renewalGraceEndsAt ?? '',
  };
}

/** Subscription expired and no active renewal grace window. */
export function isSubscriptionAccessBlocked(user) {
  if (user?.role === 'admin') return false;
  if (!isSubscriptionExpired(user)) return false;
  return !isRenewalGraceActive(user);
}

export function renewalGraceHours() {
  return Math.round(RENEWAL_GRACE_MS / (60 * 60 * 1000));
}
