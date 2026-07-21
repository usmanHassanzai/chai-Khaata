import { useMemo, useState } from 'react';
import FormField, { FieldLabel, ReadOnlyField } from '../components/FormField';
import ImageUpload, { ImageThumb } from '../components/ImageUpload';
import ExportToolbar from '../components/ExportToolbar';
import TextAreaField from '../components/TextAreaField';
import { db } from '../db/database';
import { useLedgerLive } from '../hooks/useLedgerLive';
import { flushLedgerPushNow } from '../services/ledgerSync';
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
  nowISO,
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

type SaleStep = 1 | 2 | 3;
type QtyMode = 'bags' | 'kg';

export default function Dukaan() {
  const l = useLabel();
  const shopProfile = useShopPrintProfile();
  const { sales, purchases, customers } = useLedgerLive();

  const [step, setStep] = useState<SaleStep>(1);
  const [qtyMode, setQtyMode] = useState<QtyMode>('bags');
  const [showMore, setShowMore] = useState(false);
  const [fullHistory, setFullHistory] = useState(false);

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

  function resetForm() {
    setStep(1);
    setQtyMode('bags');
    setShowMore(false);
    setTeaName('');
    setBagsSold('');
    setBagWeightKg(String(DEFAULT_BAG_WEIGHT_KG));
    setQuantityKg('');
    setSalePricePerKg('');
    setCustomerId('');
    setAmountReceived('');
    setBillImage(undefined);
    setNotes('');
    setError('');
    setDate(todayISO());
  }

  function selectTea(name: string) {
    setTeaName(name);
    setError('');
  }

  function canGoStep2() {
    return teaName.trim().length > 0 && godaamPrice.hasPurchase && !stockOut;
  }

  function canGoStep3() {
    return qty > 0 && price > 0 && qty <= stockInfo.currentStock;
  }

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
      history: selectedCustomer
        ? [{
            id: `create-${Date.now()}`,
            at: nowISO(),
            type: 'create',
            summary: `Sale created — ${formatKg(qty)} @ ${formatCurrency(price)}/kg`,
            amount: Math.min(received, saleValue),
          }]
        : undefined,
    });
    flushLedgerPushNow();
    resetForm();
  }

  async function handleDelete(id: number) {
    if (window.confirm(l('common.confirmDelete'))) {
      await db.sales.delete(id);
      flushLedgerPushNow();
    }
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
    <div className="page dukaan-page dukaan-pro dukaan-easy">
      <header className="duk-topbar animate-fade-in-up">
        <div>
          <p className="duk-eyebrow">POS · Easy sale</p>
          <h1 className="duk-title">
            <Label k="dukaan.title" variant="compact" />
          </h1>
          <p className="duk-meta">
            <span>{todayISO()}</span>
            <span className="duk-meta-dot" aria-hidden />
            <span>{todaySalesCount} · <Label k="dukaan.filterToday" variant="compact" /></span>
          </p>
        </div>
      </header>

      <div className="duk-layout duk-layout-easy">
        <form className="duk-panel duk-sale-form animate-fade-in-up stagger-1" onSubmit={handleSubmit}>
          <div className="duk-panel-head">
            <div>
              <h2 className="duk-panel-title">
                <Label k="dukaan.newSale" variant="compact" />
              </h2>
            </div>
          </div>

          <ol className="sale-steps" aria-label="Sale steps">
            {([1, 2, 3] as SaleStep[]).map((n) => (
              <li key={n} className={`sale-step${step === n ? ' is-active' : ''}${step > n ? ' is-done' : ''}`}>
                <button
                  type="button"
                  className="sale-step-btn"
                  onClick={() => {
                    if (n === 1) setStep(1);
                    else if (n === 2 && canGoStep2()) setStep(2);
                    else if (n === 3 && canGoStep2() && canGoStep3()) setStep(3);
                  }}
                >
                  <span className="sale-step-num">{n}</span>
                  <span className="sale-step-label">
                    <Label
                      k={n === 1 ? 'dukaan.stepTea' : n === 2 ? 'dukaan.stepQty' : 'dukaan.stepPay'}
                      variant="compact"
                    />
                  </span>
                </button>
              </li>
            ))}
          </ol>

          {step === 1 && (
            <div className="sale-step-body">
              <h3 className="sale-step-title"><Label k="dukaan.stepTeaTitle" variant="compact" /></h3>
              {teaNames.length === 0 ? (
                <p className="error-msg">{l('dukaan.noGodaamPurchase')}</p>
              ) : (
                <div className="tea-chip-grid">
                  {teaNames.map((name) => {
                    const stock = getStockForTea(name, purchases, sales);
                    const active = teaName === name;
                    return (
                      <button
                        key={name}
                        type="button"
                        className={`tea-chip${active ? ' is-active' : ''}${stock.currentStock <= 0 ? ' is-empty' : ''}`}
                        onClick={() => selectTea(name)}
                      >
                        <strong>{name}</strong>
                        <span>{formatKg(stock.currentStock)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              <label className="form-field sale-tea-type">
                <FieldLabel labelKey="dukaan.teaName" />
                <input
                  list="tea-names"
                  value={teaName}
                  onChange={(e) => selectTea(e.target.value)}
                  placeholder={l('dukaan.teaName')}
                />
                <datalist id="tea-names">
                  {teaNames.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </label>

              {teaName && (
                <div className={`sale-stock-banner${stockOut ? ' is-out' : stockLow ? ' is-low' : ' is-ok'}`}>
                  <strong>{formatKg(stockInfo.currentStock)}</strong>
                  <span>
                    {stockOut
                      ? l('dukaan.stockOutHint')
                      : !godaamPrice.hasPurchase
                        ? l('dukaan.noGodaamPurchase')
                        : stockLow
                          ? l('dukaan.stockLowHint')
                          : l('dukaan.stockReady')}
                  </span>
                </div>
              )}

              <div className="sale-step-actions">
                <button
                  type="button"
                  className="btn primary"
                  disabled={!canGoStep2()}
                  onClick={() => setStep(2)}
                >
                  {l('dukaan.nextStep')} →
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="sale-step-body">
              <h3 className="sale-step-title"><Label k="dukaan.stepQtyTitle" variant="compact" /></h3>
              <p className="sale-selected-tea">{teaName}</p>

              <div className="qty-mode-toggle" role="group">
                <button
                  type="button"
                  className={`qty-mode-btn${qtyMode === 'bags' ? ' is-active' : ''}`}
                  onClick={() => setQtyMode('bags')}
                >
                  <Label k="dukaan.qtyByBags" variant="compact" />
                </button>
                <button
                  type="button"
                  className={`qty-mode-btn${qtyMode === 'kg' ? ' is-active' : ''}`}
                  onClick={() => setQtyMode('kg')}
                >
                  <Label k="dukaan.qtyByKg" variant="compact" />
                </button>
              </div>

              <div className="form-grid sale-qty-grid">
                {qtyMode === 'bags' ? (
                  <FormField
                    labelKey="dukaan.bagsSold"
                    value={bagsSold}
                    onChange={(v) => {
                      setBagsSold(v);
                      const b = Math.round(parseFloat(v) || 0);
                      const bw = parseFloat(bagWeightKg) || DEFAULT_BAG_WEIGHT_KG;
                      if (b > 0) setQuantityKg(String(kgFromBags(b, bw)));
                      else setQuantityKg('');
                    }}
                    type="number"
                    min={0}
                    step={1}
                    required
                    placeholder="0"
                  />
                ) : (
                  <FormField
                    labelKey="dukaan.quantityKg"
                    value={quantityKg}
                    onChange={(v) => {
                      setQuantityKg(v);
                      setBagsSold('');
                    }}
                    type="number"
                    min={0}
                    step={0.01}
                    required
                  />
                )}
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

              {hasLivePreview && (
                <div className="sale-total-hero">
                  <span><Label k="dukaan.saleValue" variant="compact" /></span>
                  <strong>{formatCurrency(saleValue)}</strong>
                </div>
              )}

              <button
                type="button"
                className="btn sm sale-more-toggle"
                onClick={() => setShowMore((v) => !v)}
              >
                {showMore ? l('dukaan.hideOptions') : l('dukaan.moreOptions')}
              </button>

              {showMore && (
                <div className="sale-more-panel form-grid">
                  <FormField labelKey="common.date" value={date} onChange={setDate} type="date" />
                  {qtyMode === 'bags' && (
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
                  )}
                  {qtyMode === 'bags' && quantityKg && (
                    <ReadOnlyField labelKey="dukaan.quantityKg" value={formatKg(qty)} />
                  )}
                  <ReadOnlyField
                    labelKey="dukaan.purchasePricePerKg"
                    value={godaamPrice.hasPurchase ? formatCurrency(godaamPrice.avgCostPerKg) : '—'}
                  />
                  <TextAreaField labelKey="dukaan.saleNotes" value={notes} onChange={setNotes} />
                  <ImageUpload labelKey="dukaan.billImage" value={billImage} onChange={setBillImage} />
                </div>
              )}

              <div className="sale-step-actions">
                <button type="button" className="btn" onClick={() => setStep(1)}>
                  ← {l('dukaan.backStep')}
                </button>
                <button
                  type="button"
                  className="btn primary"
                  disabled={!canGoStep3()}
                  onClick={() => {
                    if (qty > stockInfo.currentStock) {
                      setError(l('dukaan.stockError'));
                      return;
                    }
                    setError('');
                    setStep(3);
                  }}
                >
                  {l('dukaan.nextStep')} →
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="sale-step-body">
              <h3 className="sale-step-title"><Label k="dukaan.stepPayTitle" variant="compact" /></h3>

              <div className="sale-confirm-card">
                <div><span>{teaName}</span><strong>{formatKg(qty)}</strong></div>
                <div><span><Label k="dukaan.salePricePerKg" variant="compact" /></span><strong>{formatCurrency(price)}</strong></div>
                <div className="is-total"><span><Label k="dukaan.saleValue" variant="compact" /></span><strong>{formatCurrency(saleValue)}</strong></div>
              </div>

              <label className="form-field">
                <FieldLabel labelKey="dukaan.customer" />
                <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">{l('common.walkIn')}</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.customerId})</option>
                  ))}
                </select>
              </label>

              {selectedCustomer ? (
                <>
                  <FormField
                    labelKey="dukaan.amountReceived"
                    value={amountReceived}
                    onChange={setAmountReceived}
                    type="number"
                    min={0}
                    step={0.01}
                  />
                  <div className={`sale-due-line${remainingDue > 0 ? ' is-due' : ''}`}>
                    <Label k="dukaan.remainingDue" variant="compact" />
                    <strong>{formatCurrency(remainingDue)}</strong>
                  </div>
                </>
              ) : (
                <p className="sale-walkin-note">{l('common.walkIn')} — {formatCurrency(saleValue)}</p>
              )}

              {error && <p className="error-msg">{error}</p>}

              <div className="sale-step-actions">
                <button type="button" className="btn" onClick={() => setStep(2)}>
                  ← {l('dukaan.backStep')}
                </button>
                <button type="submit" className="btn primary duk-save-btn">
                  {l('dukaan.saveSale')}
                </button>
              </div>
            </div>
          )}
        </form>

        <aside className="duk-side animate-fade-in-up stagger-2">
          <section className={`duk-panel duk-stock-card${stockOut ? ' is-out' : stockLow ? ' is-low' : ''}`}>
            <h3 className="duk-side-title"><Label k="dukaan.liveStock" variant="compact" /></h3>
            {!teaName ? (
              <p className="duk-side-empty"><Label k="dukaan.stepTeaTitle" variant="compact" /></p>
            ) : (
              <>
                <p className="duk-stock-name">{teaName}</p>
                <strong className="duk-stock-value">
                  {stockInfo.currentStock > 0 ? formatKg(stockInfo.currentStock) : l('dukaan.noStock')}
                </strong>
              </>
            )}
          </section>

          <section className="duk-panel duk-preview-card">
            <h3 className="duk-side-title"><Label k="dukaan.saleSummary" variant="compact" /></h3>
            {!hasLivePreview ? (
              <p className="duk-side-empty"><Label k="dukaan.stepQtyTitle" variant="compact" /></p>
            ) : (
              <dl className="duk-preview-list">
                <div>
                  <dt><Label k="dukaan.saleValue" variant="compact" /></dt>
                  <dd>{formatCurrency(saleValue)}</dd>
                </div>
                <div>
                  <dt><Label k="dukaan.profit" variant="compact" /></dt>
                  <dd className={estimatedProfit >= 0 ? 'is-profit' : 'is-loss'}>{formatCurrency(estimatedProfit)}</dd>
                </div>
                {selectedCustomer && (
                  <div>
                    <dt><Label k="dukaan.remainingDue" variant="compact" /></dt>
                    <dd className={remainingDue > 0 ? 'is-due' : undefined}>{formatCurrency(remainingDue)}</dd>
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
            <h2 className="duk-panel-title"><Label k="dukaan.salesHistory" variant="compact" /></h2>
          </div>
          <div className="duk-history-toggles">
            <button
              type="button"
              className={`duk-chip${!fullHistory ? ' is-active' : ''}`}
              onClick={() => setFullHistory(false)}
            >
              <Label k="dukaan.simpleHistory" variant="compact" />
            </button>
            <button
              type="button"
              className={`duk-chip${fullHistory ? ' is-active' : ''}`}
              onClick={() => setFullHistory(true)}
            >
              <Label k="dukaan.fullHistory" variant="compact" />
            </button>
            <ExportToolbar
              filenamePrefix={`dukaan-sales-${filter}`}
              title="Dukaan Sales Report"
              subtitle={`Filter: ${filter}${search ? ` · Search: ${search}` : ''}`}
              columns={SALES_EXPORT_COLUMNS}
              rows={exportRows}
              compact
            />
          </div>
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
              <span className="duk-kpi-label"><Label k="dukaan.totalValue" variant="compact" /></span>
              <strong className="duk-kpi-value">{formatCurrency(totals.totalValue)}</strong>
            </article>
            <article className="duk-kpi">
              <span className="duk-kpi-label"><Label k="dukaan.totalQty" variant="compact" /></span>
              <strong className="duk-kpi-value">{formatKg(totals.totalQty)}</strong>
            </article>
            <article className="duk-kpi">
              <span className="duk-kpi-label"><Label k="dukaan.totalProfit" variant="compact" /></span>
              <strong className="duk-kpi-value">{formatCurrency(totals.totalProfit)}</strong>
            </article>
          </div>
        )}

        {/* Simple card list — default for less educated users */}
        {!fullHistory && (
          <div className="sale-simple-list">
            {filteredSales.length === 0 ? (
              <p className="empty">{l('common.noData')}</p>
            ) : (
              filteredSales.map((s) => {
                const dues = Math.max(0, saleTotal(s) - s.amountReceived);
                return (
                  <article key={s.id} className="sale-simple-card">
                    <div className="sale-simple-top">
                      <div>
                        <strong>{s.teaName}</strong>
                        <span>{s.date} · {customerLabel(s)}</span>
                      </div>
                      <strong className="sale-simple-amount">{formatCurrency(saleTotal(s))}</strong>
                    </div>
                    <div className="sale-simple-meta">
                      <span>{formatKg(s.quantityKg)}</span>
                      {dues > 0 && <span className="warn-text">{l('dukaan.remainingDue')}: {formatCurrency(dues)}</span>}
                    </div>
                    <div className="sale-simple-actions">
                      <button type="button" className="btn sm" onClick={() => printOneSale(s)}>🖨</button>
                      <button type="button" className="btn danger sm" onClick={() => handleDelete(s.id!)}>
                        {l('common.delete')}
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        )}

        {fullHistory && (
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
                    const isCustomerSale = !!s.customerId;
                    const profit = rowProfit(s);
                    const cost = s.purchasePricePerKg ?? getStockForTea(s.teaName, purchases, sales).avgCostPerKg;
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
                            : formatCurrency(s.purchasePricePerKg ?? cost)}
                        </td>
                        <td>{formatCurrency(s.salePricePerKg)}</td>
                        <td className="duk-num">{formatCurrency(saleTotal(s))}</td>
                        <td className={isCustomerSale ? undefined : profit >= 0 ? 'profit-positive' : 'profit-negative'}>
                          {isCustomerSale ? '—' : formatCurrency(profit)}
                        </td>
                        <td>{customerLabel(s)}</td>
                        <td><ImageThumb src={s.billImage} /></td>
                        <td className="duk-actions">
                          <button type="button" className="btn sm" onClick={() => printOneSale(s)}>🖨</button>
                          <button type="button" className="btn danger sm" onClick={() => handleDelete(s.id!)}>
                            {l('common.delete')}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
