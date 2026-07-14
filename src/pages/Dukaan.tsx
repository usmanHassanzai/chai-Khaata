import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import FormField, { FieldLabel, ReadOnlyField } from '../components/FormField';
import ImageUpload, { ImageThumb } from '../components/ImageUpload';
import PageBanner from '../components/PageBanner';
import ExportToolbar from '../components/ExportToolbar';
import StatCard from '../components/StatCard';
import TextAreaField from '../components/TextAreaField';
import { db } from '../db/database';
import { Label, PageTitle, SectionTitle, useLabel } from '../i18n/useLabel';
import type { Sale, SaleFilter } from '../models/types';
import {
  computeSaleProfit,
  filterSales,
  formatCurrency,
  formatKg,
  getGodaamPurchasePrice,
  getStockForTea,
  getTeaNames,
  profitPerKg,
  saleTotal,
  todayISO,
} from '../services/calculations';
import {
  buildSalesExportRows,
  printTable,
  SALES_EXPORT_COLUMNS,
} from '../services/export';

const FILTERS: SaleFilter[] = ['today', 'month', 'year', 'all'];
const FILTER_KEYS: Record<SaleFilter, string> = {
  today: 'dukaan.filterToday',
  month: 'dukaan.filterMonth',
  year: 'dukaan.filterYear',
  all: 'dukaan.filterAll',
};

