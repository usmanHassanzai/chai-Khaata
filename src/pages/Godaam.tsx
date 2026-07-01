import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import FormField, { FieldLabel, ReadOnlyField } from '../components/FormField';
import ImageUpload, { ImageThumb } from '../components/ImageUpload';
import TextAreaField from '../components/TextAreaField';
import { db } from '../db/database';
import { Label, PageTitle, SectionTitle, useLabel } from '../i18n/useLabel';
import type { Dealer, Purchase } from '../models/types';
import {
  computeDealerSummary,
  formatCurrency,
  formatKg,
  purchaseDue,
  purchaseNetWeight,
  purchasePendingBags,
  purchaseTotalPrice,
  todayISO,
} from '../services/calculations';

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
  const [billImage, setBillImage] = useState<string | undefined>();
  const [purchaseNotes, setPurchaseNotes] = useState('');

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

  const remainingBalance = useMemo(() => {
    if (!previewPurchase.dealerId) return 0;
    const dealer = dealers.find((d) => d.id === previewPurchase.dealerId);
    if (!dealer) return dueThisPurchase;
    return computeDealerSummary(dealer, purchases, payments).currentDue + dueThisPurchase;
  }, [previewPurchase, dealers, purchases, payments, dueThisPurchase]);

  const filteredPurchases = useMemo(() => {
    const q = purchaseSearch.toLowerCase();
    return [...purchases]
      .filter((p) => {
        if (!q) return true;
        const dealer = dealers.find((d) => d.id === p.dealerId);
        return p.teaName.toLowerCase().includes(q) || (dealer?.name.toLowerCase().includes(q) ?? false);
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [purchases, purchaseSearch, dealers]);

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
      billImage,
      notes: purchaseNotes.trim() || undefined,
    });
    setPTeaName('');
    setBagsOrdered('');
    setBagsReceived('');
    setMissWeight('0');
    setPricePerKg('');
    setDepositPaid('');
    setBillImage(undefined);
    setPurchaseNotes('');
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
        <SectionTitle k="godaam.dealerSummary" />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th><Label k="godaam.dealerName" variant="compact" /></th>
                <th><Label k="godaam.totalPurchased" variant="compact" /></th>
                <th><Label k="godaam.totalPaid" variant="compact" /></th>
                <th><Label k="godaam.currentDue" variant="compact" /></th>
                <th><Label k="common.actions" variant="compact" /></th>
              </tr>
            </thead>
            <tbody>
              {activeDealers.length === 0 ? (
                <tr><td colSpan={5} className="empty">{l('common.noData')}</td></tr>
              ) : (
                activeDealers.map((d) => {
                  const s = computeDealerSummary(d, purchases, payments);
                  return (
                    <tr key={d.id}>
                      <td>{d.name}</td>
                      <td>{formatCurrency(s.totalPurchased)}</td>
                      <td>{formatCurrency(s.totalPaid)}</td>
                      <td className={s.currentDue > 0 ? 'warn-text' : ''}>{formatCurrency(s.currentDue)}</td>
                      <td className="action-cell">
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
        <SectionTitle k="godaam.purchaseHistory" />
        <input className="search-input" placeholder={l('common.search')} value={purchaseSearch} onChange={(e) => setPurchaseSearch(e.target.value)} />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th><Label k="common.date" variant="compact" /></th>
                <th><Label k="godaam.dealer" variant="compact" /></th>
                <th><Label k="godaam.teaName" variant="compact" /></th>
                <th><Label k="godaam.standardWeight" variant="compact" /></th>
                <th><Label k="godaam.missWeight" variant="compact" /></th>
                <th><Label k="godaam.netWeight" variant="compact" /></th>
                <th><Label k="godaam.totalPrice" variant="compact" /></th>
                <th><Label k="godaam.billImage" variant="compact" /></th>
              </tr>
            </thead>
            <tbody>
              {filteredPurchases.length === 0 ? (
                <tr><td colSpan={8} className="empty">{l('common.noData')}</td></tr>
              ) : (
                filteredPurchases.map((p) => {
                  const dealer = dealers.find((d) => d.id === p.dealerId);
                  return (
                    <tr key={p.id}>
                      <td>{p.date}</td>
                      <td>{dealer?.name ?? '—'}</td>
                      <td>{p.teaName}{p.notes ? <small className="row-note">{p.notes}</small> : null}</td>
                      <td>{formatKg(p.bagsReceived * p.bagWeightKg)}</td>
                      <td>{formatKg(p.missWeightKg)}</td>
                      <td>{formatKg(purchaseNetWeight(p))}</td>
                      <td>{formatCurrency(purchaseTotalPrice(p))}</td>
                      <td><ImageThumb src={p.billImage} /></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
