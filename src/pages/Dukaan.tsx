import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import FormField, { FieldLabel, ReadOnlyField } from '../components/FormField';
import ImageUpload, { ImageThumb } from '../components/ImageUpload';
import ExportToolbar from '../components/ExportToolbar';
import TextAreaField from '../components/TextAreaField';
import { db } from '../db/database';
import { Label, useLabel } from '../i18n/useLabel';
import type { Sale, SaleFilter } from '../models/types';
import {
  computeSaleProfit,
  DEFAULT_BAG_WEIGHT_KG,
  filterSales,
  formatBags,
  formatCurrency,
  formatKg,
  getGodaamPurchasePrice,
  getStockForTea,
  getTeaNames,
  kgFromBags,
  profitPerKg,
  saleBagsSold,
  saleTotal,
  todayISO,
} from '../services/calculations';
import {
  buildSalesExportRows,
  printCustomerReceipt,
  printTable,
  SALES_EXPORT_COLUMNS,
} from '../services/export';
import { useShopPrintProfile } from '../hooks/useShopPrintProfile';

const FILTERS: SaleFilter[] = ['today', 'month', 'year', 'all'];
const FILTER_KEYS: Record<SaleFilter, string> = {
  today: 'dukaan.filterToday',
  month: 'dukaan.filterMonth',
  year: 'dukaan.filterYear',
  all: 'dukaan.filterAll',
};

