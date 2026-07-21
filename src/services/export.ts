import type {
  Customer,
  Dealer,
  Payment,
  Purchase,
  Sale,
  TeaStock,
} from '../models/types';
import {
  computeCustomerSummary,
  computeDealerSummary,
  computeSaleProfit,
  formatBags,
  formatCurrency,
  formatDateTime,
  formatKg,
  profitPerKg,
  purchaseNetWeight,
  purchaseOrderedKg,
  purchaseOrderedTotalPrice,
  purchasePendingAmount,
  purchasePendingBags,
  purchasePreviousPaid,
  purchaseCurrentPayment,
  purchaseTotalPrice,
  buildPurchaseChangeEvents,
  saleBagsSold,
  saleCurrentPayment,
  salePreviousPaid,
  saleTotal,
  buildSaleChangeEvents,
} from './calculations';
import {
  buildPrintHeaderHtml,
  formatShopContact,
  logoImageFormat,
  type ShopPrintProfile,
} from './shopProfile';

export type ExportColumn = { key: string; header: string };

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCsv(filename: string, columns: ExportColumn[], rows: Record<string, string | number>[]) {
  const escape = (v: string | number) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map((c) => escape(c.header)).join(',');
  const body = rows.map((row) => columns.map((c) => escape(row[c.key] ?? '')).join(',')).join('\n');
  const csv = `\uFEFF${header}\n${body}`;
  downloadBlob(filename.endsWith('.csv') ? filename : `${filename}.csv`, new Blob([csv], { type: 'text/csv;charset=utf-8' }));
}

export function downloadJson(filename: string, content: string) {
  downloadBlob(filename.endsWith('.json') ? filename : `${filename}.json`, new Blob([content], { type: 'application/json' }));
}

function stamp() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function drawPdfBrandBar(doc: {
  setFillColor: (...args: number[]) => void;
  rect: (x: number, y: number, w: number, h: number, style?: string) => void;
  internal: { pageSize: { getWidth: () => number; getHeight: () => number } };
}) {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(26, 61, 47);
  doc.rect(0, 0, pageW, 8, 'F');
  doc.setFillColor(212, 168, 83);
  doc.rect(0, 8, pageW, 1.2, 'F');
  return { pageW, startY: 16 };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawPdfFooter(doc: any, profile: ShopPrintProfile) {
  const pageCount = doc.getNumberOfPages() as number;
  const pageW = doc.internal.pageSize.getWidth() as number;
  const pageH = doc.internal.pageSize.getHeight() as number;
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setDrawColor(235, 228, 216);
    doc.setLineWidth(0.3);
    doc.line(14, pageH - 12, pageW - 14, pageH - 12);
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text(`${profile.shopName} · Confidential ledger`, 14, pageH - 7);
    doc.text(`Page ${i} of ${pageCount}`, pageW - 14, pageH - 7, { align: 'right' });
    doc.setTextColor(0);
  }
}

