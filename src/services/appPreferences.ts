import type { ChaiKhataDB } from '../db/database';
import { setLabelMode } from '../i18n/labels';
import { setLanguage } from '../i18n/index';
import { setCloudApiUrl } from './cloudConfig';

export type ThemeMode = 'light' | 'dark' | 'auto';

export type AppPreferences = {
  theme: ThemeMode;
  compactUi: boolean;
  animations: boolean;
  showProfitOnDashboard: boolean;
};

const STORAGE = {
  theme: 'patiwala-theme',
  compactUi: 'patiwala-compact-ui',
  animations: 'patiwala-animations',
  showProfit: 'patiwala-show-profit',
} as const;

export const DEFAULT_PREFERENCES: AppPreferences = {
  theme: 'light',
  compactUi: false,
  animations: true,
  showProfitOnDashboard: true,
};

const ALL_LOCAL_KEYS = [
  STORAGE.theme,
  STORAGE.compactUi,
  STORAGE.animations,
  STORAGE.showProfit,
  'chai-khata-label-mode',
  'chai-khata-lang',
  'chai-khata-cloud-url',
  'chai-khata-ledger-updated-at',
  'chai-khata-token',
];

function readBool(key: string, fallback: boolean): boolean {
  const v = localStorage.getItem(key);
  if (v === null) return fallback;
  return v === 'true';
}

function readPreferences(): AppPreferences {
  const theme = (localStorage.getItem(STORAGE.theme) as ThemeMode | null) ?? DEFAULT_PREFERENCES.theme;
  return {
    theme: theme === 'dark' || theme === 'auto' ? theme : 'light',
    compactUi: readBool(STORAGE.compactUi, DEFAULT_PREFERENCES.compactUi),
    animations: readBool(STORAGE.animations, DEFAULT_PREFERENCES.animations),
    showProfitOnDashboard: readBool(STORAGE.showProfit, DEFAULT_PREFERENCES.showProfitOnDashboard),
  };
}

/** Stable snapshot for useSyncExternalStore — must return same reference until prefs change. */
let preferencesSnapshot: AppPreferences = readPreferences();

export function getPreferences(): AppPreferences {
  return preferencesSnapshot;
}

export function getPreferencesSnapshot(): AppPreferences {
  return preferencesSnapshot;
}

function refreshPreferencesSnapshot() {
  preferencesSnapshot = readPreferences();
}

function notifyChange() {
  refreshPreferencesSnapshot();
  window.dispatchEvent(new Event('app-preferences-change'));
}

export function subscribePreferences(cb: () => void) {
  window.addEventListener('app-preferences-change', cb);
  window.addEventListener('label-mode-change', cb);
  return () => {
    window.removeEventListener('app-preferences-change', cb);
    window.removeEventListener('label-mode-change', cb);
  };
}

export function setTheme(theme: ThemeMode) {
  localStorage.setItem(STORAGE.theme, theme);
  applyPreferences();
  notifyChange();
}

export function setCompactUi(enabled: boolean) {
  localStorage.setItem(STORAGE.compactUi, String(enabled));
  applyPreferences();
  notifyChange();
}

export function setAnimations(enabled: boolean) {
  localStorage.setItem(STORAGE.animations, String(enabled));
  applyPreferences();
  notifyChange();
}

export function setShowProfitOnDashboard(enabled: boolean) {
  localStorage.setItem(STORAGE.showProfit, String(enabled));
  notifyChange();
}

function resolveTheme(theme: ThemeMode): 'light' | 'dark' {
  if (theme === 'auto') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
}

export function applyPreferences() {
  const prefs = getPreferences();
  const resolved = resolveTheme(prefs.theme);
  document.documentElement.setAttribute('data-theme', resolved);
  document.documentElement.classList.toggle('compact-ui', prefs.compactUi);
  document.documentElement.classList.toggle('reduce-motion-ui', !prefs.animations);
}

export function initAppPreferences() {
  refreshPreferencesSnapshot();
  applyPreferences();
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const onSystemChange = () => {
    if (getPreferences().theme === 'auto') applyPreferences();
  };
  mq.addEventListener('change', onSystemChange);
}

export async function resetPreferencesOnly() {
  localStorage.removeItem(STORAGE.theme);
  localStorage.removeItem(STORAGE.compactUi);
  localStorage.removeItem(STORAGE.animations);
  localStorage.removeItem(STORAGE.showProfit);
  setLabelMode('bilingual');
  setLanguage('ur-roman');
  applyPreferences();
  notifyChange();
}

export function resetCloudConfigOnly() {
  setCloudApiUrl('');
  localStorage.removeItem('chai-khata-ledger-updated-at');
}

export async function resetBusinessSettings(db: ChaiKhataDB) {
  await db.settings.put({
    id: 'settings',
    lowStockThresholdKg: 50,
    language: 'ur-roman',
  });
}

export async function clearLocalLedgerData(db: ChaiKhataDB) {
  await Promise.all([
    db.dealers.clear(),
    db.customers.clear(),
    db.purchases.clear(),
    db.sales.clear(),
    db.payments.clear(),
  ]);
  await resetBusinessSettings(db);
  localStorage.removeItem('chai-khata-ledger-updated-at');
}

export async function exportLedgerJson(db: ChaiKhataDB): Promise<string> {
  const [dealers, customers, purchases, sales, payments, settings] = await Promise.all([
    db.dealers.toArray(),
    db.customers.toArray(),
    db.purchases.toArray(),
    db.sales.toArray(),
    db.payments.toArray(),
    db.settings.get('settings'),
  ]);
  return JSON.stringify(
    { exportedAt: new Date().toISOString(), dealers, customers, purchases, sales, payments, settings },
    null,
    2,
  );
}

export function downloadJson(filename: string, content: string) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export type ResetScope = 'preferences' | 'cloud' | 'business' | 'data';

export async function runReset(scope: ResetScope, db?: ChaiKhataDB) {
  switch (scope) {
    case 'preferences':
      await resetPreferencesOnly();
      break;
    case 'cloud':
      resetCloudConfigOnly();
      break;
    case 'business':
      if (!db) throw new Error('Database not ready');
      await resetBusinessSettings(db);
      break;
    case 'data':
      if (!db) throw new Error('Database not ready');
      await clearLocalLedgerData(db);
      break;
  }
}

export function clearAllLocalStorage() {
  for (const key of ALL_LOCAL_KEYS) {
    localStorage.removeItem(key);
  }
}
