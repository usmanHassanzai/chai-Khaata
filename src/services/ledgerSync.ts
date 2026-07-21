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
/** Lite login should finish quickly; full image sync can wait in background */
const SYNC_TIMEOUT_MS = 45000;
const LITE_SYNC_TIMEOUT_MS = 20000;
const PUSH_DEBOUNCE_MS = 40;
const POLL_INTERVAL_MS = 20000;
const FULL_SYNC_EVERY_N_POLLS = 6;

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
let pendingPull = false;
let pendingPullFull = false;
let suppressAutoPush = false;
let syncDb: ChaiKhataDB | null = null;
let pollTick = 0;
let cloudSyncInFlight: Promise<unknown> | null = null;
let pendingFullSync: { db: ChaiKhataDB; userId: string } | null = null;
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

/** Clear sync cursor so the next pull downloads the full cloud ledger. */
export function clearLocalSyncCursor(userId?: string) {
  const id = userId || activeUserId;
  if (id) localStorage.removeItem(ledgerUpdatedAtKey(id));
  localStorage.removeItem(LEGACY_UPDATED_AT_KEY);
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
  pendingPull = false;
  pendingPullFull = false;
  pollTick = 0;
  cloudSyncInFlight = null;
  pendingFullSync = null;
  clearPendingChanges();
  suppressAutoPush = false;
  setStatus('idle');
}

function snapshotRowCount(ledger: LedgerSnapshot | undefined | null) {
  if (!ledger) return 0;
  return (ledger.dealers?.length ?? 0)
    + (ledger.customers?.length ?? 0)
    + (ledger.purchases?.length ?? 0)
    + (ledger.sales?.length ?? 0)
    + (ledger.payments?.length ?? 0);
}

async function syncRequest<T>(
  path: string,
  options: RequestInit & { timeoutMs?: number } = {},
): Promise<{ ok: boolean; status: number; data: T }> {
  const base = getCloudApiUrl();
  if (!base) throw new Error('Cloud sync not configured');

  const token = getStoredToken();
  if (!token) throw new Error('Login required for cloud sync');

  const { timeoutMs, ...fetchOptions } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string> | undefined),
  };
  headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs ?? SYNC_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, { ...fetchOptions, headers, signal: controller.signal });
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
    toArray: () => Promise<T[]>;
  },
  rows: T[],
) {
  // Soft merge only upserts newer server rows.
  // Never delete local-only rows here — they may still be waiting to upload.
  const localRows = await table.toArray();
  const localMap = new Map(localRows.map((row) => [row.id, row]));
  const toPut: T[] = [];

  for (const row of rows) {
    if (row.id == null) continue;
    const local = localMap.get(row.id);
    if (!local || isNewer(rowUpdatedAt(row), rowUpdatedAt(local))) toPut.push(row);
  }

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
  const [dealers, customers, purchases, sales, payments] = await Promise.all([
    db.dealers.count(),
    db.customers.count(),
    db.purchases.count(),
    db.sales.count(),
    db.payments.count(),
  ]);
  return { dealers, customers, purchases, sales, payments };
}

function serverEntityCounts(ledger: LedgerSnapshot) {
  return {
    dealers: ledger.dealers?.length ?? 0,
    customers: ledger.customers?.length ?? 0,
    purchases: ledger.purchases?.length ?? 0,
    sales: ledger.sales?.length ?? 0,
    payments: ledger.payments?.length ?? 0,
  };
}

function serverHasMoreData(local: Awaited<ReturnType<typeof localEntityCounts>>, server: LedgerSnapshot) {
  const remote = serverEntityCounts(server);
  return remote.dealers > local.dealers
    || remote.customers > local.customers
    || remote.purchases > local.purchases
    || remote.sales > local.sales
    || remote.payments > local.payments;
}

