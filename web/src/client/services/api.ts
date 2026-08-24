import axios from 'axios'
import type {
  ApiResponse, AiChatResponse, BusinessSettings, Buyer, DashboardStats,
  Dheri, Farmer, Payment, PriceCalculationResult, Product, QueueEntry,
  ReportSummary, Sale, SearchResult, StaffUsageSummary, StockItem, StockLot, StockTransaction,
  SyncPulse, SystemUser, Truck, User, WeatherCalendar, RegisterParty, RegisterEntry, ZakatSummary,
  WheatKhataBook, WheatKhataMoney, WheatKhataParty, WheatKhataProduct, WheatKhataPayment,
  GrainKhataBookMeta, KhataHead, KhataTreasuryLine, KhataLedgerPerson, AccountStatement,
  PaddyKhataBook, PaddyKhataBookSummary, PaddyKhataPurchase,
  ArhatAmountBook, ArhatAmountMergeReport,
} from '../types'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  timeout: 20000,
})

api.interceptors.request.use((config) => {
  const stored = localStorage.getItem('rehmani_user')
  if (stored) {
    try {
      const user = JSON.parse(stored) as User
      if (user?.token) config.headers.Authorization = `Bearer ${user.token}`
    } catch {
      // ignore corrupt session
    }
  }
  // Bill endpoints return HTML receipts — must not send Accept: application/json
  const url = String(config.url || '')
  if (url.includes('/bills/')) {
    config.headers.Accept = 'text/html,application/xhtml+xml,*/*'
    if (!config.responseType) config.responseType = 'text' as never
  }
  return config
})

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function isRetryableMethod(method?: string) {
  const m = (method || 'get').toLowerCase()
  return m === 'get' || m === 'head' || m === 'options'
}

function isRetryableError(error: unknown) {
  const err = error as {
    code?: string
    message?: string
    response?: { status?: number }
    config?: { url?: string }
  }
  const status = err?.response?.status
  if (status === 408 || status === 425 || status === 429 || status === 502 || status === 503 || status === 504) {
    return true
  }
  if (!err?.response) {
    // Network / timeout / aborted while server wakes up
    return true
  }
  const msg = String(err?.message || '').toLowerCase()
  return (
    msg.includes('timeout') ||
    msg.includes('network') ||
    msg.includes('temporarily unavailable') ||
    msg.includes('api unavailable')
  )
}

api.interceptors.response.use(
  (res) => {
    const ct = String(res.headers?.['content-type'] || '')
    const url = String(res.config?.url || '')
    const isBill = url.includes('/bills/')

    // SPA HTML must never be treated as an API/bill response
    if (typeof res.data === 'string') {
      const body = res.data
      if (body.includes('id="root"') || body.includes('__next') || body.includes('/_next/')) {
        return Promise.reject(new Error('API unavailable — refresh the page and try again'))
      }
      if (isBill && ct.includes('application/json')) {
        return Promise.reject(new Error('Bill endpoint returned JSON instead of HTML'))
      }
    }

    // Blob downloads (Excel/ZIP) can receive SPA HTML when proxy is down
    if (res.config?.responseType === 'blob' && res.data instanceof Blob) {
      if (ct.includes('text/html') || res.data.type.includes('text/html')) {
        return Promise.reject(new Error('API unavailable — refresh the page and try again'))
      }
    }

    // Non-bill JSON APIs that somehow get HTML
    if (!isBill && ct.includes('text/html')) {
      return Promise.reject(new Error('API unavailable — refresh the page and try again'))
    }

    return res
  },
  async (error) => {
    const config = error?.config as
      | { method?: string; url?: string; __retryCount?: number }
      | undefined
    const status = error?.response?.status
    const url = String(config?.url || '')

    if (
      status === 401 &&
      !url.includes('/auth/login') &&
      !url.includes('/auth/heartbeat')
    ) {
      localStorage.removeItem('rehmani_user')
      if (!window.location.pathname.startsWith('/login')) {
        window.location.assign('/login')
      }
      return Promise.reject(error)
    }

    // Prefer server message for toast consumers
    const serverMsg = error?.response?.data?.message
    if (serverMsg && typeof serverMsg === 'string') {
      error.message = serverMsg
    }

    const retryCount = config?.__retryCount ?? 0
    const isPulse = url.includes('/sync/pulse')
    if (
      config &&
      !isPulse &&
      isRetryableMethod(config.method) &&
      isRetryableError(error) &&
      retryCount < 1
    ) {
      config.__retryCount = retryCount + 1
      await sleep(400 * 2 ** retryCount)
      return api.request(config)
    }

    return Promise.reject(error)
  },
)

