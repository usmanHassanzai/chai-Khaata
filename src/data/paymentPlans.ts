import type { PaymentConfig, SubscriptionPlan } from '../services/authApi';

/** Canonical prices — keep in sync with server .env */
export const SUBSCRIPTION_PRICES = {
  monthly: 500,
  yearly: 5000,
} as const;

/** Fallback when API config not loaded yet */
export const DEFAULT_PAYMENT_CONFIG: PaymentConfig = {
  accounts: [
    { id: 'easypaisa', label: 'Easypaisa', number: '03453395781', accountName: 'Muzafar shah' },
    { id: 'ubl', label: 'UBL Bank', number: '0002346646607', accountName: 'usman muzafar shah' },
    { id: 'nayapay', label: 'Nayapay', number: '03195145327', accountName: 'usman muzafar shah' },
    { id: 'jsbank', label: 'JS Bank', number: '03453395781', accountName: 'usman usman' },
  ],
  whatsapp: '923462204903',
  whatsappDisplay: '+923462204903',
  whatsappLink: 'https://wa.me/923462204903',
  demoDaysMarketing: 7,
  pendingTrialHours: 7 * 24,
};

export const LANDING_PLANS = [
  {
    id: 'monthly' as const,
    name: 'Monthly',
    price: SUBSCRIPTION_PRICES.monthly,
    period: '/ month',
    features: ['Full app access', 'Cloud sync', 'PDF export', 'Admin support'],
  },
  {
    id: 'yearly' as const,
    name: 'Yearly',
    price: SUBSCRIPTION_PRICES.yearly,
    period: '/ year',
    badge: 'Best value',
    features: ['Everything in Monthly', 'Save Rs 1,000 vs monthly', 'Priority support', '12 months access'],
  },
];

export const DEMO_PLAN = {
  name: '7-Day Demo',
  price: 'Free',
  note: 'Marketing preview only — not activated until payment is verified by admin.',
};

/** Ensure API plans always show Rs 500 / Rs 5000 */
export function normalizeSubscriptionPlans(plans: SubscriptionPlan[]): SubscriptionPlan[] {
  const priceMap: Record<string, number> = {
    monthly: SUBSCRIPTION_PRICES.monthly,
    yearly: SUBSCRIPTION_PRICES.yearly,
  };
  return plans
    .filter((p) => p.id === 'monthly' || p.id === 'yearly')
    .map((p) => ({
      ...p,
      price: priceMap[p.id] ?? p.price,
    }));
}

export function formatPlanPrice(planId: string): string {
  if (planId === 'monthly') return `Rs ${SUBSCRIPTION_PRICES.monthly.toLocaleString()}`;
  if (planId === 'yearly') return `Rs ${SUBSCRIPTION_PRICES.yearly.toLocaleString()}`;
  return '';
}

/** Use server config when valid; otherwise fall back to local defaults */
export function normalizePaymentConfig(raw?: Partial<PaymentConfig> | null): PaymentConfig {
  if (!raw?.accounts?.length) return DEFAULT_PAYMENT_CONFIG;
  return {
    ...DEFAULT_PAYMENT_CONFIG,
    ...raw,
    accounts: raw.accounts,
  };
}
