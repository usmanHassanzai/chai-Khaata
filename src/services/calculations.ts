import type {
  Customer,
  CustomerSummary,
  Dealer,
  DealerSummary,
  Payment,
  Purchase,
  Sale,
  SaleFilter,
  TeaStock,
} from '../models/types';

export function purchaseNetWeight(p: Purchase): number {
  return p.bagsReceived * p.bagWeightKg - p.missWeightKg;
}

export function purchaseTotalPrice(p: Purchase): number {
  return purchaseNetWeight(p) * p.pricePerKg;
}

export function purchaseDue(p: Purchase): number {
  return purchaseTotalPrice(p) - p.depositPaid;
}

export function purchasePendingBags(p: Purchase): number {
  return Math.max(0, p.bagsOrdered - p.bagsReceived);
}

export function purchaseOrderedKg(p: Purchase): number {
  return p.bagsOrdered * p.bagWeightKg;
}

export function purchaseOrderedTotalPrice(p: Purchase): number {
  return purchaseOrderedKg(p) * p.pricePerKg;
}

export function purchasePendingAmount(p: Purchase): number {
  return Math.max(0, purchaseOrderedTotalPrice(p) - p.depositPaid);
}

export function purchasePreviousPaid(p: Purchase): number {
  if (p.previousDepositPaid != null) return p.previousDepositPaid;
  if (p.lastPaymentAmount != null) return Math.max(0, p.depositPaid - p.lastPaymentAmount);
  return p.depositPaid;
}

export function purchaseCurrentPayment(p: Purchase): number {
  return p.lastPaymentAmount ?? 0;
}

export function salePreviousPaid(s: Sale): number {
  if (s.previousAmountReceived != null) return s.previousAmountReceived;
  if (s.lastPaymentAmount != null) return Math.max(0, s.amountReceived - s.lastPaymentAmount);
  return s.amountReceived;
}

export function saleCurrentPayment(s: Sale): number {
  return s.lastPaymentAmount ?? 0;
}

export const DEFAULT_BAG_WEIGHT_KG = 62;

export function saleBagWeightKg(s: Sale): number {
  return s.bagWeightKg && s.bagWeightKg > 0 ? s.bagWeightKg : DEFAULT_BAG_WEIGHT_KG;
}

/** Bags sold — only when entered on sale; kg-only sales show 0. */
export function saleBagsSold(s: Sale): number {
  if (s.bagsSold == null || s.bagsSold <= 0) return 0;
  return Math.round(s.bagsSold);
}

export function formatBags(count: number): string {
  return `${Math.round(count).toLocaleString('en-PK')} bags`;
}

export function kgFromBags(bags: number, bagWeightKg = DEFAULT_BAG_WEIGHT_KG): number {
  return Math.round(bags * bagWeightKg * 100) / 100;
}

export function saleTotal(s: Sale): number {
  return s.quantityKg * s.salePricePerKg;
}

export function saleProfit(s: Sale, avgCostPerKg: number): number {
  return (s.salePricePerKg - avgCostPerKg) * s.quantityKg;
}

export function getSaleCostPerKg(s: Sale, purchases: Purchase[], _sales: Sale[]): number {
  if (s.purchasePricePerKg != null) return s.purchasePricePerKg;
  return getGodaamPurchasePrice(s.teaName, purchases).avgCostPerKg;
}

export function computeSaleProfit(s: Sale, purchases: Purchase[], sales: Sale[]): number {
  return saleProfit(s, getSaleCostPerKg(s, purchases, sales));
}

export function profitPerKg(salePricePerKg: number, costPerKg: number): number {
  return salePricePerKg - costPerKg;
}

function normalizeTea(name: string): string {
  return name.trim().toLowerCase();
}

export function computeTeaStocks(
  purchases: Purchase[],
  sales: Sale[],
  threshold: number,
): TeaStock[] {
  const teaMap = new Map<
    string,
    { displayName: string; received: number; cost: number; sold: number }
  >();

  for (const p of purchases) {
    const key = normalizeTea(p.teaName);
    const net = purchaseNetWeight(p);
    const existing = teaMap.get(key) ?? {
      displayName: p.teaName.trim(),
      received: 0,
      cost: 0,
      sold: 0,
    };
    existing.received += net;
    existing.cost += net * p.pricePerKg;
    if (!teaMap.has(key)) existing.displayName = p.teaName.trim();
    teaMap.set(key, existing);
  }

  for (const s of sales) {
    const key = normalizeTea(s.teaName);
    const existing = teaMap.get(key) ?? {
      displayName: s.teaName.trim(),
      received: 0,
      cost: 0,
      sold: 0,
    };
    existing.sold += s.quantityKg;
    teaMap.set(key, existing);
  }

  return Array.from(teaMap.values())
    .map((t) => {
      const currentStock = t.received - t.sold;
      const avgCostPerKg = t.received > 0 ? t.cost / t.received : 0;
      return {
        teaName: t.displayName,
        totalReceived: t.received,
        totalSold: t.sold,
        currentStock,
        avgCostPerKg,
        stockValue: currentStock * avgCostPerKg,
        isLow: currentStock < threshold,
      };
    })
    .sort((a, b) => a.teaName.localeCompare(b.teaName));
}

