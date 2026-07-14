import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
  formatCurrency,
  formatKg,
  profitPerKg,
  purchaseNetWeight,
  purchaseTotalPrice,
  saleTotal,
} from './calculations';

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

export function downloadPdf(options: {
  filename: string;
  title: string;
  shopName?: string;
  subtitle?: string;
  columns: ExportColumn[];
  rows: Record<string, string | number>[];
}) {
  const { filename, title, shopName, subtitle, columns, rows } = options;
  const doc = new jsPDF({ orientation: columns.length > 6 ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });

  let y = 14;
  doc.setFontSize(16);
  doc.text(shopName || 'Patiwala — Chai Khata', 14, y);
  y += 7;
  doc.setFontSize(12);
  doc.text(title, 14, y);
  y += 6;
  if (subtitle) {
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
  shopName?: string;
  subtitle?: string;
  columns: ExportColumn[];
  rows: Record<string, string | number>[];
}) {
  const { title, shopName, subtitle, columns, rows } = options;
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;

  const head = columns.map((c) => `<th>${c.header}</th>`).join('');
  const body = rows
    .map((row) => `<tr>${columns.map((c) => `<td>${row[c.key] ?? ''}</td>`).join('')}</tr>`)
    .join('');

  win.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
<style>
body{font-family:system-ui,sans-serif;padding:24px;color:#1a1a1a}
h1{font-size:1.25rem;margin:0 0 4px}
.meta{color:#666;font-size:0.85rem;margin-bottom:16px}
table{width:100%;border-collapse:collapse;font-size:0.85rem}
th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}
th{background:#1a3d2f;color:#fff}
@media print{body{padding:0}}
</style></head><body>
<h1>${shopName || 'Patiwala — Chai Khata'}</h1>
<h2>${title}</h2>
<p class="meta">${subtitle ? `${subtitle} · ` : ''}Generated: ${stamp()}</p>
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
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
  { key: 'kg', header: 'Kg' },
  { key: 'purchasePrice', header: 'Purchase/kg' },
  { key: 'salePrice', header: 'Sale/kg' },
  { key: 'total', header: 'Total' },
  { key: 'profit', header: 'Profit' },
  { key: 'profitPerKg', header: 'Profit/kg' },
  { key: 'customer', header: 'Customer' },
  { key: 'notes', header: 'Notes' },
];

export function buildPurchaseExportRows(purchases: Purchase[], dealers: Dealer[]) {
  return purchases.map((p) => ({
    date: p.date,
    dealer: dealerName(dealers, p.dealerId),
    tea: p.teaName,
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
  { key: 'standardKg', header: 'Standard kg' },
  { key: 'missKg', header: 'Miss kg' },
  { key: 'netKg', header: 'Net kg' },
  { key: 'totalPrice', header: 'Total price' },
  { key: 'notes', header: 'Notes' },
];

export function buildDealerExportRows(dealers: Dealer[], purchases: Purchase[], payments: Payment[]) {
  return dealers.map((d) => {
    const s = computeDealerSummary(d, purchases, payments);
    return {
      name: d.name,
      phone: d.phone ?? '',
      totalPurchased: formatCurrency(s.totalPurchased),
      totalPaid: formatCurrency(s.totalPaid),
      currentDue: formatCurrency(s.currentDue),
    };
  });
}

export const DEALER_EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'name', header: 'Dealer' },
  { key: 'phone', header: 'Phone' },
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
      kg: formatKg(s.quantityKg),
      salePrice: formatCurrency(s.salePricePerKg),
      total: formatCurrency(total),
      profit: formatCurrency(profit),
      received: formatCurrency(s.amountReceived),
      dues: formatCurrency(dues),
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
  { key: 'kg', header: 'Kg' },
  { key: 'salePrice', header: 'Sale/kg' },
  { key: 'total', header: 'Total' },
  { key: 'profit', header: 'Profit' },
  { key: 'received', header: 'Received' },
  { key: 'dues', header: 'Dues' },
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
