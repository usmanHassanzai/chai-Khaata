import type { ChaiKhataDB } from '../db/database';
import type {
  AppSettings,
  Customer,
  Dealer,
  Payment,
  Purchase,
  Sale,
} from '../models/types';
import { getStoredToken } from './authCommon';
import { getCloudApiUrl, isCloudSyncEnabled } from './cloudConfig';

export type LedgerSnapshot = {
  updatedAt: string;
  dealers: Dealer[];
  customers: Customer[];
  purchases: Purchase[];
  sales: Sale[];
  payments: Payment[];
  settings: AppSettings[];
};

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

type LedgerEntity = keyof LedgerSnapshot;
type SyncableEntity = Exclude<LedgerEntity, 'updatedAt'>;

type LedgerChange =
  | { table: SyncableEntity; op: 'upsert'; row: Record<string, unknown>; updatedAt: string }
  | { table: SyncableEntity; op: 'delete'; id: number | string; updatedAt: string };

const LEGACY_UPDATED_AT_KEY = 'chai-khata-ledger-updated-at';
const SYNC_TIMEOUT_MS = 30000;
const PUSH_DEBOUNCE_MS = 100;
const POLL_INTERVAL_MS = 20000;

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
let pulling = false;
let pendingPush = false;
let suppressAutoPush = false;
let syncDb: ChaiKhataDB | null = null;
const pendingChanges = new Map<string, LedgerChange>();

function ledgerUpdatedAtKey(userId: string) {
  return `chai-khata-ledger-updated-at-${userId}`;
}

function migrateLegacyUpdatedAt(userId: string) {
  const key = ledgerUpdatedAtKey(userId);
  if (localStorage.getItem(key)) return;
  const legacy = localStorage.getItem(LEGACY_UPDATED_AT_KEY);
  if (legacy) localStorage.setItem(key, legacy);
}

function changeKey(change: LedgerChange) {
  const id = change.op === 'delete' ? change.id : change.row.id ?? 'settings';
  return `${change.table}:${id}:${change.op}`;
}

function queueChange(change: LedgerChange) {
  pendingChanges.set(changeKey(change), change);
  pendingPush = true;
}

function clearPendingChanges() {
  pendingChanges.clear();
  pendingPush = false;
}

function rowUpdatedAt(row: { updatedAt?: string } | undefined) {
  return row?.updatedAt || '';
}

function isNewer(incoming: string | undefined, existing: string | undefined) {
  if (!incoming) return false;
  if (!existing) return true;
  return new Date(incoming).getTime() > new Date(existing).getTime();
}

