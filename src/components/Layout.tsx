import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { AdminUsersProvider, useAdminPendingCount } from '../context/AdminUsersContext';
import { isCloudSyncEnabled } from '../services/cloudConfig';
import {
  flushLedgerPushNow,
  onSyncStatus,
  pullLedgerFromCloud,
  pushLedgerToCloud,
  type SyncStatus,
} from '../services/ledgerSync';
import { db } from '../db/database';
import AppInterior from './AppInterior';
import AppLoading from './AppLoading';
import TrialBanner from './TrialBanner';
import RenewalGraceBanner from './RenewalGraceBanner';
import SubscriptionBanner from './SubscriptionBanner';
import { Label } from '../i18n/useLabel';
import { getLabel } from '../i18n/labels';
import { useLabelMode } from '../i18n/useLabel';

const mainLinks = [
  { to: '/dashboard', key: 'dashboard', icon: '🏠', glyph: 'H' },
  { to: '/dukaan', key: 'dukaan', icon: '🛒', glyph: 'S' },
  { to: '/godaam', key: 'godaam', icon: '📦', glyph: 'G' },
  { to: '/customers', key: 'customers', icon: '👤', glyph: 'C' },
  { to: '/stock', key: 'stock', icon: '📋', glyph: 'I' },
] as const;

const adminLink = { to: '/admin', key: 'approvals', icon: '✅', glyph: 'A' } as const;
const settingsLink = { to: '/settings', key: 'settings', icon: '⚙️', glyph: '⚙' } as const;

function navShortLabel(key: string, mode: ReturnType<typeof useLabelMode>): string {
  const text = getLabel(`nav.${key}`);
  if (mode === 'ur') return text.ur.split(/[\s—]/)[0];
  if (mode === 'en') return text.en.split(/[\s(]/)[0];
  if (mode === 'ur-roman') {
    const roman = text.roman ?? text.en;
    return roman.split(/[\s—]/)[0];
  }
  return text.ur.split(/[\s—]/)[0];
}

function pageTitleFromPath(pathname: string, mode: ReturnType<typeof useLabelMode>): string {
  if (pathname.startsWith('/dukaan')) return navShortLabel('dukaan', mode);
  if (pathname.startsWith('/godaam')) return navShortLabel('godaam', mode);
  if (pathname.startsWith('/customers')) return navShortLabel('customers', mode);
  if (pathname.startsWith('/stock')) return navShortLabel('stock', mode);
  if (pathname.startsWith('/settings')) return navShortLabel('settings', mode);
  if (pathname.startsWith('/admin')) return navShortLabel('approvals', mode);
  if (pathname.startsWith('/dashboard')) return navShortLabel('dashboard', mode);
  return navShortLabel('dashboard', mode);
}

function syncLabelKey(status: SyncStatus): string {
  if (status === 'synced') return 'common.syncLive';
  if (status === 'syncing') return 'common.syncing';
  if (status === 'offline') return 'common.syncOffline';
  if (status === 'error') return 'common.syncError';
  return 'common.syncReady';
}

export default function Layout() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  if (isAdmin) {
    return (
      <AdminUsersProvider>
        <LayoutShell />
      </AdminUsersProvider>
    );
  }

  return <LayoutShell />;
}

