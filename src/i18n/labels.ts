export type LabelText = {
  ur: string;
  en: string;
  roman?: string;
};

export type LabelMode = 'bilingual' | 'en' | 'ur' | 'ur-roman';

export const labels = {
  appName: { ur: 'چائے کھاتہ', en: 'Chai Khata', roman: 'Chai Khata' },
  appSubtitle: { ur: 'چائے کی دکان کا کھاتہ', en: 'Tea Shop Ledger', roman: 'Chai ki Dukaan ka Khata' },

  nav: {
    dashboard: { ur: 'ڈیش بورڈ', en: 'Dashboard', roman: 'Khulasaa' },
    dukaan: { ur: 'دکان — فروخت', en: 'Dukaan (Sale)', roman: 'Dukaan — Sale' },
    godaam: { ur: 'گودام — خریداری', en: 'Godaam (Warehouse)', roman: 'Godaam — Khareedari' },
    customers: { ur: 'گاہک', en: 'Customers', roman: 'Customers' },
    stock: { ur: 'اسٹاک کھاتہ', en: 'Stock Ledger', roman: 'Stock Ledger' },
    settings: { ur: 'ترتیبات', en: 'Settings', roman: 'Settings' },
    approvals: { ur: 'منظوری', en: 'Approvals', roman: 'Manzoori' },
  },

  common: {
    save: { ur: 'محفوظ کریں', en: 'Save', roman: 'Mehfooz Karein' },
    cancel: { ur: 'منسوخ', en: 'Cancel', roman: 'Cancel' },
    delete: { ur: 'حذف کریں', en: 'Delete', roman: 'Hata Dein' },
    add: { ur: 'شامل کریں', en: 'Add', roman: 'Add Karein' },
    search: { ur: 'تلاش...', en: 'Search...', roman: 'Talaash...' },
    date: { ur: 'تاریخ', en: 'Date', roman: 'Tareekh' },
    actions: { ur: 'عمل', en: 'Actions', roman: 'Actions' },
    total: { ur: 'کل', en: 'Total', roman: 'Total' },
    confirmDelete: { ur: 'کیا آپ حذف کرنا چاہتے ہیں؟', en: 'Are you sure you want to delete this?', roman: 'Kya aap delete karna chahte hain?' },
    yes: { ur: 'ہاں', en: 'Yes', roman: 'Haan' },
    no: { ur: 'نہیں', en: 'No', roman: 'Nahin' },
    walkIn: { ur: 'عام گاہک', en: 'Walk-in', roman: 'Walk-in / Aam Customer' },
    ok: { ur: 'ٹھیک', en: 'OK', roman: 'Theek' },
    low: { ur: 'کم', en: 'Low', roman: 'Kam' },
    status: { ur: 'حالت', en: 'Status', roman: 'Halat' },
    viewHistory: { ur: 'تاریخ دیکھیں', en: 'View History', roman: 'History Dekhein' },
    addPayment: { ur: 'ادائیگی شامل کریں', en: 'Add Payment', roman: 'Payment Add Karein' },
    amount: { ur: 'رقم', en: 'Amount', roman: 'Raqam' },
    note: { ur: 'نوٹ', en: 'Note', roman: 'Note' },
    phone: { ur: 'فون', en: 'Phone', roman: 'Phone' },
    address: { ur: 'پتہ', en: 'Address', roman: 'Pata' },
    name: { ur: 'نام', en: 'Name', roman: 'Naam' },
    noData: { ur: 'ابھی کوئی entry نہیں', en: 'No entries yet', roman: 'Abhi koi entry nahi' },
    uploadImage: { ur: 'تصویر اپ لوڈ', en: 'Upload Image', roman: 'Tasveer Upload' },
    removeImage: { ur: 'تصویر ہٹائیں', en: 'Remove Image', roman: 'Tasveer Hata Dein' },
    viewImage: { ur: 'تصویر دیکھیں', en: 'View Image', roman: 'Tasveer Dekhein' },
    imageError: { ur: 'تصویر لوڈ نہیں ہو سکی', en: 'Could not load image', roman: 'Tasveer load nahi ho saki' },
    notes: { ur: 'نوٹ / تفصیل', en: 'Notes / Details', roman: 'Note / Tafseel' },
    language: { ur: 'زبان', en: 'Language', roman: 'Zubaan' },
    english: { ur: 'انگریزی', en: 'English', roman: 'English' },
    romanUrdu: { ur: 'رومن اردو', en: 'Roman Urdu', roman: 'Roman Urdu' },
    urdu: { ur: 'اردو', en: 'Urdu', roman: 'Urdu' },
    bilingual: { ur: 'اردو + انگریزی', en: 'Urdu + English', roman: 'Urdu + English' },
  },

  export: {
    csv: { ur: 'CSV', en: 'CSV', roman: 'CSV' },
    pdf: { ur: 'PDF', en: 'PDF', roman: 'PDF' },
    print: { ur: 'پرنٹ', en: 'Print', roman: 'Print' },
    json: { ur: 'ڈیٹا', en: 'Data', roman: 'Data' },
    download: { ur: 'ڈاؤن لوڈ', en: 'Download', roman: 'Download' },
  },

  dashboard: {
    title: { ur: 'ڈیش بورڈ', en: 'Dashboard', roman: 'Khulasaa' },
    todaySale: { ur: 'آج کی فروخت', en: "Today's Sale", roman: 'Aaj ki Sale' },
    monthSale: { ur: 'اس ماہ کی فروخت', en: 'This Month Sale', roman: 'Is Mahine ki Sale' },
    yearSale: { ur: 'اس سال کی فروخت', en: 'This Year Sale', roman: 'Is Saal ki Sale' },
    monthProfit: { ur: 'اس ماہ کا منافع', en: 'This Month Profit', roman: 'Is Mahine ka Munafa' },
    stockValue: { ur: 'اسٹاک کی قیمت', en: 'Stock Value', roman: 'Stock ki Qeemat' },
    customerDues: { ur: 'گاہکوں کا باقی پیسہ', en: 'Pending Customer Dues', roman: 'Customers ka Baqi Paisa' },
    dealerDues: { ur: 'ڈیلرز کو دینا باقی', en: 'Pending Dealer Dues', roman: 'Dealers ko Dena Baqi' },
    lowStockAlerts: { ur: 'اسٹاک کم ہے', en: 'Low Stock Alerts', roman: 'Stock Kam Hai' },
    recentSales: { ur: 'حالیہ فروخت', en: 'Recent Sales', roman: 'Haal ki Sales' },
    lowStockList: { ur: 'کم اسٹاک والی چائے', en: 'Teas Running Low', roman: 'Kam Stock Wali Chai' },
  },

  dukaan: {
    title: { ur: 'دکان — فروخت', en: 'Dukaan — Sale', roman: 'Dukaan — Sale' },
    newSale: { ur: 'نئی فروخت', en: 'New Sale', roman: 'Nayi Sale' },
    teaName: { ur: 'چائے کا نام', en: 'Tea Name', roman: 'Chai ka Naam' },
    quantityKg: { ur: 'کتنی کلو فروخت', en: 'Quantity Sold (kg)', roman: 'Kitni kg Bechi' },
    bagsSold: { ur: 'بوریاں فروخت (اختیاری)', en: 'Bags Sold (optional)', roman: 'Boriyaa Sold (optional)' },
    bagWeight: { ur: 'بوری کا وزن (کilo)', en: 'Bag Weight (kg)', roman: 'Boriyaa Wazan (kg)' },
    salePricePerKg: { ur: 'فروخت کی قیمت / کلو', en: 'Sale Price / kg', roman: 'Rate per kg (Sale)' },
    customer: { ur: 'گاہک', en: 'Customer', roman: 'Customer' },
    amountReceived: { ur: 'ابھی کتنا ملا', en: 'Amount Received Now', roman: 'Abhi Kitna Mila' },
    liveStock: { ur: 'موجود اسٹاک', en: 'Available Stock', roman: 'Mojood Stock' },
    liveProfit: { ur: 'اندازہ منافع', en: 'Estimated Profit', roman: 'Andaza Munafa' },
    profit: { ur: 'منافع', en: 'Profit', roman: 'Munafa' },
    profitPerKg: { ur: 'منافع / کلو', en: 'Profit / kg', roman: 'Munafa / kg' },
    profitMargin: { ur: 'منافع فیصد', en: 'Profit %', roman: 'Munafa %' },
    saleSummary: { ur: 'فروخت خلاصہ', en: 'Sale Summary', roman: 'Sale Khulasaa' },
    saleValue: { ur: 'فروخت کی رقم', en: 'Sale Value', roman: 'Sale ki Raqam' },
    saveSale: { ur: 'فروخت محفوظ کریں', en: 'Save Sale', roman: 'Sale Save Karein' },
    salesHistory: { ur: 'فروخت کی تاریخ', en: 'Sales History', roman: 'Sales ki History' },
    filterToday: { ur: 'آج', en: 'Today', roman: 'Aaj' },
    filterMonth: { ur: 'مہینہ', en: 'Month', roman: 'Mahina' },
    filterYear: { ur: '\u0633\u0627\u0644', en: 'Year', roman: 'Saal' },
    filterAll: { ur: 'سب', en: 'All', roman: 'Sab' },
    totalQty: { ur: 'کل مقدار', en: 'Total Qty', roman: 'Total kg' },
    totalValue: { ur: 'کل رقم', en: 'Total Value', roman: 'Total Raqam' },
    totalProfit: { ur: 'کل منافع', en: 'Total Profit', roman: 'Total Munafa' },
    stockError: { ur: 'اسٹاک سے زیادہ نہیں بیچ سکتے!', en: 'Cannot sell more than available stock!', roman: 'Stock se zyada nahi bech sakte!' },
    purchasePricePerKg: { ur: 'خرید قیمت / کلو (گودام سے)', en: 'Purchase Price / kg (from Godaam)', roman: 'Khareed Rate / kg (Godaam se)' },
    purchaseFromGodaam: { ur: 'گودام کی خریداری سے خودکار', en: 'Auto-imported from Godaam purchases', roman: 'Godaam ki khareedari se auto' },
    latestGodaamPrice: { ur: 'آخری گودام خرید', en: 'Latest Godaam Purchase', roman: 'Aakhri Godaam Khareed' },
    noGodaamPurchase: { ur: 'پہلے گودام میں خریداری شامل کریں', en: 'Add purchase in Godaam first', roman: 'Pehle Godaam mein khareedari add karein' },
    billImage: { ur: 'بل / رسید کی تصویر', en: 'Bill Slip Picture', roman: 'Bill Slip ki Tasveer' },
    saleNotes: { ur: 'اضافی نوٹ', en: 'Miscellaneous Notes', roman: 'Extra Note' },
    stockAvailable: { ur: '{{kg}} کلو موجود ہے', en: '{{kg}} kg available', roman: '{{kg}} kg mojood hai' },
    noStock: { ur: 'اس چائے کا اسٹاک نہیں', en: 'No stock for this tea', roman: 'Is chai ka stock nahi hai' },
  },

  godaam: {
    title: { ur: 'گودام — خریداری', en: 'Godaam — Warehouse', roman: 'Godaam — Khareedari' },
    dealers: { ur: 'ڈیلرز', en: 'Dealers', roman: 'Dealers' },
    addDealer: { ur: 'ڈیلر شامل کریں', en: 'Add Dealer', roman: 'Dealer Add Karein' },
    dealerName: { ur: 'ڈیلر کا نام', en: 'Dealer Name', roman: 'Dealer ka Naam' },
    openingDue: { ur: 'پہلے سے باقی', en: 'Opening Due', roman: 'Pehle se Baqi (Opening Due)' },
    addPurchase: { ur: 'خریداری شامل کریں', en: 'Add Purchase', roman: 'Khareedari Add Karein' },
    dealer: { ur: 'ڈیلر', en: 'Dealer', roman: 'Dealer' },
    teaName: { ur: 'چائے کا نام', en: 'Tea Name', roman: 'Chai ka Naam' },
    bagsOrdered: { ur: 'کتنی بوریاں آرڈر', en: 'Bags Ordered', roman: 'Kitni Boriyaa Order Ki' },
    bagsReceived: { ur: 'کتنی بوریاں آئیں', en: 'Bags Received', roman: 'Kitni Boriyaa Aaye' },
    bagWeight: { ur: 'بوری کا وزن (کilo)', en: 'Bag Weight (kg/bag)', roman: 'Boriyaa ka Wazan (kg)' },
    standardWeight: { ur: 'معیاری کل وزن', en: 'Standard Total Weight', roman: 'Standard Total Wazan' },
    missWeight: { ur: 'کمی وزن (کilo)', en: 'Miss Weight / Shortage (kg)', roman: 'Kami Wazan (kg)' },
    netWeight: { ur: 'اصل وزن — اسٹاک', en: 'Net Weight — Stock Qty', roman: 'Asal Wazan — Stock mein' },
    pricePerKg: { ur: 'قیمت / کilo', en: 'Price per kg', roman: 'Rate per kg (Khareed)' },
    totalPrice: { ur: 'کل قیمت', en: 'Total Price', roman: 'Total Qeemat' },
    depositPaid: { ur: 'ابھی کتنا دیا', en: 'Deposit Paid Now', roman: 'Abhi Kitna Diya' },
    dueThisPurchase: { ur: 'اس خرید کا باقی', en: 'Due (this purchase)', roman: 'Is Khareed ka Baqi' },
    remainingBalance: { ur: 'ڈیلر کا کل باقی', en: 'Remaining Balance (dealer total)', roman: 'Dealer ka Total Baqi' },
    pendingBags: { ur: 'باقی بوریاں', en: 'Pending Bags', roman: 'Baqi Boriyaa' },
    receivedMaal: { ur: 'موصول مال (کilo)', en: 'Received Maal (kg)', roman: 'Mosool Maal (kg)' },
    pendingMaal: { ur: 'باقی مال (کilo)', en: 'Pending Maal (kg)', roman: 'Baqi Maal (kg)' },
    dealerContact: { ur: 'رابطہ', en: 'Contact', roman: 'Contact' },
    dealerHistory: { ur: 'ڈیلر کی خریداری', en: 'Dealer Purchase History', roman: 'Dealer Purchase History' },
    viewHistory: { ur: 'تاریخ دیکھیں', en: 'View History', roman: 'History Dekhein' },
    bagsOrderedCol: { ur: 'آرڈر بوریاں', en: 'Bags Ordered', roman: 'Order Boriyaa' },
    bagsReceivedCol: { ur: 'موصول بوریاں', en: 'Bags Received', roman: 'Mosool Boriyaa' },
    dealerSummary: { ur: 'ڈیلر خلاصہ', en: 'Dealer Summary', roman: 'Dealer Summary' },
    totalPurchased: { ur: 'کل خریداری', en: 'Total Purchased', roman: 'Total Khareedari' },
    totalPaid: { ur: 'کل ادا شدہ', en: 'Total Paid', roman: 'Total Diya Hua' },
    currentDue: { ur: 'ابھی باقی', en: 'Current Due', roman: 'Abhi Baqi' },
    removeDealer: { ur: 'ہٹائیں', en: 'Remove', roman: 'Hata Dein' },
    purchaseHistory: { ur: 'خریداری کی تاریخ', en: 'Purchase History', roman: 'Khareedari ki History' },
    savePurchase: { ur: 'خریداری محفوظ کریں', en: 'Save Purchase', roman: 'Khareedari Save Karein' },
    dealerExists: { ur: 'یہ ڈیلر پہلے سے موجود ہے', en: 'Dealer name already exists', roman: 'Ye dealer pehle se mojood hai' },
    billImage: { ur: 'بل / رسید کی تصویر', en: 'Bill Slip Picture', roman: 'Bill Slip ki Tasveer' },
    purchaseNotes: { ur: 'اضافی نوٹ', en: 'Miscellaneous Notes', roman: 'Extra Note' },
    contNo: { ur: 'کنٹینر نمبر', en: 'Cont No', roman: 'Cont No' },
    lotNo: { ur: 'لاٹ نمبر', en: 'Lot No', roman: 'Lot No' },
    country: { ur: 'ملک', en: 'Country', roman: 'Country' },
    grade: { ur: 'گریڈ', en: 'Grade', roman: 'Grade' },
    invoiceNumber: { ur: 'انوائس نمبر', en: 'Invoice Number', roman: 'Invoice Number' },
    shipmentDetails: { ur: 'شپمنٹ تفصیل', en: 'Shipment Details', roman: 'Shipment Details' },
  },

  customers: {
    title: { ur: 'گاہک', en: 'Customers', roman: 'Customers' },
    addCustomer: { ur: 'گاہک شامل کریں', en: 'Add Customer', roman: 'Customer Add Karein' },
    customerName: { ur: 'گاہک کا نام', en: 'Customer Name', roman: 'Customer ka Naam' },
    customerId: { ur: 'گاہک ID', en: 'Customer ID', roman: 'Customer ID' },
    totalSale: { ur: 'کل فروخت', en: 'Total Sale', roman: 'Total Sale' },
    receivingAmount: { ur: 'کل موصول', en: 'Receiving Amount', roman: 'Total Mila Hua' },
    pendingAmount: { ur: 'باقی رقم', en: 'Pending Amount', roman: 'Baqi Raqam' },
    totalMaal: { ur: 'کل مال (کilo)', en: 'Total Maal Sale (kg)', roman: 'Total Maal (kg)' },
    totalBagsSold: { ur: 'فروخت بوریاں', en: 'Sold Bags', roman: 'Sold Boriyaa' },
    bagsSold: { ur: 'بوریاں فروخت (اختیاری)', en: 'Bags Sold (optional)', roman: 'Boriyaa Sold (optional)' },
    bagQuantity: { ur: 'بوری کا وزن (کilo)', en: 'Bag Weight (kg)', roman: 'Boriyaa Wazan (kg)' },
    totalAmount: { ur: 'کل رقم', en: 'Total Amount', roman: 'Total Raqam' },
    totalDues: { ur: 'کل باقی', en: 'Total Dues', roman: 'Total Baqi' },
    teaNames: { ur: 'چائے کے نام', en: 'Tea Names', roman: 'Chai ke Naam' },
    profilePicture: { ur: 'گاہک کی تصویر', en: 'Customer Picture', roman: 'Customer ki Tasveer' },
    registerDate: { ur: 'رجسٹریشن تاریخ', en: 'Register Date', roman: 'Register Tareekh' },
    customerDetails: { ur: 'گاہک کی تفصیل', en: 'Customer Details', roman: 'Customer ki Tafseel' },
    editCustomer: { ur: 'گاہک میں ترمیم', en: 'Edit Customer', roman: 'Customer Edit' },
    saveCustomer: { ur: 'گاہک محفوظ کریں', en: 'Save Customer', roman: 'Customer Save Karein' },
    history: { ur: 'گاہک کی تاریخ', en: 'Customer History', roman: 'Customer ki History' },
    salesToCustomer: { ur: 'فروخت', en: 'Sales', roman: 'Sales' },
    paymentsFromCustomer: { ur: 'ادائیگیاں', en: 'Payments', roman: 'Payments' },
    allSalesLedger: { ur: 'تمام گاہکوں کی فروخت', en: 'All Customer Sales Ledger', roman: 'Sab Customers ki Sales' },
    addSaleForCustomer: { ur: 'گاہک کے لیے فروخت', en: 'Add Sale for Customer', roman: 'Customer ke liye Sale' },
    salePricePerKg: { ur: 'فروخت قیمت / کلو', en: 'Sale Price / kg', roman: 'Sale Rate / kg' },
    saleDues: { ur: 'اس sale کا باقی', en: 'Sale Dues', roman: 'Is Sale ka Baqi' },
    lastSaleDate: { ur: 'آخری sale تاریخ', en: 'Last Sale Date', roman: 'Aakhri Sale Tareekh' },
    customerRecord: { ur: 'گاہک ریکارڈ', en: 'Customer Record', roman: 'Customer Record' },
  },

  stock: {
    title: { ur: 'اسٹاک کھاتہ', en: 'Stock Ledger', roman: 'Stock Ledger' },
    threshold: { ur: 'کم اسٹاک کی حد (کilo)', en: 'Low Stock Threshold (kg)', roman: 'Kam Stock ki Had (kg)' },
    teaName: { ur: 'چائے کا نام', en: 'Tea Name', roman: 'Chai ka Naam' },
    totalReceived: { ur: 'کل آیا', en: 'Total Received', roman: 'Total Aaya' },
    totalSold: { ur: 'کل فروخت', en: 'Total Sold', roman: 'Total Becha' },
    currentStock: { ur: 'موجود اسٹاک', en: 'Current Stock', roman: 'Mojood Stock' },
    avgCost: { ur: 'اوسط قیمت / کilo', en: 'Avg. Cost/kg', roman: 'Avg. Cost/kg' },
    stockValue: { ur: 'اسٹاک کی قیمت', en: 'Stock Value', roman: 'Stock ki Qeemat' },
    saveThreshold: { ur: 'حد محفوظ کریں', en: 'Save Threshold', roman: 'Had Save Karein' },
  },

  settings: {
    title: { ur: 'ترتیبات', en: 'Settings', roman: 'Settings' },
    subtitle: { ur: 'ظاہری شکل، زبان، کلاؤڈ اور ڈیٹا', en: 'Appearance, language, cloud & data', roman: 'Appearance, language, cloud & data' },
    tabGeneral: { ur: 'عام', en: 'General', roman: 'General' },
    tabBusiness: { ur: 'کاروبار', en: 'Business', roman: 'Business' },
    tabCloud: { ur: 'کلاؤڈ', en: 'Cloud', roman: 'Cloud' },
    tabAccount: { ur: 'اکاؤنٹ', en: 'Account', roman: 'Account' },
    tabData: { ur: 'ڈیٹا', en: 'Data', roman: 'Data' },
    tabAdmin: { ur: 'ایڈمن', en: 'Admin', roman: 'Admin' },
    appearance: { ur: 'ظاہری شکل', en: 'Appearance', roman: 'Appearance' },
    appearanceHint: { ur: 'تھیم، کمپیکٹ ویو اور اینیمیشن', en: 'Theme, compact view and animations', roman: 'Theme, compact view aur animations' },
    themeLight: { ur: 'روشن', en: 'Light', roman: 'Light' },
    themeDark: { ur: 'تاریک', en: 'Dark', roman: 'Dark' },
    themeAuto: { ur: 'خودکار', en: 'Auto', roman: 'Auto' },
    compactUi: { ur: 'کمپیکٹ ویو', en: 'Compact view', roman: 'Compact view' },
    compactUiHint: { ur: 'چھوٹی اسکرین پر زیادہ مواد', en: 'Show more content on small screens', roman: 'Chhoti screen par zyada content' },
    animations: { ur: 'اینیمیشن', en: 'Animations', roman: 'Animations' },
    animationsHint: { ur: 'صفحے کی حرکت اور اثرات', en: 'Page motion and visual effects', roman: 'Page motion aur effects' },
    showProfit: { ur: 'منافع دکھائیں', en: 'Show profit stats', roman: 'Show profit stats' },
    showProfitHint: { ur: 'ڈیش بورڈ پر منافع کے اعداد', en: 'Profit figures on dashboard', roman: 'Dashboard par profit figures' },
    businessRules: { ur: 'کاروباری قواعد', en: 'Business rules', roman: 'Business rules' },
    businessHint: { ur: 'کم اسٹاک انتباہ اور دیگر حدود', en: 'Low stock alerts and thresholds', roman: 'Low stock alerts aur limits' },
    shopProfile: { ur: 'دکان کا نام اور پرنٹ', en: 'Shop name & print header', roman: 'Shop name & print header' },
    shopProfileHint: {
      ur: 'یہ نام، لوگو اور رابطہ ہر پرنٹ / PDF پر ظاہر ہوگا (فروخت، گاہک، گودام)',
      en: 'This name, logo and contact appear on every print & PDF (sales, customers, godown)',
      roman: 'Ye naam, logo aur contact har print/PDF par dikhega',
    },
    shopName: { ur: 'دکان کا نام', en: 'Shop name', roman: 'Shop ka Naam' },
    shopLogo: { ur: 'دکان کا لوگو', en: 'Shop logo', roman: 'Shop Logo' },
    shopPhone: { ur: 'رابطہ نمبر', en: 'Contact phone', roman: 'Contact Phone' },
    shopAddress: { ur: 'پتہ', en: 'Address', roman: 'Address' },
    shopProfileSaved: { ur: 'دکان کی تفصیل محفوظ', en: 'Shop details saved', roman: 'Shop details save ho gayi' },
    printPreview: { ur: 'پرنٹ preview', en: 'Print preview', roman: 'Print preview' },
    currentThreshold: { ur: 'موجودہ حد', en: 'Current threshold', roman: 'Current threshold' },
    dataStorage: { ur: 'ڈیٹا ذخیرہ', en: 'Data storage', roman: 'Data storage' },
    localFirst: { ur: 'پہلے فون، پھر کلاؤڈ', en: 'Phone first, then cloud', roman: 'Phone first, phir cloud' },
    thresholdSaved: { ur: 'حد محفوظ ہو گئی', en: 'Threshold saved', roman: 'Threshold save ho gayi' },
    dataBackup: { ur: 'ڈیٹا بیک اپ', en: 'Data backup', roman: 'Data backup' },
    dataBackupHint: { ur: 'اپنا کھاتہ JSON فائل میں ڈاؤن لوڈ کریں', en: 'Download your ledger as a JSON file', roman: 'Apna khata JSON file mein download karein' },
    exportData: { ur: 'ڈیٹا برآمد', en: 'Export data', roman: 'Export data' },
    exportDone: { ur: 'برآمد مکمل', en: 'Export complete', roman: 'Export complete' },
    exportFailed: { ur: 'برآمد ناکام', en: 'Export failed', roman: 'Export failed' },
    resetTitle: { ur: 'ترتیبات ری سیٹ', en: 'Reset settings', roman: 'Reset settings' },
    resetHint: { ur: 'ہر آپشن صرف اپنی چیز ری سیٹ کرتا ہے', en: 'Each option resets only its own area', roman: 'Har option sirf apni cheez reset karta hai' },
    resetPreferences: { ur: 'ظاہری شکل ری سیٹ', en: 'Reset appearance', roman: 'Reset appearance' },
    resetPreferencesDesc: { ur: 'تھیم، زبان، اینیمیشن', en: 'Theme, language, animations', roman: 'Theme, language, animations' },
    resetPreferencesMsg: { ur: 'ظاہری شکل اور زبان دوبارہ ڈیفالٹ پر آ جائے گی۔', en: 'Appearance and language will return to defaults.', roman: 'Appearance aur language default par aa jayegi.' },
    resetCloud: { ur: 'کلاؤڈ ری سیٹ', en: 'Reset cloud', roman: 'Reset cloud' },
    resetCloudDesc: { ur: 'سرور URL اور سنک وقت', en: 'Server URL and sync timestamp', roman: 'Server URL aur sync time' },
    resetCloudMsg: { ur: 'کلاؤڈ URL ہٹ جائے گا۔ دوبارہ URL درج کریں۔', en: 'Cloud URL will be cleared. Re-enter URL to sync again.', roman: 'Cloud URL hat jayega. Dobara URL darj karein.' },
    resetBusiness: { ur: 'کاروباری ترتیبات', en: 'Reset business settings', roman: 'Reset business settings' },
    resetBusinessDesc: { ur: 'کم اسٹاک حد → 50 kg', en: 'Low stock threshold → 50 kg', roman: 'Low stock threshold → 50 kg' },
    resetBusinessMsg: { ur: 'کاروباری حدود ڈیفالٹ پر آ جائیں گی۔ سیل/خریداری محفوظ رہے گی۔', en: 'Business thresholds reset. Sales/purchases stay safe.', roman: 'Business limits reset. Sales/purchases safe rahengi.' },
    resetData: { ur: 'تمام ڈیٹا مٹائیں', en: 'Clear all data', roman: 'Clear all data' },
    resetDataDesc: { ur: 'سیل، خرید، گاہک، اسٹاک', en: 'Sales, purchases, customers, stock', roman: 'Sales, purchases, customers, stock' },
    resetDataMsg: { ur: '⚠️ تمام مقامی کھاتہ ڈیٹا مستقل طور پر مٹ جائے گا۔ یہ واپس نہیں آ سکتا۔', en: '⚠️ All local ledger data will be permanently deleted. This cannot be undone.', roman: '⚠️ Tamam local data delete ho jayega. Wapas nahi aa sakta.' },
    resetDone: { ur: 'ری سیٹ مکمل', en: 'Reset complete', roman: 'Reset complete' },
    resetFailed: { ur: 'ری سیٹ ناکام', en: 'Reset failed', roman: 'Reset failed' },
    dbNotReady: { ur: 'ڈیٹا بیس تیار نہیں — دوبارہ لاگ ان کریں', en: 'Database not ready — please log in again', roman: 'Database not ready — login again' },
    serverOffline: { ur: 'سرور آف لائن — npm run dev چلائیں', en: 'Server offline — run npm run dev', roman: 'Server offline — run npm run dev' },
    chooseLanguage: { ur: 'لیبل کس زبان میں دکھائیں؟', en: 'How should labels appear?', roman: 'Label kis zubaan mein dikhayein?' },
    labelDisplay: { ur: 'لیبل کی زبان', en: 'Label Display', roman: 'Label ki Zubaan' },
    cloudSync: { ur: 'کلاؤڈ سنک — تمام موبائل', en: 'Cloud Sync — All Phones', roman: 'Cloud Sync — Tamam Mobile' },
    cloudSyncHint: {
      ur: 'عام انٹرنیٹ URL استعمال کریں — موبائل ڈیٹا یا کسی بھی Wi‑Fi پر کام کرے گا۔',
      en: 'Use a public internet URL — sync works on mobile data or any Wi‑Fi, not only the same network.',
      roman: 'Public internet URL use karein — mobile data ya kisi bhi Wi‑Fi par kaam karega.',
    },
    cloudServerUrl: { ur: 'کلاؤڈ سرور URL', en: 'Cloud Server URL', roman: 'Cloud Server URL' },
    saveCloudUrl: { ur: 'محفوظ کریں', en: 'Save', roman: 'Save' },
    syncNow: { ur: 'ابھی سنک کریں', en: 'Sync Now', roman: 'Abhi Sync' },
    testConnection: { ur: 'کنکشن ٹیسٹ', en: 'Test Connection', roman: 'Test Connection' },
    cloudStep1: {
      ur: '1) Supabase + Vercel پر deploy کریں (npm run deploy:vercel)',
      en: '1) Deploy to Supabase + Vercel (free) — run npm run deploy:vercel for steps',
      roman: '1) Supabase + Vercel par deploy karein (npm run deploy:vercel)',
    },
    cloudStep2: {
      ur: '2) https:// URL محفوظ کریں، پھر لاگ آؤٹ کر کے دوبارہ لاگ ان',
      en: '2) Save the https:// URL, then log out and log in again',
      roman: '2) https:// URL save karein, phir logout kar ke dubara login',
    },
    cloudStep3: {
      ur: '3) دوسرے موبائل پر بھی وہی URL + وہی لاگ ان (کسی بھی نیٹ ورک پر)',
      en: '3) On other phones: same URL + same login (any network — 4G or different Wi‑Fi)',
      roman: '3) Doosre mobile par wahi URL + wahi login (kisi bhi network par)',
    },
    dataNote: {
      ur: 'کلاؤڈ سنک آن ہونے پر ڈیٹا سرور پر محفوظ ہوتا ہے اور ہر موبائل پر live نظر آتا ہے۔',
      en: 'With cloud sync on, data is saved on the server and appears live on every phone.',
      roman: 'Cloud sync on hone par data server par save hota hai aur har mobile par live dikhta hai.',
    },
  },

  auth: {
    login: { ur: 'لاگ ان', en: 'Log In', roman: 'Log In' },
    loginSubtitle: { ur: 'اپنے اکاؤنٹ میں داخل ہوں', en: 'Sign in to your account', roman: 'Apne account mein dakhil hon' },
    register: { ur: 'رجسٹر', en: 'Register', roman: 'Register' },
    registerTitle: { ur: 'نیا اکاؤنٹ', en: 'Create Account', roman: 'Naya Account' },
    registerSubtitle: {
      ur: 'سائن اپ کریں — ایڈمن کی منظوری کے بعد لاگ ان کر سکیں گے',
      en: 'Sign up — you can log in after admin approval',
      roman: 'Sign up karein — admin ki manzoori ke baad login kar sakenge',
    },
    signUpApprovalHint: {
      ur: 'منظوری کے بعد ہی استعمال — ایڈمن:',
      en: 'Access after admin approval — admin:',
      roman: 'Manzoori ke baad istemal — admin:',
    },
    approvalNote: {
      ur: 'نئے اکاؤنٹس کی منظوری:',
      en: 'New accounts approved by:',
      roman: 'Naye accounts ki manzoori:',
    },
    username: { ur: 'یوزر نام', en: 'Username', roman: 'Username' },
    loginOrEmail: { ur: 'ای میل یا یوزر نام', en: 'Email or Username', roman: 'Email ya Username' },
    email: { ur: 'ای میل', en: 'Email', roman: 'Email' },
    adminLoginHint: {
      ur: 'ایڈمن: usmankhan14700@gmail.com یا admin — پاس ورڈ: admin123',
      en: 'Admin: usmankhan14700@gmail.com or admin — password: admin123',
      roman: 'Admin: usmankhan14700@gmail.com ya admin — password: admin123',
    },
    serverOffline: {
      ur: 'سرور نہیں چل رہا۔ ٹرمینل میں npm run dev چلائیں (server + app دونوں)',
      en: 'Auth server is not running. Run npm run dev in terminal (starts server + app).',
      roman: 'Auth server nahi chal raha. Terminal mein npm run dev chalayein.',
    },
    password: { ur: 'پاس ورڈ', en: 'Password', roman: 'Password' },
    confirmPassword: { ur: 'پاس ورڈ دوبارہ', en: 'Confirm Password', roman: 'Password Dobara' },
    shopName: { ur: 'دکان کا نام', en: 'Shop Name', roman: 'Dukaan ka Naam' },
    logout: { ur: 'لاگ آؤٹ', en: 'Log Out', roman: 'Log Out' },
    noAccount: { ur: 'اکاؤنٹ نہیں؟', en: "Don't have an account?", roman: 'Account nahi?' },
    haveAccount: { ur: 'پہلے سے اکاؤنٹ ہے؟', en: 'Already have an account?', roman: 'Pehle se account hai?' },
    registerLink: { ur: 'رجسٹر کریں', en: 'Register here', roman: 'Register karein' },
    loginLink: { ur: 'لاگ ان کریں', en: 'Log in here', roman: 'Log in karein' },
    account: { ur: 'میرا اکاؤنٹ', en: 'My Account', roman: 'Mera Account' },
    adminUsers: { ur: 'صارفین کی منظوری', en: 'User Approvals', roman: 'User Manzoori' },
    adminUsersHint: {
      ur: 'صارف کا مکمل اکاؤنٹ ڈیٹا — نام، ای میل، پاس ورڈ، سبسکرپشن، تاریخیں',
      en: 'Full user account data — name, email, password, subscription, dates',
      roman: 'User ka account data — naam, email, password, subscription, dates',
    },
    adminProfileHint: {
      ur: 'دکان کے رقم (سیل/خرید) اور اسٹاک/انوینٹری یہاں نہیں دکھائی جاتی — صرف لاگ ان اکاؤنٹ کی تفصیل',
      en: 'Shop sales amounts and stock/inventory are not shown here — account & subscription info only',
      roman: 'Shop ke amounts aur inventory yahan nahi — sirf account aur subscription info',
    },
    noPendingUsers: { ur: 'کوئی pending صارف نہیں', en: 'No pending users', roman: 'Koi pending user nahi' },
    allUsers: { ur: 'تمام صارفین', en: 'All Users', roman: 'Tamam Users' },
    allUsersManage: { ur: 'تمام رجسٹرڈ صارفین', en: 'All Registered Users', roman: 'Tamam Registered Users' },
    allUsersManageHint: {
      ur: 'یہاں سے حذف کرنے پر صارف ڈیٹا بیس سے مکمل طور پر ختم ہو جائے گا — دوبارہ لاگ ان نہیں کر سکے گا',
      en: 'Deleting here permanently removes the user from the database — they cannot log in again',
      roman: 'Yahan se delete karne par user database se permanently khatam ho jayega',
    },
    searchUsers: { ur: 'صارف تلاش کریں...', en: 'Search users...', roman: 'Search users...' },
    filterStatus: { ur: 'حالت', en: 'Status', roman: 'Status' },
    filterAll: { ur: 'سب', en: 'All', roman: 'All' },
    filterPending: { ur: 'زیرِ التواء', en: 'Pending', roman: 'Pending' },
    filterApproved: { ur: 'منظور', en: 'Approved', roman: 'Approved' },
    filterRejected: { ur: 'مسترد', en: 'Rejected', roman: 'Rejected' },
    usersShown: { ur: 'صارف', en: 'users', roman: 'users' },
    noUsersFound: { ur: 'کوئی صارف نہیں ملا', en: 'No users found', roman: 'Koi user nahi mila' },
    deletePermanently: { ur: 'مستقل حذف', en: 'Delete permanently', roman: 'Delete permanently' },
    deleteUserConfirmTitle: {
      ur: 'صارف مستقل طور پر حذف کریں؟',
      en: 'Delete user permanently?',
      roman: 'User permanently delete karein?',
    },
    deleteUserConfirmMessage: {
      ur: '"{username}" ڈیٹا بیس سے مکمل طور پر حذف ہو جائے گا — ادائیگی ثبوت اور کلاؤڈ ڈیٹا بھی۔ یہ واپس نہیں ہو سکتا',
      en: '"{username}" will be permanently removed from the database, including payment proofs and cloud data. This cannot be undone.',
      roman: '"{username}" database se permanently delete ho jayega. Ye wapas nahi ho sakta.',
    },
    seeAllUsersBelow: {
      ur: 'تمام صارفین نیچے "All Registered Users" میں دیکھیں اور حذف کریں',
      en: 'See and permanently delete all users in "All Registered Users" below',
      roman: 'Tamam users neeche "All Registered Users" mein dekhein aur delete karein',
    },
    status: { ur: 'حالت', en: 'Status', roman: 'Status' },
    approve: { ur: 'منظور', en: 'Approve', roman: 'Manzoor' },
    reject: { ur: 'مسترد', en: 'Reject', roman: 'Mustarad' },
    removeUser: { ur: 'حذف', en: 'Remove', roman: 'Remove' },
    phone: { ur: 'موبائل', en: 'Phone', roman: 'Mobile' },
    registerDate: { ur: 'رجسٹریشن تاریخ', en: 'Register Date', roman: 'Register Date' },
    paymentFee: { ur: 'ادائیگی فیس', en: 'Payment Fee', roman: 'Payment Fee' },
    paymentFeeDate: { ur: 'فیس کی تاریخ', en: 'Fee Date', roman: 'Fee Date' },
    forgotPassword: { ur: 'پاس ورڈ بھول گئے؟', en: 'Forgot password?', roman: 'Password bhool gaye?' },
    forgotTitle: { ur: 'پاس ورڈ بحال', en: 'Reset Password', roman: 'Password Reset' },
    forgotSubtitle: {
      ur: 'OTP حاصل کریں — ای میل یا موبائل پر',
      en: 'Get OTP via email or phone',
      roman: 'OTP hasil karein — email ya mobile par',
    },
    forgotEmailSubtitle: {
      ur: 'اپنا رجسٹرڈ ای میل درج کریں — پاس ورڈ آپ کے ای میل پر بھیجا جائے گا',
      en: 'Enter your registered email — your password will be sent to your inbox',
      roman: 'Apna registered email darj karein — password email par bheja jayega',
    },
    forgotEmailHint: {
      ur: 'پاس ورڈ آپ کے سائن اپ ای میل پر بھیجا جائے گا۔ ایڈمن کو بھی اطلاع ملے گی۔',
      en: 'Your password will be emailed to your registered address. Admin is also notified.',
      roman: 'Password aap ke register email par bheja jayega. Admin ko bhi khabar milegi.',
    },
    forgotEmailNeedsSmtp: {
      ur: 'لائیو سرور (patiwala.pk) پر SMTP سیٹ نہیں — Vercel میں SMTP_* شامل کریں اور Redeploy کریں۔ لوکل .env صرف آپ کے PC پر کام کرتا ہے',
      en: 'Email is NOT configured on the live server (patiwala.pk). Add SMTP_HOST, SMTP_USER, SMTP_PASS in Vercel → Environment Variables → Redeploy. Your local .env file only works on your computer, not for other users online.',
      roman: 'Live server par SMTP nahi — Vercel mein SMTP vars add karein aur redeploy. Local .env sirf aap ke PC par kaam karta hai.',
    },
    sendPasswordToEmail: { ur: 'پاس ورڈ ای میل کریں', en: 'Email my password', roman: 'Email my password' },
    useOtpInstead: { ur: 'OTP سے نیا پاس ورڈ بنائیں', en: 'Reset with OTP instead', roman: 'OTP se naya password' },
    sendPasswordToUser: { ur: 'پاس ورڈ ای میل کریں', en: 'Email password to user', roman: 'Email password to user' },
    sendOtp: { ur: 'OTP بھیجیں', en: 'Send OTP', roman: 'OTP Bhejein' },
    enterOtp: { ur: 'OTP درج کریں', en: 'Enter OTP', roman: 'OTP Darj Karein' },
    newPassword: { ur: 'نیا پاس ورڈ', en: 'New Password', roman: 'Naya Password' },
    currentPassword: { ur: 'موجودہ پاس ورڈ', en: 'Current Password', roman: 'Current Password' },
    changePassword: { ur: 'پاس ورڈ تبدیل کریں', en: 'Change Password', roman: 'Change Password' },
    changePasswordHint: {
      ur: 'لاگ ان کے بعد یہاں سے اپنا پاس ورڈ تبدیل کریں',
      en: 'Update your login password while you are signed in',
      roman: 'Login ke baad yahan se password tabdeel karein',
    },
    changePasswordSuccess: { ur: 'پاس ورڈ تبدیل ہو گیا', en: 'Password changed successfully', roman: 'Password change ho gaya' },
    changePasswordFailed: { ur: 'پاس ورڈ تبدیل نہیں ہوا', en: 'Could not change password', roman: 'Password change nahi hua' },
    passwordMinLength: { ur: 'پاس ورڈ کم از کم 6 حروف', en: 'Password must be at least 6 characters', roman: 'Password kam az kam 6 characters' },
    passwordMismatch: { ur: 'پاس ورڈ میل نہیں کھاتے', en: 'Passwords do not match', roman: 'Passwords match nahi karte' },
    passwordSameAsOld: { ur: 'نیا پاس ورڈ پرانے جیسا نہیں ہو سکتا', en: 'New password must be different from current password', roman: 'Naya password purane jaisa nahi ho sakta' },
    resetPassword: { ur: 'پاس ورڈ تبدیل', en: 'Change Password', roman: 'Password Tabdeel' },
    resendOtp: { ur: 'دوبارہ OTP', en: 'Resend OTP', roman: 'Dobara OTP' },
    backToLogin: { ur: '← لاگ ان', en: '← Back to login', roman: '← Login par wapas' },
    otpVia: { ur: 'OTP کہاں بھیجیں؟', en: 'Send OTP via', roman: 'OTP kahan bhejein?' },
    otpManualHint: {
      ur: 'ای میل/SMS خودکار نہیں — OTP اسکرین پر دکھایا جائے گا',
      en: 'Email/SMS auto-send not set up — your OTP will appear on screen after you submit',
      roman: 'Email/SMS auto nahi — OTP screen par dikhega',
    },
    yourOtp: { ur: 'آپ کا OTP', en: 'Your OTP code', roman: 'Aap ka OTP' },
    otpCopyHint: {
      ur: 'نیچے OTP درج کریں اور نیا پاس ورڈ سیٹ کریں',
      en: 'Enter this OTP below and set your new password',
      roman: 'Neeche OTP darj karein aur naya password set karein',
    },
    activeOtps: { ur: 'فعال OTP (پاس ورڈ ریسیٹ)', en: 'Active OTPs (password reset)', roman: 'Active OTPs' },
    pendingApprovals: { ur: 'زیرِ التواء منظوری', en: 'Pending Approvals', roman: 'Pending Manzoori' },
    rejectedApprovals: { ur: 'مسترد صارفین', en: 'Rejected Users', roman: 'Rejected Users' },
    refresh: { ur: 'تازہ کریں', en: 'Refresh', roman: 'Refresh' },
    adminOnly: {
      ur: 'صرف ایڈمن اس صفحے تک رسائی حاصل کر سکتا ہے',
      en: 'Only admin can access this page',
      roman: 'Sirf admin is page tak rasai hasil kar sakta hai',
    },
    adminLoadFailed: {
      ur: 'صارفین لوڈ نہیں ہوئے — لاگ ان اور سرور چیک کریں',
      en: 'Could not load users — check login and that the server is running',
      roman: 'Users load nahi hue — login aur server check karein',
    },
    signupPasswordNote: {
      ur: 'سائن اپ پاس ورڈ (صرف رجسٹریشن وقت)',
      en: 'Signup password (stored at registration only)',
      roman: 'Signup password',
    },
    paymentDue: { ur: 'باقی ادائیگی', en: 'Payment Due', roman: 'Baqi Payment' },
    setPaymentDue: { ur: 'باقی سیٹ کریں', en: 'Set Due', roman: 'Due Set Karein' },
    markPaid: { ur: 'ادائیگی مکمل', en: 'Mark Paid', roman: 'Mark Paid' },
    paymentNote: { ur: 'نوٹ (اختیاری)', en: 'Note (optional)', roman: 'Note' },
    paymentBlockedTitle: { ur: 'اکاؤنٹ معطل', en: 'Account Suspended', roman: 'Account Suspended' },
    paymentBlockedSubtitle: {
      ur: 'ادائیگی باقی ہے — ایپ استعمال بند ہے',
      en: 'Payment pending — app access is blocked',
      roman: 'Payment baqi hai — app band hai',
    },
    paymentBlockedHint: {
      ur: 'ادائیگی کے بعد ایڈمن اکاؤنٹ بحال کرے گا',
      en: 'Pay the admin to restore your account',
      roman: 'Admin ko payment karein phir access milega',
    },
    checkPayment: { ur: 'ادائیگی چیک کریں', en: 'Check if paid', roman: 'Payment check karein' },
    paymentScreenshot: { ur: 'ادائیگی کی اسکرین شاٹ', en: 'Payment Screenshot', roman: 'Payment Screenshot' },
    paymentRefId: { ur: 'Payment ID', en: 'Payment ID', roman: 'Payment ID' },
    submitPaymentProof: { ur: 'اسکرین شاٹ جمع کریں', en: 'Submit Payment Proof', roman: 'Screenshot Submit Karein' },
    paymentProofHint: {
      ur: 'ادائیگی کریں، اسکرین شاٹ اپ لوڈ کریں، ای میل اور پاس ورڈ درج کریں',
      en: 'Pay the fee, upload screenshot, enter your email and password',
      roman: 'Payment karein, screenshot upload karein, email aur password darj karein',
    },
    paymentProofPending: {
      ur: 'آپ کی ادائیگی ایڈمن کے پاس زیرِ جائزہ ہے — منظوری کے بعد اکاؤنٹ کھل جائے گا',
      en: 'Your payment is under admin review — account will unlock after approval',
      roman: 'Aapki payment admin ke paas hai — manzoori ke baad account khulega',
    },
    paymentProofsTitle: { ur: 'ادائیگی کی اسکرین شاٹس', en: 'Payment Proofs to Review', roman: 'Payment Proofs' },
    paymentProofsHint: {
      ur: 'صارف نے ادائیگی کی تصویر بھیجی — منظور کریں تو اکاؤنٹ کھل جائے گا',
      en: 'User uploaded payment proof — approve to unblock their account',
      roman: 'User ne screenshot bheji — manzoor karein to account khulega',
    },
    approvePayment: { ur: 'ادائیگی منظور', en: 'Approve Payment', roman: 'Approve Payment' },
    deleteFromDb: {
      ur: 'ڈیٹا بیس سے مستقل حذف',
      en: 'Permanently deleted from database',
      roman: 'Database se delete',
    },
    chooseSubscription: { ur: 'سبسکرپشن منتخب کریں', en: 'Choose Subscription', roman: 'Subscription Choose Karein' },
    subscription: { ur: 'سبسکرپشن', en: 'Subscription', roman: 'Subscription' },
    selectedPlanFee: { ur: 'منتخب پلان کی فیس', en: 'Selected plan fee', roman: 'Selected plan fee' },
    subscriptionExpiredTitle: { ur: 'سبسکرپشن ختم', en: 'Subscription Expired', roman: 'Subscription Expired' },
    subscriptionExpiringTitle: {
      ur: 'سبسکرپشن جلد ختم ہو رہی ہے',
      en: 'Subscription expiring soon',
      roman: 'Subscription jald khatam ho rahi hai',
    },
    subscriptionExpiredSubtitle: {
      ur: 'جاری رکھنے کے لیے سبسکرپشن ری نیو کریں',
      en: 'Renew your subscription to continue using the app',
      roman: 'App use karne ke liye subscription renew karein',
    },
    subscriptionExpiringSubtitle: {
      ur: 'بروقت ری نیو کریں تاکہ رسائی جاری رہے',
      en: 'Renew early to keep uninterrupted access',
      roman: 'Waqt par renew karein taake access jari rahe',
    },
    daysUntilExpiry: {
      ur: '{{days}} دن باقی',
      en: '{{days}} day(s) left',
      roman: '{{days}} din baqi',
    },
    renewNow: { ur: 'ابھی ری نیو کریں', en: 'Renew now', roman: 'Abhi renew karein' },
    subscriptionEnded: { ur: 'ختم ہونے کی تاریخ', en: 'Expired on', roman: 'Expired on' },
    renewSubscription: { ur: 'سبسکرپشن ری نیو', en: 'Renew Subscription', roman: 'Renew Subscription' },
    renewalAmount: { ur: 'ری نیو رقم', en: 'Renewal amount', roman: 'Renewal amount' },
    uploadPaymentScreenshot: { ur: 'ادائیگی کی اسکرین شاٹ', en: 'Payment screenshot', roman: 'Payment screenshot' },
    submitRenewal: { ur: 'ری نیو جمع کریں', en: 'Submit Renewal', roman: 'Submit Renewal' },
    checkRenewalStatus: { ur: 'ری نیو کی حالت چیک کریں', en: 'Check renewal status', roman: 'Check renewal status' },
    renewalPending: {
      ur: 'ری نیو زیرِ جائزہ — ایڈمن منظوری کے بعد سبسکرپشن بحال ہوگی',
      en: 'Renewal pending — subscription restores after admin approval',
      roman: 'Renewal pending — admin manzoori ke baad subscription restore hogi',
    },
    subscriptionStarts: { ur: 'سبسکرپشن شروع', en: 'Subscription starts', roman: 'Subscription starts' },
    subscriptionExpires: { ur: 'سبسکرپشن ختم', en: 'Subscription expires', roman: 'Subscription expires' },
    approvedDate: { ur: 'منظوری تاریخ', en: 'Approved date', roman: 'Approved date' },
    userDetails: { ur: 'صارف کی تفصیل', en: 'User Details', roman: 'User Details' },
    viewDetails: { ur: 'تفصیل', en: 'Details', roman: 'Details' },
    lastPaid: { ur: 'آخری ادائیگی', en: 'Last paid', roman: 'Last paid' },
    mySubscription: { ur: 'میری سبسکرپشن', en: 'My Subscription', roman: 'My Subscription' },
    subscriptionActive: { ur: 'فعال', en: 'Active', roman: 'Active' },
    subscriptionInactive: { ur: 'غیر فعال / ختم', en: 'Inactive / Expired', roman: 'Inactive / Expired' },
    renewalType: { ur: 'قسم', en: 'Type', roman: 'Type' },
    role: { ur: 'کردار', en: 'Role', roman: 'Role' },
    subscriptionStatus: { ur: 'سبسکرپشن حالت', en: 'Subscription status', roman: 'Subscription status' },
    userId: { ur: 'صارف ID', en: 'User ID', roman: 'User ID' },
  },
} as const;

