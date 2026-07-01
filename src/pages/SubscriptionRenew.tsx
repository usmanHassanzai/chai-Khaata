import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ImageUpload from '../components/ImageUpload';
import { Label } from '../i18n/useLabel';
import { ApiError, authApi, type SubscriptionPlan, type SubscriptionPlanId } from '../services/authApi';

export default function SubscriptionRenew() {
  const { user, logout, refreshUser } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlanId>('monthly');
  const [loginId, setLoginId] = useState(user?.email || user?.username || '');
  const [password, setPassword] = useState('');
  const [screenshot, setScreenshot] = useState<string | undefined>();
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pendingReview, setPendingReview] = useState(false);
  const [expiresAt, setExpiresAt] = useState(user?.subscriptionExpiresAt ?? '');

  useEffect(() => {
    authApi.subscriptionPlans().then(({ plans: list }) => {
      setPlans(list);
      if (list.length) setSubscriptionPlan(list[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (user?.email || user?.username) {
      setLoginId(user.email || user.username);
    }
    if (user?.subscriptionExpiresAt) setExpiresAt(user.subscriptionExpiresAt);
    if (user?.subscriptionPlan) setSubscriptionPlan(user.subscriptionPlan as SubscriptionPlanId);
  }, [user]);

  const selectedPlan = plans.find((p) => p.id === subscriptionPlan);

  async function checkStatus() {
    if (!loginId.trim() || !password) {
      setError('Enter email and password to check status');
      return;
    }
    setChecking(true);
    setError('');
    try {
      const status = await authApi.checkPaymentSubmission(loginId.trim(), password);
      setExpiresAt(status.subscriptionExpiresAt ?? '');
      setPendingReview(status.pendingSubmission);
      if (!status.accessBlocked) {
        setSuccess('Subscription active! You can log in now.');
        await refreshUser();
      } else if (status.pendingSubmission) {
        setSuccess('Your renewal payment is waiting for admin approval.');
      } else {
        setSuccess('');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not check status');
    } finally {
      setChecking(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!screenshot) {
      setError('Upload payment screenshot');
      return;
    }

    setSubmitting(true);
    try {
      const res = await authApi.submitPaymentProof(loginId.trim(), password, screenshot, subscriptionPlan);
      setSuccess(res.message);
      setPendingReview(true);
      setScreenshot(undefined);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not submit renewal');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-bg-pattern" aria-hidden />

      <div className="auth-card auth-card-wide">
        <div className="auth-brand">
          <div className="auth-logo">⏳</div>
          <h1><Label k="auth.subscriptionExpiredTitle" variant="stacked" /></h1>
          <p className="auth-tagline"><Label k="auth.subscriptionExpiredSubtitle" variant="compact" /></p>
        </div>

        {expiresAt && (
          <p className="auth-approval-hint">
            <Label k="auth.subscriptionEnded" variant="compact" />:{' '}
            <strong>{new Date(expiresAt).toLocaleDateString()}</strong>
          </p>
        )}

        {success && <div className="auth-banner success">{success}</div>}
        {error && <div className="auth-banner error">{error}</div>}
        {pendingReview && !success && (
          <div className="auth-banner info"><Label k="auth.renewalPending" variant="compact" /></div>
        )}

        <fieldset className="subscription-fieldset">
          <legend><Label k="auth.renewSubscription" variant="compact" /></legend>
          <div className="subscription-plans">
            {plans.map((plan) => (
              <label
                key={plan.id}
                className={`subscription-plan-card${subscriptionPlan === plan.id ? ' selected' : ''}`}
              >
                <input
                  type="radio"
                  name="renewPlan"
                  value={plan.id}
                  checked={subscriptionPlan === plan.id}
                  onChange={() => setSubscriptionPlan(plan.id)}
                />
                <span className="plan-label">{plan.label}</span>
                <span className="plan-price">Rs {plan.price.toLocaleString()}</span>
              </label>
            ))}
          </div>
          {selectedPlan && (
            <p className="subscription-selected-note">
              <Label k="auth.renewalAmount" variant="compact" />:{' '}
              <strong>Rs {selectedPlan.price.toLocaleString()}</strong>
            </p>
          )}
        </fieldset>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span><Label k="auth.loginOrEmail" variant="compact" /></span>
            <input
              type="text"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              required
            />
          </label>

          <label className="auth-field">
            <span><Label k="auth.password" variant="compact" /></span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          <div className="auth-field">
            <span><Label k="auth.uploadPaymentScreenshot" variant="compact" /></span>
          <ImageUpload labelKey="auth.paymentScreenshot" value={screenshot} onChange={setScreenshot} />
          </div>

          <button type="submit" className="btn primary auth-submit" disabled={submitting || pendingReview}>
            {submitting ? '…' : <Label k="auth.submitRenewal" variant="compact" />}
          </button>
        </form>

        <button type="button" className="btn sm auth-submit" disabled={checking} onClick={checkStatus}>
          {checking ? '…' : <Label k="auth.checkRenewalStatus" variant="compact" />}
        </button>

        <p className="auth-switch">
          <Link to="/login"><Label k="auth.backToLogin" variant="compact" /></Link>
        </p>
        {user && (
          <p className="auth-switch">
            <button type="button" className="link-btn" onClick={logout}>
              <Label k="auth.logout" variant="compact" />
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
