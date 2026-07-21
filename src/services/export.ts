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
  saleBagsSold,
  saleCurrentPayment,
  salePreviousPaid,
  saleTotal,
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

  let y = 14;
  let textX = 14;

  if (profile.shopLogo) {
    try {
      const fmt = logoImageFormat(profile.shopLogo);
      doc.addImage(profile.shopLogo, fmt, 14, y - 2, 16, 16);
      textX = 34;
    } catch {
      /* skip logo if unsupported */
    }
  }

  doc.setFontSize(16);
  doc.text(profile.shopName, textX, y);
  y += 6;

  const contact = formatShopContact(profile);
  if (contact) {
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text(contact, textX, y);
    doc.setTextColor(0);
    y += 5;
  }

  doc.setFontSize(12);
  doc.text(title, textX, y + 2);
  y += 8;

  if (subtitle) {
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text(subtitle, textX, y);
    y += 5;
  }
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(`Generated: ${stamp()}`, textX, y);
  doc.setTextColor(0);

  autoTable(doc, {
    startY: y + 4,
    head: [columns.map((c) => c.header)],
    body: rows.map((row) => columns.map((c) => String(row[c.key] ?? ''))),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [26, 61, 47], textColor: 255 },
    margin: { left: 14, right: 14 },
  });

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
body{font-family:system-ui,sans-serif;padding:24px;color:#1a1a1a}
.print-header{display:flex;align-items:center;gap:16px;margin-bottom:12px}
.print-logo{width:64px;height:64px;object-fit:contain;border-radius:8px}
.print-header-text h1{font-size:1.35rem;margin:0 0 4px}
.print-contact{color:#444;font-size:0.9rem;margin:0}
h2{font-size:1.05rem;margin:0 0 8px}
.meta{color:#666;font-size:0.85rem;margin-bottom:16px}
table{width:100%;border-collapse:collapse;font-size:0.85rem}
th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}
th{background:#1a3d2f;color:#fff}
.receipt-summary{margin-top:20px;padding:14px 16px;border:2px solid #1a3d2f;border-radius:8px;background:#f8faf8;max-width:360px}
.receipt-summary p{margin:6px 0;font-size:0.95rem}
.receipt-summary .label{color:#444}
.receipt-summary .value{font-weight:700}
.receipt-summary .remaining{color:#b45309;font-size:1.05rem}
@media print{body{padding:12px}}
</style></head><body>
${headerHtml}
<h2>${title}</h2>
<p class="meta">${subtitle ? `${subtitle} · ` : ''}Generated: ${stamp()}</p>
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
${footerHtml ?? ''}
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

export function buildPurchaseExportRows(purchases: Purchase[], dealers: Dealer[]) {
  return purchases.map((p) => ({
    date: p.date,
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
  }));
}

export const PURCHASE_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'date', header: 'Date' },
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
      receivedMaal: formatKg(s.totalReceivedMaalKg),
      pendingBags: String(s.totalPendingBags),
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
) {
  return ledger.map((s) => {
    const c = customers.find((x) => x.id === s.customerId);
    const profit = computeSaleProfit(s, purchases, allSales);
    const total = saleTotal(s);
    const dues = Math.max(0, total - s.amountReceived);
    return {
      date: s.date,
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
    };
  });
}

export const CUSTOMER_LEDGER_COLUMNS: ExportColumn[] = [
  { key: 'date', header: 'Date' },
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

export const DEALER_PAYMENT_HISTORY_COLUMNS: ExportColumn[] = [
  { key: 'date', header: 'Date / Time' },
  { key: 'source', header: 'Type' },
  { key: 'detail', header: 'Detail' },
  { key: 'amount', header: 'Amount' },
  { key: 'previousPaid', header: 'Previous Paid' },
  { key: 'totalPaid', header: 'Total Paid After' },
  { key: 'notes', header: 'Notes' },
];

export function buildCustomerMaalHistoryRows(sales: Sale[]) {
  return [...sales]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((s) => {
      const total = saleTotal(s);
      const remaining = Math.max(0, total - s.amountReceived);
      return {
        date: s.date,
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
      };
    });
}

export function buildCustomerPaymentHistoryRows(sales: Sale[], payments: Payment[]) {
  type Row = Record<string, string | number> & { _sort: string };
  const rows: Row[] = [];

  for (const s of sales) {
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

  for (const p of payments) {
    rows.push({
      _sort: p.date,
      date: p.date,
      source: 'Direct Payment',
      detail: '—',
      amount: formatCurrency(p.amount),
      previousPaid: '—',
      totalPaid: '—',
      notes: p.note ?? '',
    });
  }

  return rows
    .sort((a, b) => b._sort.localeCompare(a._sort))
    .map(({ _sort: _, ...row }) => row);
}

export function buildDealerMaalHistoryRows(purchases: Purchase[]) {
  return [...purchases]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((p) => ({
      date: p.date,
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
    }));
}

export function buildDealerPaymentHistoryRows(purchases: Purchase[], payments: Payment[]) {
  type Row = Record<string, string | number> & { _sort: string };
  const rows: Row[] = [];

  for (const p of purchases) {
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

  for (const p of payments) {
    rows.push({
      _sort: p.date,
      date: p.date,
      source: 'Direct Payment',
      detail: '—',
      amount: formatCurrency(p.amount),
      previousPaid: '—',
      totalPaid: '—',
      notes: p.note ?? '',
    });
  }

  return rows
    .sort((a, b) => b._sort.localeCompare(a._sort))
    .map(({ _sort: _, ...row }) => row);
}

function buildSummaryHtml(lines: { label: string; value: string }[]) {
  return `<div class="receipt-summary">${lines.map((l) => `<p><span class="label">${l.label}:</span> <span class="value">${l.value}</span></p>`).join('')}</div>`;
}

function buildSectionsHtml(sections: HistorySection[]) {
  return sections
    .map((section) => {
      if (section.rows.length === 0) {
        return `<h3>${section.title}</h3><p class="meta">No entries</p>`;
      }
      const head = section.columns.map((c) => `<th>${c.header}</th>`).join('');
      const body = section.rows
        .map((row) => `<tr>${section.columns.map((c) => `<td>${row[c.key] ?? ''}</td>`).join('')}</tr>`)
        .join('');
      return `<h3>${section.title}</h3><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
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
body{font-family:system-ui,sans-serif;padding:24px;color:#1a1a1a}
.print-header{display:flex;align-items:center;gap:16px;margin-bottom:12px}
.print-logo{width:64px;height:64px;object-fit:contain;border-radius:8px}
.print-header-text h1{font-size:1.35rem;margin:0 0 4px}
.print-contact{color:#444;font-size:0.9rem;margin:0}
h2{font-size:1.05rem;margin:0 0 8px}
h3{font-size:0.95rem;margin:20px 0 8px;color:#1a3d2f}
.meta{color:#666;font-size:0.85rem;margin-bottom:16px}
table{width:100%;border-collapse:collapse;font-size:0.8rem;margin-bottom:8px}
th,td{border:1px solid #ccc;padding:5px 7px;text-align:left;word-break:break-word}
th{background:#1a3d2f;color:#fff}
.receipt-summary{margin:12px 0 20px;padding:14px 16px;border:2px solid #1a3d2f;border-radius:8px;background:#f8faf8;max-width:480px}
.receipt-summary p{margin:6px 0;font-size:0.9rem}
.receipt-summary .label{color:#444}
.receipt-summary .value{font-weight:700}
@media print{body{padding:12px}}
</style></head><body>
${headerHtml}
<h2>${title}</h2>
<p class="meta">${subtitle ? `${subtitle} · ` : ''}Generated: ${stamp()}</p>
${summaryHtml}
${sectionsHtml}
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

  let y = 14;
  let textX = 14;

  if (profile.shopLogo) {
    try {
      const fmt = logoImageFormat(profile.shopLogo);
      doc.addImage(profile.shopLogo, fmt, 14, y - 2, 16, 16);
      textX = 34;
    } catch {
      /* skip */
    }
  }

  doc.setFontSize(16);
  doc.text(profile.shopName, textX, y);
  y += 6;

  const contact = formatShopContact(profile);
  if (contact) {
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text(contact, textX, y);
    doc.setTextColor(0);
    y += 5;
  }

  doc.setFontSize(12);
  doc.text(title, textX, y + 2);
  y += 8;

  if (subtitle) {
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text(subtitle, textX, y);
    y += 5;
  }

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(`Generated: ${stamp()}`, textX, y);
  doc.setTextColor(0);
  y += 6;

  if (summaryLines?.length) {
    doc.setFontSize(9);
    for (const line of summaryLines) {
      doc.text(`${line.label}: ${line.value}`, textX, y);
      y += 5;
    }
    y += 2;
  }

  for (const section of sections) {
    if (y > 250) {
      doc.addPage();
      y = 14;
    }
    doc.setFontSize(11);
    doc.setTextColor(26, 61, 47);
    doc.text(section.title, 14, y);
    doc.setTextColor(0);
    y += 4;

    if (section.rows.length === 0) {
      doc.setFontSize(9);
      doc.text('No entries', 14, y + 4);
      y += 10;
      continue;
    }

    autoTable(doc, {
      startY: y,
      head: [section.columns.map((c) => c.header)],
      body: section.rows.map((row) => section.columns.map((c) => String(row[c.key] ?? ''))),
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [26, 61, 47], textColor: 255 },
      margin: { left: 14, right: 14 },
    });

    y = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20;
    y += 8;
  }

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
    summaryLines: [
      { label: 'Total Maal', value: formatKg(summary.totalMaalKg) },
      { label: 'Total Sale', value: formatCurrency(summary.totalSale) },
      { label: 'Total Received', value: formatCurrency(summary.receivingAmount) },
      { label: 'Total Dues', value: formatCurrency(summary.pendingAmount) },
    ],
    sections: [
      { title: 'Maal / Sales History', columns: CUSTOMER_MAAL_HISTORY_COLUMNS, rows: buildCustomerMaalHistoryRows(sales) },
      { title: 'Payment History', columns: CUSTOMER_PAYMENT_HISTORY_COLUMNS, rows: buildCustomerPaymentHistoryRows(sales, payments) },
    ],
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
  const stamp = new Date().toISOString().slice(0, 10);
  await downloadHistoryPdf({
    filename: `customer-${customer.customerId}-${stamp}`,
    title: `Customer Full History — ${customer.name}`,
    subtitle: `${customer.customerId}${customer.phone ? ` · ${customer.phone}` : ''}`,
    shopProfile,
    summaryLines: [
      { label: 'Total Maal', value: formatKg(summary.totalMaalKg) },
      { label: 'Total Sale', value: formatCurrency(summary.totalSale) },
      { label: 'Total Received', value: formatCurrency(summary.receivingAmount) },
      { label: 'Total Dues', value: formatCurrency(summary.pendingAmount) },
    ],
    sections: [
      { title: 'Maal / Sales History', columns: CUSTOMER_MAAL_HISTORY_COLUMNS, rows: buildCustomerMaalHistoryRows(sales) },
      { title: 'Payment History', columns: CUSTOMER_PAYMENT_HISTORY_COLUMNS, rows: buildCustomerPaymentHistoryRows(sales, payments) },
    ],
  });
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
    summaryLines: [
      { label: 'Received Maal', value: formatKg(summary.totalReceivedMaalKg) },
      { label: 'Pending Maal', value: formatKg(summary.totalPendingMaalKg) },
      { label: 'Total Purchased', value: formatCurrency(summary.totalPurchased) },
      { label: 'Total Paid', value: formatCurrency(summary.totalPaid) },
      { label: 'Current Due', value: formatCurrency(summary.currentDue) },
    ],
    sections: [
      { title: 'Maal / Purchase History', columns: DEALER_MAAL_HISTORY_COLUMNS, rows: buildDealerMaalHistoryRows(purchases) },
      { title: 'Payment History', columns: DEALER_PAYMENT_HISTORY_COLUMNS, rows: buildDealerPaymentHistoryRows(purchases, payments) },
    ],
  });
}

export async function downloadDealerFullHistoryPdf(options: {
  dealer: Dealer;
  summary: ReturnType<typeof computeDealerSummary>;
  purchases: Purchase[];
  payments: Payment[];
  shopProfile?: ShopPrintProfile;
}) {
  const { dealer, summary, purchases, payments, shopProfile } = options;
  const stamp = new Date().toISOString().slice(0, 10);
  await downloadHistoryPdf({
    filename: `dealer-${dealer.name.replace(/\s+/g, '-')}-${stamp}`,
    title: `Dealer Full History — ${dealer.name}`,
    subtitle: dealer.phone ?? undefined,
    shopProfile,
    summaryLines: [
      { label: 'Received Maal', value: formatKg(summary.totalReceivedMaalKg) },
      { label: 'Pending Maal', value: formatKg(summary.totalPendingMaalKg) },
      { label: 'Total Purchased', value: formatCurrency(summary.totalPurchased) },
      { label: 'Total Paid', value: formatCurrency(summary.totalPaid) },
      { label: 'Current Due', value: formatCurrency(summary.currentDue) },
    ],
    sections: [
      { title: 'Maal / Purchase History', columns: DEALER_MAAL_HISTORY_COLUMNS, rows: buildDealerMaalHistoryRows(purchases) },
      { title: 'Payment History', columns: DEALER_PAYMENT_HISTORY_COLUMNS, rows: buildDealerPaymentHistoryRows(purchases, payments) },
    ],
  });
}
