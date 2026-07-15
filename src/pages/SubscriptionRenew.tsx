import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import { useAuth } from '../context/AuthContext';
import ImageUpload from '../components/ImageUpload';
import { Label } from '../i18n/useLabel';
import { DEFAULT_PAYMENT_CONFIG, normalizePaymentConfig, normalizeSubscriptionPlans } from '../data/paymentPlans';
import PaymentInstructions from '../components/PaymentInstructions';
import { ApiError, authApi, type PaymentConfig, type SubscriptionPlan, type SubscriptionPlanId } from '../services/authApi';

export default function SubscriptionRenew() {
  const { user, logout, refreshUser, login } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [payment, setPayment] = useState<PaymentConfig>(DEFAULT_PAYMENT_CONFIG);
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
  const [renewalAvailable, setRenewalAvailable] = useState(user?.renewalAvailable ?? false);
  const [daysUntilExpiry, setDaysUntilExpiry] = useState<number | null>(user?.daysUntilExpiry ?? null);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminNotified, setAdminNotified] = useState(false);
  const [whatsappLink, setWhatsappLink] = useState(DEFAULT_PAYMENT_CONFIG.whatsappLink);
  const [paymentRefId, setPaymentRefId] = useState(user?.paymentRefId ?? '');

  const isEarlyRenewal = Boolean(
    (user?.renewalAvailable && !user?.subscriptionExpired)
    || (renewalAvailable && expiresAt && new Date(expiresAt) > new Date()),
  );

  useEffect(() => {
    async function loadPlans() {
      try {
        const { plans: list } = await authApi.subscriptionPlans();
        if (list?.length) {
          const normalized = normalizeSubscriptionPlans(list);
          setPlans(normalized);
          if (normalized.length) setSubscriptionPlan(normalized[0].id);
          return;
        }
      } catch {
        /* fall through to config */
      }

      try {
        const c = await authApi.config();
        if (c.payment) setPayment(normalizePaymentConfig(c.payment));
        if (c.subscriptionPlans?.length) {
          const normalized = normalizeSubscriptionPlans(c.subscriptionPlans);
          setPlans(normalized);
          if (normalized.length) setSubscriptionPlan(normalized[0].id);
        }
      } catch {
        /* ignore */
      }
    }

    authApi.config()
      .then((c) => {
        setAdminEmail(c.adminEmail);
        if (c.payment) {
          const normalized = normalizePaymentConfig(c.payment);
          setPayment(normalized);
          setWhatsappLink(normalized.whatsappLink);
        }
      })
      .catch(() => {});

    loadPlans();
  }, []);

  useEffect(() => {
    if (user?.email || user?.username) {
      setLoginId(user.email || user.username);
    }
    if (user?.subscriptionExpiresAt) setExpiresAt(user.subscriptionExpiresAt);
    if (user?.subscriptionPlan) setSubscriptionPlan(user.subscriptionPlan as SubscriptionPlanId);
    if (user?.renewalAvailable != null) setRenewalAvailable(user.renewalAvailable);
    if (user?.daysUntilExpiry != null) setDaysUntilExpiry(user.daysUntilExpiry);
    if (user?.paymentRefId) setPaymentRefId(user.paymentRefId);
  }, [user]);

  const selectedPlan = plans.find((p) => p.id === subscriptionPlan);

  function whatsappRenewalUrl() {
    const planLabel = selectedPlan?.label || subscriptionPlan;
    const amount = selectedPlan?.price?.toLocaleString() || '';
    const text = [
      'Patiwala subscription renewal',
      paymentRefId ? `Payment ID: ${paymentRefId}` : '',
      `Plan: ${planLabel}${amount ? ` — Rs ${amount}` : ''}`,
      loginId ? `Email: ${loginId}` : '',
      'Payment screenshot attached.',
    ].filter(Boolean).join('\n');
    const base = whatsappLink || payment.whatsappLink;
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}text=${encodeURIComponent(text)}`;
  }

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
      setRenewalAvailable(Boolean(status.renewalAvailable));
      setDaysUntilExpiry(status.daysUntilExpiry ?? null);

      if (!status.accessBlocked && !status.renewalAvailable) {
        setSuccess('Subscription active! You can log in now.');
        await refreshUser();
        navigate('/dashboard', { replace: true });
      } else if (status.pendingSubmission && status.renewalGraceActive) {
        setSuccess('Renewal pending — you have free access while admin reviews.');
        try {
          await login(loginId.trim(), password);
          navigate('/dashboard', { replace: true });
        } catch {
          await refreshUser();
        }
      } else if (status.pendingSubmission) {
        setSuccess('Your renewal payment is waiting for admin approval.');
      } else if (status.renewalAvailable && !status.subscriptionExpired) {
        setSuccess('');
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
      setAdminNotified(Boolean(res.adminNotified));
      if (res.paymentRefId) setPaymentRefId(res.paymentRefId);
      if (res.whatsappLink) setWhatsappLink(res.whatsappLink);
      setScreenshot(undefined);

      try {
        await login(loginId.trim(), password);
        navigate('/dashboard', { replace: true });
      } catch {
        await refreshUser();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not submit renewal');
    } finally {
      setSubmitting(false);
    }
  }

  const displayDaysLeft = daysUntilExpiry ?? user?.daysUntilExpiry ?? null;

  return (
    <AuthLayout wide>
        <div className="auth-brand">
          <div className="auth-logo">{isEarlyRenewal ? '⏰' : '⏳'}</div>
          <h1>
            <Label
              k={isEarlyRenewal ? 'auth.subscriptionExpiringTitle' : 'auth.subscriptionExpiredTitle'}
              variant="stacked"
            />
          </h1>
          <p className="auth-tagline">
            <Label
              k={isEarlyRenewal ? 'auth.subscriptionExpiringSubtitle' : 'auth.subscriptionExpiredSubtitle'}
              variant="compact"
            />
          </p>
        </div>

        {isEarlyRenewal && displayDaysLeft != null && displayDaysLeft >= 1 && (
          <p className="auth-approval-hint">
            <Label k="auth.daysUntilExpiry" variant="compact" vars={{ days: String(displayDaysLeft) }} />
          </p>
        )}

        {expiresAt && !isEarlyRenewal && (
          <p className="auth-approval-hint">
            <Label k="auth.subscriptionEnded" variant="compact" />:{' '}
            <strong>{new Date(expiresAt).toLocaleDateString()}</strong>
          </p>
        )}

        {expiresAt && isEarlyRenewal && (
          <p className="auth-approval-hint">
            <Label k="auth.subscriptionExpires" variant="compact" />:{' '}
            <strong>{new Date(expiresAt).toLocaleDateString()}</strong>
          </p>
        )}

        {success && <div className="auth-banner success">{success}</div>}
        {error && <div className="auth-banner error">{error}</div>}
        {pendingReview && !success && (
          <div className="auth-banner info"><Label k="auth.renewalPending" variant="compact" /></div>
        )}

        {(pendingReview || success) && (
          <div className="register-upload-block">
            {adminNotified && (
              <div className="auth-banner success">
                <Label k="auth.renewalAdminNotified" variant="compact" />
                {adminEmail && <> — <strong>{adminEmail}</strong></>}
              </div>
            )}
            <p className="settings-note">
              <Label k="auth.renewalWhatsappHint" variant="compact" />
              {paymentRefId && <> Payment ID: <code>{paymentRefId}</code></>}
            </p>
            <a
              href={whatsappRenewalUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="btn primary payment-wa-btn"
            >
              📱 <Label k="auth.renewalSendWhatsapp" variant="compact" /> — {payment.whatsappDisplay}
            </a>
          </div>
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
            <PaymentInstructions
              payment={payment}
              paymentRefId={paymentRefId || user?.paymentRefId}
              planPrice={selectedPlan.price}
              planLabel={selectedPlan.label}
              showDemoNote={false}
              compact
            />
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
            <p className="settings-note"><Label k="auth.renewalWhatsappHint" variant="compact" /></p>
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
    </AuthLayout>
  );
}
