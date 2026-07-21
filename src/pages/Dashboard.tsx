import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import MobileSaleCards from '../components/MobileSaleCards';
import ExportToolbar from '../components/ExportToolbar';
import { useAuth } from '../context/AuthContext';
import { db, getSettingsQuery } from '../db/database';
import { Label, useLabel } from '../i18n/useLabel';
import {
  getPreferencesSnapshot,
  subscribePreferences,
} from '../services/appPreferences';
import {
  computeDashboardStats,
  formatCurrency,
  formatKg,
  getStockForTea,
  saleProfit,
  saleTotal,
} from '../services/calculations';
import {
  buildDashboardExportRows,
  buildSalesExportRows,
  DASHBOARD_EXPORT_COLUMNS,
  SALES_EXPORT_COLUMNS,
} from '../services/export';

const ACTIONS = [
  { to: '/dukaan', label: 'New sale', icon: '＋' },
  { to: '/godaam', label: 'Purchase', icon: '⬇' },
  { to: '/customers', label: 'Customers', icon: '◎' },
  { to: '/stock', label: 'Stock ledger', icon: '☰' },
] as const;

function stockStatus(currentStock: number, isLow: boolean) {
  if (currentStock <= 0) return { key: 'out', label: 'Out' };
  if (isLow) return { key: 'low', label: 'Low' };
  return { key: 'ok', label: 'OK' };
}

