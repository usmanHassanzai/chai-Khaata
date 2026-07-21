import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import FormField from '../components/FormField';
import ExportToolbar from '../components/ExportToolbar';
import { db, getSettingsQuery } from '../db/database';
import { Label, SectionTitle, useLabel } from '../i18n/useLabel';
import { computeTeaStocks, formatCurrency, formatKg } from '../services/calculations';
import { buildStockExportRows, STOCK_EXPORT_COLUMNS } from '../services/export';

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
  const stockExportRows = buildStockExportRows(stocks);
  const lowCount = stocks.filter((t) => t.isLow).length;

  async function saveThreshold(e: React.FormEvent) {
    e.preventDefault();
    const val = parseFloat(threshold) || 50;
    await db.settings.put({ ...settings, lowStockThresholdKg: val });
  }

  return (
    <div className="page stock-page stock-pro">
      <header className="stock-topbar animate-fade-in-up">
        <div>
          <p className="stock-eyebrow">Inventory</p>
          <h1 className="stock-title">
            <Label k="stock.title" variant="stacked" />
          </h1>
          <p className="stock-meta">
            <span>{stocks.length} teas</span>
            <span className="stock-meta-dot" aria-hidden />
            <span className={lowCount > 0 ? 'warn-text' : ''}>{lowCount} low</span>
          </p>
        </div>
      </header>

      <form className="stock-panel form-card threshold-form animate-fade-in-up stagger-1" onSubmit={saveThreshold}>
        <FormField labelKey="stock.threshold" value={threshold} onChange={setThreshold} type="number" min={0} step={1} />
        <button type="submit" className="btn primary">{l('stock.saveThreshold')}</button>
      </form>

      <section className="stock-panel card-section animate-fade-in-up stagger-2">
        <div className="section-header-row">
          <SectionTitle k="stock.title" />
          <ExportToolbar
            filenamePrefix="godaam-stock"
            title="Godaam Stock Ledger"
            subtitle={`Low stock threshold: ${settings.lowStockThresholdKg} kg`}
            columns={STOCK_EXPORT_COLUMNS}
            rows={stockExportRows}
            compact
          />
        </div>

        <div className="stock-card-grid">
          {stocks.length === 0 ? (
            <p className="empty">{l('common.noData')}</p>
          ) : (
            stocks.map((tea) => (
              <article key={tea.teaName} className={`stock-card${tea.isLow ? ' is-low' : ''}`}>
                <div className="stock-card-name">{tea.teaName}</div>
                <div className="stock-card-row">
                  <span><Label k="stock.currentStock" variant="compact" /></span>
                  <strong className={tea.isLow ? 'warn-text' : ''}>{formatKg(tea.currentStock)}</strong>
                </div>
                <div className="stock-card-row">
                  <span><Label k="stock.stockValue" variant="compact" /></span>
                  <strong>{formatCurrency(tea.stockValue)}</strong>
                </div>
                <div className="stock-card-row">
                  <span><Label k="common.status" variant="compact" /></span>
                  <strong>{tea.isLow ? l('common.low') : l('common.ok')}</strong>
                </div>
              </article>
            ))
          )}
        </div>

        <div className="table-wrap stock-table-desktop">
          <table className="stock-table">
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
                    <td><strong>{tea.teaName}</strong></td>
                    <td>{formatKg(tea.totalReceived)}</td>
                    <td>{formatKg(tea.totalSold)}</td>
                    <td className={tea.isLow ? 'warn-text' : ''}>{formatKg(tea.currentStock)}</td>
                    <td>{formatCurrency(tea.avgCostPerKg)}</td>
                    <td>{formatCurrency(tea.stockValue)}</td>
                    <td>{tea.isLow ? l('common.low') : l('common.ok')}</td>
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
