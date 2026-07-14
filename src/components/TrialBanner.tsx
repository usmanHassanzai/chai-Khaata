import { useAuth } from '../context/AuthContext';

export default function TrialBanner() {
  const { user } = useAuth();

  if (!user || user.role === 'admin' || user.status !== 'pending' || !user.trialActive) {
    return null;
  }

  const ends = user.trialEndsAt
    ? new Date(user.trialEndsAt).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })
    : '';

  return (
    <div className="trial-banner" role="status">
      <strong>Preview mode</strong> — Your account is pending admin approval.
      {user.paymentRefId && (
        <> Payment ID: <code>{user.paymentRefId}</code> — send screenshot on WhatsApp if not sent yet.</>
      )}
      {ends && <> Preview until {ends}.</>}
    </div>
  );
}
