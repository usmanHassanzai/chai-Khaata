export interface Dealer {
  id?: number;
  name: string;
  phone?: string;
  address?: string;
  openingDue: number;
  removed?: boolean;
}

export interface Customer {
  id?: number;
  customerId: string;
  name: string;
  phone?: string;
  address?: string;
  profilePicture?: string;
  notes?: string;
  registerDate?: string;
}

export interface Purchase {
  id?: number;
  date: string;
  dealerId: number;
  teaName: string;
  bagsOrdered: number;
  bagsReceived: number;
  bagWeightKg: number;
  missWeightKg: number;
  pricePerKg: number;
  depositPaid: number;
  billImage?: string;
  notes?: string;
}

export interface Sale {
  id?: number;
  date: string;
  teaName: string;
  quantityKg: number;
  salePricePerKg: number;
  purchasePricePerKg?: number;
  customerId?: number;
  amountReceived: number;
  billImage?: string;
  notes?: string;
}

export interface Payment {
  id?: number;
  date: string;
  customerId?: number;
  dealerId?: number;
  amount: number;
  note?: string;
}

export interface AppSettings {
  id: 'settings';
  lowStockThresholdKg: number;
  language: 'en' | 'ur-roman';
}

export interface TeaStock {
  teaName: string;
  totalReceived: number;
  totalSold: number;
  currentStock: number;
  avgCostPerKg: number;
  stockValue: number;
  isLow: boolean;
}

export interface DealerSummary {
  dealer: Dealer;
  totalPurchased: number;
  totalPaid: number;
  currentDue: number;
}

export interface CustomerSummary {
  customer: Customer;
  totalSale: number;
  totalMaalKg: number;
  receivingAmount: number;
  pendingAmount: number;
  teaNames: string[];
}

export type SaleFilter = 'today' | 'month' | 'year' | 'all';