export default function Dashboard() {
  const l = useLabel();
  const { user } = useAuth();
  const prefs = useSyncExternalStore(
    subscribePreferences,
    getPreferencesSnapshot,
    getPreferencesSnapshot,
  );

  const sales = useLiveQuery(() => db.sales.toArray(), []) ?? [];
  const purchases = useLiveQuery(() => db.purchases.toArray(), []) ?? [];
  const customers = useLiveQuery(() => db.customers.toArray(), []) ?? [];
  const payments = useLiveQuery(() => db.payments.toArray(), []) ?? [];
  const dealers = useLiveQuery(() => db.dealers.toArray(), []) ?? [];
  const settings = useLiveQuery(() => getSettingsQuery(), []) ?? {
    id: 'settings' as const,
    lowStockThresholdKg: 50,
    language: 'ur-roman' as const,
  };

  const stats = useMemo(
    () =>
      computeDashboardStats(
        sales,
        purchases,
        customers,
        payments,
        dealers,
        settings.lowStockThresholdKg,
      ),
    [sales, purchases, customers, payments, dealers, settings.lowStockThresholdKg],
  );

  const dashboardRows = useMemo(() => buildDashboardExportRows(stats), [stats]);
  const recentExportRows = useMemo(
    () => buildSalesExportRows(stats.recentSales, purchases, sales, customers),
    [stats.recentSales, purchases, sales, customers],
  );

  const inventoryRows = useMemo(() => {
    return [...stats.stocks]
      .sort((a, b) => {
        if (a.isLow !== b.isLow) return a.isLow ? -1 : 1;
        return b.stockValue - a.stockValue;
      })
      .slice(0, 8);
  }, [stats.stocks]);

  const showProfit = prefs.showProfitOnDashboard;
  const shopName = user?.shopName?.trim() || 'Patiwala';
  const todayLabel = new Date().toLocaleDateString('en-PK', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const needsAttention =
    stats.lowStockCount > 0 || stats.customerDues > 0 || stats.dealerDues > 0;

  return (
    <div className="page dashboard-page dashboard-retail">
      <header className="dash-topbar animate-fade-in-up">
        <div className="dash-topbar-text">
          <p className="dash-eyebrow">Retail overview</p>
          <h1 className="dash-title">{shopName}</h1>
          <p className="dash-meta">
            <span>{todayLabel}</span>
            <span className="dash-meta-dot" aria-hidden />
            <span>{stats.stockSkuCount} tea SKUs</span>
            <span className="dash-meta-dot" aria-hidden />
            <span>{stats.todaySaleCount} sales today</span>
          </p>
        </div>
        <div className="dash-topbar-actions">
          <ExportToolbar
            filenamePrefix="dashboard-summary"
            title="Dashboard Summary"
            columns={DASHBOARD_EXPORT_COLUMNS}
            rows={dashboardRows}
            compact
          />
          <Link to="/dukaan" className="btn primary">
            New sale
          </Link>
        </div>
      </header>

      {needsAttention && (
        <div className="dash-attention animate-fade-in-up stagger-1" role="status">
          {stats.lowStockCount > 0 && (
            <Link to="/stock" className="dash-attention-item is-warn">
              <span className="dash-attention-label">Reorder needed</span>
              <strong>{stats.lowStockCount} items low</strong>
            </Link>
          )}
          {stats.customerDues > 0 && (
            <Link to="/customers" className="dash-attention-item is-due">
              <span className="dash-attention-label">Customer receivables</span>
              <strong>{formatCurrency(stats.customerDues)}</strong>
            </Link>
          )}
          {stats.dealerDues > 0 && (
            <Link to="/godaam" className="dash-attention-item is-due">
              <span className="dash-attention-label">Dealer payables</span>
              <strong>{formatCurrency(stats.dealerDues)}</strong>
            </Link>
          )}
        </div>
      )}

      <section className="dash-kpi-row animate-fade-in-up stagger-2" aria-label="Key metrics">
        <article className="dash-kpi dash-kpi-primary">
          <span className="dash-kpi-label">
            <Label k="dashboard.todaySale" variant="stacked" />
          </span>
          <strong className="dash-kpi-value">{formatCurrency(stats.todaySale)}</strong>
          <span className="dash-kpi-hint">{stats.todaySaleCount} transactions</span>
        </article>
        <article className="dash-kpi">
          <span className="dash-kpi-label">
            <Label k="dashboard.monthSale" variant="stacked" />
          </span>
          <strong className="dash-kpi-value">{formatCurrency(stats.monthSale)}</strong>
          <span className="dash-kpi-hint">This month</span>
        </article>
        {showProfit && (
          <article className="dash-kpi">
            <span className="dash-kpi-label">
              <Label k="dashboard.monthProfit" variant="stacked" />
            </span>
            <strong className="dash-kpi-value">{formatCurrency(stats.monthProfit)}</strong>
            <span className="dash-kpi-hint">Gross estimate</span>
          </article>
        )}
        <article className="dash-kpi">
          <span className="dash-kpi-label">
            <Label k="dashboard.stockValue" variant="stacked" />
          </span>
          <strong className="dash-kpi-value">{formatCurrency(stats.stockValue)}</strong>
          <span className="dash-kpi-hint">{stats.stockSkuCount} SKUs on hand</span>
        </article>
        <article className={`dash-kpi${stats.lowStockCount > 0 ? ' is-alert' : ''}`}>
          <span className="dash-kpi-label">
            <Label k="dashboard.lowStockAlerts" variant="stacked" />
          </span>
          <strong className="dash-kpi-value">{stats.lowStockCount}</strong>
          <span className="dash-kpi-hint">
            Threshold {formatKg(settings.lowStockThresholdKg)}
          </span>
        </article>
      </section>

      <nav className="dash-actions animate-fade-in-up stagger-2" aria-label="Quick actions">
        {ACTIONS.map((action) => (
          <Link key={action.to} to={action.to} className="dash-action">
            <span className="dash-action-icon" aria-hidden>
              {action.icon}
            </span>
            {action.label}
          </Link>
        ))}
      </nav>

      <div className="dash-main-grid">
        <section className="dash-panel animate-fade-in-up stagger-3">
          <div className="dash-panel-head">
            <div>
              <h2 className="dash-panel-title">Inventory status</h2>
              <p className="dash-panel-sub">Stock by tea · lowest first</p>
            </div>
            <Link to="/stock" className="dash-panel-link">
              Full ledger →
            </Link>
          </div>

          {inventoryRows.length === 0 ? (
            <div className="dash-empty">
              <p>No stock yet. Add a purchase to start tracking inventory.</p>
              <Link to="/godaam" className="btn primary sm">
                Add purchase
              </Link>
            </div>
          ) : (
            <>
              <div className="table-wrap desktop-only-table">
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>On hand</th>
                      <th>Value</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryRows.map((tea) => {
                      const status = stockStatus(tea.currentStock, tea.isLow);
                      return (
                        <tr key={tea.teaName} className={status.key === 'ok' ? undefined : `is-${status.key}`}>
                          <td className="dash-item-name">{tea.teaName}</td>
                          <td>{formatKg(tea.currentStock)}</td>
                          <td className="dash-num">{formatCurrency(tea.stockValue)}</td>
                          <td>
                            <span className={`dash-status dash-status-${status.key}`}>
                              {status.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mobile-only-cards dash-stock-cards">
                {inventoryRows.map((tea) => {
                  const status = stockStatus(tea.currentStock, tea.isLow);
                  return (
                    <article key={tea.teaName} className="dash-stock-card">
                      <div className="dash-stock-card-top">
                        <strong>{tea.teaName}</strong>
                        <span className={`dash-status dash-status-${status.key}`}>
                          {status.label}
                        </span>
                      </div>
                      <div className="dash-stock-card-meta">
                        <span>{formatKg(tea.currentStock)}</span>
                        <span>{formatCurrency(tea.stockValue)}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </section>

        <aside className="dash-side animate-fade-in-up stagger-4">
          <section className="dash-panel">
            <div className="dash-panel-head">
              <div>
                <h2 className="dash-panel-title">Needs attention</h2>
                <p className="dash-panel-sub">Exceptions to clear today</p>
              </div>
            </div>

            {stats.lowStockTeas.length === 0 ? (
              <p className="dash-ok-banner">All stock above threshold.</p>
            ) : (
              <ul className="dash-exception-list">
                {stats.lowStockTeas.slice(0, 6).map((tea) => (
                  <li key={tea.teaName}>
                    <div>
                      <strong>{tea.teaName}</strong>
                      <span>Reorder soon</span>
                    </div>
                    <em>{formatKg(tea.currentStock)}</em>
                  </li>
                ))}
              </ul>
            )}

            <dl className="dash-dues">
              <div>
                <dt>
                  <Label k="dashboard.customerDues" variant="compact" />
                </dt>
                <dd>{formatCurrency(stats.customerDues)}</dd>
              </div>
              <div>
                <dt>
                  <Label k="dashboard.dealerDues" variant="compact" />
                </dt>
                <dd>{formatCurrency(stats.dealerDues)}</dd>
              </div>
              <div>
                <dt>
                  <Label k="dashboard.yearSale" variant="compact" />
                </dt>
                <dd>{formatCurrency(stats.yearSale)}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>

      <section className="dash-panel dash-recent animate-fade-in-up stagger-4">
        <div className="dash-panel-head">
          <div>
            <h2 className="dash-panel-title">
              <Label k="dashboard.recentSales" variant="stacked" />
            </h2>
            <p className="dash-panel-sub">Latest shop transactions</p>
          </div>
          <div className="dash-panel-tools">
            <ExportToolbar
              filenamePrefix="dashboard-recent-sales"
              title="Recent Sales"
              columns={SALES_EXPORT_COLUMNS}
              rows={recentExportRows}
              compact
            />
            <Link to="/dukaan" className="dash-panel-link">
              All sales →
            </Link>
          </div>
        </div>

        {stats.recentSales.length === 0 ? (
          <div className="dash-empty">
            <p className="empty">{l('common.noData')}</p>
            <Link to="/dukaan" className="btn primary sm">
              Record first sale
            </Link>
          </div>
        ) : (
          <>
            <div className="table-wrap desktop-only-table">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>
                      <Label k="common.date" variant="compact" />
                    </th>
                    <th>
                      <Label k="dukaan.teaName" variant="compact" />
                    </th>
                    <th>
                      <Label k="dukaan.quantityKg" variant="compact" />
                    </th>
                    <th>
                      <Label k="common.total" variant="compact" />
                    </th>
                    {showProfit && (
                      <th>
                        <Label k="dukaan.profit" variant="compact" />
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {stats.recentSales.map((s) => {
                    const { avgCostPerKg } = getStockForTea(s.teaName, purchases, sales);
                    return (
                      <tr key={s.id}>
                        <td>{s.date}</td>
                        <td className="dash-item-name">{s.teaName}</td>
                        <td>{formatKg(s.quantityKg)}</td>
                        <td className="dash-num">{formatCurrency(saleTotal(s))}</td>
                        {showProfit && (
                          <td className="dash-num">
                            {formatCurrency(saleProfit(s, avgCostPerKg))}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mobile-only-cards">
              <MobileSaleCards
                sales={stats.recentSales}
                showProfit={showProfit}
                profitFor={(s) => {
                  const { avgCostPerKg } = getStockForTea(s.teaName, purchases, sales);
                  return saleProfit(s, avgCostPerKg);
                }}
              />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
