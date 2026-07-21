import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import FormField, { FieldLabel, ReadOnlyField } from '../components/FormField';
import ImageUpload, { ImageThumb } from '../components/ImageUpload';
import PageBanner from '../components/PageBanner';
import PhoneLink from '../components/PhoneLink';
import ExportToolbar from '../components/ExportToolbar';
import TextAreaField from '../components/TextAreaField';
import { db, nextCustomerId } from '../db/database';
import { flushLedgerPushNow } from '../services/ledgerSync';
import { Label, PageTitle, SectionTitle, useLabel } from '../i18n/useLabel';
import type { Customer, Sale } from '../models/types';
import {
  computeCustomerSummary,
  DEFAULT_BAG_WEIGHT_KG,
  formatBags,
  formatCurrency,
  formatDateTime,
  formatKg,
  getGodaamPurchasePrice,
  getStockForTea,
  getTeaNames,
  kgFromBags,
  nowISO,
  profitPerKg,
  saleBagsSold,
  saleCurrentPayment,
  salePreviousPaid,
  saleTotal,
  todayISO,
} from '../services/calculations';
import {
  buildCustomerLedgerExportRows,
  buildCustomerSummaryExportRows,
  CUSTOMER_LEDGER_COLUMNS,
  CUSTOMER_SUMMARY_COLUMNS,
  downloadCustomerFullHistoryPdf,
  printCustomerFullHistory,
  printCustomerReceipt,
} from '../services/export';
import { useShopPrintProfile } from '../hooks/useShopPrintProfile';

function ReadOnlyDisplay({ labelKey, value }: { labelKey: string; value: string }) {
  return (
    <div className="form-field readonly">
      <FieldLabel labelKey={labelKey} />
      <span className="readonly-value">{value}</span>
    </div>
  );
}

