import { REMINDER_DAYS_BEFORE, daysUntilExpiry } from './subscriptionReminders.js';

/** @typedef {'monthly' | 'yearly'} SubscriptionPlanId */

export const PLAN_IDS = ['monthly', 'yearly'];

/** @returns {{ id: SubscriptionPlanId, label: string, months: number, price: number }[]} */
export function getSubscriptionPlans() {
  return [
    {
      id: 'monthly',
      label: 'Monthly',
      months: 1,
      price: Number(process.env.SUBSCRIPTION_MONTHLY_PRICE) || 500,
    },
    {
      id: 'yearly',
      label: 'Yearly',
      months: 12,
      price: Number(process.env.SUBSCRIPTION_YEARLY_PRICE) || 5000,
    },
  ];
}

/** Legacy plan support for existing records */
const LEGACY_PLANS = {
  six_month: { id: 'six_month', label: '6 Months (legacy)', months: 6, price: 5000 },
};

/** @param {string} planId */
export function getPlan(planId) {
  return getSubscriptionPlans().find((p) => p.id === planId)
    ?? LEGACY_PLANS[planId]
    ?? null;
}

/** @param {string} planId */
export function isValidPlanId(planId) {
  return Boolean(getPlan(planId));
}

/** @param {Date | string} date @param {number} months */
export function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/** @param {Date | string} startDate @param {string} planId */
export function computeExpiryFrom(startDate, planId) {
  const plan = getPlan(planId);
  if (!plan) return null;
  return addMonths(startDate, plan.months).toISOString();
}

/** @param {import('./store.js').UserRecord} user @param {string} planId @param {Date} [fromDate] */
export function extendSubscription(user, planId, fromDate = new Date()) {
  const plan = getPlan(planId);
  if (!plan) {
    return {
      subscriptionPlan: user.subscriptionPlan,
      subscriptionStartsAt: user.subscriptionStartsAt,
      subscriptionExpiresAt: user.subscriptionExpiresAt,
    };
  }

  const now = fromDate instanceof Date ? fromDate : new Date(fromDate);
  const currentExpiry = user.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt) : null;
  const base = currentExpiry && currentExpiry > now ? currentExpiry : now;

  return {
    subscriptionPlan: planId,
    subscriptionStartsAt: user.subscriptionStartsAt || now.toISOString(),
    subscriptionExpiresAt: addMonths(base, plan.months).toISOString(),
  };
}

/** @param {{ role?: string, status?: string, subscriptionExpiresAt?: string }} user */
export function isSubscriptionExpired(user) {
  if (user?.role === 'admin') return false;
  if (user?.status !== 'approved') return false;
  if (!user?.subscriptionExpiresAt) return false;
  return new Date() > new Date(user.subscriptionExpiresAt);
}

/** @param {import('./store.js').UserRecord} user */
export function subscriptionRenewalFields(user) {
  if (user?.role === 'admin' || user?.status !== 'approved') {
    return { renewalAvailable: false, daysUntilExpiry: null };
  }

  const daysLeft = user?.subscriptionExpiresAt
    ? daysUntilExpiry(user.subscriptionExpiresAt)
    : null;

  if (isSubscriptionExpired(user)) {
    return { renewalAvailable: true, daysUntilExpiry: daysLeft };
  }

  if (!user?.subscriptionExpiresAt || daysLeft === null) {
    return { renewalAvailable: false, daysUntilExpiry: null };
  }

  const renewalAvailable = daysLeft >= 1 && daysLeft <= REMINDER_DAYS_BEFORE;
  return { renewalAvailable, daysUntilExpiry: daysLeft };
}

/** @param {{ subscriptionPlan?: string, subscriptionStartsAt?: string, subscriptionExpiresAt?: string, registrationFee?: number, role?: string }} user */
export function subscriptionInfo(user) {
  const plan = getPlan(user.subscriptionPlan ?? '');
  const expired = isSubscriptionExpired(user);
  return {
    subscriptionPlan: user.subscriptionPlan ?? '',
    subscriptionPlanLabel: plan?.label ?? '',
    subscriptionStartsAt: user.subscriptionStartsAt ?? '',
    subscriptionExpiresAt: user.subscriptionExpiresAt ?? '',
    subscriptionExpired: expired,
    subscriptionActive: Boolean(user.subscriptionExpiresAt) && !expired,
    subscriptionPrice: plan?.price ?? (Number(user.registrationFee) || 0),
  };
}
