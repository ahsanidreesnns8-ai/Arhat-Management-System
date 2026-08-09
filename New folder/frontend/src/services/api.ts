import axios from 'axios'
import type {
  ApiResponse, AiChatResponse, BusinessSettings, Buyer, DashboardStats,
  Dheri, Farmer, PriceCalculationResult, Product, QueueEntry,
  SearchResult, StockItem, StockTransaction, Truck, User,
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
}

export const buyerApi = {
  getAll: () => api.get<ApiResponse<Buyer[]>>('/buyers'),
  getById: (id: number) => api.get<ApiResponse<Buyer>>(`/buyers/${id}`),
  create: (data: Partial<Buyer>) => api.post<ApiResponse<Buyer>>('/buyers', data),
  update: (id: number, data: Partial<Buyer>) => api.put<ApiResponse<Buyer>>(`/buyers/${id}`, data),
  delete: (id: number) => api.delete<ApiResponse<void>>(`/buyers/${id}`),
}

export const truckApi = {
  getAll: () => api.get<ApiResponse<Truck[]>>('/trucks'),
  create: (data: Record<string, unknown>) => api.post<ApiResponse<Truck>>('/trucks', data),
  update: (id: number, data: Record<string, unknown>) => api.put<ApiResponse<Truck>>(`/trucks/${id}`, data),
}

export const dheriApi = {
  getAll: () => api.get<ApiResponse<Dheri[]>>('/dheris'),
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

export default api