export function getGodaamPurchasePrice(teaName: string, purchases: Purchase[]): {
  avgCostPerKg: number;
  latestPricePerKg: number | null;
  latestPurchaseDate: string | null;
  hasPurchase: boolean;
} {
  const key = normalizeTea(teaName);
  const teaPurchases = purchases
    .filter((p) => normalizeTea(p.teaName) === key)
    .sort((a, b) => b.date.localeCompare(a.date));

  if (teaPurchases.length === 0) {
    return { avgCostPerKg: 0, latestPricePerKg: null, latestPurchaseDate: null, hasPurchase: false };
  }

  let totalKg = 0;
  let totalCost = 0;
  for (const p of teaPurchases) {
    const net = purchaseNetWeight(p);
    totalKg += net;
    totalCost += net * p.pricePerKg;
  }

  return {
    avgCostPerKg: totalKg > 0 ? totalCost / totalKg : 0,
    latestPricePerKg: teaPurchases[0].pricePerKg,
    latestPurchaseDate: teaPurchases[0].date,
    hasPurchase: true,
  };
}

export function getStockForTea(
  teaName: string,
  purchases: Purchase[],
  sales: Sale[],
): { currentStock: number; avgCostPerKg: number } {
  const stocks = computeTeaStocks(purchases, sales, Infinity);
  const key = normalizeTea(teaName);
  const found = stocks.find((s) => normalizeTea(s.teaName) === key);
  return found
    ? { currentStock: found.currentStock, avgCostPerKg: found.avgCostPerKg }
    : { currentStock: 0, avgCostPerKg: 0 };
}

export function getTeaNames(purchases: Purchase[]): string[] {
  const names = new Set<string>();
  for (const p of purchases) {
    if (p.teaName.trim()) names.add(p.teaName.trim());
  }
  return Array.from(names).sort();
}

function isSameDay(d: string, ref: Date): boolean {
  const date = new Date(d);
  return (
    date.getFullYear() === ref.getFullYear() &&
    date.getMonth() === ref.getMonth() &&
    date.getDate() === ref.getDate()
  );
}

function isSameMonth(d: string, ref: Date): boolean {
  const date = new Date(d);
  return date.getFullYear() === ref.getFullYear() && date.getMonth() === ref.getMonth();
}

function isSameYear(d: string, ref: Date): boolean {
  return new Date(d).getFullYear() === ref.getFullYear();
}

export function filterSales(sales: Sale[], filter: SaleFilter, now = new Date()): Sale[] {
  switch (filter) {
    case 'today':
      return sales.filter((s) => isSameDay(s.date, now));
    case 'month':
      return sales.filter((s) => isSameMonth(s.date, now));
    case 'year':
      return sales.filter((s) => isSameYear(s.date, now));
    default:
      return sales;
  }
}

export function computeDealerSummary(
  dealer: Dealer,
  purchases: Purchase[],
  payments: Payment[],
): DealerSummary {
  const dealerPurchases = purchases.filter((p) => p.dealerId === dealer.id);
  const totalPurchased = dealerPurchases.reduce((sum, p) => sum + purchaseTotalPrice(p), 0);
  const depositFromPurchases = dealerPurchases.reduce((sum, p) => sum + p.depositPaid, 0);
  const standalonePayments = payments
    .filter((p) => p.dealerId === dealer.id && p.purchaseId == null && p.saleId == null)
    .reduce((sum, p) => sum + p.amount, 0);
  const totalPaid = depositFromPurchases + standalonePayments;
  const currentDue = dealer.openingDue + totalPurchased - totalPaid;

  const totalReceivedMaalKg = dealerPurchases.reduce((sum, p) => sum + purchaseNetWeight(p), 0);
  const totalPendingBags = dealerPurchases.reduce((sum, p) => sum + purchasePendingBags(p), 0);
  const totalPendingMaalKg = dealerPurchases.reduce(
    (sum, p) => sum + purchasePendingBags(p) * p.bagWeightKg,
    0,
  );
  const totalBagsReceived = dealerPurchases.reduce((sum, p) => sum + p.bagsReceived, 0);
  const totalBagsOrdered = dealerPurchases.reduce((sum, p) => sum + p.bagsOrdered, 0);

  return {
    dealer,
    totalPurchased,
    totalPaid,
    currentDue,
    totalReceivedMaalKg,
    totalPendingBags,
    totalPendingMaalKg,
    totalBagsReceived,
    totalBagsOrdered,
  };
}