const GET_CACHE_MS = 4000
const getCache = new Map<string, { exp: number; value: unknown }>()
const getInflight = new Map<string, Promise<unknown>>()

function currentToken() {
  try {
    const stored = localStorage.getItem('rehmani_user')
    if (!stored) return ''
    return String((JSON.parse(stored) as User)?.token || '')
  } catch {
    return ''
  }
}

function cacheableGet(url: string) {
  return (
    !url.includes('/sync/pulse') &&
    !url.includes('/bills/') &&
    !url.includes('/auth/') &&
    !url.includes('/search') &&
    !url.includes('/backup')
  )
}

function getCacheKey(url: string, config?: { params?: unknown }) {
  return `${currentToken()}|${url}|${JSON.stringify(config?.params || {})}`
}

function clearGetCache() {
  getCache.clear()
}

export function invalidateApiCache() {
  clearGetCache()
}

const rawGet = api.get.bind(api)
api.get = ((url: string, config?: object) => {
  if (!cacheableGet(String(url))) return rawGet(url, config)
  const key = getCacheKey(String(url), config as { params?: unknown } | undefined)
  const hit = getCache.get(key)
  if (hit && hit.exp > Date.now()) return Promise.resolve(hit.value)
  const pending = getInflight.get(key)
  if (pending) return pending
  const req = rawGet(url, config).then((res) => {
    getCache.set(key, { exp: Date.now() + GET_CACHE_MS, value: res })
    getInflight.delete(key)
    return res
  }).catch((err) => {
    getInflight.delete(key)
    throw err
  })
  getInflight.set(key, req)
  return req
}) as typeof api.get

api.interceptors.response.use((res) => {
  const method = String(res.config?.method || 'get').toLowerCase()
  if (method !== 'get' && method !== 'head' && method !== 'options') {
    clearGetCache()
  }
  return res
})

const billRequest = (
  path: string,
  lang: 'en' | 'ur' = 'en',
  extraParams?: Record<string, string>,
) =>
  api.get<string>(path, {
    params: { lang, ...extraParams },
    responseType: 'text' as never,
    headers: { Accept: 'text/html,application/xhtml+xml,*/*' },
    timeout: 45000,
  })

export const authApi = {
  login: (username: string, password: string) =>
    api.post<ApiResponse<User & { token: string; sessionId?: number }>>('/auth/login', { username, password }),
  logout: () => api.post<ApiResponse<{ closed: boolean }>>('/auth/logout'),
  heartbeat: () => api.post<ApiResponse<{ ok: boolean; lastSeenAt: string | null }>>('/auth/heartbeat'),
  updateTheme: (theme: string) =>
    api.put('/auth/theme', null, { params: { theme } }),
}

export const settingsApi = {
  getPublic: () => api.get<ApiResponse<BusinessSettings>>('/settings/public'),
  get: () => api.get<ApiResponse<BusinessSettings>>('/settings'),
  update: (data: Partial<BusinessSettings>) =>
    api.put<ApiResponse<BusinessSettings>>('/settings', data),
  getProducts: () => api.get<ApiResponse<Product[]>>('/settings/products'),
}

export const weatherApi = {
  get: () => api.get<ApiResponse<WeatherCalendar>>('/weather'),
}

export const syncApi = {
  pulse: () => api.get<ApiResponse<SyncPulse>>('/sync/pulse', { timeout: 8000 }),
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
  getBillHtml: (id: number, lang: 'en' | 'ur' = 'en') =>
    billRequest(`/bills/farmer/${id}`, lang),
  getBalanceHtml: (id: number, lang: 'en' | 'ur' = 'en') =>
    billRequest(`/bills/farmer/${id}/balance`, lang),
}

