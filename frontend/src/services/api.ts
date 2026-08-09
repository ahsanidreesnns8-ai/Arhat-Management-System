import axios from 'axios'
import type {
  ApiResponse, AiChatResponse, BusinessSettings, Buyer, DashboardStats,
  Dheri, Farmer, Payment, PriceCalculationResult, Product, QueueEntry,
  ReportSummary, Sale, SearchResult, StockItem, StockTransaction,
  SystemUser, Truck, User,
} from '../types'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const stored = localStorage.getItem('rehmani_user')
  if (stored) {
    const user = JSON.parse(stored) as User
    config.headers.Authorization = `Bearer ${user.token}`
  }
  return config
})

export const authApi = {
  login: (username: string, password: string) =>
    api.post<ApiResponse<User & { token: string }>>('/auth/login', { username, password }),
  updateTheme: (username: string, theme: string) =>
    api.put('/auth/theme', null, { params: { username, theme } }),
}

export const settingsApi = {
  getPublic: () => api.get<ApiResponse<BusinessSettings>>('/settings/public'),
  get: () => api.get<ApiResponse<BusinessSettings>>('/settings'),
  update: (data: Partial<BusinessSettings>) =>
    api.put<ApiResponse<BusinessSettings>>('/settings', data),
  getProducts: () => api.get<ApiResponse<Product[]>>('/settings/products'),
}

export const dashboardApi = {
  getStats: () => api.get<ApiResponse<DashboardStats>>('/dashboard/stats'),
}

export const farmerApi = {
  getAll: () => api.get<ApiResponse<Farmer[]>>('/farmers'),
  getById: (id: number) => api.get<ApiResponse<Farmer>>(`/farmers/${id}`),
  create: (data: Partial<Farmer>) => api.post<ApiResponse<Farmer>>('/farmers', data),
  update: (id: number, data: Partial<Farmer>) => api.put<ApiResponse<Farmer>>(`/farmers/${id}`, data),
  delete: (id: number) => api.delete<ApiResponse<void>>(`/farmers/${id}`),
  getPayments: (id: number) => api.get<ApiResponse<Payment[]>>(`/farmers/${id}/payments`),
  getDheris: (id: number) => api.get<ApiResponse<Dheri[]>>(`/farmers/${id}/dheris`),
  getTrucks: (id: number) => api.get<ApiResponse<Truck[]>>(`/farmers/${id}/trucks`),
  getBillHtml: (id: number) => api.get<string>(`/bills/farmer/${id}`, { responseType: 'text' as never }),
}

export const buyerApi = {
  getAll: () => api.get<ApiResponse<Buyer[]>>('/buyers'),
  getById: (id: number) => api.get<ApiResponse<Buyer>>(`/buyers/${id}`),
  create: (data: Partial<Buyer>) => api.post<ApiResponse<Buyer>>('/buyers', data),
  update: (id: number, data: Partial<Buyer>) => api.put<ApiResponse<Buyer>>(`/buyers/${id}`, data),
  delete: (id: number) => api.delete<ApiResponse<void>>(`/buyers/${id}`),
  getPayments: (id: number) => api.get<ApiResponse<Payment[]>>(`/buyers/${id}/payments`),
  getSales: (id: number) => api.get<ApiResponse<Sale[]>>(`/buyers/${id}/sales`),
  getBillHtml: (id: number) => api.get<string>(`/bills/buyer/${id}`, { responseType: 'text' as never }),
}

export const truckApi = {
  getAll: () => api.get<ApiResponse<Truck[]>>('/trucks'),
  getById: (id: number) => api.get<ApiResponse<Truck>>(`/trucks/${id}`),
  create: (data: Record<string, unknown>) => api.post<ApiResponse<Truck>>('/trucks', data),
  update: (id: number, data: Record<string, unknown>) => api.put<ApiResponse<Truck>>(`/trucks/${id}`, data),
  delete: (id: number) => api.delete<ApiResponse<void>>(`/trucks/${id}`),
}

export const dheriApi = {
  getAll: () => api.get<ApiResponse<Dheri[]>>('/dheris'),
  getById: (id: number) => api.get<ApiResponse<Dheri>>(`/dheris/${id}`),
  create: (data: Record<string, unknown>) => api.post<ApiResponse<Dheri>>('/dheris', data),
  update: (id: number, data: Record<string, unknown>) => api.put<ApiResponse<Dheri>>(`/dheris/${id}`, data),
  delete: (id: number) => api.delete<ApiResponse<void>>(`/dheris/${id}`),
}

