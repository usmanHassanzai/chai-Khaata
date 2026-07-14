import { Label } from '../i18n/useLabel';
import type { AuthUser } from '../services/authApi';
import {
  formatAdminDateTime,
  planLabel,
} from '../utils/adminProfile';

type Props = {
  user: AuthUser;
};

function Field({ labelKey, children }: { labelKey: string; children: React.ReactNode }) {
  return (
    <div className="admin-user-field">
      <span className="admin-user-field-label"><Label k={labelKey} variant="compact" /></span>
      <span className="admin-user-field-value">{children}</span>
    </div>
  );
}

function displayValue(value: string | undefined, missingHint?: string) {
  if (value && value !== '—') return value;
  if (missingHint) return <span className="admin-missing-field">{missingHint}</span>;
  return '—';
}

/** Full user account card — phone, password, subscription, dates always visible */
export default function AdminUserCard({ user }: Props) {
  const isAdmin = user.role === 'admin';
  const missingHint = 'Not saved at signup';

  return (
    <div className="admin-user-card">
      <div className="admin-user-card-head">
        <div>
          <strong className="admin-user-card-name">{user.username}</strong>
          {user.shopName && <span className="admin-user-card-shop"> — {user.shopName}</span>}
        </div>
        <span className={`status-pill ${user.status === 'approved' ? 'status-approved' : user.status === 'rejected' ? 'status-rejected' : 'status-pending'}`}>
          {user.status}
        </span>
      </div>

      <div className="admin-user-card-grid">
        <Field labelKey="auth.email">{user.email || '—'}</Field>
        {!isAdmin && user.paymentRefId && (
          <Field labelKey="auth.paymentRefId"><code className="payment-ref-id">{user.paymentRefId}</code></Field>
        )}
        <Field labelKey="auth.phone">{displayValue(user.phone, !isAdmin && !user.phone ? missingHint : undefined)}</Field>
        <Field labelKey="auth.password">
          {isAdmin ? '—' : (
            user.registrationPassword
              ? <code className="signup-password">{user.registrationPassword}</code>
              : displayValue(undefined, missingHint)
          )}
        </Field>
        <Field labelKey="auth.subscription">
          {isAdmin ? '—' : displayValue(planLabel(user) !== '—' ? planLabel(user) : undefined, missingHint)}
        </Field>
        <Field labelKey="auth.subscriptionStarts">
          {isAdmin ? '—' : displayValue(user.subscriptionStartsAt ? formatAdminDateTime(user.subscriptionStartsAt) : undefined, missingHint)}
        </Field>
        <Field labelKey="auth.subscriptionExpires">
          {isAdmin ? '—' : displayValue(user.subscriptionExpiresAt ? formatAdminDateTime(user.subscriptionExpiresAt) : undefined, missingHint)}
        </Field>
        <Field labelKey="auth.registerDate">{formatAdminDateTime(user.createdAt)}</Field>
        <Field labelKey="auth.approvedDate">{formatAdminDateTime(user.approvedAt)}</Field>
      </div>
    </div>
  );
}