function localHasMoreData(local: Awaited<ReturnType<typeof localEntityCounts>>, server: LedgerSnapshot) {
  const remote = serverEntityCounts(server);
  return local.dealers > remote.dealers
    || local.customers > remote.customers
    || local.purchases > remote.purchases
    || local.sales > remote.sales
    || local.payments > remote.payments;
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
  if (pulling) {
    pendingPull = true;
    if (options.useSince === false) pendingPullFull = true;
    return { pulled: false as const, queued: true as const };
  }

  const uid = userId || activeUserId || undefined;
  let useSince = options.useSince !== false;
  pulling = true;
  setStatus('syncing');
  try {
    // Empty local DB must always download full cloud ledger (never trust a stale ?since=)
    const preCounts = await localEntityCounts(db);
    const localEmpty = preCounts.dealers === 0
      && preCounts.customers === 0
      && preCounts.purchases === 0
      && preCounts.sales === 0
      && preCounts.payments === 0;
    if (localEmpty) {
      useSince = false;
      if (uid) clearLocalSyncCursor(uid);
    }

    const res = await syncRequest<{
      empty?: boolean;
      unchanged?: boolean;
      updatedAt?: string;
      ledger?: LedgerSnapshot;
      source?: string;
    }>(buildSyncPath(uid, useSince));

    if (res.data.unchanged) {
      // Stale cursor on empty device — force a real download once
      if (localEmpty) {
        const full = await syncRequest<{
          empty?: boolean;
          unchanged?: boolean;
          updatedAt?: string;
          ledger?: LedgerSnapshot;
        }>('/api/sync/ledger');
        if (full.data.empty || !full.data.ledger) {
          setStatus('synced');
          return { pulled: false as const, empty: true as const };
        }
        await importLedgerSnapshotFull(db, full.data.ledger, uid);
        setStatus('synced');
        return { pulled: true as const, ledger: full.data.ledger };
      }
      if (res.data.updatedAt && uid) {
        localStorage.setItem(ledgerUpdatedAtKey(uid), res.data.updatedAt);
      }
      setStatus('synced');
      return { pulled: false as const, unchanged: true as const };
    }

    if (res.data.empty || !res.data.ledger || snapshotRowCount(res.data.ledger) === 0) {
      setStatus('synced');
      return { pulled: false as const, empty: true as const };
    }

    const localCounts = await localEntityCounts(db);
    const localHasData = localCounts.dealers > 0
      || localCounts.customers > 0
      || localCounts.purchases > 0
      || localCounts.sales > 0
      || localCounts.payments > 0;
    const remoteHasMore = serverHasMoreData(localCounts, res.data.ledger);
    const localRicher = localHasMoreData(localCounts, res.data.ledger);
    const hasPendingLocal = pendingChanges.size > 0;

    // Empty device: full replace. Never wipe a richer local ledger with a smaller cloud copy.
    if (!localHasData) {
      await importLedgerSnapshotFull(db, res.data.ledger, uid);
    } else if (localRicher) {
      await importLedgerSnapshot(db, res.data.ledger, uid);
    } else if (!hasPendingLocal && remoteHasMore) {
      await importLedgerSnapshot(db, res.data.ledger, uid);
    } else {
      await importLedgerSnapshot(db, res.data.ledger, uid);
    }

    setStatus('synced');
    return { pulled: true as const, ledger: res.data.ledger };
  } catch (err) {
    setStatus('offline');
    return { pulled: false as const, error: true as const, message: err instanceof Error ? err.message : 'Pull failed' };
  } finally {
    pulling = false;
    if (pendingPull && syncDb) {
      const forceFull = pendingPullFull;
      pendingPull = false;
      pendingPullFull = false;
      void pullLedgerFromCloud(syncDb, activeUserId || undefined, { useSince: !forceFull });
    }
  }
}

type PushResult =
  | { pushed: false; empty?: true; queued?: true; error?: true; message?: string }
  | { pushed: true; applied?: number; fallback?: true; recovered?: true }
  | { pushed: false; merged: true };

