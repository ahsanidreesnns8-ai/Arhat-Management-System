export interface User {
  id: number
  username: string
  fullName: string
  email: string
  role: string
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

export type ThemeMode = 'light' | 'dark' | 'system'
