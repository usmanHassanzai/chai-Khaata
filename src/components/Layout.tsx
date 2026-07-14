import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/authApi';
import { isCloudSyncEnabled } from '../services/cloudConfig';
import { onSyncStatus, type SyncStatus } from '../services/ledgerSync';
import { Label } from '../i18n/useLabel';
import { getLabel } from '../i18n/labels';
import { useLabelMode } from '../i18n/useLabel';

const mainLinks = [
  { to: '/', key: 'dashboard', icon: '📊' },
  { to: '/dukaan', key: 'dukaan', icon: '🏪' },
  { to: '/godaam', key: 'godaam', icon: '📦' },
  { to: '/customers', key: 'customers', icon: '👥' },
  { to: '/stock', key: 'stock', icon: '📋' },
] as const;

const adminLink = { to: '/admin', key: 'approvals', icon: '✅' } as const;

function navShortLabel(key: string, mode: ReturnType<typeof useLabelMode>): string {
  const text = getLabel(`nav.${key}`);
  if (mode === 'ur') return text.ur.split(/[\s—]/)[0];
  if (mode === 'en') return text.en.split(' ')[0];
  if (mode === 'ur-roman') return (text.roman ?? text.en).split(' ')[0];
  return text.ur.split(/[\s—]/)[0];
}

function pageTitleFromPath(pathname: string, mode: ReturnType<typeof useLabelMode>): string {
  if (pathname.startsWith('/dukaan')) return navShortLabel('dukaan', mode);
  if (pathname.startsWith('/godaam')) return navShortLabel('godaam', mode);
  if (pathname.startsWith('/customers')) return navShortLabel('customers', mode);
  if (pathname.startsWith('/stock')) return navShortLabel('stock', mode);
  if (pathname.startsWith('/settings')) return navShortLabel('settings', mode);
  if (pathname.startsWith('/admin')) return navShortLabel('approvals', mode);
  return navShortLabel('dashboard', mode);
}

export default function Layout() {
  const mode = useLabelMode();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');

  const isAdmin = user?.role === 'admin';
  const mobilePageTitle = pageTitleFromPath(location.pathname, mode);

  useEffect(() => onSyncStatus(setSyncStatus), []);

  useEffect(() => {
    if (!isAdmin) {
      setPendingCount(0);
      return;
    }
    const poll = () => {
      authApi.listUsers()
        .then(({ users }) => {
          setPendingCount(users.filter((u) => u.status === 'pending' && u.role !== 'admin').length);
        })
        .catch(() => setPendingCount(0));
    };
    poll();
    const timer = window.setInterval(poll, 15000);
    return () => window.clearInterval(timer);
  }, [isAdmin]);

  const bottomLinks = [
    ...mainLinks,
    ...(isAdmin ? [adminLink] : []),
    { to: '/settings', key: 'settings', icon: '⚙️' } as const,
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">🍵</div>
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-name"><Label k="appName" variant="compact" /></span>
            <span className="sidebar-brand-tag">Patiwala Ledger</span>
          </div>
        </div>

        <p className="sidebar-section-label">Menu</p>
        <nav className="sidebar-nav">
          {mainLinks.map(({ to, key, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <span className="nav-icon-wrap">{icon}</span>
              <span className="nav-text">
                <Label k={`nav.${key}`} variant="stacked" />
              </span>
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink
              to={adminLink.to}
              className={({ isActive }) => `nav-link nav-link-admin${isActive ? ' active' : ''}`}
            >
              <span className="nav-icon-wrap">{adminLink.icon}</span>
              <span className="nav-text">
                <Label k={`nav.${adminLink.key}`} variant="stacked" />
                {pendingCount > 0 && <span className="nav-badge">{pendingCount}</span>}
              </span>
            </NavLink>
          )}
        </nav>

        <div className="sidebar-footer">
          <NavLink
            to="/settings"
            className={({ isActive }) => `nav-link settings-link${isActive ? ' active' : ''}`}
          >
            <span className="nav-icon-wrap">⚙️</span>
            <span className="nav-text">
              <Label k="nav.settings" variant="stacked" />
            </span>
          </NavLink>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-header">
          <div className="header-inner">
            <div className="header-title-mobile">
              <span className="header-logo-sm">🍵</span>
              <div className="header-title-stack">
                <span className="header-page-name">{mobilePageTitle}</span>
                <span className="header-shop-name">{user?.shopName || user?.username || 'Chai Khata'}</span>
              </div>
            </div>
            <div className="header-meta">
              {isCloudSyncEnabled() && (
                <span
                  className={`header-sync-dot${syncStatus === 'offline' || syncStatus === 'error' ? ' offline' : syncStatus === 'syncing' ? ' syncing' : ''}`}
                  title={syncStatus === 'synced' ? 'Cloud sync live' : syncStatus}
                  aria-label="Cloud sync status"
                />
              )}
              <span className="header-badge">Patiwala</span>
              <span className="header-date">
                {new Date().toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric', month: 'short' })}
              </span>
              {user && (
                <span className="header-user" title={user.username}>
                  {user.shopName || user.username}
                </span>
              )}
              <button type="button" className="btn header-logout-btn" onClick={logout} aria-label="Logout">
                <span className="header-logout-icon" aria-hidden>⎋</span>
                <span className="header-logout-text"><Label k="auth.logout" variant="compact" /></span>
              </button>
            </div>
          </div>
        </header>

        <main className="main-content">
          <div key={location.pathname} className="page-container">
            <Outlet />
          </div>
        </main>
      </div>

      <nav className="bottom-nav" aria-label="Main navigation">
        <div className="bottom-nav-scroll">
          {bottomLinks.map(({ to, key, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `bottom-link${isActive ? ' active' : ''}`}
            >
              <span className="bottom-icon-wrap">
                <span className="bottom-icon">{icon}</span>
                {key === 'approvals' && pendingCount > 0 && (
                  <span className="bottom-badge">{pendingCount}</span>
                )}
              </span>
              <span className="bottom-label">{navShortLabel(key, mode)}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
