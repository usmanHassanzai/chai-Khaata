import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getCloudApiUrl, isCloudSyncEnabled, isDeployedWebOrigin, setCloudApiUrl, testCloudConnection } from '../services/cloudConfig';
import { onSyncStatus, pushLedgerToCloud, pullLedgerFromCloud, type SyncStatus } from '../services/ledgerSync';
import { db } from '../db/database';
import { Label } from '../i18n/useLabel';

export default function CloudSyncPanel() {
  const { user } = useAuth();
  const autoSync = isDeployedWebOrigin();
  const [url, setUrl] = useState(getCloudApiUrl());
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [message, setMessage] = useState('');
  const [messageKind, setMessageKind] = useState<'info' | 'error'>('info');
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => onSyncStatus(setStatus), []);

  function showMessage(text: string, kind: 'info' | 'error' = 'info') {
    setMessage(text);
    setMessageKind(kind);
  }

  async function saveUrl() {
    setCloudApiUrl(url.trim());
    showMessage('Cloud server saved. Log out and log in again on every device with the same account.');
  }

  async function testConnection() {
    setTesting(true);
    showMessage('');
    const result = await testCloudConnection(url.trim());
    showMessage(result.message, result.ok ? 'info' : 'error');
    setTesting(false);
  }

  async function syncNow() {
    if (!isCloudSyncEnabled()) {
      showMessage('Enter your cloud server URL first.', 'error');
      return;
    }
    if (!user) {
      showMessage('Log in first.', 'error');
      return;
    }
    setBusy(true);
    showMessage('');
    try {
      if (!db) throw new Error('Database not ready');
      const pull = await pullLedgerFromCloud(db, user.id);
      const push = await pushLedgerToCloud(db, user.id);
      const errMsg = ('message' in pull && pull.message) || ('message' in push && push.message);
      if (pull.error || push.error) {
        showMessage(
          errMsg || 'Sync failed. Check internet and that Supabase is configured on the server.',
          'error',
        );
      } else {
        showMessage('Synced successfully. Your inventory is saved in the cloud and available on any device.');
      }
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Sync failed.', 'error');
    } finally {
      setBusy(false);
    }
  }

  const statusLabel =
    status === 'synced' ? 'Live — auto-saving to cloud'
    : status === 'syncing' ? 'Syncing…'
    : status === 'offline' ? 'Offline — changes saved locally until online'
    : status === 'error' ? 'Sync error — tap Sync now to retry'
    : isCloudSyncEnabled() ? 'Ready' : 'Not configured';

  return (
    <section className="card form-card cloud-sync-panel">
      <SectionTitle k="settings.cloudSync" />
      <p className="settings-note">
        {autoSync ? (
          <>
            Your data auto-syncs to the cloud when you log in on <strong>patiwala.pk</strong>.
            Use the same email and password on phone, tablet, or computer — your Godaam, sales, and customers follow you.
          </>
        ) : (
          <Label k="settings.cloudSyncHint" variant="compact" />
        )}
      </p>

      {!autoSync && (
        <label className="form-field">
          <span className="field-label"><Label k="settings.cloudServerUrl" variant="compact" /></span>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={(import.meta.env.VITE_DEFAULT_CLOUD_URL as string) || 'https://patiwala.pk'}
            inputMode="url"
          />
        </label>
      )}

      <div className="cloud-sync-actions">
        {!autoSync && (
          <>
            <button type="button" className="btn primary" onClick={saveUrl}>
              <Label k="settings.saveCloudUrl" variant="compact" />
            </button>
            <button type="button" className="btn" onClick={testConnection} disabled={testing || !url.trim()}>
              {testing ? '…' : <Label k="settings.testConnection" variant="compact" />}
            </button>
          </>
        )}
        <button type="button" className="btn primary" onClick={syncNow} disabled={busy || !isCloudSyncEnabled()}>
          {busy ? '…' : <Label k="settings.syncNow" variant="compact" />}
        </button>
      </div>

      <div className={`cloud-sync-status cloud-sync-status-${status}`}>
        <span className="cloud-sync-dot" aria-hidden />
        {statusLabel}
      </div>

      {message && <p className={`auth-banner ${messageKind === 'error' ? 'error' : 'info'}`}>{message}</p>}

      <ul className="cloud-sync-steps">
        <li>Log in with the same account on every device.</li>
        <li>Add sales or purchases — they save automatically (green dot in header = live).</li>
        <li>Open the app on another phone or Wi‑Fi — your full inventory loads after login.</li>
      </ul>
    </section>
  );
}

function SectionTitle({ k }: { k: string }) {
  return (
    <h3 className="section-title">
      <span className="section-title-bar" />
      <Label k={k} variant="stacked" />
    </h3>
  );
}
