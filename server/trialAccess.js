const TRIAL_MS = 24 * 60 * 60 * 1000;

/** @param {{ status?: string, trialEndsAt?: string }} user */
export function isTrialActive(user) {
  if (user?.status !== 'pending') return false;
  if (!user.trialEndsAt) return false;
  return new Date() < new Date(user.trialEndsAt);
}

/**
 * Start a 1-day preview for pending users on first login.
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
  const trialStartedAt = now.toISOString();
  const trialEndsAt = new Date(now.getTime() + TRIAL_MS).toISOString();
  await updateUserFn(user.id, { trialStartedAt, trialEndsAt });
  return { active: true, endsAt: trialEndsAt };
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
