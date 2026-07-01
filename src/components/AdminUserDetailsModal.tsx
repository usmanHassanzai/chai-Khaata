import { useLabel } from '../i18n/useLabel';
import type { AuthUser } from '../services/authApi';
import { adminProfileRows } from '../utils/adminProfile';

type Props = {
  user: AuthUser;
  onClose: () => void;
};

export default function AdminUserDetailsModal({ user, onClose }: Props) {
  const l = useLabel();
  const rows = adminProfileRows(user);

  return (
    <div className="admin-modal-backdrop" onClick={onClose} role="presentation">
      <div className="admin-modal card admin-profile-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="admin-panel-head">
          <h3>{l('auth.userDetails')} — {user.username}</h3>
          <button type="button" className="btn sm" onClick={onClose}>✕</button>
        </div>
        <p className="settings-hint admin-profile-hint">{l('auth.adminProfileHint')}</p>
        <dl className="admin-user-details">
          {rows.map(({ key, labelKey, value }) => (
            <div key={key} className="admin-detail-row">
              <dt>{l(labelKey as 'auth.username')}</dt>
              <dd>
                {key === 'password' && value !== '—' ? (
                  <code className="signup-password">{value}</code>
                ) : (
                  value
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
