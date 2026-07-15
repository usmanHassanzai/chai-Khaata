import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import FormField, { FieldLabel, ReadOnlyField } from '../components/FormField';
import ImageUpload, { ImageThumb } from '../components/ImageUpload';
import PageBanner from '../components/PageBanner';
import PhoneLink from '../components/PhoneLink';
import ExportToolbar from '../components/ExportToolbar';
import TextAreaField from '../components/TextAreaField';
import { db } from '../db/database';
import { Label, PageTitle, SectionTitle, useLabel } from '../i18n/useLabel';
import type { Dealer, Purchase } from '../models/types';
import {
  computeDealerSummary,
  formatBags,
  formatCurrency,
  formatKg,
  purchaseDue,
  purchaseNetWeight,
  purchasePendingBags,
  purchaseTotalPrice,
  todayISO,
} from '../services/calculations';
import {
  buildDealerExportRows,
  buildPurchaseExportRows,
  DEALER_EXPORT_COLUMNS,
  PURCHASE_EXPORT_COLUMNS,
} from '../services/export';

function cell(value?: string) {
  return value?.trim() || '—';
}

function purchaseMatchesSearch(p: Purchase, q: string, dealerName?: string): boolean {
  if (!q) return true;
  const haystack = [
    p.teaName,
    dealerName,
    p.contNo,
    p.lotNo,
    p.country,
    p.grade,
    p.invoiceNumber,
    p.notes,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

function PurchaseShipmentHeaders() {
  return (
    <>
      <th><Label k="godaam.contNo" variant="compact" /></th>
      <th><Label k="godaam.lotNo" variant="compact" /></th>
      <th><Label k="godaam.country" variant="compact" /></th>
      <th><Label k="godaam.grade" variant="compact" /></th>
      <th><Label k="godaam.invoiceNumber" variant="compact" /></th>
    </>
  );
}

function PurchaseShipmentCells({ p }: { p: Purchase }) {
  return (
    <>
      <td>{cell(p.contNo)}</td>
      <td>{cell(p.lotNo)}</td>
      <td>{cell(p.country)}</td>
      <td>{cell(p.grade)}</td>
      <td>{cell(p.invoiceNumber)}</td>
    </>
  );
}

export default function Godaam() {
  const l = useLabel();
  const dealers = useLiveQuery(() => db.dealers.toArray(), []) ?? [];
  const purchases = useLiveQuery(() => db.purchases.toArray(), []) ?? [];
  const payments = useLiveQuery(() => db.payments.toArray(), []) ?? [];
  const activeDealers = dealers.filter((d) => !d.removed);

  const [dealerName, setDealerName] = useState('');
  const [dealerPhone, setDealerPhone] = useState('');
  const [dealerAddress, setDealerAddress] = useState('');
  const [openingDue, setOpeningDue] = useState('');
  const [dealerError, setDealerError] = useState('');

  const [pDate, setPDate] = useState(todayISO());
  const [pDealerId, setPDealerId] = useState('');
  const [pTeaName, setPTeaName] = useState('');
  const [bagsOrdered, setBagsOrdered] = useState('');
  const [bagsReceived, setBagsReceived] = useState('');
  const [bagWeight, setBagWeight] = useState('62');
  const [missWeight, setMissWeight] = useState('0');
  const [pricePerKg, setPricePerKg] = useState('');
  const [depositPaid, setDepositPaid] = useState('');
  const [purchaseSearch, setPurchaseSearch] = useState('');
  const [dealerFilterId, setDealerFilterId] = useState('');
  const [detailDealerId, setDetailDealerId] = useState<number | null>(null);
  const [billImage, setBillImage] = useState<string | undefined>();
  const [purchaseNotes, setPurchaseNotes] = useState('');
  const [contNo, setContNo] = useState('');
  const [lotNo, setLotNo] = useState('');
  const [country, setCountry] = useState('');
  const [grade, setGrade] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');

  const [editPurchaseId, setEditPurchaseId] = useState<number | null>(null);
  const [editPDate, setEditPDate] = useState(todayISO());
  const [editPDealerId, setEditPDealerId] = useState('');
  const [editPTeaName, setEditPTeaName] = useState('');
  const [editBagsOrdered, setEditBagsOrdered] = useState('');
  const [editBagsReceived, setEditBagsReceived] = useState('');
  const [editBagWeight, setEditBagWeight] = useState('62');
  const [editMissWeight, setEditMissWeight] = useState('0');
  const [editPricePerKg, setEditPricePerKg] = useState('');
  const [editDepositPaid, setEditDepositPaid] = useState('');
  const [editBillImage, setEditBillImage] = useState<string | undefined>();
  const [editPurchaseNotes, setEditPurchaseNotes] = useState('');
  const [editContNo, setEditContNo] = useState('');
  const [editLotNo, setEditLotNo] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [editGrade, setEditGrade] = useState('');
  const [editInvoiceNumber, setEditInvoiceNumber] = useState('');
  const [editPurchaseError, setEditPurchaseError] = useState('');

  const previewPurchase: Purchase = useMemo(
    () => ({
      date: pDate,
      dealerId: parseInt(pDealerId, 10) || 0,
      teaName: pTeaName,
      bagsOrdered: parseFloat(bagsOrdered) || 0,
      bagsReceived: parseFloat(bagsReceived) || 0,
      bagWeightKg: parseFloat(bagWeight) || 62,
      missWeightKg: parseFloat(missWeight) || 0,
      pricePerKg: parseFloat(pricePerKg) || 0,
      depositPaid: parseFloat(depositPaid) || 0,
    }),
    [pDate, pDealerId, pTeaName, bagsOrdered, bagsReceived, bagWeight, missWeight, pricePerKg, depositPaid],
  );

  const standardWeight = previewPurchase.bagsReceived * previewPurchase.bagWeightKg;
  const netWeight = purchaseNetWeight(previewPurchase);
  const totalPrice = purchaseTotalPrice(previewPurchase);
  const dueThisPurchase = purchaseDue(previewPurchase);
  const pendingBags = purchasePendingBags(previewPurchase);

  const editPreviewPurchase: Purchase = useMemo(
    () => ({
      date: editPDate,
      dealerId: parseInt(editPDealerId, 10) || 0,
      teaName: editPTeaName,
      bagsOrdered: parseFloat(editBagsOrdered) || 0,
      bagsReceived: parseFloat(editBagsReceived) || 0,
      bagWeightKg: parseFloat(editBagWeight) || 62,
      missWeightKg: parseFloat(editMissWeight) || 0,
      pricePerKg: parseFloat(editPricePerKg) || 0,
      depositPaid: parseFloat(editDepositPaid) || 0,
    }),
    [editPDate, editPDealerId, editPTeaName, editBagsOrdered, editBagsReceived, editBagWeight, editMissWeight, editPricePerKg, editDepositPaid],
  );

  const editStandardWeight = editPreviewPurchase.bagsReceived * editPreviewPurchase.bagWeightKg;
  const editNetWeight = purchaseNetWeight(editPreviewPurchase);
  const editTotalPrice = purchaseTotalPrice(editPreviewPurchase);
  const editDueThisPurchase = purchaseDue(editPreviewPurchase);
  const editPendingBags = purchasePendingBags(editPreviewPurchase);

  const remainingBalance = useMemo(() => {
    if (!previewPurchase.dealerId) return 0;
    const dealer = dealers.find((d) => d.id === previewPurchase.dealerId);
    if (!dealer) return dueThisPurchase;
    return computeDealerSummary(dealer, purchases, payments).currentDue + dueThisPurchase;
  }, [previewPurchase, dealers, purchases, payments, dueThisPurchase]);

  const filteredPurchases = useMemo(() => {
    const q = purchaseSearch.toLowerCase();
    const dealerId = dealerFilterId ? parseInt(dealerFilterId, 10) : null;
    return [...purchases]
      .filter((p) => {
        if (dealerId && p.dealerId !== dealerId) return false;
        const dealer = dealers.find((d) => d.id === p.dealerId);
        return purchaseMatchesSearch(p, q, dealer?.name);
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [purchases, purchaseSearch, dealerFilterId, dealers]);

  const detailDealer = detailDealerId ? dealers.find((d) => d.id === detailDealerId) : null;
  const detailSummary = detailDealer ? computeDealerSummary(detailDealer, purchases, payments) : null;
  const detailPurchases = detailDealer
    ? purchases.filter((p) => p.dealerId === detailDealer.id).sort((a, b) => b.date.localeCompare(a.date))
    : [];

  const dealerExportRows = useMemo(
    () => buildDealerExportRows(activeDealers, purchases, payments),
    [activeDealers, purchases, payments],
  );

  const purchaseExportRows = useMemo(
    () => buildPurchaseExportRows(filteredPurchases, dealers),
    [filteredPurchases, dealers],
  );

  async function handleAddDealer(e: React.FormEvent) {
    e.preventDefault();
    setDealerError('');
    const name = dealerName.trim();
    if (!name) return;
    if (activeDealers.some((d) => d.name.toLowerCase() === name.toLowerCase())) {
      setDealerError(l('godaam.dealerExists'));
      return;
    }
    const dealer: Dealer = {
      name,
      phone: dealerPhone.trim() || undefined,
      address: dealerAddress.trim() || undefined,
      openingDue: parseFloat(openingDue) || 0,
    };
    await db.dealers.add(dealer);
    setDealerName('');
    setDealerPhone('');
    setDealerAddress('');
    setOpeningDue('');
  }

  async function handleAddPurchase(e: React.FormEvent) {
    e.preventDefault();
    if (!pDealerId || !pTeaName.trim()) return;
    await db.purchases.add({
      ...previewPurchase,
      teaName: pTeaName.trim(),
      contNo: contNo.trim() || undefined,
      lotNo: lotNo.trim() || undefined,
      country: country.trim() || undefined,
      grade: grade.trim() || undefined,
      invoiceNumber: invoiceNumber.trim() || undefined,
      billImage,
      notes: purchaseNotes.trim() || undefined,
    });
    setPTeaName('');
    setBagsOrdered('');
    setBagsReceived('');
    setMissWeight('0');
    setPricePerKg('');
    setDepositPaid('');
    setContNo('');
    setLotNo('');
    setCountry('');
    setGrade('');
    setInvoiceNumber('');
    setBillImage(undefined);
    setPurchaseNotes('');
  }

  function openEditPurchase(p: Purchase) {
    if (!p.id) return;
    setEditPurchaseId(p.id);
    setEditPurchaseError('');
    setEditPDate(p.date);
    setEditPDealerId(String(p.dealerId));
    setEditPTeaName(p.teaName);
    setEditBagsOrdered(String(p.bagsOrdered));
    setEditBagsReceived(String(p.bagsReceived));
    setEditBagWeight(String(p.bagWeightKg));
    setEditMissWeight(String(p.missWeightKg));
    setEditPricePerKg(String(p.pricePerKg));
    setEditDepositPaid(String(p.depositPaid));
    setEditBillImage(p.billImage);
    setEditPurchaseNotes(p.notes ?? '');
    setEditContNo(p.contNo ?? '');
    setEditLotNo(p.lotNo ?? '');
    setEditCountry(p.country ?? '');
    setEditGrade(p.grade ?? '');
    setEditInvoiceNumber(p.invoiceNumber ?? '');
  }

  async function handleUpdatePurchase(e: React.FormEvent) {
    e.preventDefault();
    setEditPurchaseError('');
    if (!editPurchaseId || !editPDealerId || !editPTeaName.trim()) return;

    const ordered = parseFloat(editBagsOrdered) || 0;
    const received = parseFloat(editBagsReceived) || 0;
    if (received > ordered) {
      setEditPurchaseError(l('godaam.bagsReceivedMax'));
      return;
    }

    await db.purchases.update(editPurchaseId, {
      ...editPreviewPurchase,
      teaName: editPTeaName.trim(),
      contNo: editContNo.trim() || undefined,
      lotNo: editLotNo.trim() || undefined,
      country: editCountry.trim() || undefined,
      grade: editGrade.trim() || undefined,
      invoiceNumber: editInvoiceNumber.trim() || undefined,
      billImage: editBillImage,
      notes: editPurchaseNotes.trim() || undefined,
    });
    setEditPurchaseId(null);
  }

  async function handleRemoveDealer(id: number) {
    await db.dealers.update(id, { removed: true });
  }

  async function handleDealerPayment(dealerId: number) {
    const amountStr = window.prompt(l('common.amount'));
    if (!amountStr) return;
    const amount = parseFloat(amountStr);
    if (amount <= 0) return;
    await db.payments.add({ date: todayISO(), dealerId, amount });
  }

  return (
    <div className="page">
      <PageBanner titleKey="godaam.title" subtitle="Track purchases & dealer stock" icon="📦" accent="brown" />
      <PageTitle k="godaam.title" />

      <form className="card form-card" onSubmit={handleAddDealer}>
        <SectionTitle k="godaam.addDealer" />
        <div className="form-grid">
          <FormField labelKey="godaam.dealerName" value={dealerName} onChange={setDealerName} required />
          <FormField labelKey="common.phone" value={dealerPhone} onChange={setDealerPhone} />
          <FormField labelKey="common.address" value={dealerAddress} onChange={setDealerAddress} />
          <FormField labelKey="godaam.openingDue" value={openingDue} onChange={setOpeningDue} type="number" min={0} step={0.01} />
        </div>
        {dealerError && <p className="error-msg">{dealerError}</p>}
        <button type="submit" className="btn primary">{l('godaam.addDealer')}</button>
      </form>

      <form className="card form-card" onSubmit={handleAddPurchase}>
        <SectionTitle k="godaam.addPurchase" />
        <div className="form-grid">
          <FormField labelKey="common.date" value={pDate} onChange={setPDate} type="date" required />
          <label className="form-field">
            <FieldLabel labelKey="godaam.dealer" />
            <select value={pDealerId} onChange={(e) => setPDealerId(e.target.value)} required>
              <option value="">—</option>
              {activeDealers.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </label>
          <FormField labelKey="godaam.teaName" value={pTeaName} onChange={setPTeaName} required />
          <FormField labelKey="godaam.contNo" value={contNo} onChange={setContNo} />
          <FormField labelKey="godaam.lotNo" value={lotNo} onChange={setLotNo} />
          <FormField labelKey="godaam.country" value={country} onChange={setCountry} />
          <FormField labelKey="godaam.grade" value={grade} onChange={setGrade} />
          <FormField labelKey="godaam.invoiceNumber" value={invoiceNumber} onChange={setInvoiceNumber} />
          <FormField labelKey="godaam.bagsOrdered" value={bagsOrdered} onChange={setBagsOrdered} type="number" min={0} required />
          <FormField labelKey="godaam.bagsReceived" value={bagsReceived} onChange={setBagsReceived} type="number" min={0} required />
          <FormField labelKey="godaam.bagWeight" value={bagWeight} onChange={setBagWeight} type="number" min={0} step={0.01} />
          <ReadOnlyField labelKey="godaam.standardWeight" value={formatKg(standardWeight)} />
          <FormField labelKey="godaam.missWeight" value={missWeight} onChange={setMissWeight} type="number" min={0} step={0.01} />
          <ReadOnlyField labelKey="godaam.netWeight" value={formatKg(netWeight)} />
          <FormField labelKey="godaam.pricePerKg" value={pricePerKg} onChange={setPricePerKg} type="number" min={0} step={0.01} required />
          <ReadOnlyField labelKey="godaam.totalPrice" value={formatCurrency(totalPrice)} />
          <FormField labelKey="godaam.depositPaid" value={depositPaid} onChange={setDepositPaid} type="number" min={0} step={0.01} />
          <ReadOnlyField labelKey="godaam.dueThisPurchase" value={formatCurrency(dueThisPurchase)} />
          <ReadOnlyField labelKey="godaam.remainingBalance" value={formatCurrency(remainingBalance)} />
          <ReadOnlyField labelKey="godaam.pendingBags" value={String(pendingBags)} />
          <TextAreaField labelKey="godaam.purchaseNotes" value={purchaseNotes} onChange={setPurchaseNotes} />
          <ImageUpload labelKey="godaam.billImage" value={billImage} onChange={setBillImage} />
        </div>
        <button type="submit" className="btn primary" disabled={activeDealers.length === 0}>{l('godaam.savePurchase')}</button>
      </form>

      <section className="card-section">
        <div className="section-header-row">
          <SectionTitle k="godaam.dealerSummary" />
          <ExportToolbar
            filenamePrefix="godaam-dealers"
            title="Godaam — Dealer Summary"
            columns={DEALER_EXPORT_COLUMNS}
            rows={dealerExportRows}
            compact
          />
        </div>
        <div className="table-wrap wide-table">
          <table>
            <thead>
              <tr>
                <th><Label k="godaam.dealerName" variant="compact" /></th>
                <th><Label k="common.phone" variant="compact" /></th>
                <th><Label k="common.address" variant="compact" /></th>
                <th><Label k="godaam.receivedMaal" variant="compact" /></th>
                <th><Label k="godaam.pendingBags" variant="compact" /></th>
                <th><Label k="godaam.pendingMaal" variant="compact" /></th>
                <th><Label k="godaam.totalPurchased" variant="compact" /></th>
                <th><Label k="godaam.totalPaid" variant="compact" /></th>
                <th><Label k="godaam.currentDue" variant="compact" /></th>
                <th><Label k="common.actions" variant="compact" /></th>
              </tr>
            </thead>
            <tbody>
              {activeDealers.length === 0 ? (
                <tr><td colSpan={10} className="empty">{l('common.noData')}</td></tr>
              ) : (
                activeDealers.map((d) => {
                  const s = computeDealerSummary(d, purchases, payments);
                  return (
                    <tr key={d.id}>
                      <td><strong>{d.name}</strong></td>
                      <td><PhoneLink phone={d.phone} /></td>
                      <td className="truncate-cell">{d.address ?? '—'}</td>
                      <td>{formatKg(s.totalReceivedMaalKg)}</td>
                      <td className={s.totalPendingBags > 0 ? 'warn-text' : ''}>{formatBags(s.totalPendingBags)}</td>
                      <td className={s.totalPendingMaalKg > 0 ? 'warn-text' : ''}>{formatKg(s.totalPendingMaalKg)}</td>
                      <td>{formatCurrency(s.totalPurchased)}</td>
                      <td>{formatCurrency(s.totalPaid)}</td>
                      <td className={s.currentDue > 0 ? 'warn-text' : ''}>{formatCurrency(s.currentDue)}</td>
                      <td className="action-cell">
                        <button type="button" className="btn sm" onClick={() => setDetailDealerId(d.id!)}>{l('godaam.viewHistory')}</button>
                        <button type="button" className="btn sm" onClick={() => { setDealerFilterId(String(d.id)); setPurchaseSearch(''); }}>{l('godaam.dealerHistory')}</button>
                        <button type="button" className="btn sm" onClick={() => handleDealerPayment(d.id!)}>{l('common.addPayment')}</button>
                        <button type="button" className="btn danger sm" onClick={() => handleRemoveDealer(d.id!)}>{l('godaam.removeDealer')}</button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card-section">
        <div className="section-header-row">
          <SectionTitle k="godaam.purchaseHistory" />
          <ExportToolbar
            filenamePrefix="godaam-purchases"
            title="Godaam — Purchase History"
            subtitle={purchaseSearch ? `Search: ${purchaseSearch}` : undefined}
            columns={PURCHASE_EXPORT_COLUMNS}
            rows={purchaseExportRows}
            compact
          />
        </div>
        <input className="search-input" placeholder={l('common.search')} value={purchaseSearch} onChange={(e) => setPurchaseSearch(e.target.value)} />
        {dealerFilterId && (
          <div className="filter-chip-row">
            <span className="chip active">
              {dealers.find((d) => d.id === parseInt(dealerFilterId, 10))?.name ?? l('godaam.dealer')}
              <button type="button" className="chip-clear" onClick={() => setDealerFilterId('')} aria-label="Clear">×</button>
            </span>
          </div>
        )}
        <div className="table-wrap wide-table">
          <table>
            <thead>
              <tr>
                <th><Label k="common.date" variant="compact" /></th>
                <th><Label k="godaam.dealer" variant="compact" /></th>
                <th><Label k="godaam.teaName" variant="compact" /></th>
                <PurchaseShipmentHeaders />
                <th><Label k="godaam.bagsOrderedCol" variant="compact" /></th>
                <th><Label k="godaam.bagsReceivedCol" variant="compact" /></th>
                <th><Label k="godaam.pendingBags" variant="compact" /></th>
                <th><Label k="godaam.receivedMaal" variant="compact" /></th>
                <th><Label k="godaam.pendingMaal" variant="compact" /></th>
                <th><Label k="godaam.missWeight" variant="compact" /></th>
                <th><Label k="godaam.totalPrice" variant="compact" /></th>
                <th><Label k="godaam.billImage" variant="compact" /></th>
                <th><Label k="common.actions" variant="compact" /></th>
              </tr>
            </thead>
            <tbody>
              {filteredPurchases.length === 0 ? (
                <tr><td colSpan={17} className="empty">{l('common.noData')}</td></tr>
              ) : (
                filteredPurchases.map((p) => {
                  const dealer = dealers.find((d) => d.id === p.dealerId);
                  const pending = purchasePendingBags(p);
                  const receivedMaal = purchaseNetWeight(p);
                  const pendingMaal = pending * p.bagWeightKg;
                  return (
                    <tr key={p.id}>
                      <td>{p.date}</td>
                      <td>{dealer?.name ?? '—'}</td>
                      <td>{p.teaName}{p.notes ? <small className="row-note">{p.notes}</small> : null}</td>
                      <PurchaseShipmentCells p={p} />
                      <td>{p.bagsOrdered}</td>
                      <td>{p.bagsReceived}</td>
                      <td className={pending > 0 ? 'warn-text' : ''}>{pending}</td>
                      <td>{formatKg(receivedMaal)}</td>
                      <td className={pendingMaal > 0 ? 'warn-text' : ''}>{formatKg(pendingMaal)}</td>
                      <td>{formatKg(p.missWeightKg)}</td>
                      <td>{formatCurrency(purchaseTotalPrice(p))}</td>
                      <td><ImageThumb src={p.billImage} /></td>
                      <td className="action-cell">
                        <button type="button" className="btn sm" onClick={() => openEditPurchase(p)}>{l('godaam.editPurchase')}</button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {detailDealer && detailSummary && (
        <div className="modal-overlay" onClick={() => setDetailDealerId(null)}>
          <div className="modal card modal-wide" onClick={(e) => e.stopPropagation()}>
            <h3>{detailDealer.name}</h3>
            <p><Label k="common.phone" variant="compact" />: <PhoneLink phone={detailDealer.phone} /></p>
            <p><Label k="common.address" variant="compact" />: {detailDealer.address ?? '—'}</p>

            <div className="detail-grid">
              <div className="detail-stat"><Label k="godaam.receivedMaal" variant="compact" /><strong>{formatKg(detailSummary.totalReceivedMaalKg)}</strong></div>
              <div className="detail-stat"><Label k="godaam.pendingBags" variant="compact" /><strong className={detailSummary.totalPendingBags > 0 ? 'warn-text' : ''}>{formatBags(detailSummary.totalPendingBags)}</strong></div>
              <div className="detail-stat"><Label k="godaam.pendingMaal" variant="compact" /><strong className={detailSummary.totalPendingMaalKg > 0 ? 'warn-text' : ''}>{formatKg(detailSummary.totalPendingMaalKg)}</strong></div>
              <div className="detail-stat"><Label k="godaam.currentDue" variant="compact" /><strong className={detailSummary.currentDue > 0 ? 'warn-text' : ''}>{formatCurrency(detailSummary.currentDue)}</strong></div>
            </div>

            <h4><Label k="godaam.dealerHistory" variant="compact" /></h4>
            <div className="table-wrap wide-table">
              <table>
                <thead>
                  <tr>
                    <th><Label k="common.date" variant="compact" /></th>
                    <th><Label k="godaam.teaName" variant="compact" /></th>
                    <PurchaseShipmentHeaders />
                    <th><Label k="godaam.bagsOrderedCol" variant="compact" /></th>
                    <th><Label k="godaam.bagsReceivedCol" variant="compact" /></th>
                    <th><Label k="godaam.pendingBags" variant="compact" /></th>
                    <th><Label k="godaam.receivedMaal" variant="compact" /></th>
                    <th><Label k="godaam.pendingMaal" variant="compact" /></th>
                    <th><Label k="godaam.totalPrice" variant="compact" /></th>
                    <th><Label k="common.actions" variant="compact" /></th>
                  </tr>
                </thead>
                <tbody>
                  {detailPurchases.length === 0 ? (
                    <tr><td colSpan={14} className="empty">{l('common.noData')}</td></tr>
                  ) : (
                    detailPurchases.map((p) => {
                      const pending = purchasePendingBags(p);
                      return (
                        <tr key={p.id}>
                          <td>{p.date}</td>
                          <td>{p.teaName}</td>
                          <PurchaseShipmentCells p={p} />
                          <td>{p.bagsOrdered}</td>
                          <td>{p.bagsReceived}</td>
                          <td className={pending > 0 ? 'warn-text' : ''}>{pending}</td>
                          <td>{formatKg(purchaseNetWeight(p))}</td>
                          <td className={pending > 0 ? 'warn-text' : ''}>{formatKg(pending * p.bagWeightKg)}</td>
                          <td>{formatCurrency(purchaseTotalPrice(p))}</td>
                          <td className="action-cell">
                            <button type="button" className="btn sm" onClick={() => openEditPurchase(p)}>{l('godaam.editPurchase')}</button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <button type="button" className="btn" onClick={() => setDetailDealerId(null)}>{l('common.cancel')}</button>
          </div>
        </div>
      )}

      {editPurchaseId && (
        <div className="modal-overlay" onClick={() => setEditPurchaseId(null)}>
          <div className="modal card modal-wide" onClick={(e) => e.stopPropagation()}>
            <SectionTitle k="godaam.editPurchase" />
            <form onSubmit={handleUpdatePurchase}>
              <div className="form-grid">
                <FormField labelKey="common.date" value={editPDate} onChange={setEditPDate} type="date" required />
                <label className="form-field">
                  <FieldLabel labelKey="godaam.dealer" />
                  <select value={editPDealerId} onChange={(e) => setEditPDealerId(e.target.value)} required>
                    <option value="">—</option>
                    {activeDealers.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </label>
                <FormField labelKey="godaam.teaName" value={editPTeaName} onChange={setEditPTeaName} required />
                <FormField labelKey="godaam.contNo" value={editContNo} onChange={setEditContNo} />
                <FormField labelKey="godaam.lotNo" value={editLotNo} onChange={setEditLotNo} />
                <FormField labelKey="godaam.country" value={editCountry} onChange={setEditCountry} />
                <FormField labelKey="godaam.grade" value={editGrade} onChange={setEditGrade} />
                <FormField labelKey="godaam.invoiceNumber" value={editInvoiceNumber} onChange={setEditInvoiceNumber} />
                <FormField labelKey="godaam.bagsOrdered" value={editBagsOrdered} onChange={setEditBagsOrdered} type="number" min={0} required />
                <FormField labelKey="godaam.bagsReceived" value={editBagsReceived} onChange={setEditBagsReceived} type="number" min={0} required />
                <FormField labelKey="godaam.bagWeight" value={editBagWeight} onChange={setEditBagWeight} type="number" min={0} step={0.01} />
                <ReadOnlyField labelKey="godaam.standardWeight" value={formatKg(editStandardWeight)} />
                <FormField labelKey="godaam.missWeight" value={editMissWeight} onChange={setEditMissWeight} type="number" min={0} step={0.01} />
                <ReadOnlyField labelKey="godaam.netWeight" value={formatKg(editNetWeight)} />
                <FormField labelKey="godaam.pricePerKg" value={editPricePerKg} onChange={setEditPricePerKg} type="number" min={0} step={0.01} required />
                <ReadOnlyField labelKey="godaam.totalPrice" value={formatCurrency(editTotalPrice)} />
                <FormField labelKey="godaam.depositPaid" value={editDepositPaid} onChange={setEditDepositPaid} type="number" min={0} step={0.01} />
                <ReadOnlyField labelKey="godaam.dueThisPurchase" value={formatCurrency(editDueThisPurchase)} />
                <ReadOnlyField labelKey="godaam.pendingBags" value={String(editPendingBags)} />
                <TextAreaField labelKey="godaam.purchaseNotes" value={editPurchaseNotes} onChange={setEditPurchaseNotes} />
                <ImageUpload labelKey="godaam.billImage" value={editBillImage} onChange={setEditBillImage} />
              </div>
              {editPurchaseError && <p className="error-msg">{editPurchaseError}</p>}
              <div className="modal-actions">
                <button type="submit" className="btn primary">{l('godaam.updatePurchase')}</button>
                <button type="button" className="btn" onClick={() => setEditPurchaseId(null)}>{l('common.cancel')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
