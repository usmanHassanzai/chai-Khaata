import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ImageUpload from '../components/ImageUpload';
import { Label } from '../i18n/useLabel';
import { ApiError, authApi } from '../services/authApi';

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

  useEffect(() => {
    authApi.config().then((c) => setAdminEmail(c.adminEmail)).catch(() => {});
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
    <div className="auth-page">
      <div className="auth-bg-pattern" aria-hidden />
      <div className="auth-card payment-due-card payment-due-card-wide">
        <div className="auth-brand">
          <div className="auth-logo">⛔</div>
          <h1><Label k="auth.paymentBlockedTitle" variant="stacked" /></h1>
          <p className="auth-tagline"><Label k="auth.paymentBlockedSubtitle" variant="compact" /></p>
        </div>

        <div className="payment-due-amount">Rs {dueAmount.toLocaleString()}</div>

        {user?.paymentDueNote && <p className="settings-note">{user.paymentDueNote}</p>}

        {pendingReview && (
          <div className="auth-banner info">
            <Label k="auth.paymentProofPending" variant="compact" />
          </div>
        )}

        {success && <div className="auth-banner success">{success}</div>}
        {error && <div className="auth-banner error">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmitProof}>
          <p className="settings-hint"><Label k="auth.paymentProofHint" variant="compact" /></p>

          <label className="auth-field">
            <span><Label k="auth.loginOrEmail" variant="compact" /></span>
            <input
              type="text"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="your@email.com"
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
              minLength={6}
            />
          </label>

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
            {submitting ? '…' : <Label k="auth.submitPaymentProof" variant="compact" />}
          </button>
        </form>

        <div className="auth-form">
          <button type="button" className="btn auth-submit" onClick={checkPayment} disabled={checking}>
            {checking ? '…' : <Label k="auth.checkPayment" variant="compact" />}
          </button>
          <button type="button" className="btn auth-submit" onClick={logout}>
            <Label k="auth.logout" variant="compact" />
          </button>
        </div>

        {adminEmail && (
          <p className="auth-admin-note">
            Admin: {adminEmail}
          </p>
        )}

        <p className="auth-switch">
          <Link to="/login"><Label k="auth.backToLogin" variant="compact" /></Link>
        </p>
      </div>
    </div>
  );
}
