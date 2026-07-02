import Dexie, { type EntityTable } from 'dexie';
import {
  attachLedgerSyncHooks,
  startLedgerSyncLoop,
  syncLedgerWithCloud,
  touchLocalLedgerUpdatedAt,
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
  }
}

export type { ChaiKhataDB };
export let db: ChaiKhataDB;

export function isDbInitialized(): boolean {
  return Boolean(db);
}

export async function initUserDatabase(userId: string): Promise<void> {
  if (db) {
    db.close();
  }
  db = new ChaiKhataDB(`ChaiKhataDB_${userId}`);
  await ensureSettings();

  if (isCloudSyncEnabled()) {
    // Sync in background so login is not blocked on slow/unreachable cloud API
    void syncLedgerWithCloud(db)
      .then(() => {
        attachLedgerSyncHooks(db);
        startLedgerSyncLoop(db);
      })
      .catch((err) => {
        console.warn('[Chai Khata] Cloud sync after login:', err);
        attachLedgerSyncHooks(db);
        startLedgerSyncLoop(db);
      });
  } else if (!getLocalLedgerUpdatedAt()) {
    touchLocalLedgerUpdatedAt();
  }
}

function getLocalLedgerUpdatedAt() {
  return localStorage.getItem('chai-khata-ledger-updated-at') || '';
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
  return db.settings.get('settings');
}

export async function nextCustomerId(): Promise<string> {
  const count = await db.customers.count();
  return `CUST-${String(count + 1).padStart(4, '0')}`;
}