export const buyerApi = {
  getAll: () => api.get<ApiResponse<Buyer[]>>('/buyers'),
  getById: (id: number) => api.get<ApiResponse<Buyer>>(`/buyers/${id}`),
  create: (data: Partial<Buyer>) => api.post<ApiResponse<Buyer>>('/buyers', data),
  update: (id: number, data: Partial<Buyer>) => api.put<ApiResponse<Buyer>>(`/buyers/${id}`, data),
  delete: (id: number) => api.delete<ApiResponse<void>>(`/buyers/${id}`),
  getPayments: (id: number) => api.get<ApiResponse<Payment[]>>(`/buyers/${id}/payments`),
  getSales: (id: number) => api.get<ApiResponse<Sale[]>>(`/buyers/${id}/sales`),
  getBillHtml: (id: number, lang: 'en' | 'ur' = 'en') =>
    billRequest(`/bills/buyer/${id}`, lang),
  getBalanceHtml: (id: number, lang: 'en' | 'ur' = 'en') =>
    billRequest(`/bills/buyer/${id}/balance`, lang),
  getSelectedBillHtml: (
    id: number,
    saleItemIds: number[],
    lang: 'en' | 'ur' = 'en',
    groupSize?: number,
  ) =>
    billRequest(`/bills/buyer/${id}`, lang, {
      items: saleItemIds.join(','),
      ...(groupSize ? { groupSize: String(groupSize) } : {}),
    }),
}

export const billApi = {
  farmer: (id: number, lang: 'en' | 'ur' = 'en') => billRequest(`/bills/farmer/${id}`, lang),
  buyer: (id: number, lang: 'en' | 'ur' = 'en') => billRequest(`/bills/buyer/${id}`, lang),
  saleFarmer: (saleId: number, lang: 'en' | 'ur' = 'en') => billRequest(`/bills/sale/${saleId}/farmer`, lang),
  saleBuyer: (saleId: number, lang: 'en' | 'ur' = 'en') => billRequest(`/bills/sale/${saleId}/buyer`, lang),
  register: (id: number, lang: 'en' | 'ur' = 'en') => billRequest(`/bills/register/${id}`, lang),
  registerParty: (id: number, lang: 'en' | 'ur' = 'en') =>
    billRequest(`/bills/register/party/${id}`, lang),
  registerBalance: (id: number, lang: 'en' | 'ur' = 'en') =>
    billRequest(`/bills/register/party/${id}/balance`, lang),
  registerBook: (lang: 'en' | 'ur' = 'en') => billRequest('/bills/register/book', lang),
  wheatKhataParty: (id: number, lang: 'en' | 'ur' = 'en', book = 'WHEAT', secret?: string) =>
    book && book !== 'WHEAT'
      ? billRequest(`/bills/grain-khata/${id}`, lang, { book, ...(secret ? { secret } : {}) })
      : secret
        ? billRequest(`/bills/grain-khata/${id}`, lang, { book, secret })
        : billRequest(`/bills/wheat-khata/${id}`, lang),
  wheatKhataAll: (kind: 'PARTY' | 'COMPANY', lang: 'en' | 'ur' = 'en', book = 'WHEAT', secret?: string) =>
    secret || (book && book !== 'WHEAT')
      ? billRequest('/bills/grain-khata/all', lang, { kind, book, ...(secret ? { secret } : {}) })
      : billRequest('/bills/wheat-khata/all', lang, { kind }),
  paddyKhata: (bookId: number, secret: string, module?: string, lang: 'en' | 'ur' = 'en') =>
    billRequest(`/bills/paddy-khata/${bookId}`, lang, {
      secret,
      ...(module ? { module } : {}),
    }),
  paddyKhataAll: (bookId: number, secret: string, lang: 'en' | 'ur' = 'en') =>
    billRequest(`/bills/paddy-khata/${bookId}/all`, lang, { secret }),
  paddyKhataParty: (bookId: number, partyId: number, secret: string, lang: 'en' | 'ur' = 'en') =>
    billRequest(`/bills/paddy-khata/${bookId}/party/${partyId}`, lang, { secret }),
  arhatAmount: (lang: 'en' | 'ur' = 'en') => billRequest('/bills/arhat-amount', lang),
  arhatAmountMerge: (lang: 'en' | 'ur' = 'en') => billRequest('/bills/arhat-amount/merge', lang),
}

