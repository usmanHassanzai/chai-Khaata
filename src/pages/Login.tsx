import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import AuthField from '../components/AuthField';
import AuthLayout from '../components/AuthLayout';
import AuthPageHeader from '../components/AuthPageHeader';
import { useAuth } from '../context/AuthContext';
import { Label } from '../i18n/useLabel';
import { ApiError, authApi, authHealth, getApiBase, isNativeAuthMode } from '../services/authApi';
import {
  ensureCloudServerConfigured,
  PRODUCTION_CLOUD_URL,
  testCloudConnection,
  useProductionCloudServer,
} from '../services/cloudConfig';
import { friendlyAuthError, isLocalDevHost } from '../utils/authErrors';

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
  const [checkingServer, setCheckingServer] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [usingLiveServer, setUsingLiveServer] = useState(false);

  useEffect(() => {
    ensureCloudServerConfigured();
    authApi.config().then((c) => setAdminEmail(c.adminEmail)).catch(() => {});
  }, []);

  async function refreshServerStatus() {
    setCheckingServer(true);
    try {
      let ok = await authHealth();
      if (!ok) {
        const live = await testCloudConnection(PRODUCTION_CLOUD_URL);
        if (live.ok) {
          useProductionCloudServer();
          setUsingLiveServer(true);
          setInfo(`Connected to live cloud ${PRODUCTION_CLOUD_URL}. Log in with your account.`);
          ok = true;
        }
      }
      setServerOnline(ok);
      if (ok) setError('');
      return ok;
    } catch {
      setServerOnline(isNativeAuthMode());
      return isNativeAuthMode();
    } finally {
      setCheckingServer(false);
    }
  }

  useEffect(() => {
    void refreshServerStatus();
  }, []);

  if (
    user?.status === 'approved'
    || user?.role === 'admin'
    || (user?.status === 'pending' && user.trialActive)
    || user?.renewalGraceActive
  ) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    setSubmitting(true);

    try {
      if (serverOnline === false) {
        const live = await testCloudConnection(PRODUCTION_CLOUD_URL);
        if (live.ok) {
          useProductionCloudServer();
          setUsingLiveServer(true);
        }
      }
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
        } else if (err.code === 'INVALID_CREDENTIALS') {
          setError(
            adminEmail
              ? `Invalid email or password. If you already registered, use Forgot Password — or contact admin at ${adminEmail}.`
              : 'Invalid email or password. If you already registered, use Forgot Password on the login page.',
          );
        } else if (err.code === 'NETWORK_ERROR') {
          setError(friendlyAuthError(err));
          setServerOnline(false);
        } else {
          setError(friendlyAuthError(err));
        }
      } else {
        setServerOnline(false);
        const base = getApiBase();
        if (isLocalDevHost() && !usingLiveServer) {
          setError('Cannot reach local server. Tap “Use live server”, or run: npm run dev');
        } else if (base && !base.includes(window.location.hostname)) {
          setError(`Cannot reach server at ${base}. Tap “Use live server” (${PRODUCTION_CLOUD_URL}).`);
        } else {
          setError(
            isNativeAuthMode()
              ? 'Could not start the app. Please close and reopen Chai Khata.'
              : 'Cannot reach the server. Check your internet connection and try again.',
          );
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  function switchToLiveServer() {
    useProductionCloudServer();
    setUsingLiveServer(true);
    setInfo(`Cloud server set to ${PRODUCTION_CLOUD_URL}. Checking…`);
    void refreshServerStatus();
  }

  return (
    <AuthLayout>
      <AuthPageHeader
        titleKey="auth.login"
        subtitleKey="auth.loginSubtitle"
        badge="Welcome back"
      />

      <div className="auth-trust-row">
        <span className="auth-trust-pill">📱 Mobile friendly</span>
        <span className="auth-trust-pill">🇵🇰 Urdu + English</span>
        <span className="auth-trust-pill">☁️ Cloud sync</span>
      </div>

      {serverOnline === false && !isNativeAuthMode() && (
        <div className="auth-banner error">
          <strong>Server not reachable.</strong>{' '}
          {isLocalDevHost() && !usingLiveServer ? (
            <>
              Local server is off. Run <code>npm run dev</code>, or use the live cloud database.
            </>
          ) : (
            <>
              Cannot reach the auth server. Use live cloud <code>{PRODUCTION_CLOUD_URL}</code>.
            </>
          )}
          {' '}
          <button type="button" className="auth-inline-link" onClick={switchToLiveServer}>
            Use live server
          </button>
          {' · '}
          <button
            type="button"
            className="auth-inline-link"
            onClick={() => void refreshServerStatus()}
            disabled={checkingServer}
          >
            {checkingServer ? 'Checking…' : 'Check again'}
          </button>
        </div>
      )}

      {usingLiveServer && serverOnline && (
        <div className="auth-banner info">
          Live cloud: <code>{PRODUCTION_CLOUD_URL}</code> — same data on phone and laptop.
        </div>
      )}

      <form className="auth-form auth-form-panel" onSubmit={handleSubmit}>
        {info && <div className="auth-banner info">{info}</div>}
        {error && serverOnline !== false && <div className="auth-banner error">{error}</div>}

        <AuthField
          label={<Label k="auth.loginOrEmail" variant="compact" />}
          icon="✉️"
          type="text"
          autoComplete="username"
          value={loginId}
          onChange={(e) => setLoginId(e.target.value)}
          placeholder="Email or username"
          required
          minLength={3}
        />

        <AuthField
          label={<Label k="auth.password" variant="compact" />}
          icon="🔒"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          minLength={6}
        />

        <button type="submit" className="btn primary auth-submit" disabled={submitting}>
          {submitting
            ? <span className="auth-spinner" style={{ width: 24, height: 24, borderWidth: 2 }} />
            : <Label k="auth.login" variant="compact" />}
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
        <Link to="/subscription-renew" className="auth-quick-link">
          <Label k="auth.renewSubscription" variant="compact" />
        </Link>
      </div>
    </AuthLayout>
  );
}
