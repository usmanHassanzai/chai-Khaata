import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getCloudApiUrl, isCloudSyncEnabled, isDeployedWebOrigin, setCloudApiUrl, testCloudConnection } from '../services/cloudConfig';
import { onSyncStatus, reconcileLedgerWithCloud, type SyncStatus } from '../services/ledgerSync';
import { db } from '../db/database';
import { Label } from '../i18n/useLabel';
import { PRODUCTION_CLOUD_URL, useProductionCloudServer } from '../services/cloudConfig';

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
      useProductionCloudServer();
      const result = await reconcileLedgerWithCloud(db, user.id);
      if (!result.ok) {
        showMessage(
          ('error' in result && result.error) || 'Sync failed. Check internet and open https://patiwala.pk on both devices.',
          'error',
        );
      } else {
        const bits = [];
        if ('uploaded' in result && result.uploaded) bits.push('uploaded to cloud');
        if ('pulled' in result && result.pulled) bits.push('downloaded from cloud');
        const detail = bits.length ? bits.join(' + ') : 'already in sync';
        const rows = 'rowCount' in result && result.rowCount != null ? ` (${result.rowCount} rows)` : '';
        showMessage(`Synced successfully — ${detail}${rows}. Use the same account on phone and laptop.`);
      }
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Sync failed.', 'error');
    } finally {
      setBusy(false);
    }
  }

  const statusLabel =
    status === 'synced' ? 'Auto sync live — saving to cloud'
    : status === 'syncing' ? 'Auto syncing…'
    : status === 'offline' ? 'Offline — will sync automatically when online'
    : status === 'error' ? 'Sync issue — will retry automatically'
    : isCloudSyncEnabled() ? 'Auto sync ready' : 'Not configured';

  return (
    <section className="card form-card cloud-sync-panel">
      <SectionTitle k="settings.cloudSync" />
      <p className="settings-note">
        {autoSync ? (
          <>
            <Label k="settings.autoSyncOn" variant="compact" />
            {' '}
            Use the same email and password on phone, tablet, or computer — Godaam, sales, and customers stay matched.
          </>
        ) : (
          <Label k="settings.cloudSyncHint" variant="compact" />
        )}
      </p>

      {!autoSync && (
        <>
          <label className="form-field">
            <span className="field-label"><Label k="settings.cloudServerUrl" variant="compact" /></span>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://patiwala.pk"
              inputMode="url"
            />
          </label>
          <p className="settings-note">
            Mobile + laptop must use the same live URL: <code>https://patiwala.pk</code>
          </p>
        </>
      )}

      <div className="cloud-sync-actions">
        {!autoSync && (
          <>
            <button type="button" className="btn primary" onClick={saveUrl}>
              <Label k="settings.saveCloudUrl" variant="compact" />
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setUrl(PRODUCTION_CLOUD_URL);
                useProductionCloudServer();
                showMessage('Live server saved: https://patiwala.pk — tap Sync now on every device.');
              }}
            >
              Use patiwala.pk
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
        <li>Open <strong>https://patiwala.pk</strong> on laptop and phone (same account).</li>
        <li>On the device that has your data, tap <strong>Sync now</strong> once to upload.</li>
        <li>On the other device, open the app or tap Sync now — it downloads the same cloud ledger.</li>
        <li>New sales/purchases auto-save to the cloud (green sync status).</li>
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
