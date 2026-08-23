export interface User {
  id: number
  username: string
  fullName: string
  email: string
  role: string
  workspace?: string
  isDemo?: boolean
  themePreference: 'LIGHT' | 'DARK' | 'SYSTEM'
  companyName: string
  token: string
  sessionId?: number
}

export interface StaffUsageSession {
  id: number
  loginAt: string
  logoutAt: string | null
  lastSeenAt: string
  active: boolean
  durationSec: number
  durationLabel: string
  ipAddress?: string | null
}

export interface StaffUsageRow {
  userId: number
  username: string
  fullName: string
  role: string
  active: boolean
  loginCount: number
  activeSessions: number
  totalDurationSec: number
  totalDurationLabel: string
  lastLoginAt: string | null
  recentSessions: StaffUsageSession[]
}

export interface StaffUsageSummary {
  generatedAt: string
  staff: StaffUsageRow[]
}

export interface ApiResponse<T> {
  success: boolean
  message?: string
  data: T
}

export interface BusinessSettings {
  id: number
  companyName: string
  companyLogoUrl?: string
  address?: string
  phone?: string
  email?: string
  defaultCommissionPercentage: number
  supervisorSharePercentage: number
  laborSharePercentage: number
  arhatSharePercentage: number
  lowStockThreshold: number
  backupReminderDays: number
  paymentReminderDays: number
  geminiApiKeyConfigured?: boolean
  geminiApiKey?: string
  weatherLatitude?: number
  weatherLongitude?: number
  weatherLocationLabel?: string
  weatherTimezone?: string
  hijriAdjustmentDays?: number
  /** Client-only fields used when saving Hijri correction */
  hijriCorrectDay?: number
  hijriCorrectMonth?: number
  hijriCorrectYear?: number
  resetHijriAuto?: boolean
  hijriNudgeDays?: number
}

export interface HijriDateInfo {
  day: number
  month: number
  year: number
  monthNameEn: string
  monthNameUr: string
  adjustmentDays: number
  formattedEn: string
  formattedUr: string
  autoDaily: boolean
}

export interface WeatherCalendar {
  locationLabel: string
  latitude: number
  longitude: number
  timezone: string
  temperatureC?: number | null
  weatherCode: number
  conditionEn: string
  conditionUr: string
  humidity?: number | null
  windKmh?: number | null
  gregorianDate: string
  hijri: HijriDateInfo
  weatherAvailable: boolean
}

export interface SyncPulse {
  revision: number
  serverTime: string
  updatedAt?: string | null
}

export interface DashboardWeeklyPoint {
  name: string
  sales: number
  stock: number
}

export interface DashboardStats {
  todaySales: number
  currentQueue: number
  totalFarmers: number
  totalBuyers: number
  totalDheris: number
  currentStock: number
  extraKgStock?: number
  stockAsOf?: string
  stockLots?: Array<{
    productName: string
    remainingKg: number
    amountValue: number
    intakeDate: string
  }>
  pendingPayments: number
  revenue: number
  commission: number
  weeklyTrend?: DashboardWeeklyPoint[]
  recentActivity: RecentActivity[]
}

export interface RecentActivity {
  action: string
  entityType: string
  description: string
  timestamp: string
}

export interface Farmer {
  id: number
  farmerId: string
  name: string
  fatherName?: string | null
  cnic?: string
  phone?: string
  address?: string
  city?: string
  outstandingBalance: number
  totalBilled?: number
  totalPaid?: number
  registerPartyId?: number | null
  registerReceived?: number
  registerGiven?: number
  accountBalance?: number
  combinedRemaining?: number
  notes?: string
  active: boolean
}

export interface Buyer {
  id: number
  buyerId: string
  name: string
  fatherName?: string | null
  cnic?: string
  phone?: string
  address?: string
  city?: string
  outstandingBalance: number
  totalBilled?: number
  totalPaid?: number
  notes?: string
  active: boolean
}

export interface Truck {
  id: number
  truckId: string
  registrationNumber: string
  driverName?: string
  driverPhone?: string
  farmerId: number
  farmerName: string
  farmerCode: string
  capacity?: number
  notes?: string
  active: boolean
}

