import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Label } from '../i18n/useLabel';

export default function RenewalGraceBanner() {
  const { user } = useAuth();

  if (!user || user.role === 'admin' || !user.renewalGraceActive) {
    return null;
  }

  const ends = user.renewalGraceEndsAt
    ? new Date(user.renewalGraceEndsAt).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })
    : '';

  return (
    <div className="trial-banner renewal-grace-banner" role="status">
      <strong><Label k="auth.renewalGraceTitle" variant="compact" /></strong>
      {' — '}
      <Label k="auth.renewalGraceSubtitle" variant="compact" />
      {ends && <> Free access until {ends}.</>}
      {' '}
      <Link to="/subscription-renew" className="trial-banner-link">
        <Label k="auth.checkRenewalStatus" variant="compact" />
      </Link>
    </div>
  );
}
