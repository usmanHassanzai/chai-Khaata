export interface Dealer {
  id?: number;
  name: string;
  phone?: string;
  address?: string;
  openingDue: number;
  removed?: boolean;
  updatedAt?: string;
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
  updatedAt?: string;
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
  /** Container number */
  contNo?: string;
  /** Lot number */
  lotNo?: string;
  country?: string;
  grade?: string;
  invoiceNumber?: string;
  /** Bags received before the latest maal receipt update */
  previousBagsReceived?: number;
  /** Date/time before the latest maal receipt update */
  previousReceiveDate?: string;
  /** ISO datetime of latest maal receipt update */
  lastReceivedAt?: string;
  /** Bags added in the latest maal receipt update */
  lastReceivedBags?: number;
  /** Kg added in the latest maal receipt update */
  lastReceivedKg?: number;
  /** Receipt image for the latest maal receipt */
  receiveReceiptImage?: string;
  /** Deposit paid before the latest payment on this purchase */
  previousDepositPaid?: number;
  /** Amount from the latest payment on this purchase */
  lastPaymentAmount?: number;
  /** ISO datetime of latest payment on this purchase */
  lastPaymentAt?: string;
  /** Receipt image for the latest payment */
  paymentReceiptImage?: string;
  updatedAt?: string;
}

export interface Sale {
  id?: number;
  date: string;
  teaName: string;
  quantityKg: number;
  /** Number of bags sold (optional — derived from kg if missing). */
  bagsSold?: number;
  /** Weight per bag in kg (default 62). */
  bagWeightKg?: number;
  salePricePerKg: number;
  purchasePricePerKg?: number;
  customerId?: number;
  amountReceived: number;
  billImage?: string;
  notes?: string;
  /** ISO datetime when customer last paid dues on this sale */
  lastPaymentAt?: string;
  /** Receipt image for the latest dues payment */
  paymentReceiptImage?: string;
  /** Amount received before the latest dues payment */
  previousAmountReceived?: number;
  /** Amount from the latest dues payment */
  lastPaymentAmount?: number;
  updatedAt?: string;
}

export interface Payment {
  id?: number;
  date: string;
  customerId?: number;
  dealerId?: number;
  amount: number;
  note?: string;
  updatedAt?: string;
}

export interface AppSettings {
  id: 'settings';
  lowStockThresholdKg: number;
  language: 'en' | 'ur-roman';
  /** Shop name on receipts, exports & prints */
  shopName?: string;
  /** Base64 data URL for shop logo */
  shopLogo?: string;
  shopPhone?: string;
  shopAddress?: string;
  updatedAt?: string;
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
  totalReceivedMaalKg: number;
  totalPendingBags: number;
  totalPendingMaalKg: number;
  totalBagsReceived: number;
}

export interface CustomerSummary {
  customer: Customer;
  totalSale: number;
  totalMaalKg: number;
  totalBagsSold: number;
  receivingAmount: number;
  pendingAmount: number;
  teaNames: string[];
}

export type SaleFilter = 'today' | 'month' | 'year' | 'all';