export async function pushLedgerChangesToCloud(userId?: string): Promise<PushResult> {
  if (!isCloudSyncEnabled() || !getStoredToken()) return { pushed: false };
  if (!pendingChanges.size) return { pushed: false, empty: true };

  if (syncing) {
    pendingPush = true;
    return { pushed: false, queued: true };
  }

  const uid = userId || activeUserId || undefined;
  const changes = Array.from(pendingChanges.values());
  syncing = true;
  setStatus('syncing');

  try {
    const res = await syncRequest<{
      accepted: boolean;
      applied?: number;
      skipped?: unknown[];
      updatedAt?: string;
      ledger?: LedgerSnapshot;
    }>('/api/sync/ledger', {
      method: 'PATCH',
      body: JSON.stringify({ changes }),
    });

    const applied = Number(res.data.applied ?? 0);
    const skipped = Array.isArray(res.data.skipped) ? res.data.skipped : [];
    const serverUpdated = res.data.updatedAt || res.data.ledger?.updatedAt;

    // Only clear the queue when something actually landed (or nothing left to retry)
    if (applied > 0 || skipped.length >= changes.length) {
      if (serverUpdated && uid) {
        localStorage.setItem(ledgerUpdatedAtKey(uid), serverUpdated);
      }
      clearPendingChanges();
      setStatus('synced');
      return { pushed: true, applied };
    }

    // Server accepted HTTP but applied nothing — fall through to full snapshot upload
    throw new Error('No row changes applied — uploading full ledger');
  } catch (err) {
    // Full PUT must ignore the pending queue (otherwise we re-enter PATCH forever)
    if (syncDb) {
      syncing = false;
      const fallback: PushResult = await pushLedgerToCloud(syncDb, uid, { forceFull: true });
      if (fallback.pushed || ('merged' in fallback && fallback.merged)) {
        clearPendingChanges();
        setStatus('synced');
        return { pushed: true, applied: changes.length, fallback: true };
      }
      if ('error' in fallback && fallback.error) {
        setStatus('error');
        pendingPush = true;
        return { pushed: false, error: true, message: fallback.message || 'Push failed' };
      }
    }
    setStatus('error');
    pendingPush = true;
    return { pushed: false, error: true, message: err instanceof Error ? err.message : 'Push failed' };
  } finally {
    syncing = false;
    if (pendingPush && syncDb && pendingChanges.size) {
      pendingPush = false;
      void pushLedgerChangesToCloud(activeUserId || undefined);
    }
  }
}

export async function pushLedgerToCloud(
  db: ChaiKhataDB,
  userId?: string,
  options: { forceFull?: boolean } = {},
): Promise<PushResult> {
  if (!isCloudSyncEnabled() || !getStoredToken()) return { pushed: false };

  // Prefer incremental PATCH unless caller forces a full snapshot upload
  if (!options.forceFull && pendingChanges.size) {
    return pushLedgerChangesToCloud(userId);
  }

  if (syncing) {
    pendingPush = true;
    return { pushed: false, queued: true };
  }

  const uid = userId || activeUserId || undefined;
  syncing = true;
  setStatus('syncing');
  try {
    // Snapshot upload must carry a fresh timestamp so the server accepts it
    const snapshot = await exportLocalLedger(db, uid);
    snapshot.updatedAt = new Date().toISOString();

    const res = await syncRequest<{ accepted: boolean; ledger?: LedgerSnapshot }>('/api/sync/ledger', {
      method: 'PUT',
      body: JSON.stringify(snapshot),
    });

    if (res.status === 409 && (res.data as { ledger?: LedgerSnapshot }).ledger) {
      await importLedgerSnapshot(db, (res.data as { ledger: LedgerSnapshot }).ledger, uid);
      // After merging newer cloud data, retry full upload once with a newer stamp
      const retrySnap = await exportLocalLedger(db, uid);
      retrySnap.updatedAt = new Date().toISOString();
      const retry = await syncRequest<{ accepted: boolean; ledger?: LedgerSnapshot }>('/api/sync/ledger', {
        method: 'PUT',
        body: JSON.stringify(retrySnap),
      });
      if (retry.status === 409 && retry.data.ledger) {
        await importLedgerSnapshotFull(db, retry.data.ledger, uid);
        setStatus('synced');
        return { pushed: false, merged: true };
      }
      if (retry.data.ledger?.updatedAt && uid) {
        localStorage.setItem(ledgerUpdatedAtKey(uid), retry.data.ledger.updatedAt);
      }
      clearPendingChanges();
      setStatus('synced');
      return { pushed: true, recovered: true };
    }

    if (res.data.ledger?.updatedAt && uid) {
      localStorage.setItem(ledgerUpdatedAtKey(uid), res.data.ledger.updatedAt);
    } else if (uid) {
      localStorage.setItem(ledgerUpdatedAtKey(uid), snapshot.updatedAt);
    }

    clearPendingChanges();
    setStatus('synced');
    return { pushed: true };
  } catch (err) {
    setStatus('error');
    pendingPush = true;
    return { pushed: false, error: true, message: err instanceof Error ? err.message : 'Push failed' };
  } finally {
    syncing = false;
    if (pendingPush && syncDb && pendingChanges.size) {
      pendingPush = false;
      void pushLedgerChangesToCloud(activeUserId || undefined);
    }
  }
}