export interface Product {
  id: number
  productCode: string
  name: string
  unit: string
  defaultBagWeight: number
}

export interface Dheri {
  id: number
  dheriId: string
  farmerId: number
  farmerName: string
  farmerCode: string
  truckId?: number
  truckCode?: string
  productId: number
  productName: string
  queueNumber?: number
  numberOfBags: number
  weightPerBag: number
  partialBagWeight: number
  totalWeight: number
  marketRate: number
  commissionPercentage: number
  totalPrice: number
  commissionAmount: number
  farmerReceivable: number
  supervisorShare: number
  laborShare: number
  arhatShare: number
  sellingStatus: string
  payablePosted?: boolean
  notes?: string
}

export interface StockItem {
  id: number
  productId: number
  productCode: string
  productName: string
  quantity: number
  lowStockAlert: boolean
}

/** One Extra KG batch from a farmer dheri (or top-up) */
export interface StockLot {
  id: number
  productId: number
  productName?: string
  productCode?: string
  farmerId?: number | null
  farmerName?: string | null
  farmerCode?: string | null
  dheriId?: number | null
  dheriCode?: string | null
  remainingKg: number
  originalKg: number
  ratePer40Kg: number
  bagWeightKg: number
  amountValue: number
  intakeDate: string
  notes?: string | null
}

export interface StockTransaction {
  id: number
  productId: number
  productName: string
  transactionType: string
  quantity: number
  previousQuantity: number
  newQuantity: number
  notes?: string
  createdAt: string
}

export interface QueueEntry {
  id: number
  queueNumber: number
  dheriId: number
  dheriCode: string
  farmerName: string
  productName: string
  status: string
  position: number
  numberOfBags: number
}

export interface PriceCalculationResult {
  totalWeight: number
  totalMann: number
  totalAmount: number
  commissionPercentage: number
  commission: number
  farmerFinalBalance: number
  arhatShare: number
  munshiNigranShare: number
  workersShare: number
  arhatSharePercentage: number
  munshiNigranSharePercentage: number
  workersSharePercentage: number
}

export interface SearchResult {
  id: string
  type: string
  title: string
  subtitle: string
  link: string
}

export interface AiChatResponse {
  reply: string
  source: string
}

export interface SaleItem {
  id?: number
  productId: number
  productName?: string
  sourceType: 'FARMER' | 'BUSINESS_STOCK'
  farmerId?: number
  farmerName?: string
  dheriId?: number
  dheriCode?: string
  numberOfBags: number
  weightPerBag: number
  partialBagWeight: number
  totalWeight?: number
  rate: number
  amount?: number
}

export interface Sale {
  id: number
  invoiceNumber: string
  buyerId: number
  buyerName: string
  buyerCode: string
  saleDate: string
  totalBags: number
  totalWeight: number
  totalAmount: number
  paidAmount: number
  paymentStatus: string
  notes?: string
  items: SaleItem[]
}

export interface Payment {
  id: number
  paymentType: 'FARMER' | 'BUYER'
  farmerId?: number
  farmerName?: string
  buyerId?: number
  buyerName?: string
  saleId?: number
  invoiceNumber?: string
  saleInvoiceNumber?: string
  dheriId?: number
  dheriCode?: string
  amount: number
  paymentMethod: string
  paymentDate: string
  referenceNumber?: string
  notes?: string
  status: string
  createdAt?: string
}

export interface SystemUser {
  id: number
  username: string
  email: string
  fullName: string
  role: string
  active: boolean
  themePreference?: string
  lastLoginAt?: string
}

export type ReportKey = 'sales' | 'commission' | 'stock' | 'profit'

export interface ReportLine {
  saleId?: number
  invoiceNumber?: string
  saleDate?: string
  buyerName?: string
  totalBags?: number
  totalWeight?: number
  totalAmount?: number
  paidAmount?: number
  dheriId?: number
  dheriNumber?: string
  farmerName?: string
  totalPrice?: number
  commissionAmount?: number
  arhatShare?: number
  supervisorShare?: number
  laborShare?: number
  productId?: number
  productCode?: string
  productName?: string
  quantity?: number
  lowStockAlert?: boolean
}

