import type { SubscriptionPlan, SubscriptionPlanId } from '../services/authApi';

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  { id: 'monthly', label: 'Monthly', months: 1, price: 500 },
  { id: 'yearly', label: 'Yearly', months: 12, price: 5000 },
];

export function getSubscriptionPlans(): SubscriptionPlan[] {
  return SUBSCRIPTION_PLANS;
}

export function getPlan(planId: string) {
  return SUBSCRIPTION_PLANS.find((p) => p.id === planId) ?? null;
}

export function isValidPlanId(planId: string) {
  return Boolean(getPlan(planId));
}

export function addMonths(date: Date | string, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function computeExpiryFrom(startDate: Date | string, planId: string) {
  const plan = getPlan(planId);
  if (!plan) return null;
  return addMonths(startDate, plan.months).toISOString();
}

export function extendSubscription(
  user: { subscriptionPlan?: string; subscriptionStartsAt?: string; subscriptionExpiresAt?: string },
  planId: string,
  fromDate: Date = new Date(),
) {
  const plan = getPlan(planId);
  if (!plan) {
    return {
      subscriptionPlan: user.subscriptionPlan,
      subscriptionStartsAt: user.subscriptionStartsAt,
      subscriptionExpiresAt: user.subscriptionExpiresAt,
    };
  }

  const now = fromDate;
  const currentExpiry = user.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt) : null;
  const base = currentExpiry && currentExpiry > now ? currentExpiry : now;

  return {
    subscriptionPlan: planId,
    subscriptionStartsAt: user.subscriptionStartsAt || now.toISOString(),
    subscriptionExpiresAt: addMonths(base, plan.months).toISOString(),
  };
}

export function isSubscriptionExpired(user: {
  role?: string;
  status?: string;
  subscriptionExpiresAt?: string;
}) {
  if (user?.role === 'admin') return false;
  if (user?.status !== 'approved') return false;
  if (!user?.subscriptionExpiresAt) return false;
  return new Date() > new Date(user.subscriptionExpiresAt);
}

export function subscriptionInfo(user: {
  subscriptionPlan?: string;
  subscriptionStartsAt?: string;
  subscriptionExpiresAt?: string;
  registrationFee?: number;
  role?: string;
  status?: string;
}) {
  const plan = getPlan(user.subscriptionPlan ?? '');
  const expired = isSubscriptionExpired(user);
  return {
    subscriptionPlan: (user.subscriptionPlan ?? '') as SubscriptionPlanId | '',
    subscriptionPlanLabel: plan?.label ?? '',
    subscriptionStartsAt: user.subscriptionStartsAt ?? '',
    subscriptionExpiresAt: user.subscriptionExpiresAt ?? '',
    subscriptionExpired: expired,
    subscriptionActive: Boolean(user.subscriptionExpiresAt) && !expired,
    subscriptionPrice: plan?.price ?? (Number(user.registrationFee) || 0),
  };
}
