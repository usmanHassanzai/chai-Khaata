import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import FormField from '../components/FormField';
import PageBanner from '../components/PageBanner';
import { db, getSettingsQuery } from '../db/database';
import { Label, PageTitle, useLabel } from '../i18n/useLabel';
import { computeTeaStocks, formatCurrency, formatKg } from '../services/calculations';

export default function StockLedger() {
  const l = useLabel();
  const purchases = useLiveQuery(() => db.purchases.toArray(), []) ?? [];
  const sales = useLiveQuery(() => db.sales.toArray(), []) ?? [];
  const settings = useLiveQuery(() => getSettingsQuery(), []) ?? {
    id: 'settings' as const,
    lowStockThresholdKg: 50,
    language: 'ur-roman' as const,
  };

  const [threshold, setThreshold] = useState(String(settings.lowStockThresholdKg));

  useEffect(() => {
    setThreshold(String(settings.lowStockThresholdKg));
  }, [settings.lowStockThresholdKg]);

  const stocks = computeTeaStocks(purchases, sales, settings.lowStockThresholdKg);

  async function saveThreshold(e: React.FormEvent) {
    e.preventDefault();
    const val = parseFloat(threshold) || 50;
    await db.settings.put({ ...settings, lowStockThresholdKg: val });
  }

  return (
    <div className="page">
      <PageBanner titleKey="stock.title" subtitle="Live inventory per tea blend" icon="📋" accent="gold" />
      <PageTitle k="stock.title" />

      <form className="card form-card threshold-form" onSubmit={saveThreshold}>
        <FormField labelKey="stock.threshold" value={threshold} onChange={setThreshold} type="number" min={0} step={1} />
        <button type="submit" className="btn primary">{l('stock.saveThreshold')}</button>
      </form>

      <section className="card-section">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th><Label k="stock.teaName" variant="compact" /></th>
                <th><Label k="stock.totalReceived" variant="compact" /></th>
                <th><Label k="stock.totalSold" variant="compact" /></th>
                <th><Label k="stock.currentStock" variant="compact" /></th>
                <th><Label k="stock.avgCost" variant="compact" /></th>
                <th><Label k="stock.stockValue" variant="compact" /></th>
                <th><Label k="common.status" variant="compact" /></th>
              </tr>
            </thead>
            <tbody>
              {stocks.length === 0 ? (
                <tr><td colSpan={7} className="empty">{l('common.noData')}</td></tr>
              ) : (
                stocks.map((tea) => (
                  <tr key={tea.teaName} className={tea.isLow ? 'row-low' : ''}>
                    <td>{tea.teaName}</td>
                    <td>{formatKg(tea.totalReceived)}</td>
                    <td>{formatKg(tea.totalSold)}</td>
                    <td>{formatKg(tea.currentStock)}</td>
                    <td>{formatCurrency(tea.avgCostPerKg)}</td>
                    <td>{formatCurrency(tea.stockValue)}</td>
                    <td>
                      <span className={`badge ${tea.isLow ? 'badge-low' : 'badge-ok'}`}>
                        {tea.isLow ? l('common.low') : l('common.ok')}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
