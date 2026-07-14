import { useLiveQuery } from 'dexie-react-hooks';
import StatCard from '../components/StatCard';
import MobileSaleCards from '../components/MobileSaleCards';
import TeaHero from '../components/TeaHero';
import TeaShowcase from '../components/TeaShowcase';
import QuickActions from '../components/QuickActions';
import { db, getSettingsQuery } from '../db/database';
import { Label, SectionTitle, useLabel } from '../i18n/useLabel';
import {
  computeDashboardStats,
  formatCurrency,
  formatKg,
  getStockForTea,
  saleProfit,
  saleTotal,
} from '../services/calculations';

export default function Dashboard() {
  const l = useLabel();

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

  const stats = computeDashboardStats(
    sales,
    purchases,
    customers,
    payments,
    dealers,
    settings.lowStockThresholdKg,
  );

  return (
    <div className="page">
      <TeaHero todaySale={formatCurrency(stats.todaySale)} />
      <QuickActions />

      <div className="stat-grid">
        <StatCard labelKey="dashboard.todaySale" value={formatCurrency(stats.todaySale)} accent="green" delay={0} />
        <StatCard labelKey="dashboard.monthSale" value={formatCurrency(stats.monthSale)} accent="blue" delay={50} />
        <StatCard labelKey="dashboard.yearSale" value={formatCurrency(stats.yearSale)} accent="blue" delay={100} />
        <StatCard labelKey="dashboard.monthProfit" value={formatCurrency(stats.monthProfit)} accent="amber" delay={150} />
        <StatCard labelKey="dashboard.stockValue" value={formatCurrency(stats.stockValue)} accent="brown" delay={200} />
        <StatCard labelKey="dashboard.customerDues" value={formatCurrency(stats.customerDues)} accent="red" delay={250} />
        <StatCard labelKey="dashboard.dealerDues" value={formatCurrency(stats.dealerDues)} accent="red" delay={300} />
        <StatCard
          labelKey="dashboard.lowStockAlerts"
          value={String(stats.lowStockCount)}
          accent={stats.lowStockCount > 0 ? 'red' : 'green'}
          delay={350}
        />
      </div>

      <TeaShowcase />

      <section className="card-section dashboard-recent pak-accent-border card-premium animate-fade-in-up stagger-4">
        <SectionTitle k="dashboard.recentSales" />
        {stats.recentSales.length === 0 ? (
          <p className="empty">{l('common.noData')}</p>
        ) : (
          <>
            <div className="table-wrap desktop-only-table">
              <table>
                <thead>
                  <tr>
                    <th><Label k="common.date" variant="compact" /></th>
                    <th><Label k="dukaan.teaName" variant="compact" /></th>
                    <th><Label k="dukaan.quantityKg" variant="compact" /></th>
                    <th><Label k="common.total" variant="compact" /></th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentSales.map((s) => {
                    const { avgCostPerKg } = getStockForTea(s.teaName, purchases, sales);
                    return (
                      <tr key={s.id}>
                        <td>{s.date}</td>
                        <td>{s.teaName}</td>
                        <td>{formatKg(s.quantityKg)}</td>
                        <td>{formatCurrency(saleTotal(s))}</td>
                        <td className="hide-mobile">{formatCurrency(saleProfit(s, avgCostPerKg))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mobile-only-cards">
              <MobileSaleCards
                sales={stats.recentSales}
                profitFor={(s) => {
                  const { avgCostPerKg } = getStockForTea(s.teaName, purchases, sales);
                  return saleProfit(s, avgCostPerKg);
                }}
              />
            </div>
          </>
        )}
      </section>

      {stats.lowStockTeas.length > 0 && (
        <section className="card-section alert-section animate-fade-in-up">
          <SectionTitle k="dashboard.lowStockList" />
          <ul className="alert-list">
            {stats.lowStockTeas.map((tea) => (
              <li key={tea.teaName}>
                <strong>{tea.teaName}</strong> — {formatKg(tea.currentStock)} ({l('common.low')})
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