function LayoutShell() {
  const mode = useLabelMode();
  const location = useLocation();
  const { user, logout, dbReady } = useAuth();
  const pendingCount = useAdminPendingCount();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);

  const isAdmin = user?.role === 'admin';
  const mobilePageTitle = pageTitleFromPath(location.pathname, mode);
  const cloudOn = isCloudSyncEnabled();

  const drawerLinks = [
    ...mainLinks,
    ...(isAdmin ? [adminLink] : []),
    settingsLink,
  ];

  useEffect(() => onSyncStatus(setSyncStatus), []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.classList.toggle('scroll-lock', mobileMenuOpen);
    return () => document.body.classList.remove('scroll-lock');
  }, [mobileMenuOpen]);

  /* Keep local Dexie ledger synced with cloud DB whenever user opens a page */
  useEffect(() => {
    if (!cloudOn || !dbReady || !user || !db) return;
    void pullLedgerFromCloud(db, user.id, { useSince: true }).then(() => {
      flushLedgerPushNow();
    });
  }, [location.pathname, cloudOn, dbReady, user]);

  async function handleSyncTap() {
    if (!cloudOn || !user || !db || syncBusy) return;
    setSyncBusy(true);
    try {
      await pullLedgerFromCloud(db, user.id);
      await pushLedgerToCloud(db, user.id);
    } catch (err) {
      console.error('[Chai Khata] Mobile sync failed:', err);
    } finally {
      setSyncBusy(false);
    }
  }

  function renderNavLinks(
    links: readonly { readonly to: string; readonly key: string; readonly icon: string; readonly glyph?: string }[],
    opts?: { onNavigate?: () => void; className?: string; mobile?: boolean },
  ) {
    return links.map(({ to, key, icon, glyph }) => (
      <NavLink
        key={to}
        to={to}
        end={to === '/dashboard'}
        className={({ isActive }) => `nav-link${isActive ? ' active' : ''}${opts?.className ? ` ${opts.className}` : ''}`}
        onClick={opts?.onNavigate}
      >
        <span className={`nav-icon-wrap${opts?.mobile ? ' nav-glyph' : ''}`}>
          {opts?.mobile ? (glyph ?? icon) : icon}
        </span>
        <span className="nav-text">
          <Label k={`nav.${key}`} variant="compact" />
          {key === 'approvals' && pendingCount > 0 && <span className="nav-badge">{pendingCount}</span>}
        </span>
      </NavLink>
    ));
  }

  const effectiveSync = syncBusy ? 'syncing' : syncStatus;

  return (
    <div className={`app-shell easy-pos${mobileMenuOpen ? ' mobile-menu-open' : ''}`}>
      {/* Desktop sidebar — unchanged */}
      <aside className="sidebar sidebar-pro desktop-only-nav">
        <div className="sidebar-top">
          <div className="sidebar-brand">
            <div className="sidebar-logo-ring">
              <div className="sidebar-logo-wrap">
                <img src="/images/tea/karak-chai.jpg" alt="" className="sidebar-logo-img" />
              </div>
            </div>
            <div className="sidebar-brand-text">
              <span className="sidebar-brand-name"><Label k="appName" variant="compact" /></span>
              <span className="sidebar-brand-tag">Asaan billing · Stock</span>
            </div>
          </div>
        </div>

        <div className="sidebar-scroll">
          <p className="sidebar-section-label">MENU</p>
          <nav className="sidebar-nav">
            {renderNavLinks(mainLinks)}
            {isAdmin && renderNavLinks([adminLink])}
          </nav>
        </div>

        <div className="sidebar-footer">
          {renderNavLinks([settingsLink])}
        </div>
      </aside>

      {/* Mobile drawer */}
      <div
        className={`mobile-drawer-backdrop${mobileMenuOpen ? ' is-open' : ''}`}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden={!mobileMenuOpen}
      />
      <aside
        className={`mobile-drawer${mobileMenuOpen ? ' is-open' : ''}`}
        aria-hidden={!mobileMenuOpen}
        aria-label="Mobile menu"
      >
        <div className="mobile-drawer-head">
          <div className="mobile-drawer-brand">
            <div className="mobile-drawer-logo">
              <img src="/images/tea/karak-chai.jpg" alt="" />
            </div>
            <div className="mobile-drawer-brand-text">
              <span className="mobile-drawer-name"><Label k="appName" variant="compact" /></span>
              <span className="mobile-drawer-shop">{user?.shopName || 'Patiwala'}</span>
            </div>
          </div>
          <button
            type="button"
            className="mobile-drawer-close"
            onClick={() => setMobileMenuOpen(false)}
            aria-label={getLabel('common.closeMenu').en}
          >
            ✕
          </button>
        </div>

        <p className="mobile-drawer-label">Menu</p>
        <nav className="mobile-drawer-nav">
          {renderNavLinks(drawerLinks, {
            onNavigate: () => setMobileMenuOpen(false),
            mobile: true,
          })}
        </nav>

        <div className="mobile-drawer-footer">
          {cloudOn && (
            <button
              type="button"
              className={`mobile-drawer-sync is-${effectiveSync}`}
              onClick={() => {
                void handleSyncTap();
              }}
              disabled={syncBusy}
            >
              <span className="mobile-sync-dot" aria-hidden />
              <Label k={syncLabelKey(effectiveSync)} variant="compact" />
            </button>
          )}
          <button type="button" className="btn mobile-drawer-logout" onClick={logout}>
            <Label k="auth.logout" variant="compact" />
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-header app-header-pro">
          <div className="header-inner">
            <div className="header-title-mobile">
              <button
                type="button"
                className={`mobile-hamburger${mobileMenuOpen ? ' is-open' : ''}`}
                onClick={() => setMobileMenuOpen((o) => !o)}
                aria-expanded={mobileMenuOpen}
                aria-label={mobileMenuOpen ? getLabel('common.closeMenu').en : getLabel('common.openMenu').en}
              >
                <span />
                <span />
                <span />
              </button>
              <div className="header-title-stack">
                <span className="header-page-name">{mobilePageTitle}</span>
                <span className="header-shop-name">{user?.shopName || user?.username || 'Chai Khata'}</span>
              </div>
            </div>
            <div className="header-meta">
              {cloudOn && (
                <>
                  <button
                    type="button"
                    className={`mobile-sync-chip is-${effectiveSync}`}
                    onClick={() => void handleSyncTap()}
                    disabled={syncBusy}
                    title={getLabel('common.syncTap').en}
                    aria-label={getLabel('common.syncTap').en}
                  >
                    <span className="mobile-sync-dot" aria-hidden />
                    <span className="mobile-sync-label">
                      <Label k={syncLabelKey(effectiveSync)} variant="compact" />
                    </span>
                  </button>
                  <span
                    className={`header-sync-dot${effectiveSync === 'offline' || effectiveSync === 'error' ? ' offline' : effectiveSync === 'syncing' ? ' syncing' : ''}`}
                    title={effectiveSync === 'synced' ? 'Cloud sync live' : effectiveSync}
                    aria-label="Cloud sync status"
                  />
                </>
              )}
              <span className="header-badge auth-page-badge">Patiwala</span>
              <span className="header-date">
                {new Date().toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric', month: 'short' })}
              </span>
              {user && (
                <span className="header-user" title={user.username}>
                  {user.shopName || user.username}
                </span>
              )}
              <button type="button" className="btn header-logout-btn desktop-logout" onClick={logout} aria-label="Logout">
                <span className="header-logout-icon" aria-hidden>⎋</span>
                <span className="header-logout-text"><Label k="auth.logout" variant="compact" /></span>
              </button>
            </div>
          </div>
        </header>

        <main className="main-content">
          <TrialBanner />
          <SubscriptionBanner />
          <RenewalGraceBanner />
          {!dbReady ? (
            <AppLoading message="Loading…" />
          ) : (
            <>
              <AppInterior />
              <div key={location.pathname} className="page-container page-enter">
                <Outlet />
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
