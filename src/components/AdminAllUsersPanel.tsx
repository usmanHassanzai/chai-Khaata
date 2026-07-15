import { useMemo, useState } from 'react';
import ConfirmDialog from './ConfirmDialog';
import AdminUserDetailsModal from './AdminUserDetailsModal';
import { Label, SectionTitle, useLabel } from '../i18n/useLabel';
import { useAdminUsers } from '../context/AdminUsersContext';
import { ApiError, authApi, type AuthUser, type UserStatus } from '../services/authApi';
import { formatAdminDateTime } from '../utils/adminProfile';

type StatusFilter = 'all' | UserStatus;

export default function AdminAllUsersPanel() {
  const l = useLabel();
  const { users, loading, refreshing, error, refresh } = useAdminUsers();
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [detailsUser, setDetailsUser] = useState<AuthUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AuthUser | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      if (!q) return true;
      const haystack = [
        u.username,
        u.email,
        u.shopName,
        u.phone,
        u.paymentRefId,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [users, search, statusFilter]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    setBusyId(target.id);
    setMessage('');
    try {
      const res = await authApi.deleteUser(target.id);
      setMessage(res.message);
      await refresh({ silent: true });
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Delete failed');
    } finally {
      setBusyId(null);
    }
  }

  async function emailPassword(id: string, username: string) {
    if (!window.confirm(`Send password to "${username}" registered email?`)) return;
    setBusyId(`${id}-pwd`);
    setMessage('');
    try {
      const res = await authApi.sendPasswordToUser(id);
      setMessage(res.message);
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Could not send password email');
    } finally {
      setBusyId(null);
    }
  }

  const shopOwners = users.filter((u) => u.role !== 'admin');

  return (
    <section className="card admin-users-card admin-all-users-panel">
      <div className="admin-panel-head">
        <SectionTitle k="auth.allUsersManage" />
        <button type="button" className="btn sm" onClick={() => refresh({ silent: true })} disabled={loading || refreshing}>
          {refreshing ? '…' : '↻'} <Label k="auth.refresh" variant="compact" />
        </button>
      </div>

      <p className="settings-hint">
        <Label k="auth.allUsersManageHint" variant="compact" />
      </p>

      {message && <div className="auth-banner success">{message}</div>}
      {error && <div className="auth-banner error">{error}</div>}

      <div className="admin-all-users-toolbar">
        <input
          type="search"
          className="admin-all-users-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={l('auth.searchUsers')}
          aria-label={l('auth.searchUsers')}
        />
        <select
          className="admin-all-users-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          aria-label={l('auth.filterStatus')}
        >
          <option value="all">{l('auth.filterAll')}</option>
          <option value="pending">{l('auth.filterPending')}</option>
          <option value="approved">{l('auth.filterApproved')}</option>
          <option value="rejected">{l('auth.filterRejected')}</option>
        </select>
        <span className="admin-all-users-count">
          {filtered.length} / {shopOwners.length} {l('auth.usersShown')}
        </span>
      </div>

      {loading && users.length === 0 && <p className="settings-note">Loading users…</p>}

      {!loading && !error && filtered.length === 0 && (
        <p className="settings-note"><Label k="auth.noUsersFound" variant="compact" /></p>
      )}

      {filtered.length > 0 && (
        <div className="table-wrap admin-all-users-table-wrap">
          <table className="data-table admin-all-users-table">
            <thead>
              <tr>
                <th><Label k="auth.username" variant="compact" /></th>
                <th><Label k="auth.shopName" variant="compact" /></th>
                <th><Label k="auth.email" variant="compact" /></th>
                <th><Label k="auth.phone" variant="compact" /></th>
                <th><Label k="auth.status" variant="compact" /></th>
                <th><Label k="auth.registerDate" variant="compact" /></th>
                <th><Label k="common.actions" variant="compact" /></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className={u.status === 'pending' ? 'row-pending' : u.status === 'rejected' ? 'row-rejected' : undefined}>
                  <td>
                    <strong>{u.username}</strong>
                    {u.role === 'admin' && (
                      <span className="status-pill status-approved admin-role-pill">Admin</span>
                    )}
                  </td>
                  <td>{u.shopName || '—'}</td>
                  <td>{u.email || '—'}</td>
                  <td>{u.phone || '—'}</td>
                  <td>
                    <span className={`status-pill ${u.status === 'approved' ? 'status-approved' : u.status === 'rejected' ? 'status-rejected' : 'status-pending'}`}>
                      {u.status}
                    </span>
                  </td>
                  <td>{formatAdminDateTime(u.createdAt)}</td>
                  <td className="actions-cell">
                    <button type="button" className="btn sm" onClick={() => setDetailsUser(u)}>
                      <Label k="auth.viewDetails" variant="compact" />
                    </button>
                    {u.role !== 'admin' && (
                      <button
                        type="button"
                        className="btn sm"
                        disabled={busyId === `${u.id}-pwd`}
                        onClick={() => emailPassword(u.id, u.username)}
                      >
                        ✉ <Label k="auth.sendPasswordToUser" variant="compact" />
                      </button>
                    )}
                    {u.role !== 'admin' && (
                      <button
                        type="button"
                        className="btn sm danger"
                        disabled={busyId === u.id}
                        onClick={() => setDeleteTarget(u)}
                      >
                        <Label k="auth.deletePermanently" variant="compact" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detailsUser && (
        <AdminUserDetailsModal user={detailsUser} onClose={() => setDetailsUser(null)} />
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={l('auth.deleteUserConfirmTitle')}
        message={
          deleteTarget
            ? l('auth.deleteUserConfirmMessage').replace('{username}', deleteTarget.username)
            : ''
        }
        confirmLabel={l('auth.deletePermanently')}
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </section>
  );
}
