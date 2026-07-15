import type { ChaiKhataDB } from '../db/database';
import { getStoredToken } from './authCommon';
import { getCloudApiUrl, isCloudSyncEnabled } from './cloudConfig';

export type LedgerSnapshot = {
  updatedAt: string;
  dealers: import('../models/types').Dealer[];
  customers: import('../models/types').Customer[];
  purchases: import('../models/types').Purchase[];
  sales: import('../models/types').Sale[];
  payments: import('../models/types').Payment[];
  settings: import('../models/types').AppSettings[];
};

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

const LEGACY_UPDATED_AT_KEY = 'chai-khata-ledger-updated-at';
const SYNC_TIMEOUT_MS = 45000;
const PUSH_DEBOUNCE_MS = 500;

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let visibilityHandler: (() => void) | null = null;
let onlineHandler: (() => void) | null = null;
let pageHideHandler: (() => void) | null = null;
let attachedDbName: string | null = null;
let activeUserId: string | null = null;
let statusListeners = new Set<(s: SyncStatus) => void>();
let lastStatus: SyncStatus = 'idle';
let syncing = false;
let pendingPush = false;
let suppressAutoPush = false;
let syncDb: ChaiKhataDB | null = null;

function ledgerUpdatedAtKey(userId: string) {
  return `chai-khata-ledger-updated-at-${userId}`;
}

function migrateLegacyUpdatedAt(userId: string) {
  const key = ledgerUpdatedAtKey(userId);
  if (localStorage.getItem(key)) return;
  const legacy = localStorage.getItem(LEGACY_UPDATED_AT_KEY);
  if (legacy) localStorage.setItem(key, legacy);
}

export function hasPendingSyncPush(): boolean {
  return pendingPush;
}

export function onSyncStatus(listener: (status: SyncStatus) => void) {
  statusListeners.add(listener);
  listener(lastStatus);
  return () => {
    statusListeners.delete(listener);
  };
}

function setStatus(status: SyncStatus) {
  lastStatus = status;
  statusListeners.forEach((fn) => fn(status));
}

export function getLocalLedgerUpdatedAt(userId?: string): string {
  if (userId) migrateLegacyUpdatedAt(userId);
  const id = userId || activeUserId;
  if (!id) return localStorage.getItem(LEGACY_UPDATED_AT_KEY) || '';
  return localStorage.getItem(ledgerUpdatedAtKey(id)) || '';
}

export function touchLocalLedgerUpdatedAt(userId?: string) {
  const id = userId || activeUserId;
  const ts = new Date().toISOString();
  if (!id) {
    localStorage.setItem(LEGACY_UPDATED_AT_KEY, ts);
    return ts;
  }
  localStorage.setItem(ledgerUpdatedAtKey(id), ts);
  return ts;
}

/** Prevent auto-push while importing cloud snapshot (avoids duplicate/wrong uploads). */
export async function runWithSuppressedAutoPush<T>(fn: () => Promise<T>): Promise<T> {
  suppressAutoPush = true;
  try {
    return await fn();
  } finally {
    suppressAutoPush = false;
  }
}

export function resetLedgerSyncState() {
  if (pushTimer) clearTimeout(pushTimer);
  if (pollTimer) clearInterval(pollTimer);
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler);
    visibilityHandler = null;
  }
  if (pageHideHandler) {
    window.removeEventListener('pagehide', pageHideHandler);
    pageHideHandler = null;
  }
  if (onlineHandler) {
    window.removeEventListener('online', onlineHandler);
    onlineHandler = null;
  }
  pushTimer = null;
  pollTimer = null;
  attachedDbName = null;
  activeUserId = null;
  syncDb = null;
  syncing = false;
  pendingPush = false;
  suppressAutoPush = false;
  setStatus('idle');
}

async function syncRequest<T>(path: string, options: RequestInit = {}): Promise<{ ok: boolean; status: number; data: T }> {
  const base = getCloudApiUrl();
  if (!base) throw new Error('Cloud sync not configured');

  const token = getStoredToken();
  if (!token) throw new Error('Login required for cloud sync');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, { ...options, headers, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }

  const text = await res.text();
  let data = {} as T;
  if (text) {
    try {
      data = JSON.parse(text) as T;
    } catch {
      throw new Error(`Invalid sync response (${res.status})`);
    }
  }

  if (!res.ok && res.status !== 409) {
    const msg = (data as Record<string, unknown>).message as string;
    throw new Error(msg || `Sync failed (${res.status})`);
  }

  return { ok: res.ok, status: res.status, data };
}

