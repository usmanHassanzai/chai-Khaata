import { useCallback, useEffect, useState } from 'react';
import { ImageThumb } from './ImageUpload';
import { Label, SectionTitle } from '../i18n/useLabel';
import { ApiError, authApi, type PaymentSubmission } from '../services/authApi';
import { formatPlanPrice } from '../data/paymentPlans';

function formatPanelError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'FORBIDDEN') return 'Admin access required.';
    if (err.code === 'NETWORK_ERROR') return err.message;
    return err.message;
  }
  return 'Could not load payment proofs.';
}

function kindLabel(kind: PaymentSubmission['kind']) {
  if (kind === 'signup_payment') return { text: 'New registration', tone: 'signup' as const };
  if (kind === 'subscription_renewal') return { text: 'Renewal', tone: 'renewal' as const };
  return { text: 'Payment due', tone: 'due' as const };
}

function PaymentScreenshotCell({ submissionId, hasScreenshot }: { submissionId: string; hasScreenshot?: boolean }) {
  const [src, setSrc] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hasScreenshot || src) return;
    let cancelled = false;
    setLoading(true);
    authApi.getPaymentSubmission(submissionId)
      .then(({ submission }) => {
        if (!cancelled && submission.screenshot) setSrc(submission.screenshot);
      })
      .catch(() => { /* thumbnail optional */ })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [submissionId, hasScreenshot, src]);

  if (!hasScreenshot) return <span className="settings-note">No image</span>;
  if (loading && !src) return <span className="settings-note">Loading…</span>;
  return <ImageThumb src={src} alt="payment proof" />;
}

type Props = {
  onCountChange?: (count: number) => void;
};

export default function AdminPaymentProofsPanel({ onCountChange }: Props) {
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
      onCountChange?.(list.length);
    } catch (err) {
      setError(formatPanelError(err));
      onCountChange?.(0);
    } finally {
      setLoading(false);
    }
  }, [onCountChange]);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function approve(id: string, isSignup: boolean) {
    const confirmMsg = isSignup
      ? 'Approve payment and activate this company\'s subscription? They will be able to log in immediately.'
      : 'Approve this payment proof?';
    if (!window.confirm(confirmMsg)) return;

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

  return (
    <section className="card admin-payment-proofs settings-card-pro">
      <div className="admin-panel-head">
        <SectionTitle k="auth.paymentProofsTitle" />
        <button type="button" className="btn sm" onClick={load} disabled={loading}>
          {loading ? '…' : '↻'} Refresh
        </button>
      </div>

      <p className="settings-hint">
        <Label k="auth.paymentProofsHint" variant="compact" />
        {' '}
        For new registrations, approving payment also activates their subscription.
      </p>

      {message && <div className="auth-banner success">{message}</div>}
      {error && <div className="auth-banner error">{error}</div>}

      {loading && submissions.length === 0 && (
        <p className="settings-note">Loading payment proofs…</p>
      )}

      {!loading && submissions.length === 0 && (
        <div className="admin-empty-state">
          <span className="admin-empty-icon">✓</span>
          <p>No payment proofs waiting for review.</p>
        </div>
      )}

      {submissions.length > 0 && (
        <>
          <div className="admin-payment-cards">
            {submissions.map((s) => {
              const kind = kindLabel(s.kind);
              const isSignup = s.kind === 'signup_payment';
              return (
                <article key={s.id} className={`admin-payment-card tone-${kind.tone}`}>
                  <header className="admin-payment-card-head">
                    <div>
                      <strong>{s.username}</strong>
                    </div>
                    <span className={`admin-kind-badge tone-${kind.tone}`}>{kind.text}</span>
                  </header>
                  <dl className="admin-payment-meta">
                    <div><dt>Email</dt><dd>{s.email || '—'}</dd></div>
                    <div><dt>Phone</dt><dd>{s.phone || '—'}</dd></div>
                    <div><dt>Plan</dt><dd>{s.subscriptionPlan ? formatPlanPrice(s.subscriptionPlan) || s.subscriptionPlan : '—'}</dd></div>
                    <div><dt>Payment ID</dt><dd><code>{s.paymentRefId || '—'}</code></dd></div>
                    <div><dt>Amount</dt><dd><strong className="due-amount">Rs {s.paymentDue.toLocaleString()}</strong></dd></div>
                    <div><dt>Submitted</dt><dd>{new Date(s.createdAt).toLocaleString()}</dd></div>
                  </dl>
                  <div className="admin-payment-screenshot">
                    <PaymentScreenshotCell submissionId={s.id} hasScreenshot={s.hasScreenshot ?? Boolean(s.screenshot)} />
                  </div>
                  <div className="admin-payment-card-actions">
                    <button
                      type="button"
                      className="btn sm primary"
                      disabled={busyId === s.id}
                      onClick={() => approve(s.id, isSignup)}
                    >
                      {isSignup ? 'Approve & Subscribe' : <Label k="auth.approvePayment" variant="compact" />}
                    </button>
                    <button
                      type="button"
                      className="btn sm danger"
                      disabled={busyId === s.id}
                      onClick={() => reject(s.id, s.username)}
                    >
                      <Label k="auth.reject" variant="compact" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="table-wrap admin-payment-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th><Label k="auth.username" variant="compact" /></th>
                  <th><Label k="auth.email" variant="compact" /></th>
                  <th><Label k="auth.phone" variant="compact" /></th>
                  <th>Type</th>
                  <th><Label k="auth.subscription" variant="compact" /></th>
                  <th><Label k="auth.paymentRefId" variant="compact" /></th>
                  <th><Label k="auth.paymentDue" variant="compact" /></th>
                  <th><Label k="auth.paymentScreenshot" variant="compact" /></th>
                  <th>Date</th>
                  <th><Label k="common.actions" variant="compact" /></th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => {
                  const kind = kindLabel(s.kind);
                  const isSignup = s.kind === 'signup_payment';
                  return (
                    <tr key={s.id} className="row-pending">
                      <td><strong>{s.username}</strong></td>
                      <td>{s.email || '—'}</td>
                      <td>{s.phone || '—'}</td>
                      <td><span className={`admin-kind-badge tone-${kind.tone}`}>{kind.text}</span></td>
                      <td>{s.subscriptionPlan || '—'}</td>
                      <td><code>{s.paymentRefId || '—'}</code></td>
                      <td><strong className="due-amount">Rs {s.paymentDue.toLocaleString()}</strong></td>
                      <td><PaymentScreenshotCell submissionId={s.id} hasScreenshot={s.hasScreenshot ?? Boolean(s.screenshot)} /></td>
                      <td>{new Date(s.createdAt).toLocaleString()}</td>
                      <td className="actions-cell">
                        <button
                          type="button"
                          className="btn sm primary"
                          disabled={busyId === s.id}
                          onClick={() => approve(s.id, isSignup)}
                        >
                          {isSignup ? 'Approve & Subscribe' : 'Approve'}
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
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