export function scheduleLedgerPush(_db: ChaiKhataDB) {
  if (suppressAutoPush || !isCloudSyncEnabled() || !getStoredToken()) return;

  if (pushTimer) clearTimeout(pushTimer);
  // Auto-upload every local change to the cloud database (no manual tap)
  pushTimer = setTimeout(() => {
    void pushLedgerChangesToCloud(activeUserId || undefined).then((result: PushResult) => {
      // If row patch failed, force a full auto upload so other devices still get data
      if (result && 'error' in result && result.error && syncDb) {
        void pushLedgerToCloud(syncDb, activeUserId || undefined, { forceFull: true });
      }
    });
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

type SyncLedgerResult =
  | { ok: true; skipped: true }
  | { ok: true; uploaded?: true; pulled?: boolean; rowCount?: number }
  | { ok: false; error: string };

/**
 * Mobile/laptop login: download THIS user's full cloud ledger (lite = no images, fast).
 * Bypasses quick/since sync so empty phones never stay empty.
 */
export async function downloadUserLedgerOnLogin(
  db: ChaiKhataDB,
  userId: string,
): Promise<SyncLedgerResult> {
  if (!isCloudSyncEnabled() || !getStoredToken()) {
    return { ok: false, error: 'Cloud sync not configured. Open https://patiwala.pk or set Cloud URL.' };
  }

  activeUserId = userId;
  syncDb = db;
  clearPendingChanges();
  clearLocalSyncCursor(userId);
  setStatus('syncing');

  const attempts = 2;
  let lastError = '';

  for (let i = 0; i < attempts; i += 1) {
    try {
      // lite=1 skips heavy receipt images so mobile finishes in seconds
      const res = await syncRequest<{
        empty?: boolean;
        ledger?: LedgerSnapshot;
        lite?: boolean;
      }>('/api/sync/ledger?lite=1', { timeoutMs: LITE_SYNC_TIMEOUT_MS });

      if (res.data.empty || !res.data.ledger || snapshotRowCount(res.data.ledger) === 0) {
        setStatus('synced');
        return { ok: true, pulled: false, rowCount: 0 };
      }

      await importLedgerSnapshotFull(db, res.data.ledger, userId);
      const counts = await localEntityCounts(db);
      const rowCount = counts.dealers + counts.customers + counts.purchases + counts.sales + counts.payments;
      setStatus('synced');
      return { ok: true, pulled: true, rowCount };
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Download failed';
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 400 * (i + 1)));
      }
    }
  }

  setStatus('error');
  return { ok: false, error: lastError || 'Could not download your data from the cloud' };
}