function getNested(obj: Record<string, unknown>, path: string): LabelText | undefined {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in cur) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  if (cur && typeof cur === 'object' && 'ur' in cur && 'en' in cur) {
    return cur as LabelText;
  }
  return undefined;
}

export function getLabel(path: string): LabelText {
  const found = getNested(labels as unknown as Record<string, unknown>, path);
  if (!found) return { ur: path, en: path };
  return found;
}

export function formatLabel(text: LabelText, mode: LabelMode, vars?: Record<string, string>): string {
  let ur = text.ur;
  let en = text.en;
  let roman = text.roman ?? text.en;

  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      ur = ur.replace(`{{${k}}}`, v);
      en = en.replace(`{{${k}}}`, v);
      roman = roman.replace(`{{${k}}}`, v);
    }
  }

  switch (mode) {
    case 'ur':
      return ur;
    case 'en':
      return en;
    case 'ur-roman':
      return roman;
    case 'bilingual':
    default:
      return `${ur} · ${en}`;
  }
}

const MODE_KEY = 'chai-khata-label-mode';

export function getLabelMode(): LabelMode {
  const saved = localStorage.getItem(MODE_KEY) as LabelMode | null;
  return saved ?? 'bilingual';
}

export function setLabelMode(mode: LabelMode) {
  localStorage.setItem(MODE_KEY, mode);
  window.dispatchEvent(new Event('label-mode-change'));
}