export function hasPendingSyncPush(): boolean {
  return pendingPush || pendingChanges.size > 0;
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

/** Prevent auto-push while importing cloud data (avoids duplicate/wrong uploads). */
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
  pulling = false;
  clearPendingChanges();
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

async function mergeRows<T extends { id?: number; updatedAt?: string }>(
  table: {
    bulkPut: (rows: T[]) => Promise<unknown>;
    bulkDelete: (keys: number[]) => Promise<void>;
    toArray: () => Promise<T[]>;
  },
  rows: T[],
) {
  const serverIds = new Set(rows.map((row) => row.id).filter((id): id is number => id != null));
  const localRows = await table.toArray();
  const localMap = new Map(localRows.map((row) => [row.id, row]));
  const deleteIds: number[] = [];
  const toPut: T[] = [];

  for (const local of localRows) {
    if (local.id != null && !serverIds.has(local.id)) deleteIds.push(local.id);
  }

  for (const row of rows) {
    if (row.id == null) continue;
    const local = localMap.get(row.id);
    if (!local || isNewer(rowUpdatedAt(row), rowUpdatedAt(local))) toPut.push(row);
  }

  if (deleteIds.length) await table.bulkDelete(deleteIds);
  if (toPut.length) await table.bulkPut(toPut);
}

async function mergeSettings(db: ChaiKhataDB, rows: AppSettings[]) {
  const incoming = rows[0];
  if (!incoming) return;
  const local = await db.settings.get('settings');
  if (!local || isNewer(rowUpdatedAt(incoming), rowUpdatedAt(local))) {
    await db.settings.put(incoming);
  }
}

export async function importLedgerSnapshot(db: ChaiKhataDB, snapshot: LedgerSnapshot, userId?: string) {
  await runWithSuppressedAutoPush(async () => {
    await mergeRows(db.dealers, snapshot.dealers);
    await mergeRows(db.customers, snapshot.customers);
    await mergeRows(db.purchases, snapshot.purchases);
    await mergeRows(db.sales, snapshot.sales);
    await mergeRows(db.payments, snapshot.payments);
    await mergeSettings(db, snapshot.settings);
  });

  const uid = userId || activeUserId;
  if (snapshot.updatedAt && uid) {
    localStorage.setItem(ledgerUpdatedAtKey(uid), snapshot.updatedAt);
  }
}

export async function importLedgerSnapshotFull(db: ChaiKhataDB, snapshot: LedgerSnapshot, userId?: string) {
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

async function localEntityCounts(db: ChaiKhataDB) {
  const [dealers, customers, purchases, sales] = await Promise.all([
    db.dealers.count(),
    db.customers.count(),
    db.purchases.count(),
    db.sales.count(),
  ]);
  return { dealers, customers, purchases, sales };
}

function serverEntityCounts(ledger: LedgerSnapshot) {
  return {
    dealers: ledger.dealers?.length ?? 0,
    customers: ledger.customers?.length ?? 0,
    purchases: ledger.purchases?.length ?? 0,
    sales: ledger.sales?.length ?? 0,
  };
}

function serverHasMoreData(local: Awaited<ReturnType<typeof localEntityCounts>>, server: LedgerSnapshot) {
  const remote = serverEntityCounts(server);
  return remote.dealers > local.dealers
    || remote.customers > local.customers
    || remote.purchases > local.purchases
    || remote.sales > local.sales;
}

function buildSyncPath(userId?: string, useSince = true) {
  if (!useSince) return '/api/sync/ledger';
  const since = getLocalLedgerUpdatedAt(userId);
  if (!since) return '/api/sync/ledger';
  return `/api/sync/ledger?since=${encodeURIComponent(since)}`;
}

export async function pullLedgerFromCloud(
  db: ChaiKhataDB,
  userId?: string,
  options: { useSince?: boolean } = {},
) {
  if (!isCloudSyncEnabled() || !getStoredToken()) return { pulled: false as const };
  if (pulling) return { pulled: false as const, queued: true as const };

  const uid = userId || activeUserId || undefined;
  const useSince = options.useSince !== false;
  pulling = true;
  setStatus('syncing');
  try {
    const res = await syncRequest<{
      empty?: boolean;
      unchanged?: boolean;
      updatedAt?: string;
      ledger?: LedgerSnapshot;
      source?: string;
    }>(buildSyncPath(uid, useSince));

    if (res.data.unchanged) {
      if (res.data.updatedAt && uid) {
        localStorage.setItem(ledgerUpdatedAtKey(uid), res.data.updatedAt);
      }
      setStatus('synced');
      return { pulled: false as const, unchanged: true as const };
    }

    if (res.data.empty || !res.data.ledger) {
      setStatus('synced');
      return { pulled: false as const, empty: true as const };
    }

    const serverUpdated = res.data.ledger.updatedAt || '';
    const localUpdated = getLocalLedgerUpdatedAt(uid);
    const localCounts = await localEntityCounts(db);
    const localHasData = localCounts.dealers > 0
      || localCounts.customers > 0
      || localCounts.purchases > 0
      || localCounts.sales > 0;
    const remoteHasMore = serverHasMoreData(localCounts, res.data.ledger);

    if (!localHasData || remoteHasMore) {
      await importLedgerSnapshotFull(db, res.data.ledger, uid);
      setStatus('synced');
      return { pulled: true as const, ledger: res.data.ledger };
    }

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
  } finally {
    pulling = false;
  }
}

export async function pushLedgerChangesToCloud(userId?: string) {
  if (!isCloudSyncEnabled() || !getStoredToken()) return { pushed: false as const };
  if (!pendingChanges.size) return { pushed: false as const, empty: true as const };

  if (syncing) {
    pendingPush = true;
    return { pushed: false as const, queued: true as const };
  }

  const uid = userId || activeUserId || undefined;
  const changes = Array.from(pendingChanges.values());
  syncing = true;
  setStatus('syncing');

  try {
    const res = await syncRequest<{
      accepted: boolean;
      applied?: number;
      updatedAt?: string;
      ledger?: LedgerSnapshot;
    }>('/api/sync/ledger', {
      method: 'PATCH',
      body: JSON.stringify({ changes }),
    });

    const serverUpdated = res.data.updatedAt || res.data.ledger?.updatedAt;
    if (serverUpdated && uid) {
      localStorage.setItem(ledgerUpdatedAtKey(uid), serverUpdated);
    }

    clearPendingChanges();
    setStatus('synced');
    return { pushed: true as const, applied: res.data.applied ?? changes.length };
  } catch (err) {
    if (syncDb) {
      const fallback = await pushLedgerToCloud(syncDb, uid);
      if (fallback.pushed || ('merged' in fallback && fallback.merged)) {
        clearPendingChanges();
        setStatus('synced');
        return { pushed: true as const, applied: changes.length, fallback: true as const };
      }
    }
    setStatus('error');
    pendingPush = true;
    return { pushed: false as const, error: true as const, message: err instanceof Error ? err.message : 'Push failed' };
  } finally {
    syncing = false;
    if (pendingPush && syncDb && pendingChanges.size) {
      pendingPush = false;
      void pushLedgerChangesToCloud(activeUserId || undefined);
    }
  }
}

export async function pushLedgerToCloud(db: ChaiKhataDB, userId?: string) {
  if (!isCloudSyncEnabled() || !getStoredToken()) return { pushed: false as const };

  if (pendingChanges.size) {
    return pushLedgerChangesToCloud(userId);
  }

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
      void pushLedgerChangesToCloud(activeUserId || undefined);
    }
  }
}

