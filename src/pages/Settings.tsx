import { Label, PageTitle, SectionTitle, useLabel, useLabelMode } from '../i18n/useLabel';
import { setLabelMode, type LabelMode } from '../i18n/labels';
import { useAuth } from '../context/AuthContext';
import AdminUsersPanel from '../components/AdminUsersPanel';
import CloudSyncPanel from '../components/CloudSyncPanel';

const MODES: { mode: LabelMode; labelKey: string; flag: string }[] = [
  { mode: 'bilingual', labelKey: 'common.bilingual', flag: '🇵🇰🇬🇧' },
  { mode: 'ur', labelKey: 'common.urdu', flag: '🇵🇰' },
  { mode: 'en', labelKey: 'common.english', flag: '🇬🇧' },
  { mode: 'ur-roman', labelKey: 'common.romanUrdu', flag: '📝' },
];

export default function Settings() {
  const l = useLabel();
  const current = useLabelMode();
  const { user } = useAuth();

  return (
    <div className="page">
      <PageTitle k="settings.title" />

      {user && (
        <section className="card form-card">
          <SectionTitle k="auth.account" />
          <p className="settings-note">
            <strong>{user.email || user.username}</strong>
            {user.shopName ? ` — ${user.shopName}` : ''}
            {user.role === 'admin' ? ' (Admin)' : ''}
          </p>
          {user.role !== 'admin' && (
            <div className="subscription-status-box">
              <SectionTitle k="auth.mySubscription" />
              <p className="settings-note">
                <Label k="auth.subscription" variant="compact" />:{' '}
                <strong>{user.subscriptionPlanLabel || user.subscriptionPlan || '—'}</strong>
              </p>
              {user.subscriptionExpiresAt && (
                <p className="settings-note">
                  <Label k="auth.subscriptionExpires" variant="compact" />:{' '}
                  <strong>{new Date(user.subscriptionExpiresAt).toLocaleDateString()}</strong>
                </p>
              )}
              <p className="settings-note">
                {user.subscriptionActive ? (
                  <span className="status-pill status-approved"><Label k="auth.subscriptionActive" variant="compact" /></span>
                ) : user.subscriptionExpiresAt ? (
                  <span className="status-pill status-rejected"><Label k="auth.subscriptionInactive" variant="compact" /></span>
                ) : null}
              </p>
            </div>
          )}
        </section>
      )}

      {user?.role === 'admin' && <AdminUsersPanel />}

      <CloudSyncPanel />

      <section className="card form-card">
        <SectionTitle k="settings.chooseLanguage" />
        <p className="settings-hint">
          <Label k="settings.labelDisplay" variant="compact" />
        </p>
        <div className="lang-buttons">
          {MODES.map(({ mode, labelKey, flag }) => (
            <button
              key={mode}
              type="button"
              className={`btn lang-btn${current === mode ? ' active' : ''}`}
              onClick={() => setLabelMode(mode)}
            >
              {flag}{' '}
              <Label k={labelKey} variant="compact" />
            </button>
          ))}
        </div>
        <p className="settings-note">{l('settings.dataNote')}</p>
      </section>

      <section className="card">
        <h3><Label k="nav.settings" variant="stacked" /> — Android</h3>
        <p className="settings-note">
          Build: <code>npm run build</code> then <code>npx cap sync</code> for Android APK.
        </p>
      </section>
    </div>
  );
}
