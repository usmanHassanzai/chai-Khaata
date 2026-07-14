import { useCallback, useEffect, useState } from 'react';
import { ImageThumb } from './ImageUpload';
import { Label, SectionTitle } from '../i18n/useLabel';
import { ApiError, authApi, type PaymentSubmission } from '../services/authApi';

function formatPanelError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'FORBIDDEN') return 'Admin access required.';
    if (err.code === 'NETWORK_ERROR') return err.message;
    return err.message;
  }
  return 'Could not load payment proofs.';
}

export default function AdminPaymentProofsPanel() {
  const [submissions, setSubmissions] = useState<PaymentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { submissions: list } = await authApi.listPaymentSubmissions();
      setSubmissions(list);
    } catch (err) {
      setError(formatPanelError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function approve(id: string) {
    setBusyId(id);
    setMessage('');
    try {
      const res = await authApi.approvePaymentSubmission(id);
      setMessage(res.message);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Approve failed');
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string, username: string) {
    const note = window.prompt(`Reject payment proof for "${username}"? Optional note:`) ?? undefined;
    if (note === null) return;
    setBusyId(id);
    try {
      const res = await authApi.rejectPaymentSubmission(id, note);
      setMessage(res.message);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  if (loading && submissions.length === 0) {
    return null;
  }

  if (!loading && submissions.length === 0) {
    return null;
  }

  return (
    <section className="card admin-payment-proofs">
      <SectionTitle k="auth.paymentProofsTitle" />
      <p className="settings-hint">
        <Label k="auth.paymentProofsHint" variant="compact" />
      </p>

      {message && <div className="auth-banner success">{message}</div>}
      {error && <div className="auth-banner error">{error}</div>}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th><Label k="auth.username" variant="compact" /></th>
              <th><Label k="auth.email" variant="compact" /></th>
              <th><Label k="auth.phone" variant="compact" /></th>
              <th><Label k="auth.renewalType" variant="compact" /></th>
              <th><Label k="auth.subscription" variant="compact" /></th>
              <th><Label k="auth.paymentRefId" variant="compact" /></th>
              <th><Label k="auth.paymentDue" variant="compact" /></th>
              <th><Label k="auth.paymentScreenshot" variant="compact" /></th>
              <th>Date</th>
              <th><Label k="common.actions" variant="compact" /></th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((s) => (
              <tr key={s.id} className="row-pending">
                <td><strong>{s.username}</strong></td>
                <td>{s.email || '—'}</td>
                <td>{s.phone || '—'}</td>
                <td>{s.kind === 'signup_payment' ? 'Signup' : s.kind === 'subscription_renewal' ? 'Renewal' : 'Payment due'}</td>
                <td>{s.subscriptionPlan || '—'}</td>
                <td><code>{s.paymentRefId || '—'}</code></td>
                <td><strong className="due-amount">Rs {s.paymentDue.toLocaleString()}</strong></td>
                <td><ImageThumb src={s.screenshot} alt="payment proof" /></td>
                <td>{new Date(s.createdAt).toLocaleString()}</td>
                <td className="actions-cell">
                  <button
                    type="button"
                    className="btn sm primary"
                    disabled={busyId === s.id}
                    onClick={() => approve(s.id)}
                  >
                    <Label k="auth.approvePayment" variant="compact" />
                  </button>
                  <button
                    type="button"
                    className="btn sm danger"
                    disabled={busyId === s.id}
                    onClick={() => reject(s.id, s.username)}
                  >
                    <Label k="auth.reject" variant="compact" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