export default function Dukaan() {
  const l = useLabel();
  const shopProfile = useShopPrintProfile();
  const sales = useLiveQuery(() => db.sales.toArray(), []) ?? [];
  const purchases = useLiveQuery(() => db.purchases.toArray(), []) ?? [];
  const customers = useLiveQuery(() => db.customers.toArray(), []) ?? [];

  const [date, setDate] = useState(todayISO());
  const [teaName, setTeaName] = useState('');
  const [bagsSold, setBagsSold] = useState('');
  const [bagWeightKg, setBagWeightKg] = useState(String(DEFAULT_BAG_WEIGHT_KG));
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
  const qty = parseFloat(quantityKg) || kgFromBags(parseFloat(bagsSold) || 0, parseFloat(bagWeightKg) || DEFAULT_BAG_WEIGHT_KG);
  const price = parseFloat(salePricePerKg) || 0;
  const stockInfo = teaName ? getStockForTea(teaName, purchases, sales) : { currentStock: 0, avgCostPerKg: 0 };
  const godaamPrice = teaName ? getGodaamPurchasePrice(teaName, purchases) : {
    avgCostPerKg: 0,
    latestPricePerKg: null,
    latestPurchaseDate: null,
    hasPurchase: false,
  };

  const effectivePurchasePrice = godaamPrice.avgCostPerKg;
  const estimatedProfit = qty > 0 && price > 0 ? profitPerKg(price, effectivePurchasePrice) * qty : 0;
  const estimatedProfitPerKg = price > 0 && effectivePurchasePrice >= 0 ? profitPerKg(price, effectivePurchasePrice) : 0;
  const profitMargin = price > 0 && effectivePurchasePrice > 0
    ? ((estimatedProfitPerKg / effectivePurchasePrice) * 100)
    : 0;
  const saleValue = qty * price;
  const selectedCustomer = customerId ? parseInt(customerId, 10) : undefined;
  const remainingDue = selectedCustomer ? Math.max(0, saleValue - (parseFloat(amountReceived) || 0)) : 0;
  const hasLivePreview = qty > 0 && price > 0;
  const stockLow = teaName !== '' && stockInfo.currentStock > 0 && stockInfo.currentStock < qty;
  const stockOut = teaName !== '' && stockInfo.currentStock <= 0;

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

  const todaySalesCount = useMemo(
    () => filterSales(sales, 'today').length,
    [sales],
  );

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
    const bagCount = Math.round(parseFloat(bagsSold) || 0);
    const bagW = parseFloat(bagWeightKg) || DEFAULT_BAG_WEIGHT_KG;
    await db.sales.add({
      date,
      teaName: teaName.trim(),
      quantityKg: qty,
      bagsSold: bagCount > 0 ? bagCount : undefined,
      bagWeightKg: bagCount > 0 ? bagW : undefined,
      salePricePerKg: price,
      purchasePricePerKg: effectivePurchasePrice || undefined,
      customerId: selectedCustomer,
      amountReceived: Math.min(received, saleValue),
      billImage,
      notes: notes.trim() || undefined,
    });
    setTeaName('');
    setBagsSold('');
    setBagWeightKg(String(DEFAULT_BAG_WEIGHT_KG));
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

  function printInternalSale(s: Sale) {
    const rows = buildSalesExportRows([s], purchases, sales, customers);
    printTable({
      title: `Sale — ${s.teaName} (${s.date})`,
      subtitle: customerLabel(s),
      shopProfile,
      columns: SALES_EXPORT_COLUMNS,
      rows,
    });
  }

  function printOneSale(s: Sale) {
    if (s.customerId) {
      const customer = customers.find((c) => c.id === s.customerId);
      printCustomerReceipt({
        sale: s,
        customer,
        customerName: customer ? undefined : customerLabel(s),
        shopProfile,
      });
      return;
    }
    printInternalSale(s);
  }

  return (
    <div className="page dukaan-page dukaan-pro">
      <header className="duk-topbar animate-fade-in-up">
        <div>
          <p className="duk-eyebrow">Point of sale</p>
          <h1 className="duk-title">
            <Label k="dukaan.title" variant="stacked" />
          </h1>
          <p className="duk-meta">
            <span>{todayISO()}</span>
            <span className="duk-meta-dot" aria-hidden />
            <span>{todaySalesCount} sales today</span>
            <span className="duk-meta-dot" aria-hidden />
            <span>{teaNames.length} teas in godaam</span>
          </p>
        </div>
        <div className="duk-topbar-actions">
          <ExportToolbar
            filenamePrefix={`dukaan-sales-${filter}`}
            title="Dukaan Sales Report"
            subtitle={`Filter: ${filter}${search ? ` · Search: ${search}` : ''}`}
            columns={SALES_EXPORT_COLUMNS}
            rows={exportRows}
            compact
          />
        </div>
      </header>

      <div className="duk-layout">
        <form className="duk-panel duk-sale-form animate-fade-in-up stagger-1" onSubmit={handleSubmit}>
          <div className="duk-panel-head">
            <div>
              <h2 className="duk-panel-title">
                <Label k="dukaan.newSale" variant="stacked" />
              </h2>
              <p className="duk-panel-sub">Enter tea, quantity, and rate to record a sale</p>
            </div>
          </div>

          <div className="duk-form-sections">
            <div className="duk-form-section">
              <h3 className="duk-section-label">Item & quantity</h3>
              <div className="form-grid">
                <FormField labelKey="common.date" value={date} onChange={setDate} type="date" required />
                <label className="form-field">
                  <FieldLabel labelKey="dukaan.teaName" />
                  <input
                    list="tea-names"
                    value={teaName}
                    onChange={(e) => setTeaName(e.target.value)}
                    required
                    placeholder="Select or type tea name"
                  />
                  <datalist id="tea-names">
                    {teaNames.map((n) => (
                      <option key={n} value={n} />
                    ))}
                  </datalist>
                </label>
                <FormField
                  labelKey="dukaan.bagsSold"
                  value={bagsSold}
                  onChange={(v) => {
                    setBagsSold(v);
                    const b = Math.round(parseFloat(v) || 0);
                    const bw = parseFloat(bagWeightKg) || DEFAULT_BAG_WEIGHT_KG;
                    if (b > 0) setQuantityKg(String(kgFromBags(b, bw)));
                  }}
                  type="number"
                  min={0}
                  step={1}
                  placeholder="0"
                />
                <FormField
                  labelKey="dukaan.bagWeight"
                  value={bagWeightKg}
                  onChange={(v) => {
                    setBagWeightKg(v);
                    const b = Math.round(parseFloat(bagsSold) || 0);
                    const bw = parseFloat(v) || DEFAULT_BAG_WEIGHT_KG;
                    if (b > 0) setQuantityKg(String(kgFromBags(b, bw)));
                  }}
                  type="number"
                  min={0}
                  step={0.01}
                />
                <FormField
                  labelKey="dukaan.quantityKg"
                  value={quantityKg}
                  onChange={setQuantityKg}
                  type="number"
                  min={0}
                  step={0.01}
                  required
                />
                <FormField
                  labelKey="dukaan.salePricePerKg"
                  value={salePricePerKg}
                  onChange={setSalePricePerKg}
                  type="number"
                  min={0}
                  step={0.01}
                  required
                />
              </div>
            </div>

            <div className="duk-form-section">
              <h3 className="duk-section-label">Cost & customer</h3>
              <div className="form-grid">
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
                <p className="godaam-import-hint duk-hint">{l('dukaan.purchaseFromGodaam')}</p>
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
                  <FormField
                    labelKey="dukaan.amountReceived"
                    value={amountReceived}
                    onChange={setAmountReceived}
                    type="number"
                    min={0}
                    step={0.01}
                  />
                )}
                <TextAreaField labelKey="dukaan.saleNotes" value={notes} onChange={setNotes} />
                <ImageUpload labelKey="dukaan.billImage" value={billImage} onChange={setBillImage} />
              </div>
            </div>
          </div>

          {error && <p className="error-msg">{error}</p>}

          <div className="duk-form-actions">
            <button type="submit" className="btn primary duk-save-btn">
              {l('dukaan.saveSale')}
            </button>
          </div>
        </form>

        <aside className="duk-side animate-fade-in-up stagger-2">
          <section className={`duk-panel duk-stock-card${stockOut ? ' is-out' : stockLow ? ' is-low' : ''}`}>
            <h3 className="duk-side-title">Stock check</h3>
            {!teaName ? (
              <p className="duk-side-empty">Select a tea to see available stock.</p>
            ) : (
              <>
                <p className="duk-stock-name">{teaName}</p>
                <strong className="duk-stock-value">
                  {stockInfo.currentStock > 0
                    ? formatKg(stockInfo.currentStock)
                    : l('dukaan.noStock')}
                </strong>
                <p className="duk-stock-status">
                  {stockOut && 'Out of stock — add purchase in Godaam first'}
                  {stockLow && !stockOut && 'Low for this sale quantity'}
                  {!stockOut && !stockLow && godaamPrice.hasPurchase && 'Ready to sell'}
                  {!godaamPrice.hasPurchase && 'No Godaam purchase found for this tea'}
                </p>
              </>
            )}
          </section>

          <section className="duk-panel duk-preview-card">
            <h3 className="duk-side-title">
              <Label k="dukaan.saleSummary" variant="compact" />
            </h3>
            {!hasLivePreview ? (
              <p className="duk-side-empty">Enter quantity and sale rate to preview totals.</p>
            ) : (
              <dl className="duk-preview-list">
                <div>
                  <dt>
                    <Label k="dukaan.saleValue" variant="compact" />
                  </dt>
                  <dd>{formatCurrency(saleValue)}</dd>
                </div>
                <div>
                  <dt>
                    <Label k="dukaan.profit" variant="compact" />
                  </dt>
                  <dd className={estimatedProfit >= 0 ? 'is-profit' : 'is-loss'}>
                    {formatCurrency(estimatedProfit)}
                  </dd>
                </div>
                <div>
                  <dt>
                    <Label k="dukaan.profitPerKg" variant="compact" />
                  </dt>
                  <dd>{formatCurrency(estimatedProfitPerKg)}</dd>
                </div>
                <div>
                  <dt>
                    <Label k="dukaan.profitMargin" variant="compact" />
                  </dt>
                  <dd>{profitMargin.toFixed(1)}%</dd>
                </div>
                {selectedCustomer && (
                  <div>
                    <dt>Remaining dues</dt>
                    <dd className={remainingDue > 0 ? 'is-due' : undefined}>
                      {formatCurrency(remainingDue)}
                    </dd>
                  </div>
                )}
              </dl>
            )}
          </section>
        </aside>
      </div>

      <section className="duk-panel duk-history animate-fade-in-up stagger-3">
        <div className="duk-panel-head duk-history-head">
          <div>
            <h2 className="duk-panel-title">
              <Label k="dukaan.salesHistory" variant="stacked" />
            </h2>
            <p className="duk-panel-sub">Filter, search, and export recorded sales</p>
          </div>
          <ExportToolbar
            filenamePrefix={`dukaan-sales-${filter}`}
            title="Dukaan Sales Report"
            subtitle={`Filter: ${filter}${search ? ` · Search: ${search}` : ''}`}
            columns={SALES_EXPORT_COLUMNS}
            rows={exportRows}
            compact
          />
        </div>

        <div className="duk-toolbar">
          <div className="duk-filters">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                className={`duk-chip${filter === f ? ' is-active' : ''}`}
                onClick={() => setFilter(f)}
              >
                <Label k={FILTER_KEYS[f]} variant="compact" />
              </button>
            ))}
          </div>
          <input
            className="search-input duk-search"
            placeholder={l('common.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {filteredSales.length > 0 && (
          <div className="duk-kpi-row">
            <article className="duk-kpi duk-kpi-primary">
              <span className="duk-kpi-label">
                <Label k="dukaan.totalValue" variant="compact" />
              </span>
              <strong className="duk-kpi-value">{formatCurrency(totals.totalValue)}</strong>
            </article>
            <article className="duk-kpi">
              <span className="duk-kpi-label">
                <Label k="dukaan.totalProfit" variant="compact" />
              </span>
              <strong className="duk-kpi-value">{formatCurrency(totals.totalProfit)}</strong>
            </article>
            <article className="duk-kpi">
              <span className="duk-kpi-label">
                <Label k="dukaan.totalQty" variant="compact" />
              </span>
              <strong className="duk-kpi-value">{formatKg(totals.totalQty)}</strong>
            </article>
            <article className="duk-kpi">
              <span className="duk-kpi-label">Sales</span>
              <strong className="duk-kpi-value">{filteredSales.length}</strong>
            </article>
          </div>
        )}

        <div className="table-wrap wide-table duk-table-wrap">
          <table className="duk-table">
            <thead>
              <tr>
                <th><Label k="common.date" variant="compact" /></th>
                <th><Label k="dukaan.teaName" variant="compact" /></th>
                <th><Label k="dukaan.bagsSold" variant="compact" /></th>
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
                <tr>
                  <td colSpan={12} className="empty">{l('common.noData')}</td>
                </tr>
              ) : (
                filteredSales.map((s) => {
                  const isCustomerSale = !!s.customerId;
                  const profit = rowProfit(s);
                  const cost = s.purchasePricePerKg ?? getStockForTea(s.teaName, purchases, sales).avgCostPerKg;
                  const pkg = profitPerKg(s.salePricePerKg, cost);
                  return (
                    <tr key={s.id}>
                      <td>{s.date}</td>
                      <td className="duk-item-name">
                        {s.teaName}
                        {s.notes ? <small className="row-note">{s.notes}</small> : null}
                      </td>
                      <td>{formatBags(saleBagsSold(s))}</td>
                      <td>{formatKg(s.quantityKg)}</td>
                      <td>
                        {isCustomerSale
                          ? '—'
                          : (s.purchasePricePerKg != null
                            ? formatCurrency(s.purchasePricePerKg)
                            : formatCurrency(cost))}
                      </td>
                      <td>{formatCurrency(s.salePricePerKg)}</td>
                      <td className="duk-num">{formatCurrency(saleTotal(s))}</td>
                      <td className={isCustomerSale ? undefined : profit >= 0 ? 'profit-positive' : 'profit-negative'}>
                        {isCustomerSale ? '—' : formatCurrency(profit)}
                      </td>
                      <td className={isCustomerSale ? undefined : pkg >= 0 ? 'profit-positive' : 'profit-negative'}>
                        {isCustomerSale ? '—' : formatCurrency(pkg)}
                      </td>
                      <td>{customerLabel(s)}</td>
                      <td><ImageThumb src={s.billImage} /></td>
                      <td className="duk-actions">
                        <button
                          type="button"
                          className="btn sm"
                          onClick={() => printOneSale(s)}
                          title={s.customerId ? l('customers.printReceipt') : l('dukaan.printInternal')}
                        >
                          🖨
                        </button>
                        {s.customerId ? (
                          <button
                            type="button"
                            className="btn sm"
                            onClick={() => printInternalSale(s)}
                            title={l('dukaan.printInternal')}
                          >
                            📋
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="btn danger sm"
                          onClick={() => handleDelete(s.id!)}
                        >
                          {l('common.delete')}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredSales.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={3}><strong>{l('common.total')}</strong></td>
                  <td><strong>{formatKg(totals.totalQty)}</strong></td>
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
