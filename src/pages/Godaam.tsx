import { useMemo, useState } from 'react';
import FormField, { FieldLabel, ReadOnlyField } from '../components/FormField';
import ImageUpload, { ImageThumb } from '../components/ImageUpload';
import PhoneLink from '../components/PhoneLink';
import ExportToolbar from '../components/ExportToolbar';
import TextAreaField from '../components/TextAreaField';
import { db } from '../db/database';
import { useLedgerLive } from '../hooks/useLedgerLive';
import { flushLedgerPushNow } from '../services/ledgerSync';
import { Label, SectionTitle, useLabel } from '../i18n/useLabel';
import type { Dealer, Purchase } from '../models/types';
import {
  computeDealerSummary,
  appendActivity,
  buildPurchaseChangeEvents,
  formatBags,
  formatCurrency,
  formatDateTime,
  formatKg,
  getTeaNames,
  nowISO,
  purchaseDue,
  purchaseNetWeight,
  purchaseOrderedKg,
  purchaseOrderedTotalPrice,
  purchasePendingAmount,
  purchasePendingBags,
  purchasePreviousPaid,
  purchaseCurrentPayment,
  purchaseTotalPrice,
  todayISO,
  type PurchaseChangeEvent,
} from '../services/calculations';
import { useShopPrintProfile } from '../hooks/useShopPrintProfile';
import {
  buildDealerExportRows,
  buildPurchaseExportRows,
  buildPurchasePdfRows,
  buildDealerActivityHistoryRows,
  DEALER_EXPORT_COLUMNS,
  DEALER_ACTIVITY_HISTORY_COLUMNS,
  downloadDealerFullHistoryPdf,
  downloadDealerFullHistoryCsv,
  downloadGodaamPurchasesPdf,
  printDealerFullHistory,
  PURCHASE_EXPORT_COLUMNS,
  PURCHASE_PDF_COLUMNS,
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

function PurchaseAmountHeaders() {
  return (
    <>
      <th><Label k="godaam.orderedMaal" variant="compact" /></th>
      <th><Label k="godaam.orderedAmount" variant="compact" /></th>
      <th><Label k="godaam.previousPaid" variant="compact" /></th>
      <th><Label k="godaam.currentPayment" variant="compact" /></th>
      <th><Label k="godaam.totalPaid" variant="compact" /></th>
      <th><Label k="godaam.pendingAmount" variant="compact" /></th>
      <th><Label k="godaam.lastPayment" variant="compact" /></th>
      <th><Label k="godaam.previousReceived" variant="compact" /></th>
      <th><Label k="godaam.currentReceived" variant="compact" /></th>
      <th><Label k="godaam.previousDate" variant="compact" /></th>
      <th><Label k="godaam.currentDate" variant="compact" /></th>
    </>
  );
}

function PurchaseAmountCells({ p }: { p: Purchase }) {
  return (
    <>
      <td>{formatKg(purchaseOrderedKg(p))}</td>
      <td>{formatCurrency(purchaseOrderedTotalPrice(p))}</td>
      <td>{formatCurrency(purchasePreviousPaid(p))}</td>
      <td>{purchaseCurrentPayment(p) > 0 ? formatCurrency(purchaseCurrentPayment(p)) : '—'}</td>
      <td>{formatCurrency(p.depositPaid)}</td>
      <td className={purchasePendingAmount(p) > 0 ? 'warn-text' : ''}>{formatCurrency(purchasePendingAmount(p))}</td>
      <td>{formatDateTime(p.lastPaymentAt)}</td>
      <td>{p.previousBagsReceived != null ? p.previousBagsReceived : '—'}</td>
      <td>{p.lastReceivedBags != null ? p.lastReceivedBags : '—'}</td>
      <td>{p.previousReceiveDate ?? '—'}</td>
      <td>{formatDateTime(p.lastReceivedAt)}</td>
    </>
  );
}

function eventTypeLabel(type: PurchaseChangeEvent['type'], l: (k: string) => string) {
  if (type === 'payment') return l('godaam.eventPayPending');
  if (type === 'receive') return l('godaam.eventReceive');
  return l('godaam.eventEdit');
}

function eventTypeClass(type: PurchaseChangeEvent['type']) {
  if (type === 'payment') return 'is-payment';
  if (type === 'receive') return 'is-receive';
  return 'is-edit';
}

function PurchaseEventAmountCells({ event }: { event: PurchaseChangeEvent }) {
  if (event.type === 'payment') {
    return (
      <>
        <td>—</td>
        <td>—</td>
        <td>{event.previousPaid != null ? formatCurrency(event.previousPaid) : '—'}</td>
        <td className="god-num">{event.amount != null ? formatCurrency(event.amount) : '—'}</td>
        <td className="god-num">{event.balanceAfter != null ? formatCurrency(event.balanceAfter) : '—'}</td>
        <td>—</td>
        <td>{formatDateTime(event.at)}</td>
        <td>—</td>
        <td>—</td>
        <td>—</td>
        <td>—</td>
      </>
    );
  }
  if (event.type === 'receive') {
    return (
      <>
        <td>—</td>
        <td>—</td>
        <td>—</td>
        <td>—</td>
        <td>—</td>
        <td>—</td>
        <td>—</td>
        <td>—</td>
        <td className="god-num">{event.bagsAdded != null ? event.bagsAdded : '—'}</td>
        <td>—</td>
        <td>{formatDateTime(event.at)}</td>
      </>
    );
  }
  return (
    <>
      <td>—</td>
      <td>—</td>
      <td>—</td>
      <td>—</td>
      <td>—</td>
      <td>—</td>
      <td>—</td>
      <td>—</td>
      <td>—</td>
      <td>—</td>
      <td>—</td>
    </>
  );
}

function EmptyShipmentCells() {
  return (
    <>
      <td>—</td>
      <td>—</td>
      <td>—</td>
      <td>—</td>
      <td>—</td>
    </>
  );
}

export default function Godaam() {
  const l = useLabel();
  const shopProfile = useShopPrintProfile();
  const { dealers, purchases, payments } = useLedgerLive();
  const activeDealers = dealers.filter((d) => !d.removed);

  const teaNames = useMemo(() => getTeaNames(purchases), [purchases]);

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

  const [receivePurchaseId, setReceivePurchaseId] = useState<number | null>(null);
  const [receiveBags, setReceiveBags] = useState('');
  const [receiveReceipt, setReceiveReceipt] = useState<string | undefined>();
  const [receiveError, setReceiveError] = useState('');

  const [payPurchaseId, setPayPurchaseId] = useState<number | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payReceipt, setPayReceipt] = useState<string | undefined>();
  const [payError, setPayError] = useState('');

  const [editDealerId, setEditDealerId] = useState<number | null>(null);
  const [editDealerName, setEditDealerName] = useState('');
  const [editDealerPhone, setEditDealerPhone] = useState('');
  const [editDealerAddress, setEditDealerAddress] = useState('');
  const [editDealerOpeningDue, setEditDealerOpeningDue] = useState('');
  const [editDealerError, setEditDealerError] = useState('');

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
  const detailPayments = detailDealer
    ? payments
        .filter((p) => p.dealerId === detailDealer.id)
        .sort((a, b) => (b.paidAt ?? b.date).localeCompare(a.paidAt ?? a.date))
    : [];

  function dealerPaymentRowLabel(p: (typeof detailPayments)[number]) {
    if (p.purchaseId != null) {
      const purchase = purchases.find((x) => x.id === p.purchaseId);
      return purchase ? `Pay pending · ${purchase.teaName}` : 'Pay pending';
    }
    return p.note?.trim() || 'Direct payment';
  }

  const detailActivityRows = useMemo(() => {
    if (!detailDealer) return [];
    return buildDealerActivityHistoryRows(detailDealer, detailPurchases);
  }, [detailDealer, detailPurchases]);

  function openEditDealer(d: Dealer) {
    if (!d.id) return;
    setEditDealerId(d.id);
    setEditDealerName(d.name);
    setEditDealerPhone(d.phone ?? '');
    setEditDealerAddress(d.address ?? '');
    setEditDealerOpeningDue(String(d.openingDue ?? 0));
    setEditDealerError('');
  }

  async function handleUpdateDealer(e: React.FormEvent) {
    e.preventDefault();
    setEditDealerError('');
    if (!editDealerId) return;
    const name = editDealerName.trim();
    if (!name) return;
    const existing = dealers.find((d) => d.id === editDealerId);
    if (!existing) return;
    if (
      activeDealers.some(
        (d) => d.id !== editDealerId && d.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      setEditDealerError(l('godaam.dealerExists'));
      return;
    }
    const opening = parseFloat(editDealerOpeningDue) || 0;
    const summary = [
      'Dealer edited',
      existing.name !== name ? `name ${existing.name}→${name}` : null,
      existing.openingDue !== opening
        ? `opening due ${formatCurrency(existing.openingDue)}→${formatCurrency(opening)}`
        : null,
    ]
      .filter(Boolean)
      .join(' · ');

    await db.dealers.update(editDealerId, {
      name,
      phone: editDealerPhone.trim() || undefined,
      address: editDealerAddress.trim() || undefined,
      openingDue: opening,
      history: appendActivity(existing, {
        at: nowISO(),
        type: 'edit',
        summary: summary || 'Dealer details updated',
        detail: summary,
      }),
    });
    setEditDealerId(null);
    flushLedgerPushNow();
  }

  const dealerExportRows = useMemo(
    () => buildDealerExportRows(activeDealers, purchases, payments),
    [activeDealers, purchases, payments],
  );

  const purchaseExportRows = useMemo(
    () => buildPurchaseExportRows(filteredPurchases, dealers, payments),
    [filteredPurchases, dealers, payments],
  );

  const purchasePdfRows = useMemo(
    () => buildPurchasePdfRows(filteredPurchases, dealers, payments),
    [filteredPurchases, dealers, payments],
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
      history: [{
        id: `create-${Date.now()}`,
        at: nowISO(),
        type: 'create',
        summary: `Dealer created with opening due ${formatCurrency(parseFloat(openingDue) || 0)}`,
      }],
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
      history: [{
        id: `create-${Date.now()}`,
        at: nowISO(),
        type: 'create',
        summary: `Purchase created — ordered ${previewPurchase.bagsOrdered} bags, received ${previewPurchase.bagsReceived} bags`,
        bagsOrdered: previewPurchase.bagsOrdered,
        bagsReceived: previewPurchase.bagsReceived,
      }],
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

    const existing = purchases.find((p) => p.id === editPurchaseId);
    if (!existing) return;

    const summary = [
      `Purchase edited`,
      `ordered ${existing.bagsOrdered}→${editPreviewPurchase.bagsOrdered} bags`,
      `received ${existing.bagsReceived}→${editPreviewPurchase.bagsReceived} bags`,
      `rate ${formatCurrency(existing.pricePerKg)}→${formatCurrency(editPreviewPurchase.pricePerKg)}`,
    ].join(' · ');

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
      history: appendActivity(existing, {
        at: nowISO(),
        type: 'edit',
        summary,
        bagsOrdered: editPreviewPurchase.bagsOrdered,
        bagsReceived: editPreviewPurchase.bagsReceived,
        detail: summary,
      }),
    });
    setEditPurchaseId(null);
    flushLedgerPushNow();
  }

  const receivePurchase = receivePurchaseId ? purchases.find((p) => p.id === receivePurchaseId) : null;
  const receivePendingBags = receivePurchase ? purchasePendingBags(receivePurchase) : 0;

  function openReceiveMaal(p: Purchase) {
    if (!p.id) return;
    const pending = purchasePendingBags(p);
    if (pending <= 0) return;
    setReceivePurchaseId(p.id);
    setReceiveBags(String(pending));
    setReceiveReceipt(undefined);
    setReceiveError('');
  }

  async function handleReceiveMaal(e: React.FormEvent) {
    e.preventDefault();
    setReceiveError('');
    if (!receivePurchaseId || !receivePurchase) return;

    const bagsNow = Math.round(parseFloat(receiveBags) || 0);
    const pending = purchasePendingBags(receivePurchase);
    if (bagsNow <= 0) {
      setReceiveError(l('godaam.receiveBagsRequired'));
      return;
    }
    if (bagsNow > pending) {
      setReceiveError(l('godaam.receiveBagsExceedsPending'));
      return;
    }

    const receivedAt = nowISO();
    const prevBags = receivePurchase.bagsReceived;
    const newBags = prevBags + bagsNow;
    const prevDateLabel = receivePurchase.lastReceivedAt
      ? formatDateTime(receivePurchase.lastReceivedAt)
      : receivePurchase.date;
    const kgNow = bagsNow * receivePurchase.bagWeightKg;
    const log = `Received ${bagsNow} bags (${formatKg(kgNow)}) on ${formatDateTime(receivedAt)}. Previous: ${prevBags} bags on ${prevDateLabel}`;
    const existingNotes = receivePurchase.notes?.trim() ?? '';
    const notes = existingNotes ? `${existingNotes}\n${log}` : log;

    await db.purchases.update(receivePurchaseId, {
      previousBagsReceived: prevBags,
      previousReceiveDate: receivePurchase.lastReceivedAt ?? receivePurchase.date,
      bagsReceived: newBags,
      lastReceivedAt: receivedAt,
      lastReceivedBags: bagsNow,
      lastReceivedKg: kgNow,
      receiveReceiptImage: receiveReceipt ?? receivePurchase.receiveReceiptImage,
      notes,
      history: appendActivity(receivePurchase, {
        at: receivedAt,
        type: 'receive',
        summary: log,
        bagsOrdered: receivePurchase.bagsOrdered,
        bagsReceived: newBags,
        bagsAdded: bagsNow,
      }),
    });

    setReceivePurchaseId(null);
    flushLedgerPushNow();
  }

  const payPurchase = payPurchaseId ? purchases.find((p) => p.id === payPurchaseId) : null;
  const payPendingAmount = payPurchase ? purchasePendingAmount(payPurchase) : 0;

  function openPayPending(p: Purchase) {
    if (!p.id) return;
    const pending = purchasePendingAmount(p);
    if (pending <= 0) return;
    setPayPurchaseId(p.id);
    setPayAmount(String(pending));
    setPayReceipt(undefined);
    setPayError('');
  }

  async function handlePayPending(e: React.FormEvent) {
    e.preventDefault();
    setPayError('');
    if (!payPurchaseId || !payPurchase) return;

    const amountNow = parseFloat(payAmount) || 0;
    const pending = purchasePendingAmount(payPurchase);
    if (amountNow <= 0) {
      setPayError(l('godaam.payAmountRequired'));
      return;
    }
    if (amountNow > pending) {
      setPayError(l('godaam.payExceedsPending'));
      return;
    }

    const paymentAt = nowISO();
    const prevPaid = payPurchase.depositPaid;
    const newPaid = Math.min(prevPaid + amountNow, purchaseOrderedTotalPrice(payPurchase));
    const paymentLog = `Payment ${formatCurrency(amountNow)} on ${formatDateTime(paymentAt)}`;
    const existingNotes = payPurchase.notes?.trim() ?? '';
    const notes = existingNotes ? `${existingNotes}\n${paymentLog}` : paymentLog;

    await db.transaction('rw', [db.purchases, db.payments], async () => {
      await db.purchases.update(payPurchaseId, {
        previousDepositPaid: prevPaid,
        lastPaymentAmount: amountNow,
        depositPaid: newPaid,
        lastPaymentAt: paymentAt,
        paymentReceiptImage: payReceipt ?? payPurchase.paymentReceiptImage,
        notes,
        history: appendActivity(payPurchase, {
          at: paymentAt,
          type: 'payment',
          summary: paymentLog,
          amount: amountNow,
          bagsOrdered: payPurchase.bagsOrdered,
          bagsReceived: payPurchase.bagsReceived,
          detail: `Previous paid ${formatCurrency(prevPaid)} → ${formatCurrency(newPaid)}`,
        }),
      });
      await db.payments.add({
        date: todayISO(),
        dealerId: payPurchase.dealerId,
        purchaseId: payPurchaseId,
        amount: amountNow,
        paidAt: paymentAt,
        previousPaid: prevPaid,
        balanceAfter: newPaid,
        receiptImage: payReceipt,
        note: `Pay pending — ${payPurchase.teaName}`,
      });
    });

    setPayPurchaseId(null);
    flushLedgerPushNow();
  }

  async function handleDeleteDealer(id: number) {
    if (!window.confirm(l('godaam.confirmDeleteDealer'))) return;

    const dealerPurchases = await db.purchases.where('dealerId').equals(id).toArray();
    const dealerPayments = await db.payments.where('dealerId').equals(id).toArray();

    await db.transaction('rw', [db.dealers, db.purchases, db.payments], async () => {
      for (const p of dealerPurchases) {
        if (p.id != null) await db.purchases.delete(p.id);
      }
      for (const p of dealerPayments) {
        if (p.id != null) await db.payments.delete(p.id);
      }
      await db.dealers.delete(id);
    });

    if (detailDealerId === id) setDetailDealerId(null);
    if (dealerFilterId === String(id)) setDealerFilterId('');
    flushLedgerPushNow();
  }

  async function handleDealerPayment(dealerId: number) {
    const amountStr = window.prompt(l('common.amount'));
    if (!amountStr) return;
    const amount = parseFloat(amountStr);
    if (amount <= 0) return;
    const dealer = dealers.find((d) => d.id === dealerId);
    const paidAt = nowISO();
    await db.transaction('rw', [db.dealers, db.payments], async () => {
      await db.payments.add({
        date: todayISO(),
        dealerId,
        amount,
        paidAt,
        note: 'Direct dealer payment',
      });
      if (dealer) {
        await db.dealers.update(dealerId, {
          history: appendActivity(dealer, {
            at: paidAt,
            type: 'payment',
            summary: `Payment ${formatCurrency(amount)}`,
            amount,
          }),
        });
      }
    });
    flushLedgerPushNow();
  }

  return (
    <div className="page godaam-page godaam-pro">
      <header className="god-topbar animate-fade-in-up">
        <div>
          <p className="god-eyebrow">Warehouse · Purchases</p>
          <h1 className="god-title">
            <Label k="godaam.title" variant="stacked" />
          </h1>
          <p className="god-meta">
            <span>{activeDealers.length} dealers</span>
            <span className="god-meta-dot" aria-hidden />
            <span>{purchases.length} purchases</span>
            <span className="god-meta-dot" aria-hidden />
            <span>{todayISO()}</span>
          </p>
        </div>
      </header>

      <div className="god-forms-grid">
      <form className="god-panel form-card animate-fade-in-up stagger-1" onSubmit={handleAddDealer}>
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

      <form className="god-panel form-card animate-fade-in-up stagger-2" onSubmit={handleAddPurchase}>
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
          <label className="form-field">
            <FieldLabel labelKey="godaam.teaName" />
            <input
              list="godaam-tea-names"
              value={pTeaName}
              onChange={(e) => setPTeaName(e.target.value)}
              required
            />
            <datalist id="godaam-tea-names">
              {teaNames.map((n) => <option key={n} value={n} />)}
            </datalist>
          </label>
          <p className="settings-note">{l('godaam.otherCompanyTeaHintDealer')}</p>
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
      </div>

      <section className="god-panel card-section animate-fade-in-up stagger-3">
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
          <table className="god-table">
            <thead>
              <tr>
                <th><Label k="godaam.dealerName" variant="compact" /></th>
                <th><Label k="common.phone" variant="compact" /></th>
                <th><Label k="common.address" variant="compact" /></th>
                <th><Label k="godaam.bagsOrderedTotal" variant="compact" /></th>
                <th><Label k="godaam.bagsReceivedTotal" variant="compact" /></th>
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
                <tr><td colSpan={12} className="empty">{l('common.noData')}</td></tr>
              ) : (
                activeDealers.map((d) => {
                  const s = computeDealerSummary(d, purchases, payments);
                  return (
                    <tr key={d.id}>
                      <td><strong>{d.name}</strong></td>
                      <td><PhoneLink phone={d.phone} /></td>
                      <td className="truncate-cell">{d.address ?? '—'}</td>
                      <td>{formatBags(s.totalBagsOrdered)}</td>
                      <td>{formatBags(s.totalBagsReceived)}</td>
                      <td>{formatKg(s.totalReceivedMaalKg)}</td>
                      <td className={s.totalPendingBags > 0 ? 'warn-text' : ''}>{formatBags(s.totalPendingBags)}</td>
                      <td className={s.totalPendingMaalKg > 0 ? 'warn-text' : ''}>{formatKg(s.totalPendingMaalKg)}</td>
                      <td>{formatCurrency(s.totalPurchased)}</td>
                      <td>{formatCurrency(s.totalPaid)}</td>
                      <td className={s.currentDue > 0 ? 'warn-text' : ''}>{formatCurrency(s.currentDue)}</td>
                      <td className="action-cell">
                        <button type="button" className="btn sm" onClick={() => setDetailDealerId(d.id!)}>{l('godaam.viewHistory')}</button>
                        <button type="button" className="btn sm" onClick={() => openEditDealer(d)}>{l('godaam.editDealer')}</button>
                        <button type="button" className="btn sm" onClick={() => { setDealerFilterId(String(d.id)); setPurchaseSearch(''); }}>{l('godaam.dealerHistory')}</button>
                        <button type="button" className="btn sm" onClick={() => handleDealerPayment(d.id!)}>{l('common.addPayment')}</button>
                        <button type="button" className="btn danger sm" onClick={() => handleDeleteDealer(d.id!)}>{l('godaam.deleteDealer')}</button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="god-panel card-section animate-fade-in-up stagger-4">
        <div className="section-header-row">
          <SectionTitle k="godaam.purchaseHistory" />
          <ExportToolbar
            filenamePrefix="godaam-purchases"
            title="Godaam — Purchase Ledger"
            subtitle={purchaseSearch ? `Search: ${purchaseSearch}` : undefined}
            columns={PURCHASE_EXPORT_COLUMNS}
            rows={purchaseExportRows}
            pdfColumns={PURCHASE_PDF_COLUMNS}
            pdfRows={purchasePdfRows}
            onPdf={() => downloadGodaamPurchasesPdf({
              filename: `godaam-purchases-${new Date().toISOString().slice(0, 10)}`,
              title: 'Godaam — Purchase Ledger',
              subtitle: purchaseSearch ? `Search: ${purchaseSearch}` : undefined,
              shopProfile,
              purchases: filteredPurchases,
              dealers,
              payments,
            })}
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
          <table className="god-table">
            <thead>
              <tr>
                <th><Label k="common.date" variant="compact" /></th>
                <th><Label k="godaam.eventType" variant="compact" /></th>
                <th><Label k="godaam.dealer" variant="compact" /></th>
                <th><Label k="godaam.teaName" variant="compact" /></th>
                <PurchaseShipmentHeaders />
                <th><Label k="godaam.bagsOrderedCol" variant="compact" /></th>
                <th><Label k="godaam.bagsReceivedCol" variant="compact" /></th>
                <th><Label k="godaam.pendingBags" variant="compact" /></th>
                <th><Label k="godaam.receivedMaal" variant="compact" /></th>
                <th><Label k="godaam.pendingMaal" variant="compact" /></th>
                <PurchaseAmountHeaders />
                <th><Label k="godaam.missWeight" variant="compact" /></th>
                <th><Label k="godaam.totalPrice" variant="compact" /></th>
                <th><Label k="godaam.billImage" variant="compact" /></th>
                <th><Label k="godaam.paymentReceipt" variant="compact" /></th>
                <th><Label k="godaam.receiveReceipt" variant="compact" /></th>
                <th><Label k="common.actions" variant="compact" /></th>
              </tr>
            </thead>
            <tbody>
              {filteredPurchases.length === 0 ? (
                <tr><td colSpan={31} className="empty">{l('common.noData')}</td></tr>
              ) : (
                filteredPurchases.flatMap((p) => {
                  const dealer = dealers.find((d) => d.id === p.dealerId);
                  const pending = purchasePendingBags(p);
                  const pendingPay = purchasePendingAmount(p);
                  const receivedMaal = purchaseNetWeight(p);
                  const pendingMaal = pending * p.bagWeightKg;
                  const linked = payments.filter((pay) => pay.purchaseId === p.id);
                  const changeEvents = buildPurchaseChangeEvents(p, linked);
                  const mainRow = (
                    <tr key={p.id} className="god-purchase-row">
                      <td>{p.date}</td>
                      <td><span className="god-event-pill is-purchase">{l('godaam.eventPurchase')}</span></td>
                      <td>{dealer?.name ?? '—'}</td>
                      <td>{p.teaName}{p.notes ? <small className="row-note">{p.notes}</small> : null}</td>
                      <PurchaseShipmentCells p={p} />
                      <td className="god-num"><strong>{p.bagsOrdered}</strong></td>
                      <td className="god-num"><strong>{p.bagsReceived}</strong></td>
                      <td className={pending > 0 ? 'warn-text' : ''}>{pending}</td>
                      <td>{formatKg(receivedMaal)}</td>
                      <td className={pendingMaal > 0 ? 'warn-text' : ''}>{formatKg(pendingMaal)}</td>
                      <PurchaseAmountCells p={p} />
                      <td>{formatKg(p.missWeightKg)}</td>
                      <td>{formatCurrency(purchaseTotalPrice(p))}</td>
                      <td><ImageThumb src={p.billImage} /></td>
                      <td><ImageThumb src={p.paymentReceiptImage} /></td>
                      <td><ImageThumb src={p.receiveReceiptImage} /></td>
                      <td className="action-cell">
                        {pendingPay > 0 && (
                          <button type="button" className="btn sm primary" onClick={() => openPayPending(p)}>{l('godaam.payPending')}</button>
                        )}
                        {pending > 0 && (
                          <button type="button" className="btn sm" onClick={() => openReceiveMaal(p)}>{l('godaam.receiveMaal')}</button>
                        )}
                        <button type="button" className="btn sm" onClick={() => openEditPurchase(p)}>{l('godaam.editPurchase')}</button>
                      </td>
                    </tr>
                  );
                  const eventRows = changeEvents.map((event) => (
                    <tr key={`${p.id}-${event.id}`} className={`god-event-row ${eventTypeClass(event.type)}`}>
                      <td>{formatDateTime(event.at)}</td>
                      <td><span className={`god-event-pill ${eventTypeClass(event.type)}`}>{eventTypeLabel(event.type, l)}</span></td>
                      <td className="god-event-indent">{dealer?.name ?? '—'}</td>
                      <td>
                        <span className="god-event-summary">{event.summary}</span>
                      </td>
                      <EmptyShipmentCells />
                      <td className="god-num">{event.bagsOrdered != null ? event.bagsOrdered : '—'}</td>
                      <td className="god-num">{event.bagsReceived != null ? event.bagsReceived : '—'}</td>
                      <td>{event.bagsAdded != null ? `+${event.bagsAdded}` : '—'}</td>
                      <td>—</td>
                      <td>—</td>
                      <PurchaseEventAmountCells event={event} />
                      <td>—</td>
                      <td>{event.amount != null ? formatCurrency(event.amount) : '—'}</td>
                      <td>—</td>
                      <td><ImageThumb src={event.type === 'payment' ? event.receiptImage : undefined} /></td>
                      <td><ImageThumb src={event.type === 'receive' ? event.receiptImage : undefined} /></td>
                      <td className="god-event-follow">↳</td>
                    </tr>
                  ));
                  return [mainRow, ...eventRows];
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
              <div className="detail-stat"><Label k="godaam.bagsOrderedTotal" variant="compact" /><strong>{formatBags(detailSummary.totalBagsOrdered)}</strong></div>
              <div className="detail-stat"><Label k="godaam.bagsReceivedTotal" variant="compact" /><strong>{formatBags(detailSummary.totalBagsReceived)}</strong></div>
              <div className="detail-stat"><Label k="godaam.receivedMaal" variant="compact" /><strong>{formatKg(detailSummary.totalReceivedMaalKg)}</strong></div>
              <div className="detail-stat"><Label k="godaam.pendingBags" variant="compact" /><strong className={detailSummary.totalPendingBags > 0 ? 'warn-text' : ''}>{formatBags(detailSummary.totalPendingBags)}</strong></div>
              <div className="detail-stat"><Label k="godaam.pendingMaal" variant="compact" /><strong className={detailSummary.totalPendingMaalKg > 0 ? 'warn-text' : ''}>{formatKg(detailSummary.totalPendingMaalKg)}</strong></div>
              <div className="detail-stat"><Label k="godaam.currentDue" variant="compact" /><strong className={detailSummary.currentDue > 0 ? 'warn-text' : ''}>{formatCurrency(detailSummary.currentDue)}</strong></div>
            </div>

            <h4><Label k="godaam.dealerHistory" variant="compact" /></h4>
            <div className="table-wrap wide-table">
              <table className="god-table">
                <thead>
                  <tr>
                    <th><Label k="common.date" variant="compact" /></th>
                    <th><Label k="godaam.eventType" variant="compact" /></th>
                    <th><Label k="godaam.teaName" variant="compact" /></th>
                    <PurchaseShipmentHeaders />
                    <th><Label k="godaam.bagsOrderedCol" variant="compact" /></th>
                    <th><Label k="godaam.bagsReceivedCol" variant="compact" /></th>
                    <th><Label k="godaam.pendingBags" variant="compact" /></th>
                    <th><Label k="godaam.receivedMaal" variant="compact" /></th>
                    <th><Label k="godaam.pendingMaal" variant="compact" /></th>
                    <PurchaseAmountHeaders />
                    <th><Label k="godaam.totalPrice" variant="compact" /></th>
                    <th><Label k="godaam.paymentReceipt" variant="compact" /></th>
                    <th><Label k="godaam.receiveReceipt" variant="compact" /></th>
                    <th><Label k="common.actions" variant="compact" /></th>
                  </tr>
                </thead>
                <tbody>
                  {detailPurchases.length === 0 ? (
                    <tr><td colSpan={28} className="empty">{l('common.noData')}</td></tr>
                  ) : (
                    detailPurchases.flatMap((p) => {
                      const pending = purchasePendingBags(p);
                      const pendingPay = purchasePendingAmount(p);
                      const linked = detailPayments.filter((pay) => pay.purchaseId === p.id);
                      const changeEvents = buildPurchaseChangeEvents(p, linked);
                      const mainRow = (
                        <tr key={p.id} className="god-purchase-row">
                          <td>{p.date}</td>
                          <td><span className="god-event-pill is-purchase">{l('godaam.eventPurchase')}</span></td>
                          <td>{p.teaName}</td>
                          <PurchaseShipmentCells p={p} />
                          <td className="god-num"><strong>{p.bagsOrdered}</strong></td>
                          <td className="god-num"><strong>{p.bagsReceived}</strong></td>
                          <td className={pending > 0 ? 'warn-text' : ''}>{pending}</td>
                          <td>{formatKg(purchaseNetWeight(p))}</td>
                          <td className={pending > 0 ? 'warn-text' : ''}>{formatKg(pending * p.bagWeightKg)}</td>
                          <PurchaseAmountCells p={p} />
                          <td>{formatCurrency(purchaseTotalPrice(p))}</td>
                          <td><ImageThumb src={p.paymentReceiptImage} /></td>
                          <td><ImageThumb src={p.receiveReceiptImage} /></td>
                          <td className="action-cell">
                            {pendingPay > 0 && (
                              <button type="button" className="btn sm primary" onClick={() => openPayPending(p)}>{l('godaam.payPending')}</button>
                            )}
                            {pending > 0 && (
                              <button type="button" className="btn sm" onClick={() => openReceiveMaal(p)}>{l('godaam.receiveMaal')}</button>
                            )}
                            <button type="button" className="btn sm" onClick={() => openEditPurchase(p)}>{l('godaam.editPurchase')}</button>
                          </td>
                        </tr>
                      );
                      const eventRows = changeEvents.map((event) => (
                        <tr key={`${p.id}-${event.id}`} className={`god-event-row ${eventTypeClass(event.type)}`}>
                          <td>{formatDateTime(event.at)}</td>
                          <td><span className={`god-event-pill ${eventTypeClass(event.type)}`}>{eventTypeLabel(event.type, l)}</span></td>
                          <td><span className="god-event-summary">{event.summary}</span></td>
                          <EmptyShipmentCells />
                          <td className="god-num">{event.bagsOrdered != null ? event.bagsOrdered : '—'}</td>
                          <td className="god-num">{event.bagsReceived != null ? event.bagsReceived : '—'}</td>
                          <td>{event.bagsAdded != null ? `+${event.bagsAdded}` : '—'}</td>
                          <td>—</td>
                          <td>—</td>
                          <PurchaseEventAmountCells event={event} />
                          <td>{event.amount != null ? formatCurrency(event.amount) : '—'}</td>
                          <td><ImageThumb src={event.type === 'payment' ? event.receiptImage : undefined} /></td>
                          <td><ImageThumb src={event.type === 'receive' ? event.receiptImage : undefined} /></td>
                          <td className="god-event-follow">↳</td>
                        </tr>
                      ));
                      return [mainRow, ...eventRows];
                    })
                  )}
                </tbody>
              </table>
            </div>

            <h4><Label k="godaam.activityHistory" variant="compact" /></h4>
            {detailActivityRows.length === 0 ? (
              <p className="empty">{l('common.noData')}</p>
            ) : (
              <div className="table-wrap payment-ledger-wrap">
                <table className="payment-ledger-table">
                  <thead>
                    <tr>
                      {DEALER_ACTIVITY_HISTORY_COLUMNS.map((c) => (
                        <th key={c.key}>{c.header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {detailActivityRows.map((row, idx) => (
                      <tr key={`${row.date}-${idx}`} className="is-dues-row">
                        {DEALER_ACTIVITY_HISTORY_COLUMNS.map((c) => (
                          <td key={c.key}>{row[c.key] ?? '—'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h4><Label k="export.paymentHistory" variant="compact" /></h4>
            {detailPayments.length === 0 ? (
              <p className="empty">{l('common.noData')}</p>
            ) : (
              <div className="table-wrap payment-ledger-wrap">
                <table className="payment-ledger-table">
                  <thead>
                    <tr>
                      <th><Label k="common.date" variant="compact" /></th>
                      <th>Type</th>
                      <th><Label k="common.amount" variant="compact" /></th>
                      <th>Previous paid</th>
                      <th>Balance after</th>
                      <th><Label k="common.notes" variant="compact" /></th>
                      <th>Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailPayments.map((p) => (
                      <tr key={p.id} className={p.purchaseId != null ? 'is-dues-row' : undefined}>
                        <td>{formatDateTime(p.paidAt) !== '—' ? formatDateTime(p.paidAt) : p.date}</td>
                        <td>
                          <span className={`payment-type-pill${p.purchaseId != null ? ' is-dues' : ' is-direct'}`}>
                            {dealerPaymentRowLabel(p)}
                          </span>
                        </td>
                        <td className="dash-num">{formatCurrency(p.amount)}</td>
                        <td>{p.previousPaid != null ? formatCurrency(p.previousPaid) : '—'}</td>
                        <td>{p.balanceAfter != null ? formatCurrency(p.balanceAfter) : '—'}</td>
                        <td>{p.note ?? '—'}</td>
                        <td><ImageThumb src={p.receiptImage} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="btn sm"
                onClick={() => printDealerFullHistory({
                  dealer: detailDealer,
                  summary: detailSummary,
                  purchases: detailPurchases,
                  payments: detailPayments,
                  shopProfile,
                })}
              >
                🖨 {l('export.historyPrint')}
              </button>
              <button
                type="button"
                className="btn sm"
                onClick={() => downloadDealerFullHistoryPdf({
                  dealer: detailDealer,
                  summary: detailSummary,
                  purchases: detailPurchases,
                  payments: detailPayments,
                  shopProfile,
                }).catch(console.error)}
              >
                📄 {l('export.historyPdf')}
              </button>
              <button
                type="button"
                className="btn sm"
                onClick={() => downloadDealerFullHistoryCsv({
                  dealer: detailDealer,
                  summary: detailSummary,
                  purchases: detailPurchases,
                  payments: detailPayments,
                  shopProfile,
                })}
              >
                📥 {l('export.historyCsv')}
              </button>
              <button type="button" className="btn danger" onClick={() => handleDeleteDealer(detailDealerId!)}>{l('godaam.deleteDealer')}</button>
              <button type="button" className="btn" onClick={() => setDetailDealerId(null)}>{l('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {payPurchaseId && payPurchase && (
        <div className="modal-overlay" onClick={() => setPayPurchaseId(null)}>
          <div className="modal card modal-wide" onClick={(e) => e.stopPropagation()}>
            <SectionTitle k="godaam.payPendingTitle" />
            <form onSubmit={handlePayPending}>
              <div className="form-grid">
                <ReadOnlyField labelKey="godaam.teaName" value={payPurchase.teaName} />
                <ReadOnlyField labelKey="godaam.orderedAmount" value={formatCurrency(purchaseOrderedTotalPrice(payPurchase))} />
                <ReadOnlyField labelKey="godaam.previousPaid" value={formatCurrency(purchasePreviousPaid(payPurchase))} />
                <ReadOnlyField labelKey="godaam.totalPaid" value={formatCurrency(payPurchase.depositPaid)} />
                <ReadOnlyField labelKey="godaam.pendingAmount" value={formatCurrency(payPendingAmount)} />
                <FormField
                  labelKey="godaam.paymentAmount"
                  value={payAmount}
                  onChange={setPayAmount}
                  type="number"
                  min={0}
                  step={0.01}
                  required
                />
                <ImageUpload labelKey="godaam.paymentReceipt" value={payReceipt} onChange={setPayReceipt} />
              </div>
              {payError && <p className="error-msg">{payError}</p>}
              <div className="modal-actions">
                <button type="submit" className="btn primary">{l('godaam.recordPayment')}</button>
                <button type="button" className="btn" onClick={() => setPayPurchaseId(null)}>{l('common.cancel')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {receivePurchaseId && receivePurchase && (
        <div className="modal-overlay" onClick={() => setReceivePurchaseId(null)}>
          <div className="modal card modal-wide" onClick={(e) => e.stopPropagation()}>
            <SectionTitle k="godaam.receiveMaalTitle" />
            <form onSubmit={handleReceiveMaal}>
              <div className="form-grid">
                <ReadOnlyField labelKey="godaam.teaName" value={receivePurchase.teaName} />
                <ReadOnlyField labelKey="godaam.bagsOrdered" value={String(receivePurchase.bagsOrdered)} />
                <ReadOnlyField labelKey="godaam.bagsReceivedCol" value={String(receivePurchase.bagsReceived)} />
                <ReadOnlyField labelKey="godaam.pendingBags" value={String(receivePendingBags)} />
                <ReadOnlyField labelKey="godaam.previousReceived" value={String(receivePurchase.bagsReceived)} />
                <ReadOnlyField
                  labelKey="godaam.previousDate"
                  value={receivePurchase.lastReceivedAt ? formatDateTime(receivePurchase.lastReceivedAt) : receivePurchase.date}
                />
                <FormField
                  labelKey="godaam.bagsToReceive"
                  value={receiveBags}
                  onChange={setReceiveBags}
                  type="number"
                  min={0}
                  step={1}
                  required
                />
                <ImageUpload labelKey="godaam.receiveReceipt" value={receiveReceipt} onChange={setReceiveReceipt} />
              </div>
              {receiveError && <p className="error-msg">{receiveError}</p>}
              <div className="modal-actions">
                <button type="submit" className="btn primary">{l('godaam.recordReceive')}</button>
                <button type="button" className="btn" onClick={() => setReceivePurchaseId(null)}>{l('common.cancel')}</button>
              </div>
            </form>
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
                <label className="form-field">
                  <FieldLabel labelKey="godaam.teaName" />
                  <input
                    list="godaam-edit-tea-names"
                    value={editPTeaName}
                    onChange={(e) => setEditPTeaName(e.target.value)}
                    required
                  />
                  <datalist id="godaam-edit-tea-names">
                    {teaNames.map((n) => <option key={n} value={n} />)}
                  </datalist>
                </label>
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

      {editDealerId && (
        <div className="modal-overlay" onClick={() => setEditDealerId(null)}>
          <div className="modal card" onClick={(e) => e.stopPropagation()}>
            <SectionTitle k="godaam.editDealer" />
            <form onSubmit={handleUpdateDealer}>
              <div className="form-grid">
                <FormField labelKey="godaam.dealerName" value={editDealerName} onChange={setEditDealerName} required />
                <FormField labelKey="common.phone" value={editDealerPhone} onChange={setEditDealerPhone} />
                <FormField labelKey="common.address" value={editDealerAddress} onChange={setEditDealerAddress} />
                <FormField
                  labelKey="godaam.openingDue"
                  value={editDealerOpeningDue}
                  onChange={setEditDealerOpeningDue}
                  type="number"
                  min={0}
                  step={0.01}
                />
              </div>
              {editDealerError && <p className="error-msg">{editDealerError}</p>}
              <div className="modal-actions">
                <button type="submit" className="btn primary">{l('common.save')}</button>
                <button type="button" className="btn" onClick={() => setEditDealerId(null)}>{l('common.cancel')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