export async function exportLocalLedger(db: ChaiKhataDB, userId?: string): Promise<LedgerSnapshot> {
  const [dealers, customers, purchases, sales, payments, settings] = await Promise.all([
    db.dealers.toArray(),
    db.customers.toArray(),
    db.purchases.toArray(),
    db.sales.toArray(),
    db.payments.toArray(),
    db.settings.toArray(),
  ]);

  const uid = userId || activeUserId || undefined;
  return {
    updatedAt: getLocalLedgerUpdatedAt(uid) || touchLocalLedgerUpdatedAt(uid),
    dealers,
    customers,
    purchases,
    sales,
    payments,
    settings,
  };
}

export async function importLedgerSnapshot(db: ChaiKhataDB, snapshot: LedgerSnapshot, userId?: string) {
  await runWithSuppressedAutoPush(async () => {
    await db.transaction(
      'rw',
      [db.dealers, db.customers, db.purchases, db.sales, db.payments, db.settings],
      async () => {
        await db.dealers.clear();
        await db.customers.clear();
        await db.purchases.clear();
        await db.sales.clear();
        await db.payments.clear();
        await db.settings.clear();

        if (snapshot.dealers.length) await db.dealers.bulkPut(snapshot.dealers);
        if (snapshot.customers.length) await db.customers.bulkPut(snapshot.customers);
        if (snapshot.purchases.length) await db.purchases.bulkPut(snapshot.purchases);
        if (snapshot.sales.length) await db.sales.bulkPut(snapshot.sales);
        if (snapshot.payments.length) await db.payments.bulkPut(snapshot.payments);
        if (snapshot.settings.length) await db.settings.bulkPut(snapshot.settings);
      },
    );
  });

  const uid = userId || activeUserId;
  if (snapshot.updatedAt && uid) {
    localStorage.setItem(ledgerUpdatedAtKey(uid), snapshot.updatedAt);
  }
}

export async function pullLedgerFromCloud(db: ChaiKhataDB, userId?: string) {
  if (!isCloudSyncEnabled() || !getStoredToken()) return { pulled: false as const };

  const uid = userId || activeUserId || undefined;
  setStatus('syncing');
  try {
    const res = await syncRequest<{ empty?: boolean; ledger?: LedgerSnapshot }>('/api/sync/ledger');

    if (res.data.empty || !res.data.ledger) {
      setStatus('synced');
      return { pulled: false as const, empty: true as const };
    }

    const serverUpdated = res.data.ledger.updatedAt || '';
    const localUpdated = getLocalLedgerUpdatedAt(uid);

    if (!localUpdated || new Date(serverUpdated).getTime() > new Date(localUpdated).getTime()) {
      await importLedgerSnapshot(db, res.data.ledger, uid);
      setStatus('synced');
      return { pulled: true as const, ledger: res.data.ledger };
    }

    setStatus('synced');
    return { pulled: false as const };
  } catch (err) {
    setStatus('offline');
    return { pulled: false as const, error: true as const, message: err instanceof Error ? err.message : 'Pull failed' };
  }
}

export async function pushLedgerToCloud(db: ChaiKhataDB, userId?: string) {
  if (!isCloudSyncEnabled() || !getStoredToken()) return { pushed: false as const };

  if (syncing) {
    pendingPush = true;
    return { pushed: false as const, queued: true as const };
  }

  const uid = userId || activeUserId || undefined;
  syncing = true;
  setStatus('syncing');
  try {
    const snapshot = await exportLocalLedger(db, uid);
    snapshot.updatedAt = touchLocalLedgerUpdatedAt(uid);

    const res = await syncRequest<{ accepted: boolean; ledger?: LedgerSnapshot }>('/api/sync/ledger', {
      method: 'PUT',
      body: JSON.stringify(snapshot),
    });

    if (res.status === 409 && (res.data as { ledger?: LedgerSnapshot }).ledger) {
      await importLedgerSnapshot(db, (res.data as { ledger: LedgerSnapshot }).ledger, uid);
      setStatus('synced');
      return { pushed: false as const, merged: true as const };
    }

    if (res.data.ledger?.updatedAt && uid) {
      localStorage.setItem(ledgerUpdatedAtKey(uid), res.data.ledger.updatedAt);
    }

    setStatus('synced');
    return { pushed: true as const };
  } catch (err) {
    setStatus('error');
    pendingPush = true;
    return { pushed: false as const, error: true as const, message: err instanceof Error ? err.message : 'Push failed' };
  } finally {
    syncing = false;
    if (pendingPush && syncDb) {
      pendingPush = false;
      void pushLedgerToCloud(syncDb, activeUserId || undefined);
    }
  }
}

