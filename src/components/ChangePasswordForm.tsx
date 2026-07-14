import { FormEvent, useState } from 'react';
import FormField from './FormField';
import { Label, SectionTitle, useLabel } from '../i18n/useLabel';
import { ApiError, authApi } from '../services/authApi';

export default function ChangePasswordForm() {
  const l = useLabel();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 6) {
      setError(l('auth.passwordMinLength'));
      return;
    }
    if (newPassword !== confirm) {
      setError(l('auth.passwordMismatch'));
      return;
    }
    if (currentPassword === newPassword) {
      setError(l('auth.passwordSameAsOld'));
      return;
    }

    setBusy(true);
    try {
      const res = await authApi.changePassword(currentPassword, newPassword);
      setSuccess(res.message || l('auth.changePasswordSuccess'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(l('auth.changePasswordFailed'));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card settings-card change-password-card">
      <SectionTitle k="auth.changePassword" />
      <p className="settings-hint"><Label k="auth.changePasswordHint" variant="compact" /></p>

      <form className="form-grid change-password-form" onSubmit={handleSubmit}>
        {error && <div className="auth-banner error">{error}</div>}
        {success && <div className="auth-banner success">{success}</div>}

        <FormField
          labelKey="auth.currentPassword"
          type="password"
          value={currentPassword}
          onChange={setCurrentPassword}
          required
          autoComplete="current-password"
        />
        <FormField
          labelKey="auth.newPassword"
          type="password"
          value={newPassword}
          onChange={setNewPassword}
          required
          autoComplete="new-password"
        />
        <FormField
          labelKey="auth.confirmPassword"
          type="password"
          value={confirm}
          onChange={setConfirm}
          required
          autoComplete="new-password"
        />

        <div className="change-password-actions">
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? '…' : <Label k="auth.changePassword" variant="compact" />}
          </button>
        </div>
      </form>
    </section>
  );
}