export function scheduleLedgerPush(_db: ChaiKhataDB) {
  if (suppressAutoPush || !isCloudSyncEnabled() || !getStoredToken()) return;

  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    void pushLedgerChangesToCloud(activeUserId || undefined);
  }, PUSH_DEBOUNCE_MS);
}

/** Flush pending changes to Supabase immediately (e.g. when app goes to background). */
export function flushLedgerPushNow() {
  if (!syncDb || suppressAutoPush) return;
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  void pushLedgerChangesToCloud(activeUserId || undefined);
}

function attachTableHooks<T extends { id?: number; updatedAt?: string }>(
  table: {
    hook: (event: string, handler: (...args: unknown[]) => void) => void;
    get: (id: number) => Promise<T | undefined>;
  },
  tableName: SyncableEntity,
  db: ChaiKhataDB,
) {
  table.hook('creating', function (this: { onsuccess?: (key: number) => void }, _primKey, obj) {
    const row = obj as T;
    const updatedAt = new Date().toISOString();
    row.updatedAt = updatedAt;
    this.onsuccess = (key: number) => {
      queueChange({
        table: tableName,
        op: 'upsert',
        row: { ...(row as Record<string, unknown>), id: key },
        updatedAt,
      });
      scheduleLedgerPush(db);
    };
  });

  table.hook('updating', function (
    this: { onsuccess?: (updated: number) => void },
    mods,
    primKey,
    obj,
  ) {
    const changes = mods as Partial<T>;
    const updatedAt = new Date().toISOString();
    changes.updatedAt = updatedAt;
    this.onsuccess = () => {
      const merged = { ...(obj as T), ...changes, id: primKey as number };
      queueChange({
        table: tableName,
        op: 'upsert',
        row: merged as Record<string, unknown>,
        updatedAt,
      });
      scheduleLedgerPush(db);
    };
  });

  table.hook('deleting', function (
    this: { onsuccess?: () => void },
    primKey,
  ) {
    const updatedAt = new Date().toISOString();
    this.onsuccess = () => {
      queueChange({
        table: tableName,
        op: 'delete',
        id: primKey as number,
        updatedAt,
      });
      scheduleLedgerPush(db);
    };
  });
}