export function scheduleLedgerPush(db: ChaiKhataDB) {
  if (suppressAutoPush || !isCloudSyncEnabled() || !getStoredToken()) return;

  touchLocalLedgerUpdatedAt(activeUserId || undefined);
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    void pushLedgerToCloud(db);
  }, PUSH_DEBOUNCE_MS);
}

/** Flush pending changes to Supabase immediately (e.g. when app goes to background). */
export function flushLedgerPushNow() {
  if (!syncDb || suppressAutoPush) return;
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  void pushLedgerToCloud(syncDb, activeUserId || undefined);
}

export function attachLedgerSyncHooks(db: ChaiKhataDB, userId: string) {
  if (attachedDbName === db.name) return;
  attachedDbName = db.name;
  activeUserId = userId;
  syncDb = db;
  migrateLegacyUpdatedAt(userId);

  const tables = [db.dealers, db.customers, db.purchases, db.sales, db.payments, db.settings];
  for (const table of tables) {
    // Post-commit hooks — data is saved locally before we push to Supabase
    table.hook('creating', () => { scheduleLedgerPush(db); });
    table.hook('updating', () => { scheduleLedgerPush(db); });
    table.hook('deleting', () => { scheduleLedgerPush(db); });
  }
}

/** Pull cloud data first, then push local changes if needed. Call once after login. */
export async function syncLedgerWithCloud(db: ChaiKhataDB, userId: string) {
  if (!isCloudSyncEnabled() || !getStoredToken()) return { ok: true as const, skipped: true as const };

  activeUserId = userId;
  syncDb = db;
  migrateLegacyUpdatedAt(userId);

  return runWithSuppressedAutoPush(async () => {
    const pull = await pullLedgerFromCloud(db, userId);
    if (pull.error) {
      return { ok: false as const, error: pull.message || 'Could not download cloud data' };
    }

    if (pull.empty) {
      const push = await pushLedgerToCloud(db, userId);
      if (push.error) {
        return { ok: false as const, error: push.message || 'Could not upload data to cloud' };
      }
      return { ok: true as const, uploaded: true as const };
    }

    if (!pull.pulled) {
      const push = await pushLedgerToCloud(db, userId);
      if (push.error && !push.merged) {
        return { ok: false as const, error: push.message || 'Could not upload data to cloud' };
      }
    }

    return { ok: true as const, pulled: pull.pulled };
  });
}

export function startLedgerSyncLoop(db: ChaiKhataDB, userId: string) {
  syncDb = db;
  activeUserId = userId;

  if (pollTimer) clearInterval(pollTimer);
  if (!isCloudSyncEnabled()) return;

  pollTimer = setInterval(() => {
    void pullLedgerFromCloud(db, userId);
    if (pendingPush) void pushLedgerToCloud(db, userId);
  }, 12000);

  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler);
  }
  visibilityHandler = () => {
    if (document.visibilityState === 'visible') {
      void syncLedgerWithCloud(db, userId);
    } else {
      flushLedgerPushNow();
    }
  };
  document.addEventListener('visibilitychange', visibilityHandler);

  if (pageHideHandler) {
    window.removeEventListener('pagehide', pageHideHandler);
  }
  pageHideHandler = () => { flushLedgerPushNow(); };
  window.addEventListener('pagehide', pageHideHandler);

  if (!onlineHandler) {
    onlineHandler = () => {
      if (!syncDb || !activeUserId) return;
      void syncLedgerWithCloud(syncDb, activeUserId);
      flushLedgerPushNow();
    };
    window.addEventListener('online', onlineHandler);
  }
}

export function stopLedgerSyncLoop() {
  resetLedgerSyncState();
}

/** @deprecated use stopLedgerSyncLoop */
export { stopLedgerSyncLoop as resetLedgerSync };