export const registerApi = {
  parties: (kind: 'GIVING' | 'RECEIVING') =>
    api.get<ApiResponse<RegisterParty[]>>('/register/parties', { params: { kind } }),
  getParty: (id: number) =>
    api.get<ApiResponse<RegisterParty>>(`/register/parties/${id}`),
  addParty: (data: { kind: string; name: string; address?: string; notes?: string }) =>
    api.post<ApiResponse<RegisterParty>>('/register/parties', data),
  updateParty: (id: number, data: {
    name?: string
    address?: string
    notes?: string
    entries?: Array<{
      id: number
      amount?: number
      kind?: 'GIVING' | 'RECEIVING'
      notes?: string | null
      delete?: boolean
    }>
  }) => api.put<ApiResponse<RegisterParty>>(`/register/parties/${id}`, data),
  deleteParty: (id: number) => api.delete<ApiResponse<void>>(`/register/parties/${id}`),
  entries: (kind?: string) =>
    api.get<ApiResponse<RegisterEntry[]>>('/register/entries', { params: kind ? { kind } : {} }),
  addEntry: (data: Record<string, unknown>) =>
    api.post<ApiResponse<RegisterEntry>>('/register/entries', data),
  updateEntry: (id: number, data: { amount?: number; kind?: 'GIVING' | 'RECEIVING'; notes?: string | null }) =>
    api.put<ApiResponse<RegisterEntry>>(`/register/entries/${id}`, data),
  deleteEntry: (id: number) => api.delete<ApiResponse<void>>(`/register/entries/${id}`),
  addPersonAmounts: (data: {
    partyId: number
    receivedAmount?: number
    givenAmount?: number
    notes?: string
  }) => api.post('/register/person-amounts', data),
  zakat: () => api.get<ApiResponse<ZakatSummary>>('/register/zakat'),
  statement: (key: string) =>
    api.get<ApiResponse<AccountStatement>>('/register/statement', { params: { key } }),
  adjust: (data: { key: string; kind: 'GIVING' | 'RECEIVING'; amount: number; notes?: string; farmerId?: number; buyerId?: number }) =>
    api.post<ApiResponse<{ entry: RegisterEntry; statement: AccountStatement }>>('/register/adjust', data),
}

export const arhatAmountApi = {
  book: () => api.get<ApiResponse<ArhatAmountBook>>('/arhat-amount'),
  merge: () => api.get<ApiResponse<ArhatAmountMergeReport>>('/arhat-amount/merge'),
  addEntry: (data: { kind: 'ADD' | 'RECEIVING' | 'GIVING'; amount: number; notes?: string }) =>
    api.post('/arhat-amount/entries', data),
}

function grainKhataPath(bookKey: string, suffix = '') {
  return `/grain-khata/${encodeURIComponent(bookKey)}${suffix}`
}

function withSecret<T extends Record<string, unknown>>(data: T, secret?: string) {
  return secret ? { ...data, secret } : data
}