function attachSettingsHooks(db: ChaiKhataDB) {
  const settingsTable = db.settings as {
    hook: (event: string, handler: (...args: unknown[]) => void) => void;
  };

  settingsTable.hook('creating', function (this: { onsuccess?: () => void }, _primKey, obj) {
    const row = obj as AppSettings;
    const updatedAt = new Date().toISOString();
    row.updatedAt = updatedAt;
    this.onsuccess = () => {
      queueChange({
        table: 'settings',
        op: 'upsert',
        row: { ...row } as Record<string, unknown>,
        updatedAt,
      });
      scheduleLedgerPush(db);
    };
  });

  settingsTable.hook('updating', function (
    this: { onsuccess?: () => void },
    mods,
    _primKey,
    obj,
  ) {
    const changes = mods as Partial<AppSettings>;
    const updatedAt = new Date().toISOString();
    changes.updatedAt = updatedAt;
    this.onsuccess = () => {
      const merged = { ...(obj as AppSettings), ...changes };
      queueChange({
        table: 'settings',
        op: 'upsert',
        row: { ...merged } as Record<string, unknown>,
        updatedAt,
      });
      scheduleLedgerPush(db);
    };
  });
}

export function attachLedgerSyncHooks(db: ChaiKhataDB, userId: string) {
  if (attachedDbName === db.name) return;
  attachedDbName = db.name;
  activeUserId = userId;
  syncDb = db;
  migrateLegacyUpdatedAt(userId);

  attachTableHooks(db.dealers, 'dealers', db);
  attachTableHooks(db.customers, 'customers', db);
  attachTableHooks(db.purchases, 'purchases', db);
  attachTableHooks(db.sales, 'sales', db);
  attachTableHooks(db.payments, 'payments', db);
  attachSettingsHooks(db);
}

/** Pull cloud data first, then push local changes if needed. Call once after login. */
export async function syncLedgerWithCloud(db: ChaiKhataDB, userId: string) {
  if (!isCloudSyncEnabled() || !getStoredToken()) return { ok: true as const, skipped: true as const };

  activeUserId = userId;
  syncDb = db;
  migrateLegacyUpdatedAt(userId);

  return runWithSuppressedAutoPush(async () => {
    const pull = await pullLedgerFromCloud(db, userId, { useSince: false });
    if (pull.error) {
      return { ok: false as const, error: pull.message || 'Could not download cloud data' };
    }

    if (pull.empty) {
      const push = await pushLedgerToCloud(db, userId);
      if ('error' in push && push.error) {
        return { ok: false as const, error: push.message || 'Could not upload data to cloud' };
      }
      return { ok: true as const, uploaded: true as const };
    }

    if (pendingChanges.size) {
      const push = await pushLedgerChangesToCloud(userId);
      if ('error' in push && push.error) {
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
    void pullLedgerFromCloud(db, userId, { useSince: true });
    if (pendingChanges.size || pendingPush) void pushLedgerChangesToCloud(userId);
  }, POLL_INTERVAL_MS);

  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler);
  }
  visibilityHandler = () => {
    if (document.visibilityState === 'visible') {
      void pullLedgerFromCloud(db, userId, { useSince: true });
      if (pendingChanges.size || pendingPush) void pushLedgerChangesToCloud(userId);
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
      void pullLedgerFromCloud(syncDb, activeUserId, { useSince: true });
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