/** Pull cloud data first, then push local changes if needed. Call once after login. */
export async function syncLedgerWithCloud(
  db: ChaiKhataDB,
  userId: string,
  options: { mode?: 'full' | 'quick' } = {},
): Promise<SyncLedgerResult> {
  if (!isCloudSyncEnabled() || !getStoredToken()) return { ok: true, skipped: true };

  const mode = options.mode ?? 'full';

  // Never let a quick sync steal a requested full sync (mobile login)
  if (cloudSyncInFlight) {
    if (mode === 'full') pendingFullSync = { db, userId };
    return cloudSyncInFlight as Promise<SyncLedgerResult>;
  }

  activeUserId = userId;
  syncDb = db;
  migrateLegacyUpdatedAt(userId);

  const run = runWithSuppressedAutoPush(async (): Promise<SyncLedgerResult> => {
    const counts = await localEntityCounts(db);
    const localEmpty = counts.dealers === 0
      && counts.customers === 0
      && counts.purchases === 0
      && counts.sales === 0
      && counts.payments === 0;

    // Empty device (typical mobile login): always download full cloud ledger first
    if (localEmpty) {
      clearPendingChanges();
      clearLocalSyncCursor(userId);

      let pull = await pullLedgerFromCloud(db, userId, { useSince: false });
      if (pull.error) {
        await new Promise((r) => setTimeout(r, 800));
        clearLocalSyncCursor(userId);
        pull = await pullLedgerFromCloud(db, userId, { useSince: false });
      }
      if (pull.error) {
        return { ok: false, error: pull.message || 'Could not download cloud data' };
      }

      if (pull.empty) {
        // Brand-new account — nothing in cloud yet
        return { ok: true, pulled: false, rowCount: 0 };
      }
      return { ok: true, pulled: pull.pulled };
    }

    // Device already has data — push local edits, then pull (full or incremental)
    if (pendingChanges.size) {
      const earlyPush = await pushLedgerChangesToCloud(userId);
      if ('error' in earlyPush && earlyPush.error) {
        const forced = await pushLedgerToCloud(db, userId, { forceFull: true });
        if ('error' in forced && forced.error) {
          return { ok: false, error: forced.message || earlyPush.message || 'Could not upload data to cloud' };
        }
      }
    }

    const pull = await pullLedgerFromCloud(db, userId, { useSince: mode === 'quick' });
    if (pull.error) {
      return { ok: false, error: pull.message || 'Could not download cloud data' };
    }

    if (pull.empty) {
      const push = await pushLedgerToCloud(db, userId, { forceFull: true });
      if ('error' in push && push.error) {
        return { ok: false, error: push.message || 'Could not upload data to cloud' };
      }
      return { ok: true, uploaded: true };
    }

    if (pendingChanges.size) {
      await pushLedgerChangesToCloud(userId);
    } else if (mode === 'full' && pull.ledger) {
      const afterCounts = await localEntityCounts(db);
      if (localHasMoreData(afterCounts, pull.ledger)) {
        const push = await pushLedgerToCloud(db, userId, { forceFull: true });
        if ('error' in push && push.error) {
          return { ok: false, error: push.message || 'Could not upload data to cloud' };
        }
      }
    }

    return { ok: true, pulled: pull.pulled };
  });

  cloudSyncInFlight = run.finally(() => {
    cloudSyncInFlight = null;
    if (pendingFullSync) {
      const next = pendingFullSync;
      pendingFullSync = null;
      void syncLedgerWithCloud(next.db, next.userId, { mode: 'full' });
    }
  });
  return cloudSyncInFlight as Promise<SyncLedgerResult>;
}

export function startLedgerSyncLoop(db: ChaiKhataDB, userId: string) {
  syncDb = db;
  activeUserId = userId;
  pollTick = 0;

  if (pollTimer) clearInterval(pollTimer);
  if (!isCloudSyncEnabled()) return;

  pollTimer = setInterval(() => {
    pollTick += 1;
    const full = pollTick % FULL_SYNC_EVERY_N_POLLS === 0;
    void syncLedgerWithCloud(db, userId, { mode: full ? 'full' : 'quick' });
  }, POLL_INTERVAL_MS);

  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler);
  }
  visibilityHandler = () => {
    if (document.visibilityState === 'visible') {
      void syncLedgerWithCloud(db, userId, { mode: 'quick' });
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
      void syncLedgerWithCloud(syncDb, activeUserId, { mode: 'full' });
    };
    window.addEventListener('online', onlineHandler);
  }
}

export function stopLedgerSyncLoop() {
  resetLedgerSyncState();
}

/** @deprecated use stopLedgerSyncLoop */
export { stopLedgerSyncLoop as resetLedgerSync };
