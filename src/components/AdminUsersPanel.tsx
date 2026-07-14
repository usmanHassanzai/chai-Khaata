import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminUserCard from './AdminUserCard';
import AdminUserDetailsModal from './AdminUserDetailsModal';
import { Label, SectionTitle } from '../i18n/useLabel';
import { useAuth } from '../context/AuthContext';
import { ApiError, authApi, getApiBase, getStoredToken, type AuthUser, type OtpRequest } from '../services/authApi';

function formatLoadError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'FORBIDDEN') return 'Admin access required. Log in with the admin account.';
    if (err.code === 'UNAUTHORIZED' || err.code === 'INVALID_TOKEN') return 'Session expired. Please log out and log in again.';
    if (err.code === 'NETWORK_ERROR') return err.message;
    return err.message;
  }
  return 'Could not load users. Run npm run dev and log in as admin.';
}

export default function AdminUsersPanel() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [otpRequests, setOtpRequests] = useState<OtpRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [detailsUser, setDetailsUser] = useState<AuthUser | null>(null);

  const load = useCallback(async () => {
    if (user?.role !== 'admin') {
      setLoading(false);
      setError('Admin access required.');
      setUsers([]);
      return;
    }

    if (!getStoredToken()) {
      setLoading(false);
      setError('Session expired. Please log in again.');
      setUsers([]);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { users: list } = await authApi.listUsers();
      setUsers(list);
    } catch (err) {
      setError(formatLoadError(err));
      setUsers([]);
    }

    try {
      const { requests } = await authApi.listOtpRequests();
      setOtpRequests(requests);
    } catch {
      setOtpRequests([]);
    }

    setLoading(false);
  }, [user?.role]);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function approve(id: string) {
    setBusyId(id);
    setMessage('');
    try {
      const res = await authApi.approveUser(id);
      setMessage(res.message);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Approve failed');
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    if (!window.confirm('Reject this user?')) return;
    setBusyId(id);
    try {
      await authApi.rejectUser(id);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function removeUser(id: string, username: string) {
    if (!window.confirm(`Permanently delete "${username}" from database? They cannot log in again.`)) return;
    setBusyId(id);
    setError('');
    try {
      const res = await authApi.deleteUser(id);
      setMessage(res.message);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Delete failed');
    } finally {
      setBusyId(null);
    }
  }

  async function setPaymentDue(id: string, username: string) {
    const amountStr = window.prompt(`Payment due for "${username}" (Rs):`, '0');
    if (amountStr === null) return;
    const amount = Number(amountStr);
    if (!Number.isFinite(amount) || amount < 0) {
      setError('Enter a valid amount');
      return;
    }
    const note = window.prompt('Note (optional):', '') ?? '';
    setBusyId(id);
    try {
      const res = await authApi.setPaymentDue(id, amount, note);
      setMessage(res.message);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not set payment due');
    } finally {
      setBusyId(null);
    }
  }

  async function markPaid(id: string) {
    setBusyId(id);
    try {
      const res = await authApi.markPaid(id);
      setMessage(res.message);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function sendOtp(id: string, channel: 'email' | 'phone') {
    setBusyId(`${id}-${channel}`);
    setMessage('');
    try {
      const res = await authApi.sendOtpToUser(id, channel);
      setMessage(`${res.message} OTP: ${res.otp} → ${res.sentTo}`);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function emailPassword(id: string, username: string) {
    if (!window.confirm(`Send password to "${username}" registered email?`)) return;
    setBusyId(`${id}-pwd`);
    setMessage('');
    setError('');
    try {
      const res = await authApi.sendPasswordToUser(id);
      setMessage(res.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send password email');
    } finally {
      setBusyId(null);
    }
  }

  const pending = users.filter((u) => u.status === 'pending' && u.role !== 'admin');
  const regularUsers = users.filter((u) => u.role !== 'admin');

  function UserActions({ u }: { u: AuthUser }) {
    return (
      <div className="admin-user-card-actions">
        <button type="button" className="btn sm" onClick={() => setDetailsUser(u)}>
          <Label k="auth.viewDetails" variant="compact" />
        </button>
        {u.status === 'pending' && (
          <>
            <button type="button" className="btn sm primary" disabled={busyId === u.id} onClick={() => approve(u.id)}>
              <Label k="auth.approve" variant="compact" />
            </button>
            <button type="button" className="btn sm danger" disabled={busyId === u.id} onClick={() => reject(u.id)}>
              <Label k="auth.reject" variant="compact" />
            </button>
          </>
        )}
        <button type="button" className="btn sm" disabled={busyId === u.id} onClick={() => setPaymentDue(u.id, u.username)}>
          <Label k="auth.setPaymentDue" variant="compact" />
        </button>
        {(u.paymentDue ?? 0) > 0 && (
          <button type="button" className="btn sm primary" disabled={busyId === u.id} onClick={() => markPaid(u.id)}>
            <Label k="auth.markPaid" variant="compact" />
          </button>
        )}
        <button type="button" className="btn sm" disabled={busyId === `${u.id}-email`} onClick={() => sendOtp(u.id, 'email')}>
          OTP ✉
        </button>
        <button type="button" className="btn sm" disabled={busyId === `${u.id}-phone`} onClick={() => sendOtp(u.id, 'phone')}>
          OTP 📱
        </button>
        <button type="button" className="btn sm" disabled={busyId === `${u.id}-pwd`} onClick={() => emailPassword(u.id, u.username)}>
          ✉ <Label k="auth.sendPasswordToUser" variant="compact" />
        </button>
        <button type="button" className="btn sm danger" disabled={busyId === u.id} onClick={() => removeUser(u.id, u.username)}>
          <Label k="auth.removeUser" variant="compact" />
        </button>
      </div>
    );
  }

  return (
    <section className="card admin-users-card">
      <div className="admin-panel-head">
        <SectionTitle k="auth.pendingApprovals" />
        <button type="button" className="btn sm" onClick={() => load()} disabled={loading}>
          ↻ <Label k="auth.refresh" variant="compact" />
        </button>
      </div>

      {user?.role !== 'admin' && (
        <div className="auth-banner error">
          <Label k="auth.adminOnly" variant="compact" />
        </div>
      )}

      {pending.length > 0 && (
        <div className="admin-pending-badge">{pending.length} pending</div>
      )}

      <p className="settings-hint">
        <Label k="auth.adminUsersHint" variant="compact" />
      </p>

      {message && <div className="auth-banner success">{message}</div>}
      {loading && <p className="settings-note">Loading users…</p>}
      {error && (
        <div className="auth-banner error">
          {error}
          <p className="settings-note" style={{ marginTop: '0.5rem' }}>
            API: {getApiBase() || 'same origin'} — ensure <code>npm run dev</code> is running.
          </p>
          {(error.includes('Session expired') || error.includes('log in')) && (
            <button
              type="button"
              className="btn sm primary"
              style={{ marginTop: '0.75rem' }}
              onClick={() => {
                logout();
                navigate('/login', { replace: true });
              }}
            >
              Log in again
            </button>
          )}
        </div>
      )}

      {!loading && !error && pending.length === 0 && regularUsers.length === 0 && (
        <p className="settings-note"><Label k="auth.noPendingUsers" variant="compact" /></p>
      )}

      {!loading && !error && pending.length > 0 && (
        <div className="admin-user-list">
          <h4 className="admin-all-users-title"><Label k="auth.pendingApprovals" variant="compact" /></h4>
          {pending.map((u) => (
            <div key={u.id} className="admin-user-card-wrap row-pending">
              <AdminUserCard user={u} />
              <UserActions u={u} />
            </div>
          ))}
        </div>
      )}

      {!loading && otpRequests.length > 0 && (
        <>
          <h4 className="admin-all-users-title"><Label k="auth.activeOtps" variant="compact" /></h4>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th><Label k="auth.username" variant="compact" /></th>
                  <th><Label k="auth.email" variant="compact" /></th>
                  <th><Label k="auth.phone" variant="compact" /></th>
                  <th>OTP</th>
                  <th>Channel</th>
                </tr>
              </thead>
              <tbody>
                {otpRequests.map((r) => (
                  <tr key={`${r.userId}-${r.createdAt}`}>
                    <td>{r.username}</td>
                    <td>{r.email || '—'}</td>
                    <td>{r.phone || '—'}</td>
                    <td><code className="otp-code">{r.otp}</code></td>
                    <td>{r.channel} → {r.sentTo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!loading && !error && pending.length > 0 && (
        <p className="settings-note">
          <Label k="auth.seeAllUsersBelow" variant="compact" />
        </p>
      )}

      {detailsUser && (
        <AdminUserDetailsModal user={detailsUser} onClose={() => setDetailsUser(null)} />
      )}
    </section>
  );
}
