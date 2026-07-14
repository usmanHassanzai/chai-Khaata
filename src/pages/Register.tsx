import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
import PaymentInstructions from '../components/PaymentInstructions';
import ImageUpload from '../components/ImageUpload';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_PAYMENT_CONFIG, normalizePaymentConfig, normalizeSubscriptionPlans } from '../data/paymentPlans';
import { Label } from '../i18n/useLabel';
import { ApiError, authApi, type PaymentConfig, type SubscriptionPlan, type SubscriptionPlanId } from '../services/authApi';

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [shopName, setShopName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlanId>('monthly');
  const [paymentFeeDate, setPaymentFeeDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [payment, setPayment] = useState<PaymentConfig>(DEFAULT_PAYMENT_CONFIG);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');

  const [registered, setRegistered] = useState(false);
  const [paymentRefId, setPaymentRefId] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [adminNotified, setAdminNotified] = useState(false);
  const [adminNotificationsConfigured, setAdminNotificationsConfigured] = useState(false);
  const [savedLogin, setSavedLogin] = useState('');
  const [savedPassword, setSavedPassword] = useState('');
  const [screenshot, setScreenshot] = useState<string | undefined>();
  const [uploadMsg, setUploadMsg] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    authApi.config()
      .then((c) => {
        setAdminEmail(c.adminEmail);
        setAdminNotificationsConfigured(c.otpDelivery?.adminNotificationsConfigured ?? c.otpDelivery?.emailConfigured ?? false);
        if (c.subscriptionPlans?.length) setPlans(normalizeSubscriptionPlans(c.subscriptionPlans));
        if (c.payment) setPayment(normalizePaymentConfig(c.payment));
      })
      .catch(() => {});
    authApi.subscriptionPlans()
      .then(({ plans: list }) => setPlans(normalizeSubscriptionPlans(list)))
      .catch(() => {});
  }, []);

  const selectedPlan = plans.find((p) => p.id === subscriptionPlan);

  if (user?.status === 'approved' || user?.role === 'admin' || (user?.status === 'pending' && user.trialActive)) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

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
      const loginVal = email.trim() || username.trim();
      const result = await register(
        username.trim(),
        email.trim(),
        phone.trim(),
        password,
        subscriptionPlan,
        paymentFeeDate.trim(),
        shopName.trim(),
      );
      setSavedLogin(loginVal);
      setSavedPassword(password);
      setPaymentRefId(result.paymentRefId);
      setSuccessMessage(result.message);
      setAdminNotified(Boolean(result.adminNotified));
      setRegistered(true);
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

  async function submitScreenshot() {
    if (!screenshot) {
      setUploadMsg('Please upload payment screenshot');
      return;
    }
    setUploading(true);
    setUploadMsg('');
    try {
      const res = await authApi.submitSignupPayment(savedLogin, savedPassword, screenshot);
      setUploadMsg(res.message);
    } catch (err) {
      setUploadMsg(err instanceof ApiError ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  if (registered) {
    return (
      <AuthLayout wide>
        <div className="auth-brand">
          <div className="auth-logo">✅</div>
          <h1>Account created</h1>
          <p className="auth-tagline">{successMessage}</p>
        </div>

        {adminNotified ? (
          <div className="auth-banner success">
            Admin notification sent to <strong>{adminEmail}</strong>. You will be approved after payment verification.
          </div>
        ) : adminNotificationsConfigured ? (
          <div className="auth-banner info">
            Registration saved. If admin email was not received, contact <strong>{adminEmail}</strong> with your Payment ID.
          </div>
        ) : (
          <div className="auth-banner info">
            Registration saved. Admin email alerts are not configured on the server yet — contact <strong>{adminEmail}</strong> with Payment ID <code>{paymentRefId}</code>.
          </div>
        )}

        <PaymentInstructions
          payment={payment}
          paymentRefId={paymentRefId}
          planPrice={selectedPlan?.price}
          planLabel={selectedPlan?.label}
        />

        <div className="register-upload-block">
          <h3>Upload payment screenshot</h3>
          <p className="settings-note">Or send on WhatsApp with Payment ID <code>{paymentRefId}</code></p>
          <ImageUpload labelKey="auth.paymentScreenshot" value={screenshot} onChange={setScreenshot} />
          {uploadMsg && <div className={`auth-banner ${uploadMsg.includes('received') ? 'success' : 'info'}`}>{uploadMsg}</div>}
          <button type="button" className="btn primary" disabled={uploading || !screenshot} onClick={submitScreenshot}>
            {uploading ? '…' : 'Submit screenshot'}
          </button>
          <button type="button" className="btn" onClick={() => navigate('/login')}>
            Log in for 1-day preview
          </button>
        </div>
      </AuthLayout>
    );
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
          {adminNotificationsConfigured ? (
            <>Admin receives an email at <strong>{adminEmail}</strong> when someone registers.</>
          ) : (
            <>Admin email for approval: <strong>{adminEmail}</strong></>
          )}
        </p>
      )}

      <form className="auth-form" onSubmit={handleSubmit}>
        {error && <div className="auth-banner error">{error}</div>}

        <fieldset className="subscription-fieldset">
          <legend><Label k="auth.chooseSubscription" variant="compact" /></legend>
          <div className="subscription-plans subscription-plans-two">
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
                  onChange={() => setSubscriptionPlan(plan.id as SubscriptionPlanId)}
                />
                <span className="plan-label">{plan.label}</span>
                <span className="plan-price">Rs {plan.price.toLocaleString()}</span>
                <span className="plan-duration">
                  {plan.months === 1 ? '1 month' : `${plan.months} months`}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {selectedPlan && (
          <PaymentInstructions
            payment={payment}
            planPrice={selectedPlan.price}
            planLabel={selectedPlan.label}
            compact
          />
        )}

        <label className="auth-field">
          <span><Label k="auth.username" variant="compact" /></span>
          <input type="text" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} />
        </label>

        <label className="auth-field">
          <span><Label k="auth.email" variant="compact" /></span>
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>

        <label className="auth-field">
          <span><Label k="auth.phone" variant="compact" /></span>
          <input type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required minLength={10} />
        </label>

        <label className="auth-field">
          <span><Label k="auth.shopName" variant="compact" /></span>
          <input type="text" value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="My Tea Shop" />
        </label>

        <label className="auth-field">
          <span><Label k="auth.paymentFeeDate" variant="compact" /></span>
          <input type="date" value={paymentFeeDate} onChange={(e) => setPaymentFeeDate(e.target.value)} required />
        </label>

        <label className="auth-field">
          <span><Label k="auth.password" variant="compact" /></span>
          <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        </label>

        <label className="auth-field">
          <span><Label k="auth.confirmPassword" variant="compact" /></span>
          <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} />
        </label>

        <button type="submit" className="btn primary auth-submit" disabled={submitting || plans.length === 0}>
          {submitting ? '…' : <Label k="auth.register" variant="compact" />}
        </button>
      </form>

      <p className="auth-switch">
        <Label k="auth.haveAccount" variant="compact" />{' '}
        <Link to="/login"><Label k="auth.loginLink" variant="compact" /></Link>
        {' · '}
        <Link to="/">← Home</Link>
      </p>
    </AuthLayout>
  );
}