export default function Customers() {
  const l = useLabel();
  const shopProfile = useShopPrintProfile();
  const customers = useLiveQuery(() => db.customers.toArray(), []) ?? [];
  const sales = useLiveQuery(() => db.sales.toArray(), []) ?? [];
  const purchases = useLiveQuery(() => db.purchases.toArray(), []) ?? [];
  const payments = useLiveQuery(() => db.payments.toArray(), []) ?? [];

  // Add customer
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [registerDate, setRegisterDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [profilePicture, setProfilePicture] = useState<string | undefined>();
  const [previewId, setPreviewId] = useState('CUST-????');

  // Edit customer
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editRegisterDate, setEditRegisterDate] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editPicture, setEditPicture] = useState<string | undefined>();

  // Quick sale for customer
  const [saleCustomerId, setSaleCustomerId] = useState('');
  const [saleDate, setSaleDate] = useState(todayISO());
  const [saleTea, setSaleTea] = useState('');
  const [saleBags, setSaleBags] = useState('');
  const [saleBagWeight, setSaleBagWeight] = useState(String(DEFAULT_BAG_WEIGHT_KG));
  const [saleQty, setSaleQty] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [saleReceived, setSaleReceived] = useState('');
  const [saleBillImage, setSaleBillImage] = useState<string | undefined>();
  const [saleNotes, setSaleNotes] = useState('');
  const [saleError, setSaleError] = useState('');
  const [saleExternalTea, setSaleExternalTea] = useState(false);
  const [saleManualPurchasePrice, setSaleManualPurchasePrice] = useState('');

  const [editSaleId, setEditSaleId] = useState<number | null>(null);
  const [editSaleDate, setEditSaleDate] = useState(todayISO());
  const [editSaleTea, setEditSaleTea] = useState('');
  const [editSaleBags, setEditSaleBags] = useState('');
  const [editSaleBagWeight, setEditSaleBagWeight] = useState(String(DEFAULT_BAG_WEIGHT_KG));
  const [editSaleQty, setEditSaleQty] = useState('');
  const [editSalePrice, setEditSalePrice] = useState('');
  const [editSaleReceived, setEditSaleReceived] = useState('');
  const [editSaleBillImage, setEditSaleBillImage] = useState<string | undefined>();
  const [editSaleNotes, setEditSaleNotes] = useState('');
  const [editSaleExternalTea, setEditSaleExternalTea] = useState(false);
  const [editSaleManualPurchasePrice, setEditSaleManualPurchasePrice] = useState('');
  const [editSaleError, setEditSaleError] = useState('');

  const [payDuesSaleId, setPayDuesSaleId] = useState<number | null>(null);
  const [payDuesAmount, setPayDuesAmount] = useState('');
  const [payDuesReceipt, setPayDuesReceipt] = useState<string | undefined>();
  const [payDuesError, setPayDuesError] = useState('');

  const [detailId, setDetailId] = useState<number | null>(null);
  const [ledgerSearch, setLedgerSearch] = useState('');

  const teaNames = useMemo(() => {
    const names = new Set(getTeaNames(purchases));
    for (const s of sales) {
      if (s.teaName.trim()) names.add(s.teaName.trim());
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [purchases, sales]);

  function stockAllowsSaleQty(tea: string, qty: number, excludeSaleId?: number) {
    const stockInfo = getStockForTea(tea, purchases, sales);
    const existing = excludeSaleId ? sales.find((s) => s.id === excludeSaleId) : undefined;
    const returnedKg = existing && existing.teaName === tea ? existing.quantityKg : 0;
    return qty <= stockInfo.currentStock + returnedKg;
  }

  function resolvePurchasePrice(tea: string, external: boolean, manualPrice: string) {
    if (external) return parseFloat(manualPrice) || 0;
    return getGodaamPurchasePrice(tea, purchases).avgCostPerKg;
  }

  const quickSaleQty = parseFloat(saleQty) || (parseFloat(saleBags) || 0) * (parseFloat(saleBagWeight) || DEFAULT_BAG_WEIGHT_KG);
  const quickSalePrice = parseFloat(salePrice) || 0;
  const quickCost = resolvePurchasePrice(saleTea, saleExternalTea, saleManualPurchasePrice);
  const quickProfit = quickSaleQty > 0 && quickSalePrice > 0
    ? profitPerKg(quickSalePrice, quickCost) * quickSaleQty
    : 0;

  const customerSales = useMemo(
    () => sales.filter((s) => s.customerId).sort((a, b) => b.date.localeCompare(a.date)),
    [sales],
  );

  const filteredLedger = useMemo(() => {
    const q = ledgerSearch.toLowerCase();
    return customerSales.filter((s) => {
      if (!q) return true;
      const c = customers.find((x) => x.id === s.customerId);
      return (
        s.teaName.toLowerCase().includes(q) ||
        (c?.name.toLowerCase().includes(q) ?? false) ||
        (c?.customerId.toLowerCase().includes(q) ?? false) ||
        (c?.phone?.includes(q) ?? false)
      );
    });
  }, [customerSales, ledgerSearch, customers]);

  const customerSummaryRows = useMemo(
    () => buildCustomerSummaryExportRows(customers, sales, payments),
    [customers, sales, payments],
  );

  const customerLedgerRows = useMemo(
    () => buildCustomerLedgerExportRows(filteredLedger, customers, purchases, sales),
    [filteredLedger, customers, purchases, sales],
  );

  async function refreshPreviewId() {
    setPreviewId(await nextCustomerId());
  }

  useEffect(() => {
    refreshPreviewId();
  }, [customers.length]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const customerId = await nextCustomerId();
    const customer: Customer = {
      customerId,
      name: name.trim(),
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
      notes: notes.trim() || undefined,
      profilePicture,
      registerDate: registerDate || todayISO(),
    };
    await db.customers.add(customer);
    setName('');
    setPhone('');
    setAddress('');
    setNotes('');
    setProfilePicture(undefined);
    setRegisterDate(todayISO());
    refreshPreviewId();
  }

  async function handlePayment(customerId: number) {
    const amountStr = window.prompt(l('common.amount'));
    if (!amountStr) return;
    const amount = parseFloat(amountStr);
    if (amount <= 0) return;
    const note = window.prompt(l('common.notes')) ?? undefined;
    await db.payments.add({ date: todayISO(), customerId, amount, note: note || undefined });
  }

  async function handleDelete(id: number) {
    if (!window.confirm(l('customers.confirmDeleteCustomer'))) return;

    const customerSales = await db.sales.where('customerId').equals(id).toArray();
    const customerPayments = await db.payments.where('customerId').equals(id).toArray();

    await db.transaction('rw', [db.customers, db.sales, db.payments], async () => {
      for (const s of customerSales) {
        if (s.id != null) await db.sales.delete(s.id);
      }
      for (const p of customerPayments) {
        if (p.id != null) await db.payments.delete(p.id);
      }
      await db.customers.delete(id);
    });

    if (detailId === id) setDetailId(null);
    if (editId === id) setEditId(null);
    flushLedgerPushNow();
  }

  function openEdit(c: Customer) {
    setEditId(c.id!);
    setEditName(c.name);
    setEditPhone(c.phone ?? '');
    setEditAddress(c.address ?? '');
    setEditRegisterDate(c.registerDate ?? todayISO());
    setEditNotes(c.notes ?? '');
    setEditPicture(c.profilePicture);
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editId || !editName.trim()) return;
    await db.customers.update(editId, {
      name: editName.trim(),
      phone: editPhone.trim() || undefined,
      address: editAddress.trim() || undefined,
      registerDate: editRegisterDate || undefined,
      notes: editNotes.trim() || undefined,
      profilePicture: editPicture,
    });
    setEditId(null);
  }

  async function handleQuickSale(e: React.FormEvent) {
    e.preventDefault();
    setSaleError('');
    const cid = parseInt(saleCustomerId, 10);
    const qty = parseFloat(saleQty) || kgFromBags(parseFloat(saleBags) || 0, parseFloat(saleBagWeight) || DEFAULT_BAG_WEIGHT_KG);
    const bags = Math.round(parseFloat(saleBags) || 0);
    const bagWeight = parseFloat(saleBagWeight) || DEFAULT_BAG_WEIGHT_KG;
    const price = parseFloat(salePrice) || 0;
    if (!cid || !saleTea.trim() || qty <= 0 || price <= 0) return;

    if (!saleExternalTea) {
      if (!stockAllowsSaleQty(saleTea.trim(), qty)) {
        setSaleError(l('dukaan.stockError'));
        return;
      }
      if (!getGodaamPurchasePrice(saleTea, purchases).hasPurchase) {
        setSaleError(l('dukaan.noGodaamPurchase'));
        return;
      }
    }

    const total = qty * price;
    const received = parseFloat(saleReceived) || 0;
    const purchasePrice = resolvePurchasePrice(saleTea.trim(), saleExternalTea, saleManualPurchasePrice);

    await db.sales.add({
      date: saleDate,
      teaName: saleTea.trim(),
      quantityKg: qty,
      bagsSold: bags > 0 ? bags : undefined,
      bagWeightKg: bags > 0 ? bagWeight : undefined,
      salePricePerKg: price,
      purchasePricePerKg: purchasePrice || undefined,
      customerId: cid,
      amountReceived: Math.min(received, total),
      billImage: saleBillImage,
      notes: saleNotes.trim() || undefined,
    });

    setSaleTea('');
    setSaleBags('');
    setSaleBagWeight(String(DEFAULT_BAG_WEIGHT_KG));
    setSaleQty('');
    setSalePrice('');
    setSaleReceived('');
    setSaleBillImage(undefined);
    setSaleNotes('');
    setSaleExternalTea(false);
    setSaleManualPurchasePrice('');
  }

  function openEditSale(s: Sale) {
    if (!s.id) return;
    setEditSaleId(s.id);
    setEditSaleError('');
    setEditSaleDate(s.date);
    setEditSaleTea(s.teaName);
    setEditSaleBags(s.bagsSold != null ? String(s.bagsSold) : '');
    setEditSaleBagWeight(String(s.bagWeightKg ?? DEFAULT_BAG_WEIGHT_KG));
    setEditSaleQty(String(s.quantityKg));
    setEditSalePrice(String(s.salePricePerKg));
    setEditSaleReceived(String(s.amountReceived));
    setEditSaleBillImage(s.billImage);
    setEditSaleNotes(s.notes ?? '');
    const hasGodaam = getGodaamPurchasePrice(s.teaName, purchases).hasPurchase;
    setEditSaleExternalTea(!hasGodaam);
    setEditSaleManualPurchasePrice(
      !hasGodaam && s.purchasePricePerKg != null ? String(s.purchasePricePerKg) : '',
    );
  }

  async function handleUpdateSale(e: React.FormEvent) {
    e.preventDefault();
    setEditSaleError('');
    if (!editSaleId || !editSaleTea.trim()) return;

    const qty = parseFloat(editSaleQty) || kgFromBags(parseFloat(editSaleBags) || 0, parseFloat(editSaleBagWeight) || DEFAULT_BAG_WEIGHT_KG);
    const bags = Math.round(parseFloat(editSaleBags) || 0);
    const bagWeight = parseFloat(editSaleBagWeight) || DEFAULT_BAG_WEIGHT_KG;
    const price = parseFloat(editSalePrice) || 0;
    const received = parseFloat(editSaleReceived) || 0;
    if (qty <= 0 || price <= 0) return;

    if (!editSaleExternalTea) {
      if (!stockAllowsSaleQty(editSaleTea.trim(), qty, editSaleId)) {
        setEditSaleError(l('dukaan.stockError'));
        return;
      }
      if (!getGodaamPurchasePrice(editSaleTea, purchases).hasPurchase) {
        setEditSaleError(l('dukaan.noGodaamPurchase'));
        return;
      }
    }

    const total = qty * price;
    const purchasePrice = resolvePurchasePrice(editSaleTea.trim(), editSaleExternalTea, editSaleManualPurchasePrice);
    const existing = sales.find((s) => s.id === editSaleId);

    await db.sales.update(editSaleId, {
      date: editSaleDate,
      teaName: editSaleTea.trim(),
      quantityKg: qty,
      bagsSold: bags > 0 ? bags : undefined,
      bagWeightKg: bags > 0 ? bagWeight : undefined,
      salePricePerKg: price,
      purchasePricePerKg: purchasePrice || undefined,
      customerId: existing?.customerId,
      amountReceived: Math.min(received, total),
      billImage: editSaleBillImage,
      notes: editSaleNotes.trim() || undefined,
    });
    setEditSaleId(null);
    flushLedgerPushNow();
  }

  const editSaleQtyNum = parseFloat(editSaleQty) || (parseFloat(editSaleBags) || 0) * (parseFloat(editSaleBagWeight) || DEFAULT_BAG_WEIGHT_KG);
  const editSalePriceNum = parseFloat(editSalePrice) || 0;
  const editSaleCost = resolvePurchasePrice(editSaleTea, editSaleExternalTea, editSaleManualPurchasePrice);
  const editSaleProfit = editSaleQtyNum > 0 && editSalePriceNum > 0
    ? profitPerKg(editSalePriceNum, editSaleCost) * editSaleQtyNum
    : 0;

  function printCustomerSale(s: Sale) {
    const customer = customerForSale(s);
    printCustomerReceipt({ sale: s, customer, shopProfile });
  }

  function customerForSale(s: Sale) {
    return customers.find((c) => c.id === s.customerId);
  }

  function saleDues(s: Sale) {
    return Math.max(0, saleTotal(s) - s.amountReceived);
  }

  const payDuesSale = payDuesSaleId ? sales.find((s) => s.id === payDuesSaleId) : null;
  const payDuesRemaining = payDuesSale ? saleDues(payDuesSale) : 0;

  function openPayDues(s: Sale) {
    if (!s.id) return;
    const dues = saleDues(s);
    if (dues <= 0) return;
    setPayDuesSaleId(s.id);
    setPayDuesAmount(String(dues));
    setPayDuesReceipt(undefined);
    setPayDuesError('');
  }

  async function handlePayDues(e: React.FormEvent) {
    e.preventDefault();
    setPayDuesError('');
    if (!payDuesSaleId || !payDuesSale) return;

    const payAmount = parseFloat(payDuesAmount) || 0;
    const dues = saleDues(payDuesSale);
    if (payAmount <= 0) {
      setPayDuesError(l('customers.payDuesAmountRequired'));
      return;
    }
    if (payAmount > dues) {
      setPayDuesError(l('customers.payDuesExceedsDue'));
      return;
    }

    const paymentAt = nowISO();
    const paymentLog = `Payment ${formatCurrency(payAmount)} on ${formatDateTime(paymentAt)}`;
    const existingNotes = payDuesSale.notes?.trim() ?? '';
    const notes = existingNotes ? `${existingNotes}\n${paymentLog}` : paymentLog;

    await db.sales.update(payDuesSaleId, {
      previousAmountReceived: payDuesSale.amountReceived,
      lastPaymentAmount: payAmount,
      amountReceived: Math.min(payDuesSale.amountReceived + payAmount, saleTotal(payDuesSale)),
      lastPaymentAt: paymentAt,
      paymentReceiptImage: payDuesReceipt ?? payDuesSale.paymentReceiptImage,
      notes,
    });

    setPayDuesSaleId(null);
    flushLedgerPushNow();
  }

  function lastSaleDate(c: Customer) {
    const cs = sales.filter((s) => s.customerId === c.id);
    if (!cs.length) return '—';
    return cs.sort((a, b) => b.date.localeCompare(a.date))[0].date;
  }

  const detailCustomer = detailId ? customers.find((c) => c.id === detailId) : null;
  const detailSummary = detailCustomer ? computeCustomerSummary(detailCustomer, sales, payments) : null;
  const detailSales = detailCustomer
    ? sales.filter((s) => s.customerId === detailCustomer.id).sort((a, b) => b.date.localeCompare(a.date))
    : [];
  const detailPayments = detailCustomer
    ? payments.filter((p) => p.customerId === detailCustomer.id).sort((a, b) => b.date.localeCompare(a.date))
    : [];

  return (
    <div className="page">
      <PageBanner titleKey="customers.title" subtitle="Manage customer credit & sales" icon="👥" accent="blue" />
      <PageTitle k="customers.title" />

      {/* ── ADD CUSTOMER ── */}
      <form className="card form-card" onSubmit={handleAdd}>
        <SectionTitle k="customers.addCustomer" />
        <div className="form-grid">
          <ReadOnlyDisplay labelKey="customers.customerId" value={previewId} />
          <FormField labelKey="customers.customerName" value={name} onChange={setName} required />
          <FormField labelKey="common.phone" value={phone} onChange={setPhone} />
          <FormField labelKey="common.address" value={address} onChange={setAddress} />
          <FormField labelKey="customers.registerDate" value={registerDate} onChange={setRegisterDate} type="date" />
          <TextAreaField labelKey="common.notes" value={notes} onChange={setNotes} />
          <ImageUpload labelKey="customers.profilePicture" value={profilePicture} onChange={setProfilePicture} />
        </div>
        <button type="submit" className="btn primary">{l('customers.saveCustomer')}</button>
      </form>

      {/* ── QUICK SALE FOR CUSTOMER ── */}
      <form className="card form-card" onSubmit={handleQuickSale}>
        <SectionTitle k="customers.addSaleForCustomer" />
        <div className="form-grid">
          <label className="form-field">
            <FieldLabel labelKey="customers.customerName" />
            <select value={saleCustomerId} onChange={(e) => setSaleCustomerId(e.target.value)} required>
              <option value="">—</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.customerId})</option>
              ))}
            </select>
          </label>
          <FormField labelKey="common.date" value={saleDate} onChange={setSaleDate} type="date" required />
          <label className="form-field">
            <FieldLabel labelKey="dukaan.teaName" />
            <input
              list="cust-tea-names"
              value={saleTea}
              onChange={(e) => setSaleTea(e.target.value)}
              required
            />
            <datalist id="cust-tea-names">
              {teaNames.map((n) => <option key={n} value={n} />)}
            </datalist>
          </label>
          <label className="form-field checkbox-field">
            <input
              type="checkbox"
              checked={saleExternalTea}
              onChange={(e) => setSaleExternalTea(e.target.checked)}
            />
            <span><Label k="dukaan.otherCompanyTea" variant="compact" /></span>
          </label>
          <p className="settings-note">{l('dukaan.otherCompanyTeaHint')}</p>
          <FormField labelKey="customers.bagsSold" value={saleBags} onChange={(v) => {
            setSaleBags(v);
            const b = Math.round(parseFloat(v) || 0);
            const bw = parseFloat(saleBagWeight) || DEFAULT_BAG_WEIGHT_KG;
            if (b > 0) setSaleQty(String(kgFromBags(b, bw)));
          }} type="number" min={0} step={1} placeholder="0" />
          <FormField labelKey="customers.bagQuantity" value={saleBagWeight} onChange={(v) => {
            setSaleBagWeight(v);
            const b = Math.round(parseFloat(saleBags) || 0);
            const bw = parseFloat(v) || DEFAULT_BAG_WEIGHT_KG;
            if (b > 0) setSaleQty(String(kgFromBags(b, bw)));
          }} type="number" min={0} step={0.01} />
          <FormField labelKey="dukaan.quantityKg" value={saleQty} onChange={setSaleQty} type="number" min={0} step={0.01} required />
          {saleExternalTea ? (
            <FormField
              labelKey="dukaan.manualPurchasePrice"
              value={saleManualPurchasePrice}
              onChange={setSaleManualPurchasePrice}
              type="number"
              min={0}
              step={0.01}
            />
          ) : (
            <ReadOnlyField
              labelKey="dukaan.purchasePricePerKg"
              value={saleTea && getGodaamPurchasePrice(saleTea, purchases).hasPurchase
                ? formatCurrency(getGodaamPurchasePrice(saleTea, purchases).avgCostPerKg)
                : '—'}
            />
          )}
          <FormField labelKey="customers.salePricePerKg" value={salePrice} onChange={setSalePrice} type="number" min={0} step={0.01} required />
          <FormField labelKey="dukaan.amountReceived" value={saleReceived} onChange={setSaleReceived} type="number" min={0} step={0.01} />
          <TextAreaField labelKey="dukaan.saleNotes" value={saleNotes} onChange={setSaleNotes} />
          <ImageUpload labelKey="dukaan.billImage" value={saleBillImage} onChange={setSaleBillImage} />
        </div>
        {quickSaleQty > 0 && quickSalePrice > 0 && (
          <div className="live-info">
            <span className="info">{l('dukaan.saleValue')}: {formatCurrency(quickSaleQty * quickSalePrice)}</span>
            <span className="info profit-positive">{l('dukaan.profit')}: {formatCurrency(quickProfit)}</span>
            <span className="info">{l('dukaan.profitPerKg')}: {formatCurrency(profitPerKg(quickSalePrice, quickCost))}</span>
          </div>
        )}
        {saleError && <p className="error-msg">{saleError}</p>}
        <button type="submit" className="btn primary" disabled={customers.length === 0}>{l('dukaan.saveSale')}</button>
      </form>

      {/* ── CUSTOMER SUMMARY TABLE ── */}
      <section className="card-section">
        <div className="section-header-row">
          <SectionTitle k="customers.customerRecord" />
          <ExportToolbar
            filenamePrefix="customers-summary"
            title="Customer Summary — Dues & Amounts"
            columns={CUSTOMER_SUMMARY_COLUMNS}
            rows={customerSummaryRows}
            compact
          />
        </div>
        <div className="table-wrap wide-table">
          <table>
            <thead>
              <tr>
                <th><Label k="customers.customerId" variant="compact" /></th>
                <th><Label k="customers.customerName" variant="compact" /></th>
                <th><Label k="common.phone" variant="compact" /></th>
                <th><Label k="common.address" variant="compact" /></th>
                <th><Label k="customers.registerDate" variant="compact" /></th>
                <th><Label k="customers.totalMaal" variant="compact" /></th>
                <th><Label k="customers.totalBagsSold" variant="compact" /></th>
                <th><Label k="customers.totalAmount" variant="compact" /></th>
                <th><Label k="customers.receivingAmount" variant="compact" /></th>
                <th><Label k="customers.totalDues" variant="compact" /></th>
                <th><Label k="customers.teaNames" variant="compact" /></th>
                <th><Label k="customers.lastSaleDate" variant="compact" /></th>
                <th><Label k="customers.profilePicture" variant="compact" /></th>
                <th><Label k="common.notes" variant="compact" /></th>
                <th><Label k="common.actions" variant="compact" /></th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr><td colSpan={15} className="empty">{l('common.noData')}</td></tr>
              ) : (
                customers.map((c) => {
                  const s = computeCustomerSummary(c, sales, payments);
                  return (
                    <tr key={c.id}>
                      <td>{c.customerId}</td>
                      <td><strong>{c.name}</strong></td>
                      <td><PhoneLink phone={c.phone} /></td>
                      <td className="truncate-cell">{c.address ?? '—'}</td>
                      <td>{c.registerDate ?? '—'}</td>
                      <td>{formatKg(s.totalMaalKg)}</td>
                      <td>{formatBags(s.totalBagsSold)}</td>
                      <td>{formatCurrency(s.totalSale)}</td>
                      <td>{formatCurrency(s.receivingAmount)}</td>
                      <td className={s.pendingAmount > 0 ? 'warn-text' : ''}>{formatCurrency(s.pendingAmount)}</td>
                      <td className="tea-names-cell">{s.teaNames.length ? s.teaNames.join(', ') : '—'}</td>
                      <td>{lastSaleDate(c)}</td>
                      <td><ImageThumb src={c.profilePicture} alt={c.name} /></td>
                      <td className="truncate-cell">{c.notes ?? '—'}</td>
                      <td className="action-cell">
                        <button type="button" className="btn sm" onClick={() => setDetailId(c.id!)}>{l('customers.customerDetails')}</button>
                        <button type="button" className="btn sm" onClick={() => openEdit(c)}>{l('customers.editCustomer')}</button>
                        <button type="button" className="btn sm" onClick={() => handlePayment(c.id!)}>{l('common.addPayment')}</button>
                        <button type="button" className="btn danger sm" onClick={() => handleDelete(c.id!)}>{l('customers.deleteCustomer')}</button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── FULL SALES LEDGER (all fields visible) ── */}
      <section className="card-section">
        <div className="section-header-row">
          <SectionTitle k="customers.allSalesLedger" />
          <ExportToolbar
            filenamePrefix="customers-ledger"
            title="Customer Sales Ledger"
            subtitle={ledgerSearch ? `Search: ${ledgerSearch}` : undefined}
            columns={CUSTOMER_LEDGER_COLUMNS}
            rows={customerLedgerRows}
            compact
          />
        </div>
        <input className="search-input" placeholder={l('common.search')} value={ledgerSearch} onChange={(e) => setLedgerSearch(e.target.value)} />
        <div className="table-wrap wide-table">
          <table>
            <thead>
              <tr>
                <th><Label k="common.date" variant="compact" /></th>
                <th><Label k="customers.customerId" variant="compact" /></th>
                <th><Label k="customers.customerName" variant="compact" /></th>
                <th><Label k="common.phone" variant="compact" /></th>
                <th><Label k="dukaan.teaName" variant="compact" /></th>
                <th><Label k="customers.totalMaal" variant="compact" /></th>
                <th><Label k="customers.totalBagsSold" variant="compact" /></th>
                <th><Label k="customers.salePricePerKg" variant="compact" /></th>
                <th><Label k="customers.totalAmount" variant="compact" /></th>
                <th><Label k="customers.previousPaid" variant="compact" /></th>
                <th><Label k="customers.currentPayment" variant="compact" /></th>
                <th><Label k="customers.totalPaid" variant="compact" /></th>
                <th><Label k="customers.saleDues" variant="compact" /></th>
                <th><Label k="customers.lastPayment" variant="compact" /></th>
                <th><Label k="dukaan.billImage" variant="compact" /></th>
                <th><Label k="customers.paymentReceipt" variant="compact" /></th>
                <th><Label k="common.notes" variant="compact" /></th>
                <th><Label k="common.actions" variant="compact" /></th>
              </tr>
            </thead>
            <tbody>
              {filteredLedger.length === 0 ? (
                <tr><td colSpan={18} className="empty">{l('common.noData')}</td></tr>
              ) : (
                filteredLedger.map((s) => {
                  const c = customerForSale(s);
                  const dues = saleDues(s);
                  return (
                    <tr key={s.id}>
                      <td>{s.date}</td>
                      <td>{c?.customerId ?? '—'}</td>
                      <td>{c?.name ?? '—'}</td>
                      <td><PhoneLink phone={c?.phone} /></td>
                      <td>{s.teaName}</td>
                      <td>{formatKg(s.quantityKg)}</td>
                      <td>{formatBags(saleBagsSold(s))}</td>
                      <td>{formatCurrency(s.salePricePerKg)}</td>
                      <td>{formatCurrency(saleTotal(s))}</td>
                      <td>{formatCurrency(salePreviousPaid(s))}</td>
                      <td>{saleCurrentPayment(s) > 0 ? formatCurrency(saleCurrentPayment(s)) : '—'}</td>
                      <td>{formatCurrency(s.amountReceived)}</td>
                      <td className={dues > 0 ? 'warn-text' : ''}>{formatCurrency(dues)}</td>
                      <td>{formatDateTime(s.lastPaymentAt)}</td>
                      <td><ImageThumb src={s.billImage} /></td>
                      <td><ImageThumb src={s.paymentReceiptImage} /></td>
                      <td className="truncate-cell">{s.notes ?? '—'}</td>
                      <td className="action-cell">
                        {dues > 0 && (
                          <button type="button" className="btn sm primary" onClick={() => openPayDues(s)}>{l('customers.payDues')}</button>
                        )}
                        <button type="button" className="btn sm" onClick={() => openEditSale(s)}>{l('customers.editSale')}</button>
                        <button type="button" className="btn sm" onClick={() => printCustomerSale(s)} title={l('customers.printReceipt')}>🖨</button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── DETAIL MODAL ── */}
      {detailCustomer && detailSummary && (
        <div className="modal-overlay" onClick={() => setDetailId(null)}>
          <div className="modal card modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="customer-detail-header">
              {detailCustomer.profilePicture ? (
                <img src={detailCustomer.profilePicture} alt="" className="customer-avatar" />
              ) : (
                <div className="customer-avatar placeholder">👤</div>
              )}
              <div>
                <h3>{detailCustomer.name}</h3>
                <p><Label k="customers.customerId" variant="compact" />: <strong>{detailCustomer.customerId}</strong></p>
                <p><Label k="common.phone" variant="compact" />: <PhoneLink phone={detailCustomer.phone} /></p>
                <p><Label k="common.address" variant="compact" />: {detailCustomer.address ?? '—'}</p>
                <p><Label k="customers.registerDate" variant="compact" />: {detailCustomer.registerDate ?? '—'}</p>
              </div>
            </div>

            <div className="detail-grid">
              <div className="detail-stat"><Label k="customers.totalMaal" variant="compact" /><strong>{formatKg(detailSummary.totalMaalKg)}</strong></div>
              <div className="detail-stat"><Label k="customers.totalBagsSold" variant="compact" /><strong>{formatBags(detailSummary.totalBagsSold)}</strong></div>
              <div className="detail-stat"><Label k="customers.totalAmount" variant="compact" /><strong>{formatCurrency(detailSummary.totalSale)}</strong></div>
              <div className="detail-stat"><Label k="customers.receivingAmount" variant="compact" /><strong>{formatCurrency(detailSummary.receivingAmount)}</strong></div>
              <div className="detail-stat"><Label k="customers.totalDues" variant="compact" /><strong className={detailSummary.pendingAmount > 0 ? 'warn-text' : ''}>{formatCurrency(detailSummary.pendingAmount)}</strong></div>
            </div>

            <p><Label k="customers.teaNames" variant="compact" />: {detailSummary.teaNames.length ? detailSummary.teaNames.join(', ') : '—'}</p>
            {detailCustomer.notes && <p><Label k="common.notes" variant="compact" />: {detailCustomer.notes}</p>}

            <h4><Label k="customers.salesToCustomer" variant="compact" /></h4>
            <div className="table-wrap wide-table">
              <table>
                <thead>
                  <tr>
                    <th><Label k="common.date" variant="compact" /></th>
                    <th><Label k="dukaan.teaName" variant="compact" /></th>
                    <th>kg</th>
                    <th><Label k="customers.bagsSold" variant="compact" /></th>
                    <th><Label k="customers.salePricePerKg" variant="compact" /></th>
                    <th><Label k="customers.totalAmount" variant="compact" /></th>
                    <th><Label k="customers.previousPaid" variant="compact" /></th>
                    <th><Label k="customers.currentPayment" variant="compact" /></th>
                    <th><Label k="customers.totalPaid" variant="compact" /></th>
                    <th><Label k="customers.saleDues" variant="compact" /></th>
                    <th><Label k="customers.lastPayment" variant="compact" /></th>
                    <th><Label k="dukaan.billImage" variant="compact" /></th>
                    <th><Label k="customers.paymentReceipt" variant="compact" /></th>
                    <th><Label k="common.notes" variant="compact" /></th>
                    <th><Label k="common.actions" variant="compact" /></th>
                  </tr>
                </thead>
                <tbody>
                  {detailSales.map((s) => {
                    const dues = saleDues(s);
                    return (
                      <tr key={s.id}>
                        <td>{s.date}</td>
                        <td>{s.teaName}</td>
                        <td>{s.quantityKg}</td>
                        <td>{formatBags(saleBagsSold(s))}</td>
                        <td>{formatCurrency(s.salePricePerKg)}</td>
                        <td>{formatCurrency(saleTotal(s))}</td>
                        <td>{formatCurrency(salePreviousPaid(s))}</td>
                        <td>{saleCurrentPayment(s) > 0 ? formatCurrency(saleCurrentPayment(s)) : '—'}</td>
                        <td>{formatCurrency(s.amountReceived)}</td>
                        <td className={dues > 0 ? 'warn-text' : ''}>{formatCurrency(dues)}</td>
                        <td>{formatDateTime(s.lastPaymentAt)}</td>
                        <td><ImageThumb src={s.billImage} /></td>
                        <td><ImageThumb src={s.paymentReceiptImage} /></td>
                        <td>{s.notes ?? '—'}</td>
                        <td className="action-cell">
                          {dues > 0 && (
                            <button type="button" className="btn sm primary" onClick={() => openPayDues(s)}>{l('customers.payDues')}</button>
                          )}
                          <button type="button" className="btn sm" onClick={() => openEditSale(s)}>{l('customers.editSale')}</button>
                          <button type="button" className="btn sm" onClick={() => printCustomerSale(s)} title={l('customers.printReceipt')}>🖨</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <h4><Label k="customers.paymentsFromCustomer" variant="compact" /></h4>
            {detailPayments.length === 0 ? (
              <p className="empty">{l('common.noData')}</p>
            ) : (
              <ul className="history-list">
                {detailPayments.map((p) => (
                  <li key={p.id}>{p.date} — {formatCurrency(p.amount)} {p.note ? `(${p.note})` : ''}</li>
                ))}
              </ul>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="btn sm"
                onClick={() => printCustomerFullHistory({
                  customer: detailCustomer,
                  summary: detailSummary,
                  sales: detailSales,
                  payments: detailPayments,
                  shopProfile,
                })}
              >
                🖨 {l('export.historyPrint')}
              </button>
              <button
                type="button"
                className="btn sm"
                onClick={() => downloadCustomerFullHistoryPdf({
                  customer: detailCustomer,
                  summary: detailSummary,
                  sales: detailSales,
                  payments: detailPayments,
                  shopProfile,
                }).catch(console.error)}
              >
                📄 {l('export.historyPdf')}
              </button>
              <button type="button" className="btn danger" onClick={() => handleDelete(detailCustomer.id!)}>{l('customers.deleteCustomer')}</button>
              <button type="button" className="btn" onClick={() => setDetailId(null)}>{l('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {payDuesSaleId && payDuesSale && (
        <div className="modal-overlay" onClick={() => setPayDuesSaleId(null)}>
          <div className="modal card modal-wide" onClick={(e) => e.stopPropagation()}>
            <SectionTitle k="customers.payDuesTitle" />
            <form onSubmit={handlePayDues}>
              <div className="form-grid">
                <ReadOnlyField labelKey="dukaan.teaName" value={payDuesSale.teaName} />
                <ReadOnlyField labelKey="customers.totalAmount" value={formatCurrency(saleTotal(payDuesSale))} />
                <ReadOnlyField labelKey="customers.previousPaid" value={formatCurrency(salePreviousPaid(payDuesSale))} />
                <ReadOnlyField labelKey="customers.remainingDues" value={formatCurrency(payDuesRemaining)} />
                <FormField
                  labelKey="customers.payDuesAmount"
                  value={payDuesAmount}
                  onChange={setPayDuesAmount}
                  type="number"
                  min={0}
                  step={0.01}
                  required
                />
                <ImageUpload labelKey="customers.paymentReceipt" value={payDuesReceipt} onChange={setPayDuesReceipt} />
              </div>
              {payDuesError && <p className="error-msg">{payDuesError}</p>}
              <div className="modal-actions">
                <button type="submit" className="btn primary">{l('customers.recordPayment')}</button>
                <button type="button" className="btn" onClick={() => setPayDuesSaleId(null)}>{l('common.cancel')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editSaleId && (
        <div className="modal-overlay" onClick={() => setEditSaleId(null)}>
          <div className="modal card modal-wide" onClick={(e) => e.stopPropagation()}>
            <SectionTitle k="customers.editSale" />
            <form onSubmit={handleUpdateSale}>
              <div className="form-grid">
                <FormField labelKey="common.date" value={editSaleDate} onChange={setEditSaleDate} type="date" required />
                <label className="form-field">
                  <FieldLabel labelKey="dukaan.teaName" />
                  <input
                    list="edit-cust-tea-names"
                    value={editSaleTea}
                    onChange={(e) => setEditSaleTea(e.target.value)}
                    required
                  />
                  <datalist id="edit-cust-tea-names">
                    {teaNames.map((n) => <option key={n} value={n} />)}
                  </datalist>
                </label>
                <label className="form-field checkbox-field">
                  <input
                    type="checkbox"
                    checked={editSaleExternalTea}
                    onChange={(e) => setEditSaleExternalTea(e.target.checked)}
                  />
                  <span><Label k="dukaan.otherCompanyTea" variant="compact" /></span>
                </label>
                <FormField labelKey="customers.bagsSold" value={editSaleBags} onChange={(v) => {
                  setEditSaleBags(v);
                  const b = Math.round(parseFloat(v) || 0);
                  const bw = parseFloat(editSaleBagWeight) || DEFAULT_BAG_WEIGHT_KG;
                  if (b > 0) setEditSaleQty(String(kgFromBags(b, bw)));
                }} type="number" min={0} step={1} placeholder="0" />
                <FormField labelKey="customers.bagQuantity" value={editSaleBagWeight} onChange={(v) => {
                  setEditSaleBagWeight(v);
                  const b = Math.round(parseFloat(editSaleBags) || 0);
                  const bw = parseFloat(v) || DEFAULT_BAG_WEIGHT_KG;
                  if (b > 0) setEditSaleQty(String(kgFromBags(b, bw)));
                }} type="number" min={0} step={0.01} />
                <FormField labelKey="dukaan.quantityKg" value={editSaleQty} onChange={setEditSaleQty} type="number" min={0} step={0.01} required />
                {editSaleExternalTea ? (
                  <FormField
                    labelKey="dukaan.manualPurchasePrice"
                    value={editSaleManualPurchasePrice}
                    onChange={setEditSaleManualPurchasePrice}
                    type="number"
                    min={0}
                    step={0.01}
                  />
                ) : (
                  <ReadOnlyField
                    labelKey="dukaan.purchasePricePerKg"
                    value={editSaleTea && getGodaamPurchasePrice(editSaleTea, purchases).hasPurchase
                      ? formatCurrency(getGodaamPurchasePrice(editSaleTea, purchases).avgCostPerKg)
                      : '—'}
                  />
                )}
                <FormField labelKey="customers.salePricePerKg" value={editSalePrice} onChange={setEditSalePrice} type="number" min={0} step={0.01} required />
                <FormField labelKey="dukaan.amountReceived" value={editSaleReceived} onChange={setEditSaleReceived} type="number" min={0} step={0.01} />
                <TextAreaField labelKey="dukaan.saleNotes" value={editSaleNotes} onChange={setEditSaleNotes} />
                <ImageUpload labelKey="dukaan.billImage" value={editSaleBillImage} onChange={setEditSaleBillImage} />
              </div>
              {editSaleQtyNum > 0 && editSalePriceNum > 0 && (
                <div className="live-info">
                  <span className="info">{l('dukaan.saleValue')}: {formatCurrency(editSaleQtyNum * editSalePriceNum)}</span>
                  <span className="info profit-positive">{l('dukaan.profit')}: {formatCurrency(editSaleProfit)}</span>
                </div>
              )}
              {editSaleError && <p className="error-msg">{editSaleError}</p>}
              <div className="modal-actions">
                <button type="submit" className="btn primary">{l('customers.updateSale')}</button>
                <button type="button" className="btn" onClick={() => setEditSaleId(null)}>{l('common.cancel')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editId && (
        <div className="modal-overlay" onClick={() => setEditId(null)}>
          <div className="modal card modal-wide" onClick={(e) => e.stopPropagation()}>
            <SectionTitle k="customers.editCustomer" />
            <form onSubmit={handleEditSave}>
              <div className="form-grid">
                <FormField labelKey="customers.customerName" value={editName} onChange={setEditName} required />
                <FormField labelKey="common.phone" value={editPhone} onChange={setEditPhone} />
                <FormField labelKey="common.address" value={editAddress} onChange={setEditAddress} />
                <FormField labelKey="customers.registerDate" value={editRegisterDate} onChange={setEditRegisterDate} type="date" />
                <TextAreaField labelKey="common.notes" value={editNotes} onChange={setEditNotes} />
                <ImageUpload labelKey="customers.profilePicture" value={editPicture} onChange={setEditPicture} />
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn primary">{l('common.save')}</button>
                <button type="button" className="btn" onClick={() => setEditId(null)}>{l('common.cancel')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
