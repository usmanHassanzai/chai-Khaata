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

const UPDATED_AT_KEY = 'chai-khata-ledger-updated-at';
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let hooksAttached = false;
let statusListeners = new Set<(s: SyncStatus) => void>();
let lastStatus: SyncStatus = 'idle';
let syncing = false;

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

export function getLocalLedgerUpdatedAt(): string {
  return localStorage.getItem(UPDATED_AT_KEY) || '';
}

export function touchLocalLedgerUpdatedAt() {
  const ts = new Date().toISOString();
  localStorage.setItem(UPDATED_AT_KEY, ts);
  return ts;
}

async function syncRequest<T>(path: string, options: RequestInit = {}): Promise<{ ok: boolean; status: number; data: T }> {
  const base = getCloudApiUrl();
  if (!base) throw new Error('Cloud sync not configured');

  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
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
    throw new Error((data as Record<string, unknown>).message as string || `Sync failed (${res.status})`);
  }

  return { ok: res.ok, status: res.status, data };
}

export async function exportLocalLedger(db: ChaiKhataDB): Promise<LedgerSnapshot> {
  const [dealers, customers, purchases, sales, payments, settings] = await Promise.all([
    db.dealers.toArray(),
    db.customers.toArray(),
    db.purchases.toArray(),
    db.sales.toArray(),
    db.payments.toArray(),
    db.settings.toArray(),
  ]);

  return {
    updatedAt: getLocalLedgerUpdatedAt() || touchLocalLedgerUpdatedAt(),
    dealers,
    customers,
    purchases,
    sales,
    payments,
    settings,
  };
}

export async function importLedgerSnapshot(db: ChaiKhataDB, snapshot: LedgerSnapshot) {
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

  if (snapshot.updatedAt) {
    localStorage.setItem(UPDATED_AT_KEY, snapshot.updatedAt);
  }
}

export async function pullLedgerFromCloud(db: ChaiKhataDB) {
  if (!isCloudSyncEnabled() || !getStoredToken()) return { pulled: false as const };

  setStatus('syncing');
  try {
    const res = await syncRequest<{ empty?: boolean; ledger?: LedgerSnapshot }>('/api/sync/ledger');

    if (res.data.empty || !res.data.ledger) {
      setStatus('synced');
      return { pulled: false as const, empty: true as const };
    }

    const serverUpdated = res.data.ledger.updatedAt || '';
    const localUpdated = getLocalLedgerUpdatedAt();

    if (!localUpdated || new Date(serverUpdated).getTime() > new Date(localUpdated).getTime()) {
      await importLedgerSnapshot(db, res.data.ledger);
      setStatus('synced');
      return { pulled: true as const, ledger: res.data.ledger };
    }

    setStatus('synced');
    return { pulled: false as const };
  } catch {
    setStatus('offline');
    return { pulled: false as const, error: true as const };
  }
}

export async function pushLedgerToCloud(db: ChaiKhataDB) {
  if (!isCloudSyncEnabled() || !getStoredToken() || syncing) return { pushed: false as const };

  syncing = true;
  setStatus('syncing');
  try {
    const snapshot = await exportLocalLedger(db);
    snapshot.updatedAt = touchLocalLedgerUpdatedAt();

    const res = await syncRequest<{ accepted: boolean; ledger?: LedgerSnapshot }>('/api/sync/ledger', {
      method: 'PUT',
      body: JSON.stringify(snapshot),
    });

    if (res.status === 409 && (res.data as { ledger?: LedgerSnapshot }).ledger) {
      await importLedgerSnapshot(db, (res.data as { ledger: LedgerSnapshot }).ledger);
      setStatus('synced');
      return { pushed: false as const, merged: true as const };
    }

    if (res.data.ledger?.updatedAt) {
      localStorage.setItem(UPDATED_AT_KEY, res.data.ledger.updatedAt);
    }

    setStatus('synced');
    return { pushed: true as const };
  } catch {
    setStatus('error');
    return { pushed: false as const, error: true as const };
  } finally {
    syncing = false;
  }
}

export function scheduleLedgerPush(db: ChaiKhataDB) {
  if (!isCloudSyncEnabled() || !getStoredToken()) return;

  touchLocalLedgerUpdatedAt();
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    void pushLedgerToCloud(db);
  }, 1500);
}

export function attachLedgerSyncHooks(db: ChaiKhataDB) {
  if (hooksAttached) return;
  hooksAttached = true;

  const tables = [db.dealers, db.customers, db.purchases, db.sales, db.payments, db.settings];
  for (const table of tables) {
    table.hook('creating', () => { scheduleLedgerPush(db); });
    table.hook('updating', () => { scheduleLedgerPush(db); });
    table.hook('deleting', () => { scheduleLedgerPush(db); });
  }
}

export async function syncLedgerWithCloud(db: ChaiKhataDB) {
  if (!isCloudSyncEnabled() || !getStoredToken()) return;

  const pull = await pullLedgerFromCloud(db);
  if (pull.empty) {
    await pushLedgerToCloud(db);
    return;
  }
  if (!pull.pulled) {
    await pushLedgerToCloud(db);
  }
}

export function startLedgerSyncLoop(db: ChaiKhataDB) {
  if (pollTimer) clearInterval(pollTimer);
  if (!isCloudSyncEnabled()) return;

  pollTimer = setInterval(() => {
    void pullLedgerFromCloud(db);
  }, 20000);

  const onVisible = () => {
    if (document.visibilityState === 'visible') {
      void syncLedgerWithCloud(db);
    }
  };
  document.addEventListener('visibilitychange', onVisible);
}

export function stopLedgerSyncLoop() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  hooksAttached = false;
}
