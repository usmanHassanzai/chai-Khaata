import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Label } from '../i18n/useLabel';
import { ApiError, authApi } from '../services/authApi';

type Step = 'request' | 'reset' | 'done';

export default function ForgotPassword() {
  const [step, setStep] = useState<Step>('request');
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
  const [smsConfigured, setSmsConfigured] = useState(false);

  const [twilioFrom, setTwilioFrom] = useState<string | null>(null);

  useEffect(() => {
    authApi.config()
      .then((c) => {
        setEmailConfigured(c.otpDelivery?.emailConfigured ?? false);
        setSmsConfigured(c.otpDelivery?.smsConfigured ?? false);
        setTwilioFrom(c.otpDelivery?.twilio?.from ?? null);
      })
      .catch(() => {});
  }, []);

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
      setStep('reset');
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
    <div className="auth-page">
      <div className="auth-bg-pattern" aria-hidden />
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo">🔐</div>
          <h1><Label k="auth.forgotTitle" variant="stacked" /></h1>
          <p className="auth-tagline"><Label k="auth.forgotSubtitle" variant="compact" /></p>
        </div>

        {!emailConfigured && !smsConfigured && step === 'request' && (
          <div className="auth-banner info">
            <Label k="auth.otpManualHint" variant="compact" />
          </div>
        )}

        {step === 'request' && (
          <form className="auth-form" onSubmit={handleRequestOtp}>
            {error && <div className="auth-banner error">{error}</div>}
            <label className="auth-field">
              <span><Label k="auth.loginOrEmail" variant="compact" /></span>
              <input
                type="text"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="email or username"
                required
              />
            </label>
            <fieldset className="auth-channel-field">
              <legend><Label k="auth.otpVia" variant="compact" /></legend>
              <label className="auth-radio">
                <input type="radio" name="channel" checked={channel === 'email'} onChange={() => setChannel('email')} />
                <Label k="auth.email" variant="compact" />
                {emailConfigured && <span className="otp-channel-ok"> ✓</span>}
              </label>
              <label className="auth-radio">
                <input type="radio" name="channel" checked={channel === 'phone'} onChange={() => setChannel('phone')} />
                <Label k="auth.phone" variant="compact" />
                {smsConfigured && <span className="otp-channel-ok"> ✓ Twilio</span>}
              </label>
            </fieldset>
            {smsConfigured && twilioFrom && (
              <p className="settings-note">SMS via Twilio ({twilioFrom})</p>
            )}
            <button type="submit" className="btn primary auth-submit" disabled={submitting}>
              {submitting ? '…' : <Label k="auth.sendOtp" variant="compact" />}
            </button>
          </form>
        )}

        {step === 'reset' && (
          <form className="auth-form" onSubmit={handleReset}>
            {info && <div className="auth-banner info">{info}</div>}
            {displayOtp && (
              <div className="otp-display-box">
                <span className="otp-display-label"><Label k="auth.yourOtp" variant="compact" /></span>
                <code className="otp-display-code">{displayOtp}</code>
                <p className="settings-note"><Label k="auth.otpCopyHint" variant="compact" /></p>
              </div>
            )}
            {error && <div className="auth-banner error">{error}</div>}
            <label className="auth-field">
              <span><Label k="auth.enterOtp" variant="compact" /></span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="6-digit OTP"
                required
              />
            </label>
            <label className="auth-field">
              <span><Label k="auth.newPassword" variant="compact" /></span>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={6}
                required
              />
            </label>
            <label className="auth-field">
              <span><Label k="auth.confirmPassword" variant="compact" /></span>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                minLength={6}
                required
              />
            </label>
            <button type="submit" className="btn primary auth-submit" disabled={submitting}>
              {submitting ? '…' : <Label k="auth.resetPassword" variant="compact" />}
            </button>
            <button type="button" className="btn auth-submit" onClick={() => { setStep('request'); setDisplayOtp(''); }}>
              <Label k="auth.resendOtp" variant="compact" />
            </button>
          </form>
        )}

        {step === 'done' && (
          <div className="auth-form">
            <div className="auth-banner success">{info}</div>
            <Link to="/login" className="btn primary auth-submit auth-link-btn">
              <Label k="auth.loginLink" variant="compact" />
            </Link>
          </div>
        )}

        {step !== 'done' && (
          <p className="auth-switch">
            <Link to="/login"><Label k="auth.backToLogin" variant="compact" /></Link>
          </p>
        )}
      </div>
    </div>
  );
}
