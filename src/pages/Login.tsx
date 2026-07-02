import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Label } from '../i18n/useLabel';
import { ApiError, authHealth, isNativeAuthMode } from '../services/authApi';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const pendingFromState = (location.state as { pending?: boolean } | null)?.pending;

  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState(pendingFromState ? 'Your account is waiting for admin approval.' : '');
  const [submitting, setSubmitting] = useState(false);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);

  useEffect(() => {
    authHealth()
      .then((ok) => setServerOnline(ok))
      .catch(() => setServerOnline(isNativeAuthMode()));
  }, []);

  if (user?.status === 'approved' || user?.role === 'admin') {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    setSubmitting(true);

    try {
      await login(loginId.trim(), password);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'PENDING_APPROVAL') {
          setInfo(err.message || 'Your account is waiting for admin approval.');
        } else if (err.code === 'PAYMENT_DUE') {
          navigate('/payment-due', { replace: true });
        } else if (err.code === 'SUBSCRIPTION_EXPIRED') {
          navigate('/subscription-renew', { replace: true });
        } else {
          setError(err.message);
        }
      } else {
        setServerOnline(false);
        setError(
          isNativeAuthMode()
            ? 'Could not start the app. Please close and reopen Chai Khata.'
            : 'Cannot reach the server. Check Vercel env vars (SUPABASE_*) and redeploy.',
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-bg-pattern" aria-hidden />
      <div className="auth-bg-tea" aria-hidden />

      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo">🍵</div>
          <h1><Label k="appName" variant="stacked" /></h1>
          <p className="auth-tagline"><Label k="auth.loginSubtitle" variant="compact" /></p>
        </div>

        {serverOnline === false && !isNativeAuthMode() && (
          <div className="auth-banner error">
            API server is offline or crashed. Redeploy on Vercel, then open /api/health in your browser to test.
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          {info && <div className="auth-banner info">{info}</div>}
          {error && <div className="auth-banner error">{error}</div>}

          <label className="auth-field">
            <span><Label k="auth.loginOrEmail" variant="compact" /></span>
            <input
              type="text"
              autoComplete="username"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="Email or username"
              required
              minLength={3}
            />
          </label>

          <label className="auth-field">
            <span><Label k="auth.password" variant="compact" /></span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
            />
          </label>

          <button type="submit" className="btn primary auth-submit" disabled={submitting}>
            {submitting ? '…' : <Label k="auth.login" variant="compact" />}
          </button>
        </form>

        <div className="auth-links-grid">
          <p className="auth-switch auth-switch-primary">
            <Label k="auth.noAccount" variant="compact" />{' '}
            <Link to="/register"><Label k="auth.registerLink" variant="compact" /></Link>
          </p>
          <Link to="/forgot-password" className="auth-quick-link">
            <Label k="auth.forgotPassword" variant="compact" />
          </Link>
          <Link to="/payment-due" className="auth-quick-link">
            <Label k="auth.submitPaymentProof" variant="compact" />
          </Link>
          <Link to="/subscription-renew" className="auth-quick-link">
            <Label k="auth.renewSubscription" variant="compact" />
          </Link>
        </div>
      </div>
    </div>
  );
}
