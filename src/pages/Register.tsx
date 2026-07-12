import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import { useAuth } from '../context/AuthContext';
import { Label } from '../i18n/useLabel';
import { ApiError, authApi, type SubscriptionPlan, type SubscriptionPlanId } from '../services/authApi';

export default function Register() {
  const { user, register } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [shopName, setShopName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlanId>('monthly');
  const [paymentFeeDate, setPaymentFeeDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');

  useEffect(() => {
    authApi.config()
      .then((c) => {
        setAdminEmail(c.adminEmail);
        if (c.subscriptionPlans?.length) setPlans(c.subscriptionPlans);
      })
      .catch(() => {});
    authApi.subscriptionPlans()
      .then(({ plans: list }) => setPlans(list))
      .catch(() => {});
  }, []);

  const selectedPlan = plans.find((p) => p.id === subscriptionPlan);

  if (user?.status === 'approved' || user?.role === 'admin') {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    if (!paymentFeeDate.trim()) {
      setError('Payment date is required');
      return;
    }

    setSubmitting(true);
    try {
      const message = await register(
        username.trim(),
        email.trim(),
        phone.trim(),
        password,
        subscriptionPlan,
        paymentFeeDate.trim(),
        shopName.trim(),
      );
      setSuccess(message);
      setUsername('');
      setEmail('');
      setPhone('');
      setShopName('');
      setPassword('');
      setConfirm('');
      setPaymentFeeDate(new Date().toISOString().slice(0, 10));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Could not connect to server. Make sure the auth server is running.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout wide>
        <div className="auth-brand">
          <div className="auth-logo">🍵</div>
          <h1><Label k="auth.registerTitle" variant="stacked" /></h1>
          <p className="auth-tagline"><Label k="auth.registerSubtitle" variant="compact" /></p>
        </div>

        {adminEmail && (
          <p className="auth-approval-hint">
            <Label k="auth.signUpApprovalHint" variant="compact" /> <strong>{adminEmail}</strong>
          </p>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          {success && <div className="auth-banner success">{success}</div>}
          {error && <div className="auth-banner error">{error}</div>}

          <fieldset className="subscription-fieldset">
            <legend><Label k="auth.chooseSubscription" variant="compact" /></legend>
            <div className="subscription-plans">
              {plans.map((plan) => (
                <label
                  key={plan.id}
                  className={`subscription-plan-card${subscriptionPlan === plan.id ? ' selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="subscriptionPlan"
                    value={plan.id}
                    checked={subscriptionPlan === plan.id}
                    onChange={() => setSubscriptionPlan(plan.id)}
                  />
                  <span className="plan-label">{plan.label}</span>
                  <span className="plan-price">Rs {plan.price.toLocaleString()}</span>
                  <span className="plan-duration">
                    {plan.months === 1 ? '1 month' : `${plan.months} months`}
                  </span>
                </label>
              ))}
            </div>
            {selectedPlan && (
              <p className="subscription-selected-note">
                <Label k="auth.selectedPlanFee" variant="compact" />:{' '}
                <strong>Rs {selectedPlan.price.toLocaleString()}</strong>
              </p>
            )}
          </fieldset>

          <label className="auth-field">
            <span><Label k="auth.username" variant="compact" /></span>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="shopkeeper"
              required
              minLength={3}
            />
          </label>

          <label className="auth-field">
            <span><Label k="auth.email" variant="compact" /></span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>

          <label className="auth-field">
            <span><Label k="auth.phone" variant="compact" /></span>
            <input
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="03001234567"
              required
              minLength={10}
            />
          </label>

          <label className="auth-field">
            <span><Label k="auth.shopName" variant="compact" /></span>
            <input
              type="text"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              placeholder="My Tea Shop"
            />
          </label>

          <label className="auth-field">
            <span><Label k="auth.paymentFeeDate" variant="compact" /></span>
            <input
              type="date"
              value={paymentFeeDate}
              onChange={(e) => setPaymentFeeDate(e.target.value)}
              required
            />
          </label>

          <label className="auth-field">
            <span><Label k="auth.password" variant="compact" /></span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </label>

          <label className="auth-field">
            <span><Label k="auth.confirmPassword" variant="compact" /></span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
            />
          </label>

          <button type="submit" className="btn primary auth-submit" disabled={submitting || plans.length === 0}>
            {submitting ? '…' : <Label k="auth.register" variant="compact" />}
          </button>
        </form>

        <p className="auth-switch">
          <Label k="auth.haveAccount" variant="compact" />{' '}
          <Link to="/login"><Label k="auth.loginLink" variant="compact" /></Link>
        </p>
    </AuthLayout>
  );
}