export interface ReportSummary {
  from?: string
  to?: string
  totalSales?: number
  totalAmount?: number
  totalCommission?: number
  totalPaid?: number
  totalOutstanding?: number
  pendingPayments?: number
  profit?: number
  estimatedProfit?: number
  saleCount?: number
  totalArhatShare?: number
  totalSupervisorShare?: number
  totalLaborShare?: number
  totalQuantity?: number
  lowStockCount?: number
  lines?: ReportLine[]
  rows?: Record<string, unknown>[]
}

export type ThemeMode = 'light' | 'dark' | 'system'

export interface RegisterParty {
  id: number
  kind: string
  name: string
  address?: string | null
  notes?: string | null
  createdAt: string
  receivedTotal?: number
  givenTotal?: number
  balance?: number
  receivedCount?: number
  givenCount?: number
  cashReceivedTotal?: number
  cashGivenTotal?: number
  productTotal?: number
  productCount?: number
  soldTotal?: number
  soldCount?: number
  farmerPaid?: number
  buyerPaid?: number
  remainingToGive?: number
  remainingToReceive?: number
  displayLabel?: string
  linkedFarmerId?: number | null
  farmerCode?: string | null
  farmerName?: string | null
  linkedBuyerId?: number | null
  buyerCode?: string | null
  buyerName?: string | null
  entries?: RegisterEntry[]
}

export interface RegisterEntry {
  id: number
  kind: string
  amount: number
  notes?: string | null
  createdAt: string
  day: string
  date: string
  time: string
  partyId?: number | null
  farmerId?: number | null
  paymentId?: number | null
  partyName?: string | null
  partyAddress?: string | null
  farmerCode?: string | null
}

export interface WheatKhataMoney {
  id: number
  amount: number
  notes?: string | null
  createdAt: string
  day: string
  date: string
  time: string
}

export interface WheatKhataProduct {
  id: number
  partyId: number
  partyName?: string | null
  partyAddress?: string | null
  bags: number
  trucks?: number
  bagWeightKg: number
  totalWeightKg: number
  ratePerBag: number
  bagPricePerBag: number
  labourPerBag: number
  wheatAmount: number
  bagAmount: number
  labourAmount: number
  totalPrice: number
  notes?: string | null
  createdAt: string
  day: string
  date: string
  time: string
}

export interface WheatKhataPayment {
  id: number
  partyId: number
  partyName?: string | null
  partyKind?: string | null
  amount: number
  notes?: string | null
  createdAt: string
  day: string
  date: string
  time: string
}

export interface GrainKhataBookMeta {
  key: string
  name: string
  nameUr?: string | null
  crop: string
  cropWord: string
  builtin: boolean
  href: string
  createdAt: string
}

export interface WheatKhataParty {
  id: number
  bookKey?: string
  kind: 'RECEIVING' | 'GIVING' | string
  name: string
  address?: string | null
  notes?: string | null
  createdAt: string
  productCount: number
  paymentCount: number
  totalBags: number
  totalWeightKg: number
  wheatAmount: number
  bagAmount: number
  labourAmount: number
  productTotal: number
  cashTotal: number
  totalPrice: number
  remaining: number
  products?: WheatKhataProduct[]
  payments?: WheatKhataPayment[]
}

export interface WheatKhataBook {
  book?: GrainKhataBookMeta
  totals: {
    moneyIn: number
    receivingFromCompany: number
    givingToParty: number
    cashGiven: number
    cashReceived: number
    totalAmount: number
    bagsReceived: number
    bagsGiven: number
    bagsInStock: number
    bagsPerTruck: number
  }
  money: WheatKhataMoney[]
  parties: WheatKhataParty[]
  companies: WheatKhataParty[]
}

export interface PaddyKhataBookSummary {
  id: number
  publicId: string
  name: string
  createdAt: string
}

export interface PaddyKhataMoneyLine {
  id: number
  amount: number
  notes?: string | null
  createdAt: string
  day: string
  date: string
  time: string
}

export interface PaddyKhataPurchase {
  id: number
  partyId: number
  partyName: string
  partyAddress?: string | null
  bags: number
  bagWeightKg: number
  extraWeightKg: number
  ratePer40Kg: number
  variety: string
  bagPrice: number
  labourPrice: number
  grainAmount: number
  bagAmount: number
  labourAmount: number
  totalPrice: number
  totalWeightKg: number
  notes?: string | null
  createdAt: string
  day: string
  date: string
  time: string
}