export const grainKhataApi = {
  books: (crop: 'wheat' | 'barley' | 'maize' | 'other') =>
    api.get<ApiResponse<GrainKhataBookMeta[]>>('/grain-khata/books', { params: { crop } }),
  createBook: (data: { crop: 'wheat' | 'barley' | 'maize' | 'other'; name?: string; secret: string }) =>
    api.post<ApiResponse<GrainKhataBookMeta>>('/grain-khata/books', data),
  book: (bookKey: string, secret?: string) =>
    api.get<ApiResponse<WheatKhataBook>>(grainKhataPath(bookKey), { params: secret ? { secret } : {} }),
  addMoney: (bookKey: string, data: { amount: number; notes?: string }, secret?: string) =>
    api.post<ApiResponse<WheatKhataMoney>>(grainKhataPath(bookKey, '/money'), withSecret(data, secret)),
  addParty: (bookKey: string, data: { kind: 'RECEIVING' | 'GIVING' | 'PARTY' | 'COMPANY'; name: string; address?: string; notes?: string }, secret?: string) =>
    api.post<ApiResponse<WheatKhataParty>>(grainKhataPath(bookKey, '/parties'), withSecret(data, secret)),
  getParty: (bookKey: string, id: number, secret?: string) =>
    api.get<ApiResponse<WheatKhataParty>>(grainKhataPath(bookKey, `/parties/${id}`), { params: secret ? { secret } : {} }),
  previewProduct: (bookKey: string, data: {
    bags?: number
    trucks?: number
    ratePerBag: number
    bagWeightKg?: number
    bagPricePerBag?: number
    labourPerBag?: number
  }, secret?: string) =>
    api.post<ApiResponse<{
      bags: number
      trucks: number
      bagWeightKg: number
      ratePerBag: number
      bagPricePerBag: number
      labourPerBag: number
      wheatAmount: number
      bagAmount: number
      labourAmount: number
      totalPrice: number
      totalWeightKg: number
    }>>(grainKhataPath(bookKey, '/preview'), withSecret(data, secret)),
  addProduct: (bookKey: string, data: {
    partyId: number
    bags?: number
    trucks?: number
    ratePerBag: number
    bagWeightKg?: number
    bagPricePerBag?: number
    labourPerBag?: number
    notes?: string
  }, secret?: string) => api.post<ApiResponse<WheatKhataProduct>>(grainKhataPath(bookKey, '/products'), withSecret(data, secret)),
  addPayment: (bookKey: string, data: { partyId: number; amount: number; notes?: string }, secret?: string) =>
    api.post<ApiResponse<WheatKhataPayment>>(grainKhataPath(bookKey, '/payments'), withSecret(data, secret)),
  heads: (bookKey: string, secret?: string) =>
    api.get<ApiResponse<KhataHead[]>>(grainKhataPath(bookKey, '/heads'), { params: secret ? { secret } : {} }),
  addBank: (bookKey: string, data: { bankName: string; amount: number; notes?: string }, secret?: string) =>
    api.post<ApiResponse<KhataTreasuryLine>>(grainKhataPath(bookKey, '/bank'), withSecret(data, secret)),
  receiveBank: (bookKey: string, data: { bankName: string; amount: number; notes?: string }, secret?: string) =>
    api.post<ApiResponse<KhataTreasuryLine>>(grainKhataPath(bookKey, '/bank-receive'), withSecret(data, secret)),
  addOtherExpense: (bookKey: string, data: { reason: string; amount: number; notes?: string }, secret?: string) =>
    api.post<ApiResponse<KhataTreasuryLine>>(grainKhataPath(bookKey, '/other-expense'), withSecret(data, secret)),
  addPersonCash: (bookKey: string, data: {
    name?: string
    personId?: number
    kind: 'GIVING' | 'RECEIVING'
    amount: number
    notes?: string
    address?: string
  }, secret?: string) =>
    api.post<ApiResponse<KhataLedgerPerson>>(grainKhataPath(bookKey, '/people'), withSecret(data, secret)),
  getPerson: (bookKey: string, id: number, secret?: string) =>
    api.get<ApiResponse<KhataLedgerPerson>>(grainKhataPath(bookKey, `/people/${id}`), { params: secret ? { secret } : {} }),
  updatePerson: (bookKey: string, id: number, data: Record<string, unknown>, secret?: string) =>
    api.put<ApiResponse<KhataLedgerPerson>>(grainKhataPath(bookKey, `/people/${id}`), withSecret(data, secret)),
  deletePerson: (bookKey: string, id: number, secret?: string) =>
    api.delete<ApiResponse<{ id: number }>>(grainKhataPath(bookKey, `/people/${id}`), { params: secret ? { secret } : {} }),
  transferTo: (bookKey: string, data: { bookType: string; bookRef: string; amount: number; notes?: string }, secret?: string) =>
    api.post<ApiResponse<KhataTreasuryLine>>(grainKhataPath(bookKey, '/transfer'), withSecret(data, secret)),
}

export const wheatKhataApi = {
  book: () => grainKhataApi.book('WHEAT'),
  addMoney: (data: { amount: number; notes?: string }) => grainKhataApi.addMoney('WHEAT', data),
  addParty: (data: { kind: 'RECEIVING' | 'GIVING' | 'PARTY' | 'COMPANY'; name: string; address?: string; notes?: string }) =>
    grainKhataApi.addParty('WHEAT', data),
  getParty: (id: number) => grainKhataApi.getParty('WHEAT', id),
  previewProduct: (data: {
    bags?: number
    trucks?: number
    ratePerBag: number
    bagWeightKg?: number
    bagPricePerBag?: number
    labourPerBag?: number
  }) => grainKhataApi.previewProduct('WHEAT', data),
  addProduct: (data: {
    partyId: number
    bags?: number
    trucks?: number
    ratePerBag: number
    bagWeightKg?: number
    bagPricePerBag?: number
    labourPerBag?: number
    notes?: string
  }) => grainKhataApi.addProduct('WHEAT', data),
  addPayment: (data: { partyId: number; amount: number; notes?: string }) =>
    grainKhataApi.addPayment('WHEAT', data),
}