export default function Dukaan() {
  const l = useLabel();
  const sales = useLiveQuery(() => db.sales.toArray(), []) ?? [];
  const purchases = useLiveQuery(() => db.purchases.toArray(), []) ?? [];
  const customers = useLiveQuery(() => db.customers.toArray(), []) ?? [];

  const [date, setDate] = useState(todayISO());
  const [teaName, setTeaName] = useState('');
  const [quantityKg, setQuantityKg] = useState('');
  const [salePricePerKg, setSalePricePerKg] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [amountReceived, setAmountReceived] = useState('');
  const [billImage, setBillImage] = useState<string | undefined>();
  const [notes, setNotes] = useState('');
  const [filter, setFilter] = useState<SaleFilter>('month');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const teaNames = useMemo(() => getTeaNames(purchases), [purchases]);
  const qty = parseFloat(quantityKg) || 0;
  const price = parseFloat(salePricePerKg) || 0;
  const stockInfo = teaName ? getStockForTea(teaName, purchases, sales) : { currentStock: 0, avgCostPerKg: 0 };
  const godaamPrice = teaName ? getGodaamPurchasePrice(teaName, purchases) : {
    avgCostPerKg: 0,
    latestPricePerKg: null,
    latestPurchaseDate: null,
    hasPurchase: false,
  };

  // Purchase price always from Godaam (weighted average of all purchases for this tea)
  const effectivePurchasePrice = godaamPrice.avgCostPerKg;

  const estimatedProfit = qty > 0 && price > 0 ? profitPerKg(price, effectivePurchasePrice) * qty : 0;
  const estimatedProfitPerKg = price > 0 && effectivePurchasePrice >= 0 ? profitPerKg(price, effectivePurchasePrice) : 0;
  const profitMargin = price > 0 && effectivePurchasePrice > 0
    ? ((estimatedProfitPerKg / effectivePurchasePrice) * 100)
    : 0;
  const saleValue = qty * price;
  const selectedCustomer = customerId ? parseInt(customerId, 10) : undefined;

  const filteredSales = useMemo(() => {
    let list = filterSales(sales, filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) => {
        const cust = customers.find((c) => c.id === s.customerId);
        return (
          s.teaName.toLowerCase().includes(q) ||
          (cust?.name.toLowerCase().includes(q) ?? false) ||
          (s.notes?.toLowerCase().includes(q) ?? false)
        );
      });
    }
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [sales, filter, search, customers]);

  const totals = useMemo(() => {
    let totalQty = 0;
    let totalValue = 0;
    let totalProfit = 0;
    for (const s of filteredSales) {
      totalQty += s.quantityKg;
      totalValue += saleTotal(s);
      totalProfit += computeSaleProfit(s, purchases, sales);
    }
    return { totalQty, totalValue, totalProfit };
  }, [filteredSales, purchases, sales]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!teaName.trim() || qty <= 0 || price <= 0) return;
    if (qty > stockInfo.currentStock) {
      setError(l('dukaan.stockError'));
      return;
    }
    if (!godaamPrice.hasPurchase) {
      setError(l('dukaan.noGodaamPurchase'));
      return;
    }
    const received = selectedCustomer ? parseFloat(amountReceived) || 0 : saleValue;
    await db.sales.add({
      date,
      teaName: teaName.trim(),
      quantityKg: qty,
      salePricePerKg: price,
      purchasePricePerKg: effectivePurchasePrice || undefined,
      customerId: selectedCustomer,
      amountReceived: Math.min(received, saleValue),
      billImage,
      notes: notes.trim() || undefined,
    });
    setTeaName('');
    setQuantityKg('');
    setSalePricePerKg('');
    setCustomerId('');
    setAmountReceived('');
    setBillImage(undefined);
    setNotes('');
  }

  async function handleDelete(id: number) {
    if (window.confirm(l('common.confirmDelete'))) await db.sales.delete(id);
  }

  function customerLabel(s: Sale) {
    if (!s.customerId) return l('common.walkIn');
    return customers.find((c) => c.id === s.customerId)?.name ?? '—';
  }

  function rowProfit(s: Sale) {
    return computeSaleProfit(s, purchases, sales);
  }

  const exportRows = useMemo(
    () => buildSalesExportRows(filteredSales, purchases, sales, customers),
    [filteredSales, purchases, sales, customers],
  );

  function printOneSale(s: Sale) {
    const rows = buildSalesExportRows([s], purchases, sales, customers);
    printTable({
      title: `Sale — ${s.teaName} (${s.date})`,
      subtitle: customerLabel(s),
      columns: SALES_EXPORT_COLUMNS,
      rows,
    });
  }

  return (
    <div className="page">
      <PageBanner titleKey="dukaan.title" subtitle="Record sales & track daily profit" icon="🏪" accent="green" />
      <PageTitle k="dukaan.title" />

      <form className="card form-card" onSubmit={handleSubmit}>
        <SectionTitle k="dukaan.newSale" />
        <div className="form-grid">
          <FormField labelKey="common.date" value={date} onChange={setDate} type="date" required />
          <label className="form-field">
            <FieldLabel labelKey="dukaan.teaName" />
            <input
              list="tea-names"
              value={teaName}
              onChange={(e) => setTeaName(e.target.value)}
              required
            />
            <datalist id="tea-names">
              {teaNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </label>
          <FormField labelKey="dukaan.quantityKg" value={quantityKg} onChange={setQuantityKg} type="number" min={0} step={0.01} required />
          <FormField labelKey="dukaan.salePricePerKg" value={salePricePerKg} onChange={setSalePricePerKg} type="number" min={0} step={0.01} required />
          <ReadOnlyField
            labelKey="dukaan.purchasePricePerKg"
            value={
              godaamPrice.hasPurchase
                ? formatCurrency(godaamPrice.avgCostPerKg)
                : '—'
            }
          />
          {godaamPrice.hasPurchase && godaamPrice.latestPricePerKg != null && (
            <ReadOnlyField
              labelKey="dukaan.latestGodaamPrice"
              value={`${formatCurrency(godaamPrice.latestPricePerKg)} (${godaamPrice.latestPurchaseDate})`}
            />
          )}
          <p className="godaam-import-hint">{l('dukaan.purchaseFromGodaam')}</p>
          <label className="form-field">
            <FieldLabel labelKey="dukaan.customer" />
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">{l('common.walkIn')}</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.customerId})</option>
              ))}
            </select>
          </label>
          {selectedCustomer && (
            <FormField labelKey="dukaan.amountReceived" value={amountReceived} onChange={setAmountReceived} type="number" min={0} step={0.01} />
          )}
          <TextAreaField labelKey="dukaan.saleNotes" value={notes} onChange={setNotes} />
          <ImageUpload labelKey="dukaan.billImage" value={billImage} onChange={setBillImage} />
        </div>

        {/* Live profit block */}
        {(qty > 0 && price > 0) && (
          <div className="profit-block">
            <SectionTitle k="dukaan.saleSummary" />
            <div className="stat-grid profit-grid">
              <StatCard labelKey="dukaan.saleValue" value={formatCurrency(saleValue)} accent="blue" />
              <StatCard labelKey="dukaan.profit" value={formatCurrency(estimatedProfit)} accent="amber" />
              <StatCard labelKey="dukaan.profitPerKg" value={formatCurrency(estimatedProfitPerKg)} accent="green" />
              <StatCard labelKey="dukaan.profitMargin" value={`${profitMargin.toFixed(1)}%`} accent="brown" />
            </div>
            <div className="form-grid">
              <ReadOnlyField labelKey="dukaan.liveProfit" value={formatCurrency(estimatedProfit)} />
              <ReadOnlyField labelKey="dukaan.profitPerKg" value={formatCurrency(estimatedProfitPerKg)} />
            </div>
          </div>
        )}

        <div className="live-info">
          {teaName && (
            <span className={stockInfo.currentStock <= 0 ? 'warn' : 'info'}>
              {l('dukaan.liveStock')}:{' '}
              {stockInfo.currentStock > 0
                ? l('dukaan.stockAvailable', { kg: stockInfo.currentStock.toFixed(2) })
                : l('dukaan.noStock')}
            </span>
          )}
        </div>

        {error && <p className="error-msg">{error}</p>}
        <button type="submit" className="btn primary">{l('dukaan.saveSale')}</button>
      </form>

      <section className="card-section">
        <div className="section-header">
          <SectionTitle k="dukaan.salesHistory" />
          <ExportToolbar
            filenamePrefix={`dukaan-sales-${filter}`}
            title="Dukaan Sales Report"
            subtitle={`Filter: ${filter}${search ? ` · Search: ${search}` : ''}`}
            columns={SALES_EXPORT_COLUMNS}
            rows={exportRows}
          />
          <div className="filter-row">
            {FILTERS.map((f) => (
              <button key={f} type="button" className={`chip${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
                <Label k={FILTER_KEYS[f]} variant="compact" />
              </button>
            ))}
          </div>
        </div>

        {filteredSales.length > 0 && (
          <div className="stat-grid profit-grid">
            <StatCard labelKey="dukaan.totalValue" value={formatCurrency(totals.totalValue)} accent="blue" />
            <StatCard labelKey="dukaan.totalProfit" value={formatCurrency(totals.totalProfit)} accent="amber" />
            <StatCard labelKey="dukaan.totalQty" value={formatKg(totals.totalQty)} accent="green" />
          </div>
        )}

        <input className="search-input" placeholder={l('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} />

        <div className="table-wrap wide-table">
          <table>
            <thead>
              <tr>
                <th><Label k="common.date" variant="compact" /></th>
                <th><Label k="dukaan.teaName" variant="compact" /></th>
                <th>kg</th>
                <th><Label k="dukaan.purchasePricePerKg" variant="compact" /></th>
                <th><Label k="dukaan.salePricePerKg" variant="compact" /></th>
                <th><Label k="common.total" variant="compact" /></th>
                <th><Label k="dukaan.profit" variant="compact" /></th>
                <th><Label k="dukaan.profitPerKg" variant="compact" /></th>
                <th><Label k="dukaan.customer" variant="compact" /></th>
                <th><Label k="dukaan.billImage" variant="compact" /></th>
                <th><Label k="common.actions" variant="compact" /></th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.length === 0 ? (
                <tr><td colSpan={11} className="empty">{l('common.noData')}</td></tr>
              ) : (
                filteredSales.map((s) => {
                  const profit = rowProfit(s);
                  const cost = s.purchasePricePerKg ?? getStockForTea(s.teaName, purchases, sales).avgCostPerKg;
                  const pkg = profitPerKg(s.salePricePerKg, cost);
                  return (
                    <tr key={s.id}>
                      <td>{s.date}</td>
                      <td>{s.teaName}{s.notes ? <small className="row-note">{s.notes}</small> : null}</td>
                      <td>{s.quantityKg}</td>
                      <td>{s.purchasePricePerKg != null ? formatCurrency(s.purchasePricePerKg) : formatCurrency(cost)}</td>
                      <td>{formatCurrency(s.salePricePerKg)}</td>
                      <td>{formatCurrency(saleTotal(s))}</td>
                      <td className={profit >= 0 ? 'profit-positive' : 'profit-negative'}>{formatCurrency(profit)}</td>
                      <td className={pkg >= 0 ? 'profit-positive' : 'profit-negative'}>{formatCurrency(pkg)}</td>
                      <td>{customerLabel(s)}</td>
                      <td><ImageThumb src={s.billImage} /></td>
                      <td>
                        <button type="button" className="btn sm" onClick={() => printOneSale(s)} title="Print">🖨</button>
                        <button type="button" className="btn danger sm" onClick={() => handleDelete(s.id!)}>{l('common.delete')}</button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredSales.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={2}><strong>{l('common.total')}</strong></td>
                  <td>{formatKg(totals.totalQty)}</td>
                  <td colSpan={2} />
                  <td><strong>{formatCurrency(totals.totalValue)}</strong></td>
                  <td><strong className="profit-positive">{formatCurrency(totals.totalProfit)}</strong></td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </div>
  );
}