export interface PaddyKhataSaleLine {
  id: number
  partyId: number
  partyName: string
  partyAddress?: string | null
  variety: string
  bags: number
  bagWeightKg: number
  ratePer40Kg: number
  grainAmount: number
  totalPrice: number
  totalWeightKg: number
  notes?: string | null
  createdAt: string
  day: string
  date: string
  time: string
}

export interface PaddyKhataCashLine {
  id: number
  partyId: number
  partyName: string
  partyKind: string
  kind: string
  amount: number
  notes?: string | null
  createdAt: string
  day: string
  date: string
  time: string
}

export interface PaddyKhataParty {
  id: number
  kind: string
  name: string
  address?: string | null
  notes?: string | null
  createdAt: string
  productTotal: number
  cashTotal: number
  remaining: number
  totalBags: number
  purchases?: PaddyKhataPurchase[]
  sales?: PaddyKhataSaleLine[]
  payments?: PaddyKhataCashLine[]
}

export interface PaddyKhataBook extends PaddyKhataBookSummary {
  totals: {
    moneyIn: number
    purchaseTotal: number
    givenCash: number
    receivedCash: number
    saleTotal: number
    givingAmount: number
    receivingAmount: number
    totalAmount: number
    paddyBags: number
    processingBags: number
    processedBags: number
    riceBags: number
    soldBags: number
    riceInStock: number
    expenseTotal: number
  }
  amounts: PaddyKhataMoneyLine[]
  purchaseParties: PaddyKhataParty[]
  saleParties: PaddyKhataParty[]
  purchases: PaddyKhataPurchase[]
  processes: Array<{
    id: number
    variety: string
    riceVariety: string
    partyName: string
    bags: number
    status: 'PROCESSING' | 'COMPLETE' | string
    notes?: string | null
    createdAt: string
    day: string
    date: string
    time: string
  }>
  expenses: Array<{
    id: number
    variety: string
    amount: number
    reason: string
    createdAt: string
    day: string
    date: string
    time: string
  }>
  riceLots: Array<{
    id: number
    variety: string
    bags: number
    notes?: string | null
    createdAt: string
    day: string
    date: string
    time: string
  }>
  sales: PaddyKhataSaleLine[]
  payments: PaddyKhataCashLine[]
  varieties: Array<{
    variety: string
    bags: number
    extraWeightKg: number
    totalWeightKg: number
    totalPrice: number
    processedBags: number
    remainingBags: number
    processingBags: number
    completedBags: number
    expenseTotal: number
    runningAmount: number
    lines: PaddyKhataPurchase[]
    expenses: Array<{
      id: number
      variety: string
      amount: number
      reason: string
      createdAt: string
      day: string
      date: string
      time: string
    }>
  }>
  riceVarieties: Array<{
    variety: string
    bags: number
    soldBags: number
    remainingBags: number
    lines: Array<{
      id: number
      variety: string
      bags: number
      notes?: string | null
      createdAt: string
      day: string
      date: string
      time: string
    }>
  }>
}

export interface ArhatAmountLine {
  id: string
  book: 'ARHAT' | 'WHEAT_KHATA' | string
  source: string
  kind: 'ADD' | 'RECEIVING' | 'GIVING' | string
  amount: number
  reason: string
  createdAt: string
  day: string
  date: string
  time: string
}

export interface ArhatAmountTotals {
  added: number
  receiving: number
  giving: number
  zakat: number
  commission: number
  totalAmount: number
}

export interface ArhatAmountBook {
  totals: ArhatAmountTotals
  manual: Array<{
    id: number
    kind: string
    amount: number
    notes?: string | null
    createdAt: string
    day: string
    date: string
    time: string
  }>
  history: ArhatAmountLine[]
}

export interface ArhatAmountMergeReport {
  arhat: ArhatAmountTotals
  wheatKhata: ArhatAmountTotals
  combined: ArhatAmountTotals
  history: ArhatAmountLine[]
}

export interface ZakatSummary {
  allTime: number
  last12Months: number
  yearStart: string
  entries: RegisterEntry[]
}