export const paddyKhataApi = {
  list: () => api.get<ApiResponse<PaddyKhataBookSummary[]>>('/paddy-khata'),
  create: (data: { name?: string; secret: string }) =>
    api.post<ApiResponse<PaddyKhataBookSummary>>('/paddy-khata', data),
  get: (id: number, secret: string) =>
    api.get<ApiResponse<PaddyKhataBook>>(`/paddy-khata/${id}`, { params: { secret } }),
  previewPurchase: (data: {
    bags: number
    bagWeightKg?: number
    extraWeightKg?: number
    ratePer40Kg: number
    bagPrice?: number
    labourPrice?: number
  }) =>
    api.post<ApiResponse<{
      bags: number
      bagWeightKg: number
      extraWeightKg: number
      ratePer40Kg: number
      bagPrice: number
      labourPrice: number
      totalWeightKg: number
      grainAmount: number
      bagAmount: number
      labourAmount: number
      totalPrice: number
    }>>('/paddy-khata/preview', data),
  addAmount: (id: number, data: { secret: string; amount: number; notes?: string }) =>
    api.post(`/paddy-khata/${id}/amounts`, data),
  addParty: (id: number, data: { secret: string; kind: 'PURCHASE' | 'SALE'; name: string; address?: string; notes?: string }) =>
    api.post(`/paddy-khata/${id}/parties`, data),
  addPurchase: (id: number, data: Record<string, unknown>) =>
    api.post(`/paddy-khata/${id}/purchases`, data),
  addCash: (id: number, data: { secret: string; partyId: number; kind: 'GIVE' | 'RECEIVE'; amount: number; notes?: string }) =>
    api.post(`/paddy-khata/${id}/cash`, data),
  addProcess: (id: number, data: { secret: string; variety: string; riceVariety: string; bags: number; notes?: string }) =>
    api.post(`/paddy-khata/${id}/process`, data),
  completeProcess: (id: number, data: { secret: string; variety: string }) =>
    api.post(`/paddy-khata/${id}/process/complete`, data),
  addExpense: (id: number, data: { secret: string; variety: string; amount: number; reason: string }) =>
    api.post(`/paddy-khata/${id}/expenses`, data),
  addRice: (id: number, data: { secret: string; bags: number; variety: string; notes?: string }) =>
    api.post(`/paddy-khata/${id}/rice`, data),
  addSale: (id: number, data: Record<string, unknown>) =>
    api.post(`/paddy-khata/${id}/sales`, data),
  heads: (id: number, secret: string) =>
    api.get<ApiResponse<KhataHead[]>>(`/paddy-khata/${id}/heads`, { params: { secret } }),
  addBank: (id: number, data: { secret: string; bankName: string; amount: number; notes?: string }) =>
    api.post<ApiResponse<KhataTreasuryLine>>(`/paddy-khata/${id}/bank`, data),
  receiveBank: (id: number, data: { secret: string; bankName: string; amount: number; notes?: string }) =>
    api.post<ApiResponse<KhataTreasuryLine>>(`/paddy-khata/${id}/bank-receive`, data),
  addOtherExpense: (id: number, data: { secret: string; reason: string; amount: number; notes?: string }) =>
    api.post<ApiResponse<KhataTreasuryLine>>(`/paddy-khata/${id}/other-expense`, data),
  addPersonCash: (id: number, data: {
    secret: string
    name?: string
    personId?: number
    kind: 'GIVING' | 'RECEIVING'
    amount: number
    notes?: string
    address?: string
  }) => api.post<ApiResponse<KhataLedgerPerson>>(`/paddy-khata/${id}/people`, data),
  getPerson: (id: number, personId: number, secret: string) =>
    api.get<ApiResponse<KhataLedgerPerson>>(`/paddy-khata/${id}/people/${personId}`, { params: { secret } }),
  updatePerson: (id: number, personId: number, data: Record<string, unknown>) =>
    api.put<ApiResponse<KhataLedgerPerson>>(`/paddy-khata/${id}/people/${personId}`, data),
  deletePerson: (id: number, personId: number, secret: string) =>
    api.delete<ApiResponse<{ id: number }>>(`/paddy-khata/${id}/people/${personId}`, { params: { secret } }),
  deleteBook: (id: number) => api.delete<ApiResponse<{ id: number }>>(`/paddy-khata/${id}`),
  transferTo: (id: number, data: { secret: string; bookType: string; bookRef: string; amount: number; notes?: string }) =>
    api.post<ApiResponse<KhataTreasuryLine>>(`/paddy-khata/${id}/transfer`, data),
}

