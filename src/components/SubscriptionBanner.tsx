import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Label } from '../i18n/useLabel';

export default function SubscriptionBanner() {
  const { user } = useAuth();

  if (
    !user
    || user.role === 'admin'
    || !user.renewalAvailable
    || user.subscriptionExpired
    || user.daysUntilExpiry == null
    || user.daysUntilExpiry < 1
    || user.daysUntilExpiry > 7
  ) {
    return null;
  }

  return (
    <div className="trial-banner subscription-banner" role="status">
      <strong><Label k="auth.subscriptionExpiringTitle" variant="compact" /></strong>
      {' — '}
      <Label k="auth.subscriptionExpiringSubtitle" variant="compact" />
      {' '}
      <Label k="auth.daysUntilExpiry" variant="compact" vars={{ days: String(user.daysUntilExpiry) }} />
      {' '}
      <Link to="/subscription-renew" className="trial-banner-link">
        <Label k="auth.renewNow" variant="compact" />
      </Link>
    </div>
  );
}