export async function downloadPdf(options: {
  filename: string;
  title: string;
  shopProfile?: ShopPrintProfile;
  /** @deprecated use shopProfile.shopName */
  shopName?: string;
  subtitle?: string;
  columns: ExportColumn[];
  rows: Record<string, string | number>[];
}) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const { filename, title, subtitle, columns, rows } = options;
  const profile: ShopPrintProfile = options.shopProfile ?? {
    shopName: options.shopName || 'Chai Khata',
  };
  const doc = new jsPDF({ orientation: columns.length > 6 ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  const { pageW, startY } = drawPdfBrandBar(doc);

  let y = startY;
  let textX = 14;

  if (profile.shopLogo) {
    try {
      const fmt = logoImageFormat(profile.shopLogo);
      doc.addImage(profile.shopLogo, fmt, 14, y, 18, 18);
      textX = 36;
    } catch {
      /* skip logo if unsupported */
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(26, 61, 47);
  doc.text(profile.shopName, textX, y + 6);
  y += 10;

  const contact = formatShopContact(profile);
  if (contact) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(90);
    doc.text(contact, textX, y);
    y += 5;
  }

  doc.setDrawColor(212, 168, 83);
  doc.setLineWidth(0.4);
  doc.line(14, y + 1, pageW - 14, y + 1);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(26, 61, 47);
  doc.text(title, 14, y);
  y += 6;

  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text(subtitle, 14, y);
    y += 5;
  }
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(`Generated: ${stamp()}`, 14, y);
  doc.setTextColor(0);

  autoTable(doc, {
    startY: y + 5,
    head: [columns.map((c) => c.header)],
    body: rows.map((row) => columns.map((c) => String(row[c.key] ?? ''))),
    styles: {
      fontSize: 8,
      cellPadding: 2.4,
      lineColor: [230, 224, 214],
      lineWidth: 0.2,
      textColor: [28, 43, 36],
      font: 'helvetica',
    },
    headStyles: {
      fillColor: [26, 61, 47],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: [248, 245, 240] },
    margin: { left: 14, right: 14, bottom: 18 },
  });

  drawPdfFooter(doc, profile);
  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

export function printTable(options: {
  title: string;
  shopProfile?: ShopPrintProfile;
  /** @deprecated use shopProfile.shopName */
  shopName?: string;
  subtitle?: string;
  columns: ExportColumn[];
  rows: Record<string, string | number>[];
  footerHtml?: string;
}) {
  const { title, subtitle, columns, rows, footerHtml } = options;
  const profile: ShopPrintProfile = options.shopProfile ?? {
    shopName: options.shopName || 'Chai Khata',
  };
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;

  const head = columns.map((c) => `<th>${c.header}</th>`).join('');
  const body = rows
    .map((row) => `<tr>${columns.map((c) => `<td>${row[c.key] ?? ''}</td>`).join('')}</tr>`)
    .join('');

  const headerHtml = buildPrintHeaderHtml(profile);

  win.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&display=swap');
*{box-sizing:border-box}
body{font-family:'Plus Jakarta Sans',system-ui,sans-serif;padding:28px;color:#1c2b24;background:#fff}
.brand-bar{height:6px;background:linear-gradient(90deg,#d4a853,#1a3d2f 45%,#40916c);margin:-28px -28px 18px;border-radius:0}
.print-header{display:flex;align-items:center;gap:16px;margin-bottom:10px;padding-bottom:12px;border-bottom:1px solid #ebe4d8}
.print-logo{width:64px;height:64px;object-fit:contain;border-radius:10px;border:1px solid #ebe4d8}
.print-header-text h1{font-size:1.4rem;margin:0 0 4px;color:#1a3d2f;letter-spacing:-0.02em}
.print-contact{color:#5c6b63;font-size:0.88rem;margin:0}
h2{font-size:1.08rem;margin:0 0 6px;color:#1a3d2f}
.meta{color:#8a9690;font-size:0.82rem;margin-bottom:14px}
table{width:100%;border-collapse:collapse;font-size:0.84rem}
th,td{border:1px solid #ebe4d8;padding:8px 10px;text-align:left}
th{background:#1a3d2f;color:#fff;font-size:0.72rem;letter-spacing:0.04em;text-transform:uppercase}
tbody tr:nth-child(even){background:#f8f5f0}
.receipt-summary{margin-top:20px;padding:16px 18px;border:1px solid #1a3d2f;border-left:5px solid #d4a853;border-radius:10px;background:linear-gradient(135deg,#f8faf8,#fff);max-width:380px}
.receipt-summary p{margin:6px 0;font-size:0.92rem}
.receipt-summary .label{color:#5c6b63}
.receipt-summary .value{font-weight:800;color:#1a3d2f}
.receipt-summary .remaining{color:#b45309;font-size:1.05rem}
.print-footer{margin-top:24px;padding-top:10px;border-top:1px solid #ebe4d8;color:#8a9690;font-size:0.75rem;display:flex;justify-content:space-between}
@media print{body{padding:14px}.brand-bar{margin:-14px -14px 14px}}
</style></head><body>
<div class="brand-bar"></div>
${headerHtml}
<h2>${title}</h2>
<p class="meta">${subtitle ? `${subtitle} · ` : ''}Generated: ${stamp()}</p>
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
${footerHtml ?? ''}
<div class="print-footer"><span>${profile.shopName} · Ledger export</span><span>${stamp()}</span></div>
<script>window.onload=function(){window.print();}</script>
</body></html>`);
  win.document.close();
}

function customerName(customers: Customer[], id?: number) {
  if (!id) return 'Walk-in';
  return customers.find((c) => c.id === id)?.name ?? '—';
}

function dealerName(dealers: Dealer[], id: number) {
  return dealers.find((d) => d.id === id)?.name ?? '—';
}

export function buildSalesExportRows(
  sales: Sale[],
  purchases: Purchase[],
  allSales: Sale[],
  customers: Customer[],
) {
  return sales.map((s) => {
    const cost = s.purchasePricePerKg ?? 0;
    const profit = computeSaleProfit(s, purchases, allSales);
    return {
      date: s.date,
      tea: s.teaName,
      bags: formatBags(saleBagsSold(s)),
      kg: formatKg(s.quantityKg),
      purchasePrice: formatCurrency(cost),
      salePrice: formatCurrency(s.salePricePerKg),
      total: formatCurrency(saleTotal(s)),
      profit: formatCurrency(profit),
      profitPerKg: formatCurrency(profitPerKg(s.salePricePerKg, cost)),
      customer: customerName(customers, s.customerId),
      notes: s.notes ?? '',
    };
  });
}

export const SALES_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'date', header: 'Date' },
  { key: 'tea', header: 'Tea' },
  { key: 'bags', header: 'Bags' },
  { key: 'kg', header: 'Kg' },
  { key: 'purchasePrice', header: 'Purchase/kg' },
  { key: 'salePrice', header: 'Sale/kg' },
  { key: 'total', header: 'Total' },
  { key: 'profit', header: 'Profit' },
  { key: 'profitPerKg', header: 'Profit/kg' },
  { key: 'customer', header: 'Customer' },
  { key: 'notes', header: 'Notes' },
];

/** Customer-facing receipt — no purchase cost or profit. */
export const CUSTOMER_RECEIPT_COLUMNS: ExportColumn[] = [
  { key: 'date', header: 'Sale Date' },
  { key: 'tea', header: 'Tea Name' },
  { key: 'bags', header: 'Bags Sold' },
  { key: 'kg', header: 'Weight (kg)' },
  { key: 'salePrice', header: 'Sale Rate / kg' },
  { key: 'total', header: 'Total Amount' },
  { key: 'received', header: 'Amount Paid' },
  { key: 'dues', header: 'Remaining Amount' },
  { key: 'notes', header: 'Notes' },
];

export function buildCustomerReceiptRows(sale: Sale) {
  const total = saleTotal(sale);
  const dues = Math.max(0, total - sale.amountReceived);
  const notes = [
    sale.notes?.trim(),
    sale.lastPaymentAt ? `Last payment: ${formatDateTime(sale.lastPaymentAt)}` : undefined,
  ].filter(Boolean).join('\n');
  return [{
    date: sale.date,
    tea: sale.teaName,
    bags: formatBags(saleBagsSold(sale)),
    kg: formatKg(sale.quantityKg),
    salePrice: formatCurrency(sale.salePricePerKg),
    total: formatCurrency(total),
    received: formatCurrency(sale.amountReceived),
    dues: formatCurrency(dues),
    notes,
  }];
}

export function printCustomerReceipt(options: {
  sale: Sale;
  customer?: Customer;
  /** Used when customer record is missing but sale has customerId. */
  customerName?: string;
  shopProfile?: ShopPrintProfile;
}) {
  const { sale, customer, customerName, shopProfile } = options;
  const subtitle = customer
    ? `${customer.name}${customer.customerId ? ` · ${customer.customerId}` : ''}`
    : customerName || undefined;
  const rows = buildCustomerReceiptRows(sale);
  const row = rows[0];
  const footerHtml = `
<div class="receipt-summary">
  <p><span class="label">Total Amount:</span> <span class="value">${row.total}</span></p>
  <p><span class="label">Amount Paid:</span> <span class="value">${row.received}</span></p>
  <p class="remaining"><span class="label">Remaining Amount:</span> <span class="value">${row.dues}</span></p>
  ${sale.lastPaymentAt ? `<p><span class="label">Last Payment:</span> <span class="value">${formatDateTime(sale.lastPaymentAt)}</span></p>` : ''}
</div>`;
  printTable({
    title: `Sale Receipt — ${sale.teaName}`,
    subtitle: subtitle ? `${subtitle} · ${sale.date}` : sale.date,
    shopProfile,
    columns: CUSTOMER_RECEIPT_COLUMNS,
    rows,
    footerHtml,
  });
}

export function buildPurchaseExportRows(
  purchases: Purchase[],
  dealers: Dealer[],
  payments: Payment[] = [],
) {
  const rows: Record<string, string | number>[] = [];
  const sorted = [...purchases].sort((a, b) => b.date.localeCompare(a.date));

  for (const p of sorted) {
    const linked = payments.filter((pay) => pay.purchaseId === p.id);
    rows.push({
      date: p.date,
      event: 'Purchase',
      dealer: dealerName(dealers, p.dealerId),
      tea: p.teaName,
      contNo: p.contNo ?? '',
      lotNo: p.lotNo ?? '',
      country: p.country ?? '',
      grade: p.grade ?? '',
      invoiceNumber: p.invoiceNumber ?? '',
      bagsOrdered: String(p.bagsOrdered),
      bagsReceived: String(p.bagsReceived),
      pendingBags: String(purchasePendingBags(p)),
      orderedMaal: formatKg(purchaseOrderedKg(p)),
      receivedMaal: formatKg(purchaseNetWeight(p)),
      pendingMaal: formatKg(purchasePendingBags(p) * p.bagWeightKg),
      orderedAmount: formatCurrency(purchaseOrderedTotalPrice(p)),
      previousPaid: formatCurrency(purchasePreviousPaid(p)),
      currentPayment: formatCurrency(purchaseCurrentPayment(p)),
      paidAmount: formatCurrency(p.depositPaid),
      pendingAmount: formatCurrency(purchasePendingAmount(p)),
      lastPayment: formatDateTime(p.lastPaymentAt),
      previousReceived: p.previousBagsReceived != null ? String(p.previousBagsReceived) : '—',
      currentReceived: p.lastReceivedBags != null ? String(p.lastReceivedBags) : '—',
      previousDate: p.previousReceiveDate ?? '—',
      currentDate: formatDateTime(p.lastReceivedAt),
      standardKg: formatKg(p.bagsReceived * p.bagWeightKg),
      missKg: formatKg(p.missWeightKg),
      netKg: formatKg(purchaseNetWeight(p)),
      totalPrice: formatCurrency(purchaseTotalPrice(p)),
      notes: p.notes ?? '',
    });

    for (const event of buildPurchaseChangeEvents(p, linked)) {
      const eventLabel =
        event.type === 'payment' ? 'Pay Pending' : event.type === 'receive' ? 'Receive Maal' : 'Edit';
      rows.push({
        date: formatDateTime(event.at),
        event: eventLabel,
        dealer: dealerName(dealers, p.dealerId),
        tea: p.teaName,
        contNo: '',
        lotNo: '',
        country: '',
        grade: '',
        invoiceNumber: '',
        bagsOrdered: event.bagsOrdered != null ? String(event.bagsOrdered) : '—',
        bagsReceived: event.bagsReceived != null ? String(event.bagsReceived) : '—',
        pendingBags: event.bagsAdded != null ? `+${event.bagsAdded}` : '—',
        orderedMaal: '—',
        receivedMaal: '—',
        pendingMaal: '—',
        orderedAmount: '—',
        previousPaid: event.previousPaid != null ? formatCurrency(event.previousPaid) : '—',
        currentPayment: event.amount != null ? formatCurrency(event.amount) : '—',
        paidAmount: event.balanceAfter != null ? formatCurrency(event.balanceAfter) : '—',
        pendingAmount: '—',
        lastPayment: event.type === 'payment' ? formatDateTime(event.at) : '—',
        previousReceived: '—',
        currentReceived: event.bagsAdded != null ? String(event.bagsAdded) : '—',
        previousDate: '—',
        currentDate: event.type === 'receive' ? formatDateTime(event.at) : '—',
        standardKg: '—',
        missKg: '—',
        netKg: '—',
        totalPrice: event.amount != null ? formatCurrency(event.amount) : '—',
        notes: event.summary,
      });
    }
  }

  return rows;
}

export const PURCHASE_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'date', header: 'Date' },
  { key: 'event', header: 'Type' },
  { key: 'dealer', header: 'Dealer' },
  { key: 'tea', header: 'Tea' },
  { key: 'contNo', header: 'Cont No' },
  { key: 'lotNo', header: 'Lot No' },
  { key: 'country', header: 'Country' },
  { key: 'grade', header: 'Grade' },
  { key: 'invoiceNumber', header: 'Invoice Number' },
  { key: 'bagsOrdered', header: 'Bags ordered' },
  { key: 'bagsReceived', header: 'Bags received' },
  { key: 'pendingBags', header: 'Pending bags' },
  { key: 'orderedMaal', header: 'Ordered maal (kg)' },
  { key: 'receivedMaal', header: 'Received maal (kg)' },
  { key: 'pendingMaal', header: 'Pending maal (kg)' },
  { key: 'orderedAmount', header: 'Ordered amount' },
  { key: 'previousPaid', header: 'Previous paid' },
  { key: 'currentPayment', header: 'Current payment' },
  { key: 'paidAmount', header: 'Total paid' },
  { key: 'pendingAmount', header: 'Pending amount' },
  { key: 'lastPayment', header: 'Last payment' },
  { key: 'previousReceived', header: 'Previous received (bags)' },
  { key: 'currentReceived', header: 'Current received (bags)' },
  { key: 'previousDate', header: 'Previous date' },
  { key: 'currentDate', header: 'Current date' },
  { key: 'netKg', header: 'Net kg' },
  { key: 'totalPrice', header: 'Received value' },
  { key: 'notes', header: 'Notes' },
];

export function buildDealerExportRows(dealers: Dealer[], purchases: Purchase[], payments: Payment[]) {
  return dealers.map((d) => {
    const s = computeDealerSummary(d, purchases, payments);
    return {
      name: d.name,
      phone: d.phone ?? '',
      address: d.address ?? '',
      bagsOrdered: formatBags(s.totalBagsOrdered),
      bagsReceived: formatBags(s.totalBagsReceived),
      receivedMaal: formatKg(s.totalReceivedMaalKg),
      pendingBags: formatBags(s.totalPendingBags),
      pendingMaal: formatKg(s.totalPendingMaalKg),
      totalPurchased: formatCurrency(s.totalPurchased),
      totalPaid: formatCurrency(s.totalPaid),
      currentDue: formatCurrency(s.currentDue),
    };
  });
}

export const DEALER_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'name', header: 'Dealer' },
  { key: 'phone', header: 'Phone' },
  { key: 'address', header: 'Address' },
  { key: 'bagsOrdered', header: 'Bags ordered' },
  { key: 'bagsReceived', header: 'Bags received' },
  { key: 'receivedMaal', header: 'Received maal (kg)' },
  { key: 'pendingBags', header: 'Pending bags' },
  { key: 'pendingMaal', header: 'Pending maal (kg)' },
  { key: 'totalPurchased', header: 'Total purchased' },
  { key: 'totalPaid', header: 'Total paid' },
  { key: 'currentDue', header: 'Current due' },
];

export function buildCustomerSummaryExportRows(customers: Customer[], sales: Sale[], payments: Payment[]) {
  return customers.map((c) => {
    const s = computeCustomerSummary(c, sales, payments);
    const lastSale = sales
      .filter((x) => x.customerId === c.id)
      .sort((a, b) => b.date.localeCompare(a.date))[0]?.date ?? '';
    return {
      customerId: c.customerId,
      name: c.name,
      phone: c.phone ?? '',
      address: c.address ?? '',
      registerDate: c.registerDate ?? '',
      totalMaal: formatKg(s.totalMaalKg),
      totalBags: formatBags(s.totalBagsSold),
      totalAmount: formatCurrency(s.totalSale),
      received: formatCurrency(s.receivingAmount),
      dues: formatCurrency(s.pendingAmount),
      teas: s.teaNames.join(', '),
      lastSale,
    };
  });
}

export const CUSTOMER_SUMMARY_COLUMNS: ExportColumn[] = [
  { key: 'customerId', header: 'Customer ID' },
  { key: 'name', header: 'Name' },
  { key: 'phone', header: 'Phone' },
  { key: 'address', header: 'Address' },
  { key: 'registerDate', header: 'Register date' },
  { key: 'totalMaal', header: 'Total maal (kg)' },
  { key: 'totalBags', header: 'Sold bags' },
  { key: 'totalAmount', header: 'Total amount' },
  { key: 'received', header: 'Received' },
  { key: 'dues', header: 'Dues' },
  { key: 'teas', header: 'Teas' },
  { key: 'lastSale', header: 'Last sale' },
];

export function buildCustomerLedgerExportRows(
  ledger: Sale[],
  customers: Customer[],
  purchases: Purchase[],
  allSales: Sale[],
  payments: Payment[] = [],
) {
  const rows: Record<string, string | number>[] = [];
  const sorted = [...ledger].sort((a, b) => b.date.localeCompare(a.date));

  for (const s of sorted) {
    const c = customers.find((x) => x.id === s.customerId);
    const profit = computeSaleProfit(s, purchases, allSales);
    const total = saleTotal(s);
    const dues = Math.max(0, total - s.amountReceived);
    const linked = payments.filter((p) => p.saleId === s.id);
    rows.push({
      date: s.date,
      event: 'Sale',
      customerId: c?.customerId ?? '—',
      name: c?.name ?? '—',
      phone: c?.phone ?? '',
      tea: s.teaName,
      bags: formatBags(saleBagsSold(s)),
      kg: formatKg(s.quantityKg),
      salePrice: formatCurrency(s.salePricePerKg),
      total: formatCurrency(total),
      profit: formatCurrency(profit),
      previousPaid: formatCurrency(salePreviousPaid(s)),
      currentPayment: formatCurrency(saleCurrentPayment(s)),
      received: formatCurrency(s.amountReceived),
      dues: formatCurrency(dues),
      lastPayment: formatDateTime(s.lastPaymentAt),
      notes: s.notes ?? '',
    });

    for (const event of buildSaleChangeEvents(s, linked)) {
      rows.push({
        date: formatDateTime(event.at),
        event: event.type === 'payment' ? 'Pay Dues' : 'Edit',
        customerId: c?.customerId ?? '—',
        name: c?.name ?? '—',
        phone: c?.phone ?? '',
        tea: s.teaName,
        bags: '—',
        kg: '—',
        salePrice: '—',
        total: event.amount != null ? formatCurrency(event.amount) : '—',
        profit: '—',
        previousPaid: event.previousPaid != null ? formatCurrency(event.previousPaid) : '—',
        currentPayment: event.amount != null ? formatCurrency(event.amount) : '—',
        received: event.balanceAfter != null ? formatCurrency(event.balanceAfter) : '—',
        dues: '—',
        lastPayment: event.type === 'payment' ? formatDateTime(event.at) : '—',
        notes: event.summary,
      });
    }
  }

  return rows;
}

export const CUSTOMER_LEDGER_COLUMNS: ExportColumn[] = [
  { key: 'date', header: 'Date' },
  { key: 'event', header: 'Type' },
  { key: 'customerId', header: 'Customer ID' },
  { key: 'name', header: 'Name' },
  { key: 'phone', header: 'Phone' },
  { key: 'tea', header: 'Tea' },
  { key: 'bags', header: 'Bags' },
  { key: 'kg', header: 'Kg' },
  { key: 'salePrice', header: 'Sale/kg' },
  { key: 'total', header: 'Total' },
  { key: 'profit', header: 'Profit' },
  { key: 'previousPaid', header: 'Previous Paid' },
  { key: 'currentPayment', header: 'Current Payment' },
  { key: 'received', header: 'Total Paid' },
  { key: 'dues', header: 'Remaining' },
  { key: 'lastPayment', header: 'Last Payment' },
  { key: 'notes', header: 'Notes' },
];

export function buildStockExportRows(stocks: TeaStock[]) {
  return stocks.map((t) => ({
    tea: t.teaName,
    received: formatKg(t.totalReceived),
    sold: formatKg(t.totalSold),
    current: formatKg(t.currentStock),
    avgCost: formatCurrency(t.avgCostPerKg),
    value: formatCurrency(t.stockValue),
    status: t.isLow ? 'Low' : 'OK',
  }));
}

export const STOCK_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'tea', header: 'Tea' },
  { key: 'received', header: 'Total received' },
  { key: 'sold', header: 'Total sold' },
  { key: 'current', header: 'Current stock' },
  { key: 'avgCost', header: 'Avg cost/kg' },
  { key: 'value', header: 'Stock value' },
  { key: 'status', header: 'Status' },
];

export function buildDashboardExportRows(stats: {
  todaySale: number;
  monthSale: number;
  yearSale: number;
  monthProfit: number;
  stockValue: number;
  customerDues: number;
  dealerDues: number;
  lowStockCount: number;
}) {
  return [{
    todaySale: formatCurrency(stats.todaySale),
    monthSale: formatCurrency(stats.monthSale),
    yearSale: formatCurrency(stats.yearSale),
    monthProfit: formatCurrency(stats.monthProfit),
    stockValue: formatCurrency(stats.stockValue),
    customerDues: formatCurrency(stats.customerDues),
    dealerDues: formatCurrency(stats.dealerDues),
    lowStockCount: String(stats.lowStockCount),
  }];
}

export const DASHBOARD_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'todaySale', header: "Today's sale" },
  { key: 'monthSale', header: 'Month sale' },
  { key: 'yearSale', header: 'Year sale' },
  { key: 'monthProfit', header: 'Month profit' },
  { key: 'stockValue', header: 'Stock value' },
  { key: 'customerDues', header: 'Customer dues' },
  { key: 'dealerDues', header: 'Dealer dues' },
  { key: 'lowStockCount', header: 'Low stock alerts' },
];

export type HistorySection = {
  title: string;
  columns: ExportColumn[];
  rows: Record<string, string | number>[];
};

export const CUSTOMER_MAAL_HISTORY_COLUMNS: ExportColumn[] = [
  { key: 'date', header: 'Date' },
  { key: 'event', header: 'Type' },
  { key: 'tea', header: 'Tea' },
  { key: 'bags', header: 'Bags' },
  { key: 'kg', header: 'Kg' },
  { key: 'salePrice', header: 'Sale/kg' },
  { key: 'total', header: 'Total' },
  { key: 'previousPaid', header: 'Previous Paid' },
  { key: 'currentPayment', header: 'Current Payment' },
  { key: 'totalPaid', header: 'Total Paid' },
  { key: 'remaining', header: 'Remaining' },
  { key: 'lastPayment', header: 'Last Payment' },
  { key: 'notes', header: 'Notes' },
];

export const CUSTOMER_ACTIVITY_HISTORY_COLUMNS: ExportColumn[] = [
  { key: 'date', header: 'Date / Time' },
  { key: 'type', header: 'Type' },
  { key: 'tea', header: 'Tea / Customer' },
  { key: 'amount', header: 'Amount' },
  { key: 'summary', header: 'Summary' },
];

export const CUSTOMER_PAYMENT_HISTORY_COLUMNS: ExportColumn[] = [
  { key: 'date', header: 'Date / Time' },
  { key: 'source', header: 'Type' },
  { key: 'detail', header: 'Detail' },
  { key: 'amount', header: 'Amount' },
  { key: 'previousPaid', header: 'Previous Paid' },
  { key: 'totalPaid', header: 'Total Paid After' },
  { key: 'notes', header: 'Notes' },
];

export const DEALER_MAAL_HISTORY_COLUMNS: ExportColumn[] = [
  { key: 'date', header: 'Date' },
  { key: 'event', header: 'Type' },
  { key: 'tea', header: 'Tea' },
  { key: 'bagsOrdered', header: 'Bags Ordered' },
  { key: 'bagsReceived', header: 'Bags Received' },
  { key: 'pendingBags', header: 'Pending Bags' },
  { key: 'orderedMaal', header: 'Ordered Maal' },
  { key: 'receivedMaal', header: 'Received Maal' },
  { key: 'pendingMaal', header: 'Pending Maal' },
  { key: 'orderedAmount', header: 'Ordered Amount' },
  { key: 'totalPaid', header: 'Total Paid' },
  { key: 'pendingAmount', header: 'Pending Amount' },
  { key: 'lastReceive', header: 'Last Maal Update' },
  { key: 'lastPayment', header: 'Last Payment' },
  { key: 'notes', header: 'Notes' },
];

export const DEALER_ACTIVITY_HISTORY_COLUMNS: ExportColumn[] = [
  { key: 'date', header: 'Date / Time' },
  { key: 'type', header: 'Type' },
  { key: 'tea', header: 'Tea / Dealer' },
  { key: 'bagsOrdered', header: 'Bags Ordered' },
  { key: 'bagsReceived', header: 'Bags Received' },
  { key: 'bagsAdded', header: 'Bags Added' },
  { key: 'summary', header: 'Summary' },
];

export const DEALER_PAYMENT_HISTORY_COLUMNS: ExportColumn[] = [
  { key: 'date', header: 'Date / Time' },
  { key: 'source', header: 'Type' },
  { key: 'detail', header: 'Detail' },
  { key: 'amount', header: 'Amount' },
  { key: 'previousPaid', header: 'Previous Paid' },
  { key: 'totalPaid', header: 'Total Paid After' },
  { key: 'notes', header: 'Notes' },
];

export function buildDealerActivityHistoryRows(dealer: Dealer, purchases: Purchase[]) {
  type Row = Record<string, string | number> & { _sort: string };
  const rows: Row[] = [];

  for (const entry of dealer.history ?? []) {
    rows.push({
      _sort: entry.at,
      date: formatDateTime(entry.at),
      type: entry.type === 'edit' ? 'Dealer edit' : entry.type,
      tea: dealer.name,
      bagsOrdered: entry.bagsOrdered != null ? String(entry.bagsOrdered) : '—',
      bagsReceived: entry.bagsReceived != null ? String(entry.bagsReceived) : '—',
      bagsAdded: entry.bagsAdded != null ? String(entry.bagsAdded) : '—',
      summary: entry.summary,
    });
  }

  for (const p of purchases) {
    for (const entry of p.history ?? []) {
      rows.push({
        _sort: entry.at,
        date: formatDateTime(entry.at),
        type:
          entry.type === 'receive'
            ? 'Receive maal'
            : entry.type === 'edit'
              ? 'Purchase edit'
              : entry.type === 'create'
                ? 'New purchase'
                : entry.type === 'payment'
                  ? 'Pay pending'
                  : entry.type,
        tea: p.teaName,
        bagsOrdered: entry.bagsOrdered != null ? String(entry.bagsOrdered) : String(p.bagsOrdered),
        bagsReceived: entry.bagsReceived != null ? String(entry.bagsReceived) : String(p.bagsReceived),
        bagsAdded: entry.bagsAdded != null ? String(entry.bagsAdded) : '—',
        summary: entry.summary,
      });
    }
    // Legacy receive (before history array) still shows as one row
    if ((!(p.history?.length)) && p.lastReceivedAt && p.lastReceivedBags) {
      rows.push({
        _sort: p.lastReceivedAt,
        date: formatDateTime(p.lastReceivedAt),
        type: 'Receive maal',
        tea: p.teaName,
        bagsOrdered: String(p.bagsOrdered),
        bagsReceived: String(p.bagsReceived),
        bagsAdded: String(p.lastReceivedBags),
        summary: `Received ${p.lastReceivedBags} bags (legacy record)`,
      });
    }
  }

  return rows
    .sort((a, b) => b._sort.localeCompare(a._sort))
    .map(({ _sort: _, ...row }) => row);
}

export function buildCustomerMaalHistoryRows(sales: Sale[], payments: Payment[] = []) {
  const rows: Record<string, string | number>[] = [];
  const sorted = [...sales].sort((a, b) => b.date.localeCompare(a.date));

  for (const s of sorted) {
    const total = saleTotal(s);
    const remaining = Math.max(0, total - s.amountReceived);
    const linked = payments.filter((p) => p.saleId === s.id);
    rows.push({
      date: s.date,
      event: 'Sale',
      tea: s.teaName,
      bags: formatBags(saleBagsSold(s)),
      kg: formatKg(s.quantityKg),
      salePrice: formatCurrency(s.salePricePerKg),
      total: formatCurrency(total),
      previousPaid: formatCurrency(salePreviousPaid(s)),
      currentPayment: saleCurrentPayment(s) > 0 ? formatCurrency(saleCurrentPayment(s)) : '—',
      totalPaid: formatCurrency(s.amountReceived),
      remaining: formatCurrency(remaining),
      lastPayment: formatDateTime(s.lastPaymentAt),
      notes: s.notes ?? '',
    });

    for (const event of buildSaleChangeEvents(s, linked)) {
      rows.push({
        date: formatDateTime(event.at),
        event: event.type === 'payment' ? 'Pay Dues' : 'Edit',
        tea: s.teaName,
        bags: '—',
        kg: '—',
        salePrice: '—',
        total: event.amount != null ? formatCurrency(event.amount) : '—',
        previousPaid: event.previousPaid != null ? formatCurrency(event.previousPaid) : '—',
        currentPayment: event.amount != null ? formatCurrency(event.amount) : '—',
        totalPaid: event.balanceAfter != null ? formatCurrency(event.balanceAfter) : '—',
        remaining: '—',
        lastPayment: event.type === 'payment' ? formatDateTime(event.at) : '—',
        notes: event.summary,
      });
    }
  }

  return rows;
}

export function buildCustomerActivityHistoryRows(customer: Customer, sales: Sale[]) {
  type Row = Record<string, string | number> & { _sort: string };
  const rows: Row[] = [];

  for (const entry of customer.history ?? []) {
    rows.push({
      _sort: entry.at,
      date: formatDateTime(entry.at),
      type: entry.type === 'edit' ? 'Customer edit' : entry.type === 'payment' ? 'Payment' : entry.type,
      tea: customer.name,
      amount: entry.amount != null ? formatCurrency(entry.amount) : '—',
      summary: entry.summary,
    });
  }

  for (const s of sales) {
    for (const entry of s.history ?? []) {
      rows.push({
        _sort: entry.at,
        date: formatDateTime(entry.at),
        type:
          entry.type === 'payment'
            ? 'Pay dues'
            : entry.type === 'edit'
              ? 'Sale edit'
              : entry.type === 'create'
                ? 'New sale'
                : entry.type,
        tea: s.teaName,
        amount: entry.amount != null ? formatCurrency(entry.amount) : '—',
        summary: entry.summary,
      });
    }
  }

  return rows
    .sort((a, b) => b._sort.localeCompare(a._sort))
    .map(({ _sort: _, ...row }) => row);
}

export function buildCustomerPaymentHistoryRows(sales: Sale[], payments: Payment[]) {
  type Row = Record<string, string | number> & { _sort: string };
  const rows: Row[] = [];
  const saleById = new Map(sales.filter((s) => s.id != null).map((s) => [s.id!, s]));
  const linkedBySale = new Map<number, Payment[]>();

  for (const p of payments) {
    if (p.saleId != null) {
      const list = linkedBySale.get(p.saleId) ?? [];
      list.push(p);
      linkedBySale.set(p.saleId, list);
    }
  }

  for (const p of payments) {
    const sortKey = p.paidAt ?? p.date;
    if (p.saleId != null) {
      const sale = saleById.get(p.saleId);
      rows.push({
        _sort: sortKey,
        date: p.paidAt ? formatDateTime(p.paidAt) : p.date,
        source: 'Pay Dues',
        detail: sale?.teaName ?? 'Sale',
        amount: formatCurrency(p.amount),
        previousPaid: p.previousPaid != null ? formatCurrency(p.previousPaid) : '—',
        totalPaid: p.balanceAfter != null ? formatCurrency(p.balanceAfter) : '—',
        notes: p.note ?? '',
      });
      continue;
    }
    if (p.purchaseId != null) continue;
    rows.push({
      _sort: sortKey,
      date: p.paidAt ? formatDateTime(p.paidAt) : p.date,
      source: 'Direct Payment',
      detail: '—',
      amount: formatCurrency(p.amount),
      previousPaid: '—',
      totalPaid: '—',
      notes: p.note ?? '',
    });
  }

  for (const s of sales) {
    if (s.id == null) continue;
    const linked = linkedBySale.get(s.id) ?? [];
    if (linked.length > 0) {
      const linkedSum = linked.reduce((sum, p) => sum + p.amount, 0);
      const initial = Math.round((s.amountReceived - linkedSum) * 100) / 100;
      if (initial > 0.004) {
        rows.push({
          _sort: s.date,
          date: s.date,
          source: 'Sale',
          detail: s.teaName,
          amount: formatCurrency(initial),
          previousPaid: formatCurrency(0),
          totalPaid: formatCurrency(initial),
          notes: 'Initial payment at sale',
        });
      }
      continue;
    }

    const initialPaid = salePreviousPaid(s);
    if (s.amountReceived > 0 && !s.lastPaymentAt) {
      rows.push({
        _sort: s.date,
        date: s.date,
        source: 'Sale',
        detail: s.teaName,
        amount: formatCurrency(s.amountReceived),
        previousPaid: formatCurrency(0),
        totalPaid: formatCurrency(s.amountReceived),
        notes: 'Payment at sale',
      });
    } else if (s.lastPaymentAt && initialPaid > 0 && s.lastPaymentAmount) {
      rows.push({
        _sort: s.date,
        date: s.date,
        source: 'Sale',
        detail: s.teaName,
        amount: formatCurrency(initialPaid),
        previousPaid: formatCurrency(0),
        totalPaid: formatCurrency(initialPaid),
        notes: 'Initial payment at sale',
      });
    }
    if (s.lastPaymentAt && s.lastPaymentAmount) {
      rows.push({
        _sort: s.lastPaymentAt,
        date: formatDateTime(s.lastPaymentAt),
        source: 'Pay Dues',
        detail: s.teaName,
        amount: formatCurrency(s.lastPaymentAmount),
        previousPaid: formatCurrency(salePreviousPaid(s)),
        totalPaid: formatCurrency(s.amountReceived),
        notes: '',
      });
    }
  }

  return rows
    .sort((a, b) => b._sort.localeCompare(a._sort))
    .map(({ _sort: _, ...row }) => row);
}

export function buildDealerMaalHistoryRows(purchases: Purchase[], payments: Payment[] = []) {
  const rows: Record<string, string | number>[] = [];
  const sorted = [...purchases].sort((a, b) => b.date.localeCompare(a.date));

  for (const p of sorted) {
    const linked = payments.filter((pay) => pay.purchaseId === p.id);
    rows.push({
      date: p.date,
      event: 'Purchase',
      tea: p.teaName,
      bagsOrdered: String(p.bagsOrdered),
      bagsReceived: String(p.bagsReceived),
      pendingBags: String(purchasePendingBags(p)),
      orderedMaal: formatKg(purchaseOrderedKg(p)),
      receivedMaal: formatKg(purchaseNetWeight(p)),
      pendingMaal: formatKg(purchasePendingBags(p) * p.bagWeightKg),
      orderedAmount: formatCurrency(purchaseOrderedTotalPrice(p)),
      totalPaid: formatCurrency(p.depositPaid),
      pendingAmount: formatCurrency(purchasePendingAmount(p)),
      lastReceive: formatDateTime(p.lastReceivedAt),
      lastPayment: formatDateTime(p.lastPaymentAt),
      notes: p.notes ?? '',
    });

    for (const event of buildPurchaseChangeEvents(p, linked)) {
      const eventLabel =
        event.type === 'payment' ? 'Pay Pending' : event.type === 'receive' ? 'Receive Maal' : 'Edit';
      rows.push({
        date: formatDateTime(event.at),
        event: eventLabel,
        tea: p.teaName,
        bagsOrdered: event.bagsOrdered != null ? String(event.bagsOrdered) : '—',
        bagsReceived: event.bagsReceived != null ? String(event.bagsReceived) : '—',
        pendingBags: event.bagsAdded != null ? `+${event.bagsAdded}` : '—',
        orderedMaal: '—',
        receivedMaal: '—',
        pendingMaal: '—',
        orderedAmount: '—',
        totalPaid: event.balanceAfter != null ? formatCurrency(event.balanceAfter) : event.amount != null ? formatCurrency(event.amount) : '—',
        pendingAmount: '—',
        lastReceive: event.type === 'receive' ? formatDateTime(event.at) : '—',
        lastPayment: event.type === 'payment' ? formatDateTime(event.at) : '—',
        notes: event.summary,
      });
    }
  }

  return rows;
}

export function buildDealerPaymentHistoryRows(purchases: Purchase[], payments: Payment[]) {
  type Row = Record<string, string | number> & { _sort: string };
  const rows: Row[] = [];
  const purchaseById = new Map(purchases.filter((p) => p.id != null).map((p) => [p.id!, p]));
  const linkedByPurchase = new Map<number, Payment[]>();

  for (const p of payments) {
    if (p.purchaseId != null) {
      const list = linkedByPurchase.get(p.purchaseId) ?? [];
      list.push(p);
      linkedByPurchase.set(p.purchaseId, list);
    }
  }

  for (const p of payments) {
    const sortKey = p.paidAt ?? p.date;
    if (p.purchaseId != null) {
      const purchase = purchaseById.get(p.purchaseId);
      rows.push({
        _sort: sortKey,
        date: p.paidAt ? formatDateTime(p.paidAt) : p.date,
        source: 'Pay Pending',
        detail: purchase?.teaName ?? 'Purchase',
        amount: formatCurrency(p.amount),
        previousPaid: p.previousPaid != null ? formatCurrency(p.previousPaid) : '—',
        totalPaid: p.balanceAfter != null ? formatCurrency(p.balanceAfter) : '—',
        notes: p.note ?? '',
      });
      continue;
    }
    if (p.saleId != null) continue;
    rows.push({
      _sort: sortKey,
      date: p.paidAt ? formatDateTime(p.paidAt) : p.date,
      source: 'Direct Payment',
      detail: '—',
      amount: formatCurrency(p.amount),
      previousPaid: '—',
      totalPaid: '—',
      notes: p.note ?? '',
    });
  }

  for (const p of purchases) {
    if (p.id == null) continue;
    const linked = linkedByPurchase.get(p.id) ?? [];
    if (linked.length > 0) {
      const linkedSum = linked.reduce((sum, x) => sum + x.amount, 0);
      const initial = Math.round((p.depositPaid - linkedSum) * 100) / 100;
      if (initial > 0.004) {
        rows.push({
          _sort: p.date,
          date: p.date,
          source: 'Purchase',
          detail: p.teaName,
          amount: formatCurrency(initial),
          previousPaid: formatCurrency(0),
          totalPaid: formatCurrency(initial),
          notes: 'Initial deposit',
        });
      }
      continue;
    }

    const prevPaid = purchasePreviousPaid(p);
    if (p.depositPaid > 0 && !p.lastPaymentAt) {
      rows.push({
        _sort: p.date,
        date: p.date,
        source: 'Purchase',
        detail: p.teaName,
        amount: formatCurrency(p.depositPaid),
        previousPaid: formatCurrency(0),
        totalPaid: formatCurrency(p.depositPaid),
        notes: 'Deposit at purchase',
      });
    } else if (p.lastPaymentAt && prevPaid > 0 && p.lastPaymentAmount) {
      rows.push({
        _sort: p.date,
        date: p.date,
        source: 'Purchase',
        detail: p.teaName,
        amount: formatCurrency(prevPaid),
        previousPaid: formatCurrency(0),
        totalPaid: formatCurrency(prevPaid),
        notes: 'Initial deposit',
      });
    }
    if (p.lastPaymentAt && p.lastPaymentAmount) {
      rows.push({
        _sort: p.lastPaymentAt,
        date: formatDateTime(p.lastPaymentAt),
        source: 'Pay Pending',
        detail: p.teaName,
        amount: formatCurrency(p.lastPaymentAmount),
        previousPaid: formatCurrency(purchasePreviousPaid(p)),
        totalPaid: formatCurrency(p.depositPaid),
        notes: '',
      });
    }
  }

  return rows
    .sort((a, b) => b._sort.localeCompare(a._sort))
    .map(({ _sort: _, ...row }) => row);
}

function buildSummaryHtml(lines: { label: string; value: string }[]) {
  return `<div class="receipt-summary summary-grid">${lines.map((l) => `<div class="summary-item"><span class="label">${l.label}</span><span class="value">${l.value}</span></div>`).join('')}</div>`;
}

function buildSectionsHtml(sections: HistorySection[]) {
  return sections
    .map((section) => {
      if (section.rows.length === 0) {
        return `<section class="report-section"><h3>${section.title}</h3><p class="meta">No entries</p></section>`;
      }
      const head = section.columns.map((c) => `<th>${c.header}</th>`).join('');
      const body = section.rows
        .map((row, i) => `<tr class="${i % 2 ? 'alt' : ''}">${section.columns.map((c) => `<td>${row[c.key] ?? ''}</td>`).join('')}</tr>`)
        .join('');
      return `<section class="report-section"><h3>${section.title}</h3><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></section>`;
    })
    .join('');
}

export function printHistoryReport(options: {
  title: string;
  subtitle?: string;
  shopProfile?: ShopPrintProfile;
  summaryLines?: { label: string; value: string }[];
  sections: HistorySection[];
}) {
  const { title, subtitle, summaryLines, sections } = options;
  const profile: ShopPrintProfile = options.shopProfile ?? { shopName: 'Chai Khata' };
  const win = window.open('', '_blank', 'width=1000,height=800');
  if (!win) return;

  const headerHtml = buildPrintHeaderHtml(profile);
  const summaryHtml = summaryLines?.length ? buildSummaryHtml(summaryLines) : '';
  const sectionsHtml = buildSectionsHtml(sections);

  win.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&display=swap');
*{box-sizing:border-box}
body{font-family:'Plus Jakarta Sans',system-ui,sans-serif;padding:28px;color:#1c2b24}
.brand-bar{height:6px;background:linear-gradient(90deg,#d4a853,#1a3d2f 45%,#40916c);margin:-28px -28px 18px}
.print-header{display:flex;align-items:center;gap:16px;margin-bottom:10px;padding-bottom:12px;border-bottom:1px solid #ebe4d8}
.print-logo{width:64px;height:64px;object-fit:contain;border-radius:10px;border:1px solid #ebe4d8}
.print-header-text h1{font-size:1.4rem;margin:0 0 4px;color:#1a3d2f}
.print-contact{color:#5c6b63;font-size:0.88rem;margin:0}
h2{font-size:1.1rem;margin:0 0 6px;color:#1a3d2f}
h3{font-size:0.92rem;margin:0 0 10px;padding:8px 12px;background:#1a3d2f;color:#fff;border-radius:8px 8px 0 0}
.meta{color:#8a9690;font-size:0.82rem;margin-bottom:14px}
.report-section{margin-bottom:22px}
.report-section table{margin-top:0;border-radius:0 0 8px 8px;overflow:hidden}
table{width:100%;border-collapse:collapse;font-size:0.78rem}
th,td{border:1px solid #ebe4d8;padding:7px 8px;text-align:left;word-break:break-word}
th{background:#245a42;color:#fff;font-size:0.68rem;letter-spacing:0.04em;text-transform:uppercase}
tr.alt,tbody tr:nth-child(even){background:#f8f5f0}
.receipt-summary{margin:8px 0 20px;padding:14px;border:1px solid #d8f3dc;border-left:5px solid #d4a853;border-radius:12px;background:#f8faf8}
.summary-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 16px;max-width:560px}
.summary-item{display:flex;flex-direction:column;gap:2px}
.summary-item .label{color:#5c6b63;font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.04em}
.summary-item .value{font-weight:800;color:#1a3d2f;font-size:1rem}
.print-footer{margin-top:20px;padding-top:10px;border-top:1px solid #ebe4d8;color:#8a9690;font-size:0.75rem;display:flex;justify-content:space-between}
@media print{body{padding:12px}.brand-bar{margin:-12px -12px 12px}}
</style></head><body>
<div class="brand-bar"></div>
${headerHtml}
<h2>${title}</h2>
<p class="meta">${subtitle ? `${subtitle} · ` : ''}Generated: ${stamp()}</p>
${summaryHtml}
${sectionsHtml}
<div class="print-footer"><span>${profile.shopName} · Full history report</span><span>${stamp()}</span></div>
<script>window.onload=function(){window.print();}</script>
</body></html>`);
  win.document.close();
}

export async function downloadHistoryPdf(options: {
  filename: string;
  title: string;
  subtitle?: string;
  shopProfile?: ShopPrintProfile;
  summaryLines?: { label: string; value: string }[];
  sections: HistorySection[];
}) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const { filename, title, subtitle, summaryLines, sections } = options;
  const profile: ShopPrintProfile = options.shopProfile ?? { shopName: 'Chai Khata' };
  const landscape = sections.some((s) => s.columns.length > 7);
  const doc = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  const { pageW, startY } = drawPdfBrandBar(doc);

  let y = startY;
  let textX = 14;

  if (profile.shopLogo) {
    try {
      const fmt = logoImageFormat(profile.shopLogo);
      doc.addImage(profile.shopLogo, fmt, 14, y, 18, 18);
      textX = 36;
    } catch {
      /* skip */
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(26, 61, 47);
  doc.text(profile.shopName, textX, y + 6);
  y += 10;

  const contact = formatShopContact(profile);
  if (contact) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(90);
    doc.text(contact, textX, y);
    y += 5;
  }

  doc.setDrawColor(212, 168, 83);
  doc.setLineWidth(0.4);
  doc.line(14, y + 1, pageW - 14, y + 1);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(26, 61, 47);
  doc.text(title, 14, y);
  y += 6;

  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text(subtitle, 14, y);
    y += 5;
  }

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(`Generated: ${stamp()}`, 14, y);
  doc.setTextColor(0);
  y += 7;

  if (summaryLines?.length) {
    const boxH = 8 + summaryLines.length * 5.5;
    doc.setFillColor(248, 250, 248);
    doc.setDrawColor(26, 61, 47);
    doc.roundedRect(14, y, pageW - 28, boxH, 2, 2, 'FD');
    doc.setFillColor(212, 168, 83);
    doc.rect(14, y, 2.2, boxH, 'F');
    let sy = y + 6;
    doc.setFontSize(9);
    for (const line of summaryLines) {
      doc.setTextColor(90);
      doc.setFont('helvetica', 'normal');
      doc.text(`${line.label}:`, 20, sy);
      doc.setTextColor(26, 61, 47);
      doc.setFont('helvetica', 'bold');
      doc.text(line.value, pageW - 20, sy, { align: 'right' });
      sy += 5.5;
    }
    doc.setTextColor(0);
    y += boxH + 6;
  }

  for (const section of sections) {
    if (y > (landscape ? 180 : 250)) {
      doc.addPage();
      drawPdfBrandBar(doc);
      y = 16;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255);
    doc.setFillColor(26, 61, 47);
    doc.roundedRect(14, y, pageW - 28, 7, 1.5, 1.5, 'F');
    doc.text(section.title, 17, y + 4.8);
    doc.setTextColor(0);
    y += 9;

    if (section.rows.length === 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text('No entries', 14, y + 3);
      doc.setTextColor(0);
      y += 10;
      continue;
    }

    autoTable(doc, {
      startY: y,
      head: [section.columns.map((c) => c.header)],
      body: section.rows.map((row) => section.columns.map((c) => String(row[c.key] ?? ''))),
      styles: {
        fontSize: 7,
        cellPadding: 1.8,
        lineColor: [230, 224, 214],
        lineWidth: 0.2,
        textColor: [28, 43, 36],
      },
      headStyles: { fillColor: [36, 90, 66], textColor: 255, fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: [248, 245, 240] },
      margin: { left: 14, right: 14, bottom: 18 },
    });

    y = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20;
    y += 8;
  }

  drawPdfFooter(doc, profile);
  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

export function printCustomerFullHistory(options: {
  customer: Customer;
  summary: ReturnType<typeof computeCustomerSummary>;
  sales: Sale[];
  payments: Payment[];
  shopProfile?: ShopPrintProfile;
}) {
  const { customer, summary, sales, payments, shopProfile } = options;
  printHistoryReport({
    title: `Customer Full History — ${customer.name}`,
    subtitle: `${customer.customerId}${customer.phone ? ` · ${customer.phone}` : ''}`,
    shopProfile,
    summaryLines: customerHistorySummaryLines(summary),
    sections: customerHistorySections(customer, sales, payments),
  });
}

export async function downloadCustomerFullHistoryPdf(options: {
  customer: Customer;
  summary: ReturnType<typeof computeCustomerSummary>;
  sales: Sale[];
  payments: Payment[];
  shopProfile?: ShopPrintProfile;
}) {
  const { customer, summary, sales, payments, shopProfile } = options;
  const day = new Date().toISOString().slice(0, 10);
  await downloadHistoryPdf({
    filename: `customer-${customer.customerId}-${day}`,
    title: `Customer Full History — ${customer.name}`,
    subtitle: `${customer.customerId}${customer.phone ? ` · ${customer.phone}` : ''}`,
    shopProfile,
    summaryLines: customerHistorySummaryLines(summary),
    sections: customerHistorySections(customer, sales, payments),
  });
}

export function downloadCustomerFullHistoryCsv(options: {
  customer: Customer;
  summary: ReturnType<typeof computeCustomerSummary>;
  sales: Sale[];
  payments: Payment[];
  shopProfile?: ShopPrintProfile;
}) {
  const { customer, summary, sales, payments, shopProfile } = options;
  const day = new Date().toISOString().slice(0, 10);
  downloadHistoryCsv({
    filename: `customer-${customer.customerId}-${day}`,
    title: `Customer Full History — ${customer.name}`,
    subtitle: `${customer.customerId}${customer.phone ? ` · ${customer.phone}` : ''}`,
    shopName: shopProfile?.shopName,
    summaryLines: customerHistorySummaryLines(summary),
    sections: customerHistorySections(customer, sales, payments),
  });
}

function customerHistorySummaryLines(summary: ReturnType<typeof computeCustomerSummary>) {
  return [
    { label: 'Total Maal', value: formatKg(summary.totalMaalKg) },
    { label: 'Total Sale', value: formatCurrency(summary.totalSale) },
    { label: 'Total Received', value: formatCurrency(summary.receivingAmount) },
    { label: 'Total Dues', value: formatCurrency(summary.pendingAmount) },
  ];
}

function customerHistorySections(
  customer: Customer,
  sales: Sale[],
  payments: Payment[],
): HistorySection[] {
  return [
    { title: 'Maal / Sales History', columns: CUSTOMER_MAAL_HISTORY_COLUMNS, rows: buildCustomerMaalHistoryRows(sales, payments) },
    { title: 'Modifications & Payments', columns: CUSTOMER_ACTIVITY_HISTORY_COLUMNS, rows: buildCustomerActivityHistoryRows(customer, sales) },
    { title: 'Payment History', columns: CUSTOMER_PAYMENT_HISTORY_COLUMNS, rows: buildCustomerPaymentHistoryRows(sales, payments) },
  ];
}

export function printDealerFullHistory(options: {
  dealer: Dealer;
  summary: ReturnType<typeof computeDealerSummary>;
  purchases: Purchase[];
  payments: Payment[];
  shopProfile?: ShopPrintProfile;
}) {
  const { dealer, summary, purchases, payments, shopProfile } = options;
  printHistoryReport({
    title: `Dealer Full History — ${dealer.name}`,
    subtitle: dealer.phone ?? undefined,
    shopProfile,
    summaryLines: dealerHistorySummaryLines(summary),
    sections: dealerHistorySections(dealer, purchases, payments),
  });
}

function dealerHistorySections(
  dealer: Dealer,
  purchases: Purchase[],
  payments: Payment[],
): HistorySection[] {
  return [
    { title: 'Maal / Purchase History', columns: DEALER_MAAL_HISTORY_COLUMNS, rows: buildDealerMaalHistoryRows(purchases, payments) },
    { title: 'Modifications & Receipts', columns: DEALER_ACTIVITY_HISTORY_COLUMNS, rows: buildDealerActivityHistoryRows(dealer, purchases) },
    { title: 'Payment History', columns: DEALER_PAYMENT_HISTORY_COLUMNS, rows: buildDealerPaymentHistoryRows(purchases, payments) },
  ];
}

function dealerHistorySummaryLines(summary: ReturnType<typeof computeDealerSummary>) {
  return [
    { label: 'Bags Ordered', value: formatBags(summary.totalBagsOrdered) },
    { label: 'Bags Received', value: formatBags(summary.totalBagsReceived) },
    { label: 'Received Maal', value: formatKg(summary.totalReceivedMaalKg) },
    { label: 'Pending Maal', value: formatKg(summary.totalPendingMaalKg) },
    { label: 'Total Purchased', value: formatCurrency(summary.totalPurchased) },
    { label: 'Total Paid', value: formatCurrency(summary.totalPaid) },
    { label: 'Current Due', value: formatCurrency(summary.currentDue) },
  ];
}

export function downloadHistoryCsv(options: {
  filename: string;
  title: string;
  subtitle?: string;
  shopName?: string;
  summaryLines?: { label: string; value: string }[];
  sections: HistorySection[];
}) {
  const { filename, title, subtitle, shopName, summaryLines, sections } = options;
  const escape = (v: string | number) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const lines: string[] = [];
  lines.push(escape(shopName ?? 'Patiwala · Chai Khata'));
  lines.push(escape(title));
  if (subtitle) lines.push(escape(subtitle));
  lines.push(escape(`Generated: ${stamp()}`));
  lines.push('');

  if (summaryLines?.length) {
    lines.push(escape('SUMMARY'));
    lines.push(['Metric', 'Value'].map(escape).join(','));
    for (const line of summaryLines) {
      lines.push([line.label, line.value].map(escape).join(','));
    }
    lines.push('');
  }

  for (const section of sections) {
    lines.push(escape(section.title.toUpperCase()));
    if (section.rows.length === 0) {
      lines.push(escape('No entries'));
      lines.push('');
      continue;
    }
    lines.push(section.columns.map((c) => escape(c.header)).join(','));
    for (const row of section.rows) {
      lines.push(section.columns.map((c) => escape(row[c.key] ?? '')).join(','));
    }
    lines.push('');
  }

  const csv = `\uFEFF${lines.join('\n')}`;
  downloadBlob(
    filename.endsWith('.csv') ? filename : `${filename}.csv`,
    new Blob([csv], { type: 'text/csv;charset=utf-8' }),
  );
}

export async function downloadDealerFullHistoryPdf(options: {
  dealer: Dealer;
  summary: ReturnType<typeof computeDealerSummary>;
  purchases: Purchase[];
  payments: Payment[];
  shopProfile?: ShopPrintProfile;
}) {
  const { dealer, summary, purchases, payments, shopProfile } = options;
  const day = new Date().toISOString().slice(0, 10);
  await downloadHistoryPdf({
    filename: `dealer-${dealer.name.replace(/\s+/g, '-')}-${day}`,
    title: `Dealer Full History — ${dealer.name}`,
    subtitle: dealer.phone ?? undefined,
    shopProfile,
    summaryLines: dealerHistorySummaryLines(summary),
    sections: dealerHistorySections(dealer, purchases, payments),
  });
}

export function downloadDealerFullHistoryCsv(options: {
  dealer: Dealer;
  summary: ReturnType<typeof computeDealerSummary>;
  purchases: Purchase[];
  payments: Payment[];
  shopProfile?: ShopPrintProfile;
}) {
  const { dealer, summary, purchases, payments, shopProfile } = options;
  const day = new Date().toISOString().slice(0, 10);
  downloadHistoryCsv({
    filename: `dealer-${dealer.name.replace(/\s+/g, '-')}-${day}`,
    title: `Dealer Full History — ${dealer.name}`,
    subtitle: dealer.phone ?? undefined,
    shopName: shopProfile?.shopName,
    summaryLines: dealerHistorySummaryLines(summary),
    sections: dealerHistorySections(dealer, purchases, payments),
  });
}
