import Dexie, { type EntityTable } from 'dexie';
import {
  attachLedgerSyncHooks,
  clearLocalSyncCursor,
  runWithSuppressedAutoPush,
  startLedgerSyncLoop,
  stopLedgerSyncLoop,
  syncLedgerWithCloud,
  touchLocalLedgerUpdatedAt,
  getLocalLedgerUpdatedAt,
} from '../services/ledgerSync';
import { isCloudSyncEnabled } from '../services/cloudConfig';
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

async function localHasBusinessData(database: ChaiKhataDB): Promise<boolean> {
  const [dealers, customers, purchases, sales, payments] = await Promise.all([
    database.dealers.count(),
    database.customers.count(),
    database.purchases.count(),
    database.sales.count(),
    database.payments.count(),
  ]);
  return dealers > 0 || customers > 0 || purchases > 0 || sales > 0 || payments > 0;
}

export async function initUserDatabase(userId: string): Promise<{ syncOk: boolean; syncError?: string }> {
  stopLedgerSyncLoop();

  if (db) {
    db.close();
  }

  db = new ChaiKhataDB(`ChaiKhataDB_${userId}`);

  if (!isCloudSyncEnabled()) {
    await ensureSettings();
    if (!getLocalLedgerUpdatedAt(userId)) {
      touchLocalLedgerUpdatedAt(userId);
    }
    return { syncOk: true };
  }

  // Empty mobile/fresh device: drop stale sync cursor so we always download full user ledger
  if (!(await localHasBusinessData(db))) {
    clearLocalSyncCursor(userId);
  }

  // 1) Download cloud ledger FIRST (before hooks / local settings write)
  const result = await syncLedgerWithCloud(db, userId, { mode: 'full' });

  // 2) Ensure settings exist after cloud import (won't overwrite cloud settings)
  await runWithSuppressedAutoPush(async () => {
    await ensureSettings();
  });

  // 3) Attach auto-save hooks only after the full pull so login can't push empty stubs
  attachLedgerSyncHooks(db, userId);

  // 4) Start background sync only after login pull finished
  startLedgerSyncLoop(db, userId);

  if (!result.ok) {
    console.warn('[Chai Khata] Initial cloud sync failed:', result.error);
    // Retry once more in background — mobile networks often need a second try
    void syncLedgerWithCloud(db, userId, { mode: 'full' });
    return { syncOk: false, syncError: result.error };
  }

  return { syncOk: true };
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
