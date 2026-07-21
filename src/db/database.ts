import Dexie, { type EntityTable } from 'dexie';
import {
  attachLedgerSyncHooks,
  clearLocalSyncCursor,
  downloadUserLedgerOnLogin,
  runWithSuppressedAutoPush,
  startLedgerSyncLoop,
  stopLedgerSyncLoop,
  touchLocalLedgerUpdatedAt,
  getLocalLedgerUpdatedAt,
} from '../services/ledgerSync';
import { ensureCloudServerConfigured, isCloudSyncEnabled, useProductionCloudServer } from '../services/cloudConfig';
import type {
  AppSettings,
  Customer,
  Dealer,
  Payment,
  Purchase,
  Sale,
} from '../models/types';

class ChaiKhataDB extends Dexie {
  dealers!: EntityTable<Dealer, 'id'>;
  customers!: EntityTable<Customer, 'id'>;
  purchases!: EntityTable<Purchase, 'id'>;
  sales!: EntityTable<Sale, 'id'>;
  payments!: EntityTable<Payment, 'id'>;
  settings!: EntityTable<AppSettings, 'id'>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      dealers: '++id, name',
      customers: '++id, customerId, name',
      purchases: '++id, date, dealerId, teaName',
      sales: '++id, date, teaName, customerId',
      payments: '++id, date, customerId, dealerId',
      settings: 'id',
    });
    this.version(2).stores({
      dealers: '++id, name',
      customers: '++id, customerId, name',
      purchases: '++id, date, dealerId, teaName',
      sales: '++id, date, teaName, customerId',
      payments: '++id, date, customerId, dealerId',
      settings: 'id',
    });
    this.version(3).stores({
      dealers: '++id, name',
      customers: '++id, customerId, name',
      purchases: '++id, date, dealerId, teaName',
      sales: '++id, date, teaName, customerId',
      payments: '++id, date, customerId, dealerId, saleId, purchaseId',
      settings: 'id',
    });
  }
}

export type { ChaiKhataDB };
export let db: ChaiKhataDB;

let dbGeneration = 0;
const dbListeners = new Set<() => void>();
let initInFlight: Promise<{ syncOk: boolean; syncError?: string; rowCount?: number }> | null = null;
let initUserId: string | null = null;

export function getDbGeneration() {
  return dbGeneration;
}

export function subscribeDbGeneration(listener: () => void) {
  dbListeners.add(listener);
  return () => { dbListeners.delete(listener); };
}

export function bumpDbGeneration() {
  dbGeneration += 1;
  dbListeners.forEach((fn) => fn());
}

export function isDbInitialized(): boolean {
  return Boolean(db);
}

async function openLocalDatabase(userId: string) {
  stopLedgerSyncLoop();
  if (db) {
    try { db.close(); } catch { /* ignore */ }
  }
  db = new ChaiKhataDB(`ChaiKhataDB_${userId}`);
  bumpDbGeneration();

  ensureCloudServerConfigured();
  if (!isCloudSyncEnabled()) {
    useProductionCloudServer();
  }

  await runWithSuppressedAutoPush(async () => {
    await ensureSettings();
  });

  if (!getLocalLedgerUpdatedAt(userId)) {
    touchLocalLedgerUpdatedAt(userId);
  }

  attachLedgerSyncHooks(db, userId);
  startLedgerSyncLoop(db, userId);
}

async function pullCloudLedger(userId: string) {
  if (!isCloudSyncEnabled()) {
    useProductionCloudServer();
  }
  if (!isCloudSyncEnabled()) return { syncOk: true as const, rowCount: 0 };

  clearLocalSyncCursor(userId);
  // Import from cloud + export local so laptop and phone share one database
  let result = await downloadUserLedgerOnLogin(db, userId);
  if (!result.ok) {
    useProductionCloudServer();
    clearLocalSyncCursor(userId);
    result = await downloadUserLedgerOnLogin(db, userId);
  }

  bumpDbGeneration();

  if (!result.ok) {
    console.warn('[Chai Khata] Login sync failed:', result.error);
    return { syncOk: false as const, syncError: result.error, rowCount: 0 };
  }

  return {
    syncOk: true as const,
    rowCount: 'rowCount' in result ? (result.rowCount ?? 0) : 0,
  };
}

/**
 * Open local DB immediately (fast UI), then pull cloud in the same call
 * but callers may set dbReady after open via initUserDatabaseFast.
 * Concurrent calls for the same user share one in-flight init (StrictMode-safe).
 */
export async function initUserDatabase(userId: string): Promise<{ syncOk: boolean; syncError?: string; rowCount?: number }> {
  if (initInFlight && initUserId === userId) {
    return initInFlight;
  }

  initUserId = userId;
  initInFlight = (async () => {
    await openLocalDatabase(userId);
    return pullCloudLedger(userId);
  })().finally(() => {
    initInFlight = null;
    initUserId = null;
  });

  return initInFlight;
}

/** Open IndexedDB only — UI can render while cloud pull continues. */
export async function openUserDatabaseFast(userId: string): Promise<void> {
  if (db?.name === `ChaiKhataDB_${userId}` && isDbInitialized()) {
    return;
  }
  await openLocalDatabase(userId);
}

export async function syncUserDatabaseFromCloud(userId: string) {
  return pullCloudLedger(userId);
}

export async function ensureSettings(): Promise<AppSettings> {
  let settings = await db.settings.get('settings');
  if (!settings) {
    settings = { id: 'settings', lowStockThresholdKg: 50, language: 'ur-roman' };
    await db.settings.put(settings);
  }
  return settings;
}

export function getSettingsQuery(): Promise<AppSettings | undefined> {
  if (!db) return Promise.resolve(undefined);
  return db.settings.get('settings');
}

export async function nextCustomerId(): Promise<string> {
  const count = await db.customers.count();
  return `CUST-${String(count + 1).padStart(4, '0')}`;
}