export const truckApi = {
  getAll: () => api.get<ApiResponse<Truck[]>>('/trucks'),
  getById: (id: number) => api.get<ApiResponse<Truck>>(`/trucks/${id}`),
  create: (data: Record<string, unknown>) => api.post<ApiResponse<Truck>>('/trucks', data),
  update: (id: number, data: Record<string, unknown>) => api.put<ApiResponse<Truck>>(`/trucks/${id}`, data),
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
  getLots: (productId?: number, all = false) =>
    api.get<ApiResponse<StockLot[]>>('/stock/lots', {
      params: {
        ...(productId ? { productId } : {}),
        ...(all ? { all: '1' } : {}),
      },
    }),
  topUpLot: (data: Record<string, unknown>) =>
    api.post<ApiResponse<StockLot>>('/stock/lots/top-up', data),
  adjust: (data: Record<string, unknown>) => api.post<ApiResponse<StockItem>>('/stock/adjust', data),
}

export const dailyTradeApi = {
  getBoard: (date?: string, batchId?: number | null) =>
    api.get<ApiResponse<any>>('/daily-trade/board', {
      params: {
        ...(date ? { date } : {}),
        ...(batchId != null && Number(batchId) > 0 ? { batchId } : {}),
      },
    }),
  getHistory: () => api.get<ApiResponse<any[]>>('/daily-trade/history'),
  getBatches: (date?: string) =>
    api.get<ApiResponse<any>>('/daily-trade/batches', { params: date ? { date } : undefined }),
  openNextBatch: (date?: string, notes?: string) =>
    api.post<ApiResponse<any>>('/daily-trade/batches/open-next', {
      ...(date ? { date } : {}),
      ...(notes ? { notes } : {}),
    }),
  ensureReceivingBatch: (date?: string) =>
    api.post<ApiResponse<any>>('/daily-trade/batches/ensure', date ? { date } : {}),
  receiveMany: (data: Record<string, unknown>) =>
    api.post<ApiResponse<{ created: unknown[]; message: string; board: any; dayBatchId: number }>>(
      '/daily-trade/receive',
      data,
    ),
  sellDheri: (data: Record<string, unknown>) =>
    api.post<ApiResponse<{
      sale: Sale
      message: string
      board: any
      batchNumber: number
      ratePer40Kg: number
      batchClosed: boolean
    }>>('/daily-trade/sell-dheri', data),
  refresh: (date?: string) =>
    api.post<ApiResponse<any>>('/daily-trade/refresh', date ? { date } : {}),
  batchSell: (data: Record<string, unknown>) =>
    api.post<ApiResponse<{
      sale: Sale
      breakdown: Record<string, unknown>
      board: any
      message: string
    }>>('/daily-trade/batch-sell', data),
  nextDheri: () =>
    api.get<ApiResponse<{ queueNumber: number; dheriCode: string }>>('/daily-trade/next-dheri'),
  buyerSold: (buyerId: number) =>
    api.get<ApiResponse<{
      buyerId: number
      sales: any[]
      itemCount: number
      bags: number
      amount: number
    }>>('/daily-trade/buyer-sold', { params: { buyerId } }),
  markSold: (data: Record<string, unknown>) =>
    api.post<ApiResponse<{
      sale: Sale
      dheriId: number
      dheriCode: string
      board: any
      totals: {
        farmerGross: number
        commission: number
        farmerNet: number
        buyerAmount: number
        stockAmount: number
        grandTotal: number
      }
      message: string
    }>>('/daily-trade/mark-sold', data),
  editSold: (data: Record<string, unknown>) =>
    api.post<ApiResponse<{
      sale: Sale
      dheriId: number
      dheriCode: string
      board: any
      totals: {
        farmerGross: number
        commission: number
        farmerNet: number
        buyerAmount: number
        stockAmount: number
        grandTotal: number
      }
      message: string
    }>>('/daily-trade/edit-sold', data),
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
  chat: (
    message: string,
    options?: { language?: string; history?: { role: string; content: string }[] },
  ) =>
    api.post<ApiResponse<AiChatResponse>>('/ai/chat', {
      message,
      language: options?.language || 'en',
      history: options?.history || [],
    }),
}

