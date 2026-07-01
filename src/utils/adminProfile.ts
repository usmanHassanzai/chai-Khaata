import type { AuthUser } from '../services/authApi';

export function formatAdminDateTime(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatAdminDay(date?: string) {
  if (!date) return '—';
  const d = date.includes('T') ? new Date(date) : new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function planLabel(user: AuthUser) {
  if (user.subscriptionPlanLabel) return user.subscriptionPlanLabel;
  if (user.subscriptionPlan === 'monthly') return 'Monthly';
  if (user.subscriptionPlan === 'six_month') return '6 Months';
  if (user.subscriptionPlan === 'yearly') return 'Yearly';
  return '—';
}

export function subscriptionStatusLabel(user: AuthUser) {
  if (user.role === 'admin') return '—';
  if (user.status === 'pending') return 'Pending approval';
  if (user.status === 'rejected') return 'Rejected';
  if (!user.subscriptionExpiresAt) return user.status === 'approved' ? 'No subscription set' : '—';
  if (user.subscriptionExpired) return 'Expired';
  if (user.subscriptionActive) return 'Active';
  return '—';
}

export type AdminProfileRow = {
  key: string;
  labelKey: string;
  value: string;
};

/** All account fields for admin — excludes money amounts and shop ledger/inventory. */
export function adminProfileRows(user: AuthUser): AdminProfileRow[] {
  return [
    { key: 'username', labelKey: 'auth.username', value: user.username },
    { key: 'email', labelKey: 'auth.email', value: user.email || '—' },
    { key: 'phone', labelKey: 'auth.phone', value: user.phone || '—' },
    {
      key: 'password',
      labelKey: 'auth.password',
      value: user.role === 'admin' ? '—' : (user.registrationPassword || '—'),
    },
    {
      key: 'subscription',
      labelKey: 'auth.subscription',
      value: user.role === 'admin' ? '—' : planLabel(user),
    },
    {
      key: 'subscriptionStarts',
      labelKey: 'auth.subscriptionStarts',
      value: user.role === 'admin' ? '—' : formatAdminDateTime(user.subscriptionStartsAt),
    },
    {
      key: 'subscriptionExpires',
      labelKey: 'auth.subscriptionExpires',
      value: user.role === 'admin' ? '—' : formatAdminDateTime(user.subscriptionExpiresAt),
    },
    { key: 'shopName', labelKey: 'auth.shopName', value: user.shopName || '—' },
    { key: 'role', labelKey: 'auth.role', value: user.role },
    { key: 'status', labelKey: 'common.status', value: user.status },
    {
      key: 'subscriptionStatus',
      labelKey: 'auth.subscriptionStatus',
      value: subscriptionStatusLabel(user),
    },
    { key: 'registerDate', labelKey: 'auth.registerDate', value: formatAdminDateTime(user.createdAt) },
    { key: 'approvedDate', labelKey: 'auth.approvedDate', value: formatAdminDateTime(user.approvedAt) },
    {
      key: 'paymentFeeDate',
      labelKey: 'auth.paymentFeeDate',
      value: user.role === 'admin' ? '—' : formatAdminDay(user.paymentFeeDate),
    },
    { key: 'lastPaid', labelKey: 'auth.lastPaid', value: formatAdminDateTime(user.lastPaidAt) },
    { key: 'userId', labelKey: 'auth.userId', value: user.id },
  ];
}

export const ADMIN_USER_TABLE_COLUMNS = [
  'auth.username',
  'auth.email',
  'auth.phone',
  'auth.password',
  'auth.subscription',
  'auth.subscriptionStarts',
  'auth.subscriptionExpires',
  'common.status',
] as const;
