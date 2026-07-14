import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Label, PageTitle, SectionTitle, useLabel, useLabelMode } from '../i18n/useLabel';
import { setLabelMode, type LabelMode } from '../i18n/labels';
import { useAuth } from '../context/AuthContext';
import AdminUsersPanel from '../components/AdminUsersPanel';
import CloudSyncPanel from '../components/CloudSyncPanel';
import PageBanner from '../components/PageBanner';
import ConfirmDialog from '../components/ConfirmDialog';
import AdminPaymentProofsPanel from '../components/AdminPaymentProofsPanel';
import { useAppDb } from '../hooks/useAppDb';
import { getSettingsQuery } from '../db/database';
import {
  downloadJson,
  exportLedgerJson,
  getPreferences,
  resetCloudConfigOnly,
  resetPreferencesOnly,
  runReset,
  setAnimations,
  setCompactUi,
  setShowProfitOnDashboard,
  setTheme,
  type ResetScope,
  type ThemeMode,
} from '../services/appPreferences';

const MODES: { mode: LabelMode; labelKey: string; flag: string }[] = [
  { mode: 'bilingual', labelKey: 'common.bilingual', flag: '🇵🇰🇬🇧' },
  { mode: 'ur', labelKey: 'common.urdu', flag: '🇵🇰' },
  { mode: 'en', labelKey: 'common.english', flag: '🇬🇧' },
  { mode: 'ur-roman', labelKey: 'common.romanUrdu', flag: '📝' },
];

const TABS = [
  { id: 'general', icon: '🎨', labelKey: 'settings.tabGeneral' },
  { id: 'business', icon: '📊', labelKey: 'settings.tabBusiness' },
  { id: 'cloud', icon: '☁️', labelKey: 'settings.tabCloud' },
  { id: 'account', icon: '👤', labelKey: 'settings.tabAccount' },
  { id: 'data', icon: '🗂️', labelKey: 'settings.tabData' },
] as const;

type TabId = (typeof TABS)[number]['id'] | 'admin';

function subscribePreferences(cb: () => void) {
  window.addEventListener('app-preferences-change', cb);
  window.addEventListener('label-mode-change', cb);
  return () => {
    window.removeEventListener('app-preferences-change', cb);
    window.removeEventListener('label-mode-change', cb);
  };
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="settings-toggle-row">
      <div className="settings-toggle-text">
        <span className="settings-toggle-label">{label}</span>
        {hint && <span className="settings-toggle-hint">{hint}</span>}
      </div>
      <span className="settings-switch">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="settings-switch-slider" />
      </span>
    </label>
  );
}