export const stockApi = {
  getAll: () => api.get<ApiResponse<StockItem[]>>('/stock'),
  getHistory: () => api.get<ApiResponse<StockTransaction[]>>('/stock/history'),
  adjust: (data: Record<string, unknown>) => api.post<ApiResponse<StockItem>>('/stock/adjust', data),
}

export const queueApi = {
  getPending: () => api.get<ApiResponse<QueueEntry[]>>('/queue/pending'),
  getActive: () => api.get<ApiResponse<QueueEntry[]>>('/queue/active'),
  getCompleted: () => api.get<ApiResponse<QueueEntry[]>>('/queue/completed'),
  add: (dheriId: number) => api.post<ApiResponse<QueueEntry>>(`/queue/add/${dheriId}`),
  activate: (id: number) => api.post<ApiResponse<QueueEntry>>(`/queue/${id}/activate`),
  complete: (id: number) => api.post<ApiResponse<QueueEntry>>(`/queue/${id}/complete`),
  cancel: (id: number) => api.post<ApiResponse<QueueEntry>>(`/queue/${id}/cancel`),
}

export const calculatorApi = {
  calculate: (data: Record<string, unknown>) =>
    api.post<ApiResponse<PriceCalculationResult>>('/calculator/calculate', data),
  saveToDheri: (dheriId: number, data: Record<string, unknown>) =>
    api.post<ApiResponse<Dheri>>(`/calculator/save/${dheriId}`, data),
}

export const searchApi = {
  search: (q: string) => api.get<ApiResponse<SearchResult[]>>('/search', { params: { q } }),
}

export const aiApi = {
  chat: (message: string) =>
    api.post<ApiResponse<AiChatResponse>>('/ai/chat', { message }),
}

export const saleApi = {
  getAll: () => api.get<ApiResponse<Sale[]>>('/sales'),
  getById: (id: number) => api.get<ApiResponse<Sale>>(`/sales/${id}`),
  create: (data: Record<string, unknown>) => api.post<ApiResponse<Sale>>('/sales', data),
  delete: (id: number) => api.delete<ApiResponse<void>>(`/sales/${id}`),
}

export const paymentApi = {
  getAll: () => api.get<ApiResponse<Payment[]>>('/payments'),
  create: (data: Record<string, unknown>) => api.post<ApiResponse<Payment>>('/payments', data),
}

export const reportApi = {
  sales: (from?: string, to?: string) =>
    api.get<ApiResponse<ReportSummary>>('/reports/sales', { params: { from, to } }),
  commission: (from?: string, to?: string) =>
    api.get<ApiResponse<ReportSummary>>('/reports/commission', { params: { from, to } }),
  stock: () => api.get<ApiResponse<ReportSummary>>('/reports/stock'),
  profit: (from?: string, to?: string) =>
    api.get<ApiResponse<ReportSummary>>('/reports/profit', { params: { from, to } }),
  exportExcel: (type: string, from?: string, to?: string) =>
    api.get(`/reports/export/${type}.xlsx`, { params: { from, to }, responseType: 'blob' }),
  exportPdf: (type: string, from?: string, to?: string) =>
    api.get(`/reports/export/${type}.pdf`, { params: { from, to }, responseType: 'blob' }),
}

export const userApi = {
  getAll: () => api.get<ApiResponse<SystemUser[]>>('/users'),
  create: (data: Record<string, unknown>) => api.post<ApiResponse<SystemUser>>('/users', data),
  update: (id: number, data: Record<string, unknown>) => api.put<ApiResponse<SystemUser>>(`/users/${id}`, data),
  suspend: (id: number) => api.patch<ApiResponse<void>>(`/users/${id}/suspend`),
  activate: (id: number) => api.patch<ApiResponse<void>>(`/users/${id}/activate`),
  delete: (id: number) => api.delete<ApiResponse<void>>(`/users/${id}`),
}

export const auditApi = {
  getRecent: () => api.get<ApiResponse<Array<{ action: string; entityType: string; createdAt: string }>>>('/audit'),
}

export const backupApi = {
  export: () => api.get('/backup/export', { responseType: 'blob' }),
  restore: (data: unknown) => api.post<ApiResponse<void>>('/backup/restore', data),
}

export default api