export function computeCustomerSummary(
  customer: Customer,
  sales: Sale[],
  payments: Payment[],
): CustomerSummary {
  const customerSales = sales.filter((s) => s.customerId === customer.id);
  const totalSale = customerSales.reduce((sum, s) => sum + saleTotal(s), 0);
  const totalMaalKg = customerSales.reduce((sum, s) => sum + s.quantityKg, 0);
  const totalBagsSold = customerSales.reduce((sum, s) => sum + saleBagsSold(s), 0);
  const fromSales = customerSales.reduce((sum, s) => sum + s.amountReceived, 0);
  const standalonePayments = payments
    .filter((p) => p.customerId === customer.id && p.saleId == null && p.purchaseId == null)
    .reduce((sum, p) => sum + p.amount, 0);
  const receivingAmount = fromSales + standalonePayments;
  const pendingAmount = totalSale - receivingAmount;
  const teaNames = [...new Set(customerSales.map((s) => s.teaName.trim()).filter(Boolean))];

  return { customer, totalSale, totalMaalKg, totalBagsSold, receivingAmount, pendingAmount, teaNames };
}

export function formatCurrency(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function formatKg(kg: number): string {
  return `${kg.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kg`;
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function formatDateTime(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-PK', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return iso;
  }
}

export function appendActivity<T extends { history?: import('../models/types').ActivityEntry[] }>(
  entity: T,
  entry: Omit<import('../models/types').ActivityEntry, 'id'> & { id?: string },
): import('../models/types').ActivityEntry[] {
  const next: import('../models/types').ActivityEntry = {
    id: entry.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: entry.at,
    type: entry.type,
    summary: entry.summary,
    bagsOrdered: entry.bagsOrdered,
    bagsReceived: entry.bagsReceived,
    bagsAdded: entry.bagsAdded,
    amount: entry.amount,
    detail: entry.detail,
  };
  return [...(entity.history ?? []), next];
}

export function computeDashboardStats(
  sales: Sale[],
  purchases: Purchase[],
  customers: Customer[],
  payments: Payment[],
  dealers: Dealer[],
  threshold: number,
  now = new Date(),
) {
  const stocks = computeTeaStocks(purchases, sales, threshold);
  const costByTea = new Map(stocks.map((t) => [normalizeTea(t.teaName), t.avgCostPerKg]));

  const todaySales = filterSales(sales, 'today', now);
  const monthSales = filterSales(sales, 'month', now);
  const yearSales = filterSales(sales, 'year', now);

  const profitFor = (list: Sale[]) =>
    list.reduce((sum, s) => {
      const avgCostPerKg = costByTea.get(normalizeTea(s.teaName)) ?? 0;
      return sum + saleProfit(s, avgCostPerKg);
    }, 0);

  const customerDues = customers.reduce((sum, c) => {
    const { pendingAmount } = computeCustomerSummary(c, sales, payments);
    return sum + Math.max(0, pendingAmount);
  }, 0);

  const activeDealers = dealers.filter((d) => !d.removed);
  const dealerDues = activeDealers.reduce((sum, d) => {
    const { currentDue } = computeDealerSummary(d, purchases, payments);
    return sum + Math.max(0, currentDue);
  }, 0);

  return {
    todaySale: todaySales.reduce((s, x) => s + saleTotal(x), 0),
    todaySaleCount: todaySales.length,
    monthSale: monthSales.reduce((s, x) => s + saleTotal(x), 0),
    yearSale: yearSales.reduce((s, x) => s + saleTotal(x), 0),
    monthProfit: profitFor(monthSales),
    stockValue: stocks.reduce((s, t) => s + t.stockValue, 0),
    stockSkuCount: stocks.length,
    customerDues,
    dealerDues,
    lowStockCount: stocks.filter((t) => t.isLow).length,
    recentSales: [...sales].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8),
    lowStockTeas: stocks.filter((t) => t.isLow),
    stocks,
  };
}