export default function Settings() {
  const l = useLabel();
  const current = useLabelMode();
  const { user, dbReady } = useAuth();
  const appDb = useAppDb();
  const prefs = useSyncExternalStore(subscribePreferences, getPreferences, getPreferences);

  const [tab, setTab] = useState<TabId>('general');
  const [threshold, setThreshold] = useState('50');
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<{ scope: ResetScope; title: string; message: string } | null>(null);

  const settings = useLiveQuery(
    () => (appDb ? getSettingsQuery() : undefined),
    [appDb, dbReady],
  ) ?? {
    id: 'settings' as const,
    lowStockThresholdKg: 50,
    language: 'ur-roman' as const,
  };

  useEffect(() => {
    setThreshold(String(settings.lowStockThresholdKg));
  }, [settings.lowStockThresholdKg]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 3200);
  }, []);

  async function saveThreshold() {
    if (!appDb) {
      showToast(l('settings.dbNotReady'));
      return;
    }
    const val = Math.max(1, Number(threshold) || 50);
    await appDb.settings.put({ ...settings, lowStockThresholdKg: val });
    showToast(l('settings.thresholdSaved'));
  }

  async function handleExport() {
    if (!appDb) {
      showToast(l('settings.dbNotReady'));
      return;
    }
    setBusy(true);
    try {
      const json = await exportLedgerJson(appDb);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadJson(`patiwala-backup-${stamp}.json`, json);
      showToast(l('settings.exportDone'));
    } catch {
      showToast(l('settings.exportFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function executeReset(scope: ResetScope) {
    if ((scope === 'business' || scope === 'data') && !appDb) {
      showToast(l('settings.dbNotReady'));
      setConfirm(null);
      return;
    }
    setBusy(true);
    try {
      if (scope === 'preferences') await resetPreferencesOnly();
      else if (scope === 'cloud') resetCloudConfigOnly();
      else await runReset(scope, appDb);
      showToast(l('settings.resetDone'));
    } catch {
      showToast(l('settings.resetFailed'));
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  const visibleTabs = user?.role === 'admin'
    ? [...TABS, { id: 'admin' as const, icon: '✅', labelKey: 'settings.tabAdmin' }]
    : TABS;

  return (
    <div className="page settings-page">
      <PageBanner titleKey="settings.title" subtitle={l('settings.subtitle')} icon="⚙️" accent="green" />
      <PageTitle k="settings.title" />

      <div className="settings-layout">
        <nav className="settings-tabs" aria-label="Settings sections">
          {visibleTabs.map(({ id, icon, labelKey }) => (
            <button
              key={id}
              type="button"
              className={`settings-tab${tab === id ? ' active' : ''}`}
              onClick={() => setTab(id as TabId)}
            >
              <span className="settings-tab-icon">{icon}</span>
              <Label k={labelKey} variant="compact" />
            </button>
          ))}
        </nav>

        <div className="settings-panels">
          {tab === 'general' && (
            <div className="settings-panel animate-fade-in-up">
              <section className="card settings-card">
                <SectionTitle k="settings.appearance" />
                <p className="settings-hint"><Label k="settings.appearanceHint" variant="compact" /></p>

                <div className="settings-theme-grid">
                  {(['light', 'dark', 'auto'] as ThemeMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={`settings-theme-btn${prefs.theme === mode ? ' active' : ''}`}
                      onClick={() => setTheme(mode)}
                    >
                      <span>{mode === 'light' ? '☀️' : mode === 'dark' ? '🌙' : '🔄'}</span>
                      <Label k={`settings.theme${mode === 'light' ? 'Light' : mode === 'dark' ? 'Dark' : 'Auto'}`} variant="compact" />
                    </button>
                  ))}
                </div>

                <ToggleRow
                  label={l('settings.compactUi')}
                  hint={l('settings.compactUiHint')}
                  checked={prefs.compactUi}
                  onChange={setCompactUi}
                />
                <ToggleRow
                  label={l('settings.animations')}
                  hint={l('settings.animationsHint')}
                  checked={prefs.animations}
                  onChange={setAnimations}
                />
                <ToggleRow
                  label={l('settings.showProfit')}
                  hint={l('settings.showProfitHint')}
                  checked={prefs.showProfitOnDashboard}
                  onChange={setShowProfitOnDashboard}
                />
              </section>

              <section className="card settings-card">
                <SectionTitle k="settings.chooseLanguage" />
                <p className="settings-hint"><Label k="settings.labelDisplay" variant="compact" /></p>
                <div className="lang-buttons settings-lang-grid">
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
              </section>
            </div>
          )}

          {tab === 'business' && (
            <div className="settings-panel animate-fade-in-up">
              <section className="card settings-card">
                <SectionTitle k="settings.businessRules" />
                <p className="settings-hint"><Label k="settings.businessHint" variant="compact" /></p>

                <label className="form-field">
                  <span className="field-label"><Label k="stock.threshold" variant="compact" /></span>
                  <div className="settings-inline-field">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={threshold}
                      onChange={(e) => setThreshold(e.target.value)}
                    />
                    <span className="settings-unit">kg</span>
                    <button type="button" className="btn primary" onClick={saveThreshold}>
                      <Label k="stock.saveThreshold" variant="compact" />
                    </button>
                  </div>
                </label>

                <div className="settings-info-grid">
                  <div className="settings-info-tile">
                    <span className="settings-info-label"><Label k="settings.currentThreshold" variant="compact" /></span>
                    <strong>{settings.lowStockThresholdKg} kg</strong>
                  </div>
                  <div className="settings-info-tile">
                    <span className="settings-info-label"><Label k="settings.dataStorage" variant="compact" /></span>
                    <strong><Label k="settings.localFirst" variant="compact" /></strong>
                  </div>
                </div>
              </section>
            </div>
          )}

          {tab === 'cloud' && (
            <div className="settings-panel animate-fade-in-up">
              <CloudSyncPanel />
              <section className="card settings-card settings-steps-card">
                <SectionTitle k="settings.cloudSync" />
                <ol className="settings-steps">
                  <li><Label k="settings.cloudStep1" variant="compact" /></li>
                  <li><Label k="settings.cloudStep2" variant="compact" /></li>
                  <li><Label k="settings.cloudStep3" variant="compact" /></li>
                </ol>
                <p className="settings-note"><Label k="settings.dataNote" variant="compact" /></p>
              </section>
            </div>
          )}

          {tab === 'account' && user && (
            <div className="settings-panel animate-fade-in-up">
              <section className="card settings-card settings-account-card">
                <SectionTitle k="auth.account" />
                <div className="settings-profile">
                  <div className="settings-avatar">{user.shopName?.[0]?.toUpperCase() ?? '☕'}</div>
                  <div>
                    <h3 className="settings-profile-name">{user.shopName || user.username}</h3>
                    <p className="settings-profile-email">{user.email || user.username}</p>
                    <span className={`status-pill ${user.role === 'admin' ? 'status-approved' : 'status-pending'}`}>
                      {user.role === 'admin' ? 'Admin' : 'Shop Owner'}
                    </span>
                  </div>
                </div>

                {user.role !== 'admin' && (
                  <div className="subscription-status-box">
                    <SectionTitle k="auth.mySubscription" />
                    <div className="settings-info-grid">
                      <div className="settings-info-tile">
                        <span className="settings-info-label"><Label k="auth.subscription" variant="compact" /></span>
                        <strong>{user.subscriptionPlanLabel || user.subscriptionPlan || '—'}</strong>
                      </div>
                      {user.subscriptionExpiresAt && (
                        <div className="settings-info-tile">
                          <span className="settings-info-label"><Label k="auth.subscriptionExpires" variant="compact" /></span>
                          <strong>{new Date(user.subscriptionExpiresAt).toLocaleDateString()}</strong>
                        </div>
                      )}
                    </div>
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
            </div>
          )}

          {tab === 'data' && (
            <div className="settings-panel animate-fade-in-up">
              <section className="card settings-card">
                <SectionTitle k="settings.dataBackup" />
                <p className="settings-hint"><Label k="settings.dataBackupHint" variant="compact" /></p>
                <button type="button" className="btn primary" onClick={handleExport} disabled={busy || !appDb}>
                  📥 <Label k="settings.exportData" variant="compact" />
                </button>
              </section>

              <section className="card settings-card settings-danger-zone">
                <SectionTitle k="settings.resetTitle" />
                <p className="settings-hint"><Label k="settings.resetHint" variant="compact" /></p>

                <div className="settings-reset-grid">
                  <button
                    type="button"
                    className="settings-reset-btn"
                    disabled={busy}
                    onClick={() => setConfirm({
                      scope: 'preferences',
                      title: l('settings.resetPreferences'),
                      message: l('settings.resetPreferencesMsg'),
                    })}
                  >
                    <span>🎨</span>
                    <strong><Label k="settings.resetPreferences" variant="compact" /></strong>
                    <small><Label k="settings.resetPreferencesDesc" variant="compact" /></small>
                  </button>

                  <button
                    type="button"
                    className="settings-reset-btn"
                    disabled={busy}
                    onClick={() => setConfirm({
                      scope: 'cloud',
                      title: l('settings.resetCloud'),
                      message: l('settings.resetCloudMsg'),
                    })}
                  >
                    <span>☁️</span>
                    <strong><Label k="settings.resetCloud" variant="compact" /></strong>
                    <small><Label k="settings.resetCloudDesc" variant="compact" /></small>
                  </button>

                  <button
                    type="button"
                    className="settings-reset-btn"
                    disabled={busy || !appDb}
                    onClick={() => setConfirm({
                      scope: 'business',
                      title: l('settings.resetBusiness'),
                      message: l('settings.resetBusinessMsg'),
                    })}
                  >
                    <span>📊</span>
                    <strong><Label k="settings.resetBusiness" variant="compact" /></strong>
                    <small><Label k="settings.resetBusinessDesc" variant="compact" /></small>
                  </button>

                  <button
                    type="button"
                    className="settings-reset-btn danger"
                    disabled={busy || !appDb}
                    onClick={() => setConfirm({
                      scope: 'data',
                      title: l('settings.resetData'),
                      message: l('settings.resetDataMsg'),
                    })}
                  >
                    <span>🗑️</span>
                    <strong><Label k="settings.resetData" variant="compact" /></strong>
                    <small><Label k="settings.resetDataDesc" variant="compact" /></small>
                  </button>
                </div>
              </section>
            </div>
          )}

          {tab === 'admin' && user?.role === 'admin' && (
            <div className="settings-panel animate-fade-in-up">
              <AdminPaymentProofsPanel />
              <AdminUsersPanel />
            </div>
          )}

          {tab === 'account' && !user && (
            <div className="settings-panel">
              <section className="card settings-card">
                <p className="settings-note"><Label k="auth.loginLink" variant="compact" /></p>
              </section>
            </div>
          )}
        </div>
      </div>

      {toast && <div className="settings-toast" role="status">{toast}</div>}

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        danger={confirm?.scope === 'data'}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm && executeReset(confirm.scope)}
      />
    </div>
  );
}
