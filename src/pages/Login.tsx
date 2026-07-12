import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout';
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
        } else if (err.code === 'SERVER_CONFIG') {
          setError(`${err.message}. Fix SUPABASE_SERVICE_ROLE_KEY in Vercel — use Secret key (sb_secret_…), then Redeploy.`);
        } else {
          setError(err.message);
        }
      } else {
        setServerOnline(false);
        setError(
          isNativeAuthMode()
            ? 'Could not start the app. Please close and reopen Chai Khata.'
            : 'Cannot reach the server. Run npm run dev for local testing.',
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <div className="auth-brand">
        <div className="auth-logo">🍵</div>
        <h1><Label k="appName" variant="stacked" /></h1>
        <p className="auth-tagline"><Label k="auth.loginSubtitle" variant="compact" /></p>
      </div>

      {serverOnline === false && !isNativeAuthMode() && (
        <div className="auth-banner error">
          API server offline. Run <code>npm run dev</code> in terminal.
        </div>
      )}

      <form className="auth-form" onSubmit={handleSubmit}>
        {info && <div className="auth-banner info">{info}</div>}
        {error && <div className="auth-banner error">{error}</div>}

        <label className="auth-field animate-fade-in-up stagger-1">
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

        <label className="auth-field animate-fade-in-up stagger-2">
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

        <button type="submit" className="btn primary auth-submit animate-fade-in-up stagger-3" disabled={submitting}>
          {submitting
            ? <span className="auth-spinner" style={{ width: 24, height: 24, borderWidth: 2 }} />
            : <Label k="auth.login" variant="compact" />}
        </button>
      </form>

      <div className="auth-links-grid animate-fade-in-up stagger-4">
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
    </AuthLayout>
  );
}
