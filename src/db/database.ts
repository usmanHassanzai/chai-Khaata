import Dexie, { type EntityTable } from 'dexie';
import {
  attachLedgerSyncHooks,
  clearLocalSyncCursor,
  downloadUserLedgerOnLogin,
  runWithSuppressedAutoPush,
  startLedgerSyncLoop,
  stopLedgerSyncLoop,
  syncLedgerWithCloud,
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

export function isDbInitialized(): boolean {
  return Boolean(db);
}

export async function initUserDatabase(userId: string): Promise<{ syncOk: boolean; syncError?: string; rowCount?: number }> {
  stopLedgerSyncLoop();

  if (db) {
    db.close();
  }

  db = new ChaiKhataDB(`ChaiKhataDB_${userId}`);

  // Always prefer live cloud for phone/laptop shared data
  ensureCloudServerConfigured();
  if (!isCloudSyncEnabled()) {
    useProductionCloudServer();
  }

  if (!isCloudSyncEnabled()) {
    await ensureSettings();
    if (!getLocalLedgerUpdatedAt(userId)) {
      touchLocalLedgerUpdatedAt(userId);
    }
    return { syncOk: true, rowCount: 0 };
  }

  clearLocalSyncCursor(userId);

  // 1) Fast login download (no receipt images) — this is what fills empty mobile screens
  let result = await downloadUserLedgerOnLogin(db, userId);

  // 2) If download failed, force production URL and retry
  if (!result.ok) {
    useProductionCloudServer();
    clearLocalSyncCursor(userId);
    result = await downloadUserLedgerOnLogin(db, userId);
  }

  // 3) Settings after import
  await runWithSuppressedAutoPush(async () => {
    await ensureSettings();
  });

  // 4) Hooks + background sync only after login data is loaded
  attachLedgerSyncHooks(db, userId);
  startLedgerSyncLoop(db, userId);

  // 5) Quiet background sync (defer heavy full pass a bit so UI opens first)
  window.setTimeout(() => {
    void syncLedgerWithCloud(db, userId, { mode: 'quick' });
  }, 800);
  window.setTimeout(() => {
    void syncLedgerWithCloud(db, userId, { mode: 'full' });
  }, 5000);

  if (!result.ok) {
    console.warn('[Chai Khata] Login download failed:', result.error);
    return { syncOk: false, syncError: result.error, rowCount: 0 };
  }

  return {
    syncOk: true,
    rowCount: 'rowCount' in result ? (result.rowCount ?? 0) : 0,
  };
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
