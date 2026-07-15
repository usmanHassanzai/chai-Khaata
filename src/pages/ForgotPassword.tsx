import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AuthField from '../components/AuthField';
import AuthLayout from '../components/AuthLayout';
import AuthPageHeader from '../components/AuthPageHeader';
import { Label } from '../i18n/useLabel';
import { ApiError, authApi } from '../services/authApi';

type Step = 'request' | 'done' | 'otp-request' | 'otp-reset';

export default function ForgotPassword() {
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [login, setLogin] = useState('');
  const [channel, setChannel] = useState<'email' | 'phone'>('email');
  const [otp, setOtp] = useState('');
  const [displayOtp, setDisplayOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');

  useEffect(() => {
    authApi.config()
      .then((c) => {
        setEmailConfigured(c.otpDelivery?.emailConfigured ?? false);
        setAdminEmail(c.adminEmail);
      })
      .catch(() => {});
  }, []);

  async function handleRecoverByEmail(e: FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    setSubmitting(true);
    try {
      const res = await authApi.recoverPasswordByEmail(email.trim());
      setInfo(res.message);
      setStep('done');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send password email');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRequestOtp(e: FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    setDisplayOtp('');
    setSubmitting(true);
    try {
      const res = await authApi.forgotPassword(login.trim(), channel);
      if (res.otp) {
        setDisplayOtp(res.otp);
        setOtp(res.otp);
        setInfo(`${res.message} Check the OTP code below.`);
      } else {
        setInfo(`${res.message} (${res.maskedTarget})`);
      }
      setStep('otp-reset');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not request OTP');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReset(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (newPassword !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setSubmitting(true);
    try {
      const res = await authApi.resetPassword(login.trim(), otp.trim(), newPassword);
      setInfo(res.message);
      setStep('done');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reset password');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <AuthPageHeader
        icon="🔐"
        titleKey="auth.forgotTitle"
        subtitleKey="auth.forgotEmailSubtitle"
        badge="Account recovery"
      />

      {step === 'request' && (
        <>
          {!emailConfigured && (
            <div className="auth-banner info">
              <Label k="auth.forgotEmailNeedsSmtp" variant="compact" />
              {adminEmail && <> Admin: <strong>{adminEmail}</strong></>}
            </div>
          )}
          <form className="auth-form auth-form-panel" onSubmit={handleRecoverByEmail}>
            {error && <div className="auth-banner error">{error}</div>}
            <AuthField
              label={<Label k="auth.email" variant="compact" />}
              icon="✉️"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              autoComplete="email"
              hint={<Label k="auth.forgotEmailHint" variant="compact" />}
            />
            <button type="submit" className="btn primary auth-submit" disabled={submitting}>
              {submitting
                ? <span className="auth-spinner" style={{ width: 24, height: 24, borderWidth: 2 }} />
                : <Label k="auth.sendPasswordToEmail" variant="compact" />}
            </button>
            <button type="button" className="btn auth-submit" onClick={() => setStep('otp-request')}>
              <Label k="auth.useOtpInstead" variant="compact" />
            </button>
          </form>
        </>
      )}

      {step === 'otp-request' && (
        <form className="auth-form auth-form-panel" onSubmit={handleRequestOtp}>
          {error && <div className="auth-banner error">{error}</div>}
          <AuthField
            label={<Label k="auth.loginOrEmail" variant="compact" />}
            icon="👤"
            type="text"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            placeholder="email or username"
            required
          />
          <fieldset className="auth-channel-field">
            <legend><Label k="auth.otpVia" variant="compact" /></legend>
            <label className="auth-radio">
              <input type="radio" name="channel" checked={channel === 'email'} onChange={() => setChannel('email')} />
              <Label k="auth.email" variant="compact" />
            </label>
            <label className="auth-radio">
              <input type="radio" name="channel" checked={channel === 'phone'} onChange={() => setChannel('phone')} />
              <Label k="auth.phone" variant="compact" />
            </label>
          </fieldset>
          <button type="submit" className="btn primary auth-submit" disabled={submitting}>
            {submitting
              ? <span className="auth-spinner" style={{ width: 24, height: 24, borderWidth: 2 }} />
              : <Label k="auth.sendOtp" variant="compact" />}
          </button>
          <button type="button" className="btn auth-submit" onClick={() => setStep('request')}>
            ← <Label k="auth.sendPasswordToEmail" variant="compact" />
          </button>
        </form>
      )}

      {step === 'otp-reset' && (
        <form className="auth-form auth-form-panel" onSubmit={handleReset}>
          {info && <div className="auth-banner info">{info}</div>}
          {displayOtp && (
            <div className="otp-display-box">
              <span className="otp-display-label"><Label k="auth.yourOtp" variant="compact" /></span>
              <code className="otp-display-code">{displayOtp}</code>
              <p className="settings-note"><Label k="auth.otpCopyHint" variant="compact" /></p>
            </div>
          )}
          {error && <div className="auth-banner error">{error}</div>}
          <AuthField
            label={<Label k="auth.enterOtp" variant="compact" />}
            icon="🔢"
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            placeholder="6-digit OTP"
            required
          />
          <AuthField
            label={<Label k="auth.newPassword" variant="compact" />}
            icon="🔒"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={6}
            required
          />
          <AuthField
            label={<Label k="auth.confirmPassword" variant="compact" />}
            icon="✓"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={6}
            required
          />
          <button type="submit" className="btn primary auth-submit" disabled={submitting}>
            {submitting
              ? <span className="auth-spinner" style={{ width: 24, height: 24, borderWidth: 2 }} />
              : <Label k="auth.resetPassword" variant="compact" />}
          </button>
        </form>
      )}

      {step === 'done' && (
        <div className="auth-form auth-form-panel">
          <div className="auth-banner success">{info}</div>
          <Link to="/login" className="btn primary auth-submit auth-link-btn">
            <Label k="auth.loginLink" variant="compact" />
          </Link>
        </div>
      )}

      {step !== 'done' && (
        <p className="auth-switch auth-switch-primary">
          <Link to="/login"><Label k="auth.backToLogin" variant="compact" /></Link>
        </p>
      )}
    </AuthLayout>
  );
}
