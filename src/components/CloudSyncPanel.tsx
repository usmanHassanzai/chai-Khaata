import { useEffect, useState } from 'react';
import { getCloudApiUrl, isCloudSyncEnabled, setCloudApiUrl, testCloudConnection } from '../services/cloudConfig';
import { onSyncStatus, pushLedgerToCloud, pullLedgerFromCloud, type SyncStatus } from '../services/ledgerSync';
import { db } from '../db/database';
import { Label } from '../i18n/useLabel';

export default function CloudSyncPanel() {
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
    showMessage('Cloud server saved. Log out and log in again with the same account on every phone.');
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
    setBusy(true);
    showMessage('');
    try {
      if (!db) throw new Error('Not logged in');
      await pullLedgerFromCloud(db);
      await pushLedgerToCloud(db);
      showMessage('Synced successfully. Data is live on the cloud.');
    } catch {
      showMessage('Sync failed. Use a public https URL and check internet on both phones.', 'error');
    } finally {
      setBusy(false);
    }
  }

  const statusLabel =
    status === 'synced' ? 'Live — cloud sync active'
    : status === 'syncing' ? 'Syncing…'
    : status === 'offline' ? 'Offline'
    : status === 'error' ? 'Sync error'
    : isCloudSyncEnabled() ? 'Ready' : 'Not configured';

  return (
    <section className="card form-card cloud-sync-panel">
      <SectionTitle k="settings.cloudSync" />
      <p className="settings-note">
        <Label k="settings.cloudSyncHint" variant="compact" />
      </p>

      <label className="form-field">
        <span className="field-label"><Label k="settings.cloudServerUrl" variant="compact" /></span>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://chai-khata.vercel.app"
          inputMode="url"
        />
      </label>

      <div className="cloud-sync-actions">
        <button type="button" className="btn primary" onClick={saveUrl}>
          <Label k="settings.saveCloudUrl" variant="compact" />
        </button>
        <button type="button" className="btn" onClick={testConnection} disabled={testing || !url.trim()}>
          {testing ? '…' : <Label k="settings.testConnection" variant="compact" />}
        </button>
        <button type="button" className="btn" onClick={syncNow} disabled={busy}>
          {busy ? '…' : <Label k="settings.syncNow" variant="compact" />}
        </button>
      </div>

      <div className={`cloud-sync-status cloud-sync-status-${status}`}>
        <span className="cloud-sync-dot" aria-hidden />
        {statusLabel}
      </div>

      {message && <p className={`auth-banner ${messageKind === 'error' ? 'error' : 'info'}`}>{message}</p>}

      <ul className="cloud-sync-steps">
        <li><Label k="settings.cloudStep1" variant="compact" /></li>
        <li><Label k="settings.cloudStep2" variant="compact" /></li>
        <li><Label k="settings.cloudStep3" variant="compact" /></li>
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