export const saleApi = {
  getAll: () => api.get<ApiResponse<Sale[]>>('/sales'),
  getById: (id: number) => api.get<ApiResponse<Sale>>(`/sales/${id}`),
  create: (data: Record<string, unknown>) => api.post<ApiResponse<Sale>>('/sales', data),
  delete: (id: number) => api.delete<ApiResponse<void>>(`/sales/${id}`),
}

export const paymentApi = {
  getAll: () => api.get<ApiResponse<Payment[]>>('/payments'),
  getById: (id: number) => api.get<ApiResponse<Payment>>(`/payments/${id}`),
  getByDate: (date: string) => api.get<ApiResponse<Payment[]>>('/payments/by-date', { params: { date } }),
  getByDheri: (dheriId: number, date?: string) =>
    api.get<ApiResponse<Payment[]>>(`/payments/dheri/${dheriId}`, { params: date ? { date } : {} }),
  create: (data: Record<string, unknown>) => api.post<ApiResponse<Payment>>('/payments', data),
  update: (id: number, data: Record<string, unknown>) =>
    api.put<ApiResponse<Payment>>(`/payments/${id}`, data),
  delete: (id: number) => api.delete<ApiResponse<void>>(`/payments/${id}`),
}

export const arhatApi = {
  settle: (data: Record<string, unknown>) =>
    api.post<ApiResponse<{
      settlementType: string
      dheriId?: number
      dheriCode?: string
      saleId?: number
      invoiceNumber?: string
      totalAmount: number
      commission: number
      farmerPayable?: number
      buyerReceivable?: number
      paymentNow?: number
      partyOutstandingAfter?: number
      message: string
    }>>('/arhat/settle', data),
}

export const reportApi = {
  sales: (from?: string, to?: string) =>
    api.get<ApiResponse<ReportSummary>>('/reports/sales', { params: { from, to } }),
  commission: (from?: string, to?: string) =>
    api.get<ApiResponse<ReportSummary>>('/reports/commission', { params: { from, to } }),
  stock: () => api.get<ApiResponse<ReportSummary>>('/reports/stock'),
  profit: (from?: string, to?: string) =>
    api.get<ApiResponse<ReportSummary>>('/reports/profit', { params: { from, to } }),
}

export const userApi = {
  getAll: () => api.get<ApiResponse<SystemUser[]>>('/users'),
  staffUsage: () => api.get<ApiResponse<StaffUsageSummary>>('/users/staff-usage'),
  create: (data: Record<string, unknown>) => api.post<ApiResponse<SystemUser>>('/users', data),
  update: (id: number, data: Record<string, unknown>) => api.put<ApiResponse<SystemUser>>(`/users/${id}`, data),
  suspend: (id: number) => api.patch<ApiResponse<void>>(`/users/${id}/suspend`),
  activate: (id: number) => api.patch<ApiResponse<void>>(`/users/${id}/activate`),
  delete: (id: number) => api.delete<ApiResponse<void>>(`/users/${id}`),
  updatePassword: (id: number, password: string) =>
    api.patch<ApiResponse<void>>(`/users/${id}/password`, { password }),
}

export const auditApi = {
  getRecent: () => api.get<ApiResponse<Array<{ action: string; entityType: string; createdAt: string }>>>('/audit'),
}

export const backupApi = {
  export: () => api.get('/backup/export', { responseType: 'blob' }),
  exportJson: () => api.get<ApiResponse<unknown>>('/backup/export/json'),
  restore: (data: unknown) => api.post<ApiResponse<void>>('/backup/restore', data),
  usage: () => api.get<ApiResponse<{
    databaseBytes: number
    databaseSize: string
    neonFreeCap: string
    measuredAt: string
    counts: Record<string, number>
  }>>('/backup/usage'),
  wipe: () => api.post<ApiResponse<{
    databaseBytes: number
    databaseSize: string
    neonFreeCap: string
    measuredAt: string
    counts: Record<string, number>
  }>>('/backup/wipe', { confirm: 'START NEW' }),
}

export default api
