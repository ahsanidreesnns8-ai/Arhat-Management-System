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

export interface DashboardStats {
  todaySales: number
  currentQueue: number
  totalFarmers: number
  totalBuyers: number
  totalDheris: number
  currentStock: number
  pendingPayments: number
  revenue: number
  commission: number
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

export interface Buyer {
  id: number
  buyerId: string
  name: string
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
