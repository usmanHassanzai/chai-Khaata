import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AuthField from '../components/AuthField';
import AuthLayout from '../components/AuthLayout';
import AuthPageHeader from '../components/AuthPageHeader';
import { useAuth } from '../context/AuthContext';
import ImageUpload from '../components/ImageUpload';
import { Label } from '../i18n/useLabel';
import PaymentInstructions from '../components/PaymentInstructions';
import { DEFAULT_PAYMENT_CONFIG, normalizePaymentConfig } from '../data/paymentPlans';
import { ApiError, authApi, type PaymentConfig } from '../services/authApi';

export default function PaymentDue() {
  const { user, logout, refreshUser } = useAuth();
  const [adminEmail, setAdminEmail] = useState('');
  const [loginId, setLoginId] = useState(user?.email || user?.username || '');
  const [password, setPassword] = useState('');
  const [screenshot, setScreenshot] = useState<string | undefined>();
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pendingReview, setPendingReview] = useState(false);
  const [dueAmount, setDueAmount] = useState(user?.paymentDue ?? 0);
  const [payment, setPayment] = useState<PaymentConfig>(DEFAULT_PAYMENT_CONFIG);

  useEffect(() => {
    authApi.config()
      .then((c) => {
        setAdminEmail(c.adminEmail);
        if (c.payment) setPayment(normalizePaymentConfig(c.payment));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (user?.email || user?.username) {
      setLoginId(user.email || user.username);
    }
    if (user?.paymentDue) setDueAmount(user.paymentDue);
  }, [user]);

  async function checkPayment() {
    if (!loginId.trim() || !password) {
      setError('Enter email and password to check status');
      return;
    }
    setChecking(true);
    setError('');
    try {
      const status = await authApi.checkPaymentSubmission(loginId.trim(), password);
      setDueAmount(status.paymentDue);
      setPendingReview(status.pendingSubmission);
      if (!status.paymentBlocked) {
        setSuccess('Payment cleared! You can log in now.');
        await refreshUser();
      } else if (status.pendingSubmission) {
        setSuccess('Your payment proof is waiting for admin approval.');
      } else {
        setSuccess('');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not check status');
    } finally {
      setChecking(false);
    }
  }

  async function handleSubmitProof(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!screenshot) {
      setError('Please upload payment screenshot');
      return;
    }

    setSubmitting(true);
    try {
      const res = await authApi.submitPaymentProof(loginId.trim(), password, screenshot);
      setSuccess(res.message);
      setPendingReview(true);
      setScreenshot(undefined);
      setPassword('');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ALREADY_SUBMITTED') {
        setPendingReview(true);
        setSuccess(err.message);
      } else {
        setError(err instanceof ApiError ? err.message : 'Could not submit payment proof');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout wide>
      <AuthPageHeader
        icon="⛔"
        titleKey="auth.paymentBlockedTitle"
        subtitleKey="auth.paymentBlockedSubtitle"
        badge="Payment required"
      />

      <div className="payment-due-amount">Rs {dueAmount.toLocaleString()}</div>

      <PaymentInstructions payment={payment} planPrice={dueAmount} planLabel="Amount due" compact />

      {user?.paymentDueNote && <p className="settings-note">{user.paymentDueNote}</p>}

      {pendingReview && (
        <div className="auth-banner info">
          <Label k="auth.paymentProofPending" variant="compact" />
        </div>
      )}

      {success && <div className="auth-banner success">{success}</div>}
      {error && <div className="auth-banner error">{error}</div>}

      <form className="auth-form auth-form-panel" onSubmit={handleSubmitProof}>
        <p className="auth-field-hint"><Label k="auth.paymentProofHint" variant="compact" /></p>

        <AuthField
          label={<Label k="auth.loginOrEmail" variant="compact" />}
          icon="✉️"
          type="text"
          value={loginId}
          onChange={(e) => setLoginId(e.target.value)}
          placeholder="your@email.com"
          required
        />

        <AuthField
          label={<Label k="auth.password" variant="compact" />}
          icon="🔒"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />

        <ImageUpload
          labelKey="auth.paymentScreenshot"
          value={screenshot}
          onChange={setScreenshot}
        />

        <button
          type="submit"
          className="btn primary auth-submit"
          disabled={submitting || pendingReview}
        >
          {submitting
            ? <span className="auth-spinner" style={{ width: 24, height: 24, borderWidth: 2 }} />
            : <Label k="auth.submitPaymentProof" variant="compact" />}
        </button>
      </form>

      <div className="auth-links-grid">
        <button type="button" className="auth-quick-link link-btn" onClick={checkPayment} disabled={checking}>
          {checking
            ? 'Checking…'
            : <Label k="auth.checkPayment" variant="compact" />}
        </button>
        <button type="button" className="auth-quick-link link-btn" onClick={logout}>
          <Label k="auth.logout" variant="compact" />
        </button>
        <Link to="/login" className="auth-quick-link">
          <Label k="auth.backToLogin" variant="compact" />
        </Link>
      </div>

      {adminEmail && (
        <p className="auth-admin-note">
          Admin: {adminEmail}
        </p>
      )}
    </AuthLayout>
  );
}
