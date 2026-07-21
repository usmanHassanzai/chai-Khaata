import Dexie, { type EntityTable } from 'dexie';
import {
  attachLedgerSyncHooks,
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

export async function initUserDatabase(userId: string): Promise<{ syncOk: boolean; syncError?: string }> {
  stopLedgerSyncLoop();

  if (db) {
    db.close();
  }

  db = new ChaiKhataDB(`ChaiKhataDB_${userId}`);

  // Attach auto-save hooks before any writes so every change pushes to Supabase
  if (isCloudSyncEnabled()) {
    attachLedgerSyncHooks(db, userId);
  }

  await runWithSuppressedAutoPush(async () => {
    await ensureSettings();
  });

  if (!isCloudSyncEnabled()) {
    if (!getLocalLedgerUpdatedAt(userId)) {
      touchLocalLedgerUpdatedAt(userId);
    }
    return { syncOk: true };
  }

  startLedgerSyncLoop(db, userId);

  // Open app immediately from local cache; sync cloud data in background
  void syncLedgerWithCloud(db, userId).then((result) => {
    if (!result.ok) {
      console.warn('[Chai Khata] Initial cloud sync failed:', result.error);
    }
  });

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
