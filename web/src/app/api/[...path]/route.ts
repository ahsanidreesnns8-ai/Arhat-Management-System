import type { NextRequest } from 'next/server'
import { requireAuth, requireRoles, type AuthUser } from '@/server/auth'
import { fail, html, ok } from '@/server/http'
import { clientIp, rateLimit } from '@/server/rate-limit'
import { bumpRevision, getPulse } from '@/server/sync'
import { runWithWorkspace } from '@/server/workspace'
import * as authService from '@/server/services/auth-service'
import * as loginSessions from '@/server/services/login-sessions'
import { ensureShopLogins } from '@/server/shop-logins'
import * as farmers from '@/server/services/farmers'
import * as buyers from '@/server/services/buyers'
import * as trucks from '@/server/services/trucks'
import * as dheris from '@/server/services/dheris'
import * as sales from '@/server/services/sales'
import * as payments from '@/server/services/payments'
import * as queue from '@/server/services/queue'
import * as stock from '@/server/services/stock'
import * as settings from '@/server/services/settings'
import * as users from '@/server/services/users'
import * as dashboard from '@/server/services/dashboard'
import * as searchService from '@/server/services/search'
import * as register from '@/server/services/register'
import * as arhatAmount from '@/server/services/arhat-amount'
import { isOwnerFinanceRole } from '@/lib/roles'

type RouteContext = {
  params: Promise<{ path: string[] }>
}

type DispatchResult = {
  data: unknown
  message?: string
  status?: number
}

function result(data: unknown, message?: string, status?: number): DispatchResult {
  return { data, message, status }
}

function numericId(value?: string) {
  const id = Number(value)
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Invalid ID')
  return id
}

async function body(request: NextRequest) {
  try {
    return (await request.json()) as Record<string, unknown>
  } catch {
    return {}
  }
}

function isPublic(method: string, path: string[]) {
  return (
    (method === 'POST' && path.join('/') === 'auth/login') ||
    (method === 'POST' && path.join('/') === 'auth/logout') ||
    (method === 'GET' && path.join('/') === 'health') ||
    (method === 'GET' && path.join('/') === 'settings/public')
  )
}

async function authenticate(
  request: NextRequest,
  method: string,
  path: string[],
) {
  if (isPublic(method, path)) return undefined

  // Demo sandbox may edit its own settings; live settings stay owner/admin-only
  if (path[0] === 'settings' && method === 'PUT') {
    const user = await requireAuth(request)
    if (user.workspace === 'demo') return user
    if (user.role === 'OWNER' || user.role === 'ADMIN') return user
    throw new Error('Access denied')
  }

  if (path[0] === 'users' || path[0] === 'audit' || path[0] === 'backup') {
    return requireRoles(request, 'OWNER', 'ADMIN')
  }
  // Heartbeat/logout still require a bearer token but are handled after auth
  return requireAuth(request)
}

async function dispatch(
  request: NextRequest,
  method: string,
  path: string[],
  user?: AuthUser,
): Promise<DispatchResult | Response> {
  const url = request.nextUrl
  const payload =
    method === 'POST' || method === 'PUT' || method === 'PATCH'
      ? await body(request)
      : {}

  if (path[0] === 'health' && method === 'GET') {
    try {
      await ensureShopLogins()
    } catch {
      // Keep health green; login will retry the repair.
    }
    return result({
      status: 'UP',
      application: 'Rehmani Trading Company ERP',
    })
  }
  if (path[0] === 'auth' && path[1] === 'login' && method === 'POST') {
    const ip = clientIp(request)
    const username = String(payload.username ?? '')
    const ipLimited = rateLimit(`login:${ip}`, 40, 15 * 60_000)
    const userLimited = rateLimit(
      `login:user:${username.trim().toLowerCase() || 'unknown'}`,
      40,
      15 * 60_000,
    )
    const limited = !ipLimited.ok ? ipLimited : userLimited
    if (!limited.ok) {
      throw new Error(
        `Too many login attempts. Try again in ${limited.retryAfterSec}s.`,
      )
    }
    return result(
      await authService.login(username, String(payload.password ?? ''), {
        ipAddress: ip,
        userAgent: request.headers.get('user-agent'),
      }),
    )
  }
  if (path[0] === 'auth' && path[1] === 'logout' && method === 'POST') {
    const authorization = request.headers.get('authorization')
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice(7)
      : null
    return result(await authService.logout(token), 'Logged out')
  }
  if (path[0] === 'auth' && path[1] === 'heartbeat' && method === 'POST') {
    const authorization = request.headers.get('authorization')
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice(7)
      : null
    return result(await authService.heartbeat(token))
  }
  if (path[0] === 'auth' && path[1] === 'theme' && method === 'PUT') {
    await authService.updateTheme(
      user!.username,
      url.searchParams.get('theme') ?? '',
    )
    return result(null, 'Theme updated')
  }

  if (path[0] === 'farmers') {
    if (path.length === 1 && method === 'GET') {
      return result(await farmers.listFarmers())
    }
    if (path.length === 1 && method === 'POST') {
      return result(
        await farmers.createFarmer(payload as farmers.PartyInput),
        'Farmer created',
        201,
      )
    }
    const id = numericId(path[1])
    if (path.length === 2 && method === 'GET') {
      return result(await farmers.getFarmer(id))
    }
    if (path.length === 2 && method === 'PUT') {
      return result(
        await farmers.updateFarmer(id, payload as farmers.PartyInput),
        'Farmer updated',
      )
    }
    if (path.length === 2 && method === 'DELETE') {
      await farmers.deleteFarmer(id)
      return result(null, 'Farmer deleted')
    }
    if (path[2] === 'payments' && method === 'GET') {
      await farmers.getFarmer(id)
      return result(await payments.listPaymentsByFarmer(id))
    }
    if (path[2] === 'dheris' && method === 'GET') {
      return result(await dheris.listDherisByFarmer(id))
    }
    if (path[2] === 'trucks' && method === 'GET') {
      return result(await trucks.listTrucksByFarmer(id))
    }
    if (path[2] === 'ledger' && method === 'GET') {
      return result(await farmers.getFarmerLedger(id))
    }
  }

  if (path[0] === 'buyers') {
    if (path.length === 1 && method === 'GET') {
      return result(await buyers.listBuyers())
    }
    if (path.length === 1 && method === 'POST') {
      return result(
        await buyers.createBuyer(payload as farmers.PartyInput),
        'Buyer created',
        201,
      )
    }
    const id = numericId(path[1])
    if (path.length === 2 && method === 'GET') {
      return result(await buyers.getBuyer(id))
    }
    if (path.length === 2 && method === 'PUT') {
      return result(
        await buyers.updateBuyer(id, payload as farmers.PartyInput),
        'Buyer updated',
      )
    }
    if (path.length === 2 && method === 'DELETE') {
      await buyers.deleteBuyer(id)
      return result(null, 'Buyer deleted')
    }
    if (path[2] === 'payments' && method === 'GET') {
      await buyers.getBuyer(id)
      return result(await payments.listPaymentsByBuyer(id))
    }
    if (path[2] === 'sales' && method === 'GET') {
      return result(await sales.listSalesByBuyer(id))
    }
    if (path[2] === 'ledger' && method === 'GET') {
      return result(await buyers.getBuyerLedger(id))
    }
  }

  if (path[0] === 'trucks') {
    if (path.length === 1 && method === 'GET') {
      return result(await trucks.listTrucks())
    }
    if (path.length === 1 && method === 'POST') {
      return result(
        await trucks.createTruck(payload as trucks.TruckInput),
        'Truck created',
        201,
      )
    }
    const id = numericId(path[1])
    if (method === 'GET') return result(await trucks.getTruck(id))
    if (method === 'PUT') {
      return result(
        await trucks.updateTruck(id, payload as trucks.TruckInput),
        'Truck updated',
      )
    }
    if (method === 'DELETE') {
      await trucks.deleteTruck(id)
      return result(null, 'Truck deleted')
    }
  }

  if (path[0] === 'dheris') {
    if (path.length === 1 && method === 'GET') {
      return result(await dheris.listDheris())
    }
    if (path.length === 1 && method === 'POST') {
      return result(
        await dheris.createDheri(payload as dheris.DheriInput),
        'Dheri created',
        201,
      )
    }
    const id = numericId(path[1])
    if (method === 'GET') return result(await dheris.getDheri(id))
    if (method === 'PUT') {
      return result(
        await dheris.updateDheri(id, payload as dheris.DheriInput),
        'Dheri updated',
      )
    }
    if (method === 'DELETE') {
      await dheris.deleteDheri(id)
      return result(null, 'Dheri deleted')
    }
  }

  if (path[0] === 'sales') {
    if (path.length === 1 && method === 'GET') {
      return result(await sales.listSales())
    }
    if (path.length === 1 && method === 'POST') {
      return result(
        await sales.createSale(payload as sales.SaleInput, user?.id),
        'Sale created',
        201,
      )
    }
    if (path[1] === 'buyer' && method === 'GET') {
      return result(await sales.listSalesByBuyer(numericId(path[2])))
    }
    const id = numericId(path[1])
    if (method === 'GET') return result(await sales.getSale(id))
    if (method === 'DELETE') {
      await sales.deleteSale(id, user?.id)
      return result(null, 'Sale deleted')
    }
  }

  if (path[0] === 'payments') {
    if (path.length === 1 && method === 'GET') {
      return result(await payments.listPayments())
    }
    if (path.length === 1 && method === 'POST') {
      return result(
        await payments.recordPayment(payload as payments.PaymentInput, user?.id),
        'Payment recorded',
        201,
      )
    }
    if (path[1] === 'by-date' && method === 'GET') {
      const date = url.searchParams.get('date')
      if (!date) throw new Error('Date is required')
      return result(await payments.listPaymentsByDate(date))
    }
    if (path[1] === 'farmer' && method === 'GET') {
      return result(await payments.listPaymentsByFarmer(numericId(path[2])))
    }
    if (path[1] === 'buyer' && method === 'GET') {
      return result(await payments.listPaymentsByBuyer(numericId(path[2])))
    }
    if (path[1] === 'dheri' && method === 'GET') {
      return result(
        await payments.listPaymentsByDheri(
          numericId(path[2]),
          url.searchParams.get('date'),
        ),
      )
    }
    const id = numericId(path[1])
    if (method === 'GET') return result(await payments.getPayment(id))
    if (method === 'PUT') {
      return result(
        await payments.updatePayment(
          id,
          payload as payments.PaymentInput,
          user?.id,
        ),
        'Payment updated and balances settled',
      )
    }
    if (method === 'DELETE') {
      await payments.deletePayment(id, user?.id)
      return result(null, 'Payment deleted and balances restored')
    }
  }

  if (path[0] === 'queue') {
    if ((!path[1] || path[1] === 'pending') && method === 'GET') {
      return result(await queue.listPendingQueue())
    }
    if (path[1] === 'active' && method === 'GET') {
      return result(await queue.listActiveQueue())
    }
    if (path[1] === 'completed' && method === 'GET') {
      return result(await queue.listCompletedQueue())
    }
    if (path[1] === 'add' && method === 'POST') {
      return result(
        await queue.addToQueue(numericId(path[2])),
        'Added to queue',
      )
    }
    if (path[1] && path[2] === 'activate' && method === 'POST') {
      return result(await queue.activateQueue(numericId(path[1])), 'Queue activated')
    }
    if (path[1] && path[2] === 'complete' && method === 'POST') {
      return result(await queue.completeQueue(numericId(path[1])), 'Queue completed')
    }
    if (path[1] && path[2] === 'cancel' && method === 'POST') {
      return result(await queue.cancelQueue(numericId(path[1])), 'Queue cancelled')
    }
  }

  if (path[0] === 'stock') {
    const stockLots = await import('@/server/services/stock-lots')
    if (path.length === 1 && method === 'GET') {
      return result(await stock.listStock())
    }
    if (path[1] === 'history' && method === 'GET') {
      return result(await stock.listStockHistory())
    }
    if (path[1] === 'lots' && method === 'GET') {
      const productId = url.searchParams.get('productId')
      const includeEmpty = url.searchParams.get('all') === '1'
      return result(
        await stockLots.listStockLots(
          productId ? numericId(productId) : undefined,
          includeEmpty,
        ),
      )
    }
    if (path[1] === 'lots' && path[2] === 'top-up' && method === 'POST') {
      const lot = await stockLots.topUpStockKg({
        productId: Number(payload.productId),
        extraKg: payload.extraKg as number | string,
        ratePer40Kg: payload.ratePer40Kg as number | string | null | undefined,
        bagWeightKg: payload.bagWeightKg as number | string | null | undefined,
        notes: payload.notes as string | null | undefined,
        createdById: user?.id,
      })
      return result(lot, 'Extra KG top-up added to stock', 201)
    }
    if (path[1] === 'lots' && path[2] === 'preview' && method === 'GET') {
      const kg = Number(url.searchParams.get('kg') ?? 0)
      const bag = Number(url.searchParams.get('bagWeight') ?? 40)
      return result(stockLots.previewBagsFromKg(kg, bag))
    }
    if (path[1] === 'adjust' && method === 'POST') {
      return result(
        await stock.adjustStock(payload as stock.StockAdjustmentInput),
        'Stock updated',
      )
    }
  }

  if (path[0] === 'daily-trade') {
    const [dailyTrade, dayBatches] = await Promise.all([
      import('@/server/services/daily-trade'),
      import('@/server/services/day-batches'),
    ])
    if ((path.length === 1 || path[1] === 'board') && method === 'GET') {
      return result(
        await dailyTrade.getDailyBoard(
          url.searchParams.get('date'),
          url.searchParams.get('batchId'),
        ),
      )
    }
    if (path[1] === 'history' && method === 'GET') {
      return result(await dailyTrade.listDailyHistory())
    }
    if (path[1] === 'batches' && method === 'GET') {
      return result(
        await dayBatches.listDayBatches(url.searchParams.get('date')),
      )
    }
    if (path[1] === 'batches' && path[2] === 'open-next' && method === 'POST') {
      return result(
        await dayBatches.openNextBatch(
          (payload.date as string | undefined) ?? null,
          (payload.notes as string | undefined) ?? null,
        ),
        'Next batch opened',
      )
    }
    if (path[1] === 'batches' && path[2] === 'ensure' && method === 'POST') {
      return result(
        await dayBatches.getOrCreateReceivingBatch(
          (payload.date as string | undefined) ?? null,
        ),
        'Receiving batch ready',
      )
    }
    if (path[1] === 'receive' && method === 'POST') {
      const data = await dailyTrade.receiveManyIntoBatch(
        payload as Parameters<typeof dailyTrade.receiveManyIntoBatch>[0],
        user?.id,
      )
      return result(data, data.message)
    }
    if (path[1] === 'sell-dheri' && method === 'POST') {
      const data = await dayBatches.sellDheriAtAuctionRate(
        payload as Parameters<typeof dayBatches.sellDheriAtAuctionRate>[0],
        user?.id,
      )
      return result(
        { ...data, board: await dailyTrade.getDailyBoard(
          (payload.saleDate as string | undefined) ?? null,
          (payload.dayBatchId as number | string | undefined) ?? null,
        ) },
        data.message,
      )
    }
    if (path[1] === 'refresh' && method === 'POST') {
      return result(
        await dailyTrade.refreshDailyBoard(
          (payload.date as string | undefined) ??
            url.searchParams.get('date'),
        ),
        'Today saved to Records. Daily Trade starts from zero',
      )
    }
    if (path[1] === 'batch-sell' && method === 'POST') {
      const data = await dailyTrade.batchSellToBuyer(
        payload as Parameters<typeof dailyTrade.batchSellToBuyer>[0],
        user?.id,
      )
      return result(data, data.message)
    }
    if (path[1] === 'next-dheri' && method === 'GET') {
      return result(await dailyTrade.nextDeskDheriNumber())
    }
    if (path[1] === 'buyer-sold' && method === 'GET') {
      const buyerId = Number(url.searchParams.get('buyerId'))
      return result(
        await dailyTrade.listBuyerSoldToday(
          buyerId,
          url.searchParams.get('date'),
        ),
      )
    }
    if (path[1] === 'mark-sold' && method === 'POST') {
      const data = await dailyTrade.markDeskSold(
        payload as Parameters<typeof dailyTrade.markDeskSold>[0],
        user?.id,
      )
      return result(data, data.message)
    }
    if (path[1] === 'edit-sold' && method === 'POST') {
      const data = await dailyTrade.updateDeskSold(
        payload as Parameters<typeof dailyTrade.updateDeskSold>[0],
        user?.id,
      )
      return result(data, data.message)
    }
  }

  if (path[0] === 'calculator') {
    const calculator = await import('@/server/services/calculator')
    if (path[1] === 'calculate' && method === 'POST') {
      return result(
        await calculator.calculatePrice(payload as Parameters<typeof calculator.calculatePrice>[0]),
      )
    }
    if (path[1] === 'save' && method === 'POST') {
      const id = numericId(path[2])
      await calculator.saveCalculation(id, payload as Parameters<typeof calculator.saveCalculation>[1])
      return result(await dheris.getDheri(id), 'Calculation saved to dheri record')
    }
  }

  if (path[0] === 'arhat' && path[1] === 'settle' && method === 'POST') {
    const arhat = await import('@/server/services/arhat')
    const data = await arhat.settle(
      payload as Parameters<typeof arhat.settle>[0],
      user?.id,
    )
    return result(data, data.message)
  }

  if (path[0] === 'settings') {
    if (path[1] === 'products' && method === 'GET') {
      return result(await settings.listProducts())
    }
    if ((path.length === 1 || path[1] === 'public') && method === 'GET') {
      return result(await settings.getSettings())
    }
    if (path.length === 1 && method === 'PUT') {
      return result(
        await settings.updateSettings(payload as settings.SettingsInput),
        'Settings updated',
      )
    }
  }

  if (path[0] === 'users') {
    if (path.length === 1 && method === 'GET') {
      return result(await users.listUsers())
    }
    if (path[1] === 'staff-usage' && method === 'GET') {
      return result(await loginSessions.getStaffUsageSummary())
    }
    if (path.length === 1 && method === 'POST') {
      return result(
        await users.createUser(payload as users.UserInput),
        'User created',
        201,
      )
    }
    const id = numericId(path[1])
    if (path.length === 2 && method === 'GET') {
      return result(await users.getUser(id))
    }
    if (path.length === 2 && method === 'PUT') {
      return result(
        await users.updateUser(id, payload as users.UserInput),
        'User updated',
      )
    }
    if (path[2] === 'suspend' && method === 'PATCH') {
      await users.setUserActive(id, false)
      return result(null, 'User suspended')
    }
    if (path[2] === 'activate' && method === 'PATCH') {
      await users.setUserActive(id, true)
      return result(null, 'User activated')
    }
    if (path[2] === 'password' && method === 'PATCH') {
      await users.updatePassword(id, String(payload.password ?? ''))
      return result(null, 'Password updated')
    }
    if (path.length === 2 && method === 'DELETE') {
      await users.deleteUser(id)
      return result(null, 'User deleted')
    }
  }

  if (path[0] === 'dashboard' && path[1] === 'stats' && method === 'GET') {
    return result(await dashboard.getDashboardStats(user?.role))
  }
  if (path[0] === 'search' && method === 'GET') {
    return result(await searchService.search(url.searchParams.get('q') ?? '', user?.id))
  }
  if (path[0] === 'weather' && method === 'GET') {
    const weather = await import('@/server/services/weather')
    return result(await weather.getWeather())
  }
  if (path[0] === 'sync' && path[1] === 'pulse' && method === 'GET') {
    return result(await getPulse())
  }
  if (path[0] === 'ai' && path[1] === 'chat' && method === 'POST') {
    const ai = await import('@/server/services/ai')
    return result(await ai.chat(payload as Parameters<typeof ai.chat>[0]))
  }
  if (path[0] === 'audit' && method === 'GET') {
    const audit = await import('@/server/services/audit')
    return result(await audit.listAuditLogs())
  }

  if (path[0] === 'reports') {
    const reports = await import('@/server/services/reports')
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    if (path[1] === 'sales' && method === 'GET') {
      return result(await reports.getSalesReport(from, to))
    }
    if (path[1] === 'commission' && method === 'GET') {
      if (!isOwnerFinanceRole(user?.role)) throw new Error('Access denied')
      return result(await reports.getCommissionReport(from, to))
    }
    if (path[1] === 'heads' && method === 'GET') {
      return result(await reports.getCommissionHeads())
    }
    if (path[1] === 'stock' && method === 'GET') {
      return result(await reports.getStockReport())
    }
    if (path[1] === 'profit' && method === 'GET') {
      if (!isOwnerFinanceRole(user?.role)) throw new Error('Access denied')
      return result(await reports.getProfitReport(from, to))
    }
    if (
      path[1] === 'export' &&
      path[2] === 'sales.xlsx' &&
      method === 'GET'
    ) {
      return new Response(await reports.exportSalesCsv(from, to), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename=sales-report.csv',
        },
      })
    }
    if (path[1] === 'export' && method === 'GET') {
      throw new Error('Excel export is not available on Vercel serverless')
    }
  }

  if (path[0] === 'arhat-amount') {
    if (path.length === 1 && method === 'GET') {
      return result(await arhatAmount.getBook())
    }
    if (path[1] === 'merge' && method === 'GET') {
      if (!isOwnerFinanceRole(user?.role)) throw new Error('Only the owner can merge Wheat Khata into Arhat Amount')
      return result(await arhatAmount.getMergeReport())
    }
    if (path[1] === 'entries' && method === 'POST') {
      return result(await arhatAmount.addEntry(payload), 'Amount saved', 201)
    }
  }

  if (path[0] === 'grain-khata') {
    const [grainKhata, wheatKhata] = await Promise.all([
      import('@/server/services/grain-khata'),
      import('@/server/services/wheat-khata'),
    ])
    const userId = user!.id
    if (path[1] === 'books' && path.length === 2 && method === 'GET') {
      return result(await grainKhata.listBooks(userId, url.searchParams.get('crop') ?? payload.crop))
    }
    if (path[1] === 'books' && path.length === 2 && method === 'POST') {
      return result(await grainKhata.createBook(userId, payload), 'Khata ID created', 201)
    }
    const bookKey = path[1]
    const secret = payload.secret ?? url.searchParams.get('secret')
    if (secret != null && String(secret).length) payload.secret = secret
    const access = { userId, secret }
    if (path.length === 2 && method === 'GET') {
      return result(await wheatKhata.getBook(bookKey, access))
    }
    if (path[2] === 'money' && method === 'POST') {
      return result(await wheatKhata.addMoney(payload, bookKey, access), 'Money added', 201)
    }
    if (path[2] === 'parties' && path.length === 4 && method === 'GET') {
      return result(await wheatKhata.getParty(numericId(path[3]), bookKey, access))
    }
    if (path[2] === 'parties' && path.length === 4 && method === 'PUT') {
      return result(await wheatKhata.updateParty(numericId(path[3]), payload, bookKey, access), 'Party updated')
    }
    if (path[2] === 'parties' && path.length === 4 && method === 'DELETE') {
      return result(await wheatKhata.deleteParty(numericId(path[3]), bookKey, access), 'Party deleted')
    }
    if (path[2] === 'parties' && method === 'POST') {
      return result(await wheatKhata.createParty(payload, bookKey, access), 'Party saved', 201)
    }
    if (path[2] === 'products' && method === 'POST') {
      return result(await wheatKhata.addProduct(payload, bookKey, access), 'Product saved', 201)
    }
    if (path[2] === 'payments' && method === 'POST') {
      return result(await wheatKhata.addPayment(payload, bookKey, access), 'Amount saved', 201)
    }
    if (path[2] === 'preview' && method === 'POST') {
      return result(wheatKhata.previewProduct(payload))
    }
    if (path[2] === 'heads' && method === 'GET') {
      return result(await wheatKhata.listKhataHeads(bookKey, access))
    }
    if (path[2] === 'bank' && method === 'POST') {
      return result(await wheatKhata.addBank(payload, bookKey, access), 'Bank amount saved', 201)
    }
    if (path[2] === 'bank-receive' && method === 'POST') {
      return result(await wheatKhata.receiveBank(payload, bookKey, access), 'Received from bank', 201)
    }
    if (path[2] === 'other-expense' && method === 'POST') {
      return result(await wheatKhata.addOtherExpense(payload, bookKey, access), 'Other expense saved', 201)
    }
    if (path[2] === 'people' && path.length === 4 && method === 'GET') {
      return result(await wheatKhata.getLedgerPerson(numericId(path[3]), bookKey, access))
    }
    if (path[2] === 'people' && path.length === 4 && method === 'PUT') {
      return result(await wheatKhata.updateLedgerPerson(numericId(path[3]), payload, bookKey, access), 'Person updated')
    }
    if (path[2] === 'people' && path.length === 4 && method === 'DELETE') {
      return result(await wheatKhata.deleteLedgerPerson(numericId(path[3]), bookKey, access), 'Person deleted')
    }
    if (path[2] === 'people' && method === 'POST') {
      return result(await wheatKhata.addLedgerCash(payload, bookKey, access), 'Amount saved', 201)
    }
    if (path[2] === 'transfer' && method === 'POST') {
      return result(await wheatKhata.transferTo(payload, bookKey, access), 'Amount sent to khata', 201)
    }
  }

  if (path[0] === 'wheat-khata') {
    const wheatKhata = await import('@/server/services/wheat-khata')
    if (path.length === 1 && method === 'GET') {
      return result(await wheatKhata.getBook())
    }
    if (path[1] === 'money' && method === 'POST') {
      return result(await wheatKhata.addMoney(payload), 'Money added', 201)
    }
    if (path[1] === 'parties' && path.length === 3 && method === 'GET') {
      return result(await wheatKhata.getParty(numericId(path[2])))
    }
    if (path[1] === 'parties' && path.length === 3 && method === 'PUT') {
      return result(await wheatKhata.updateParty(numericId(path[2]), payload), 'Party updated')
    }
    if (path[1] === 'parties' && path.length === 3 && method === 'DELETE') {
      return result(await wheatKhata.deleteParty(numericId(path[2])), 'Party deleted')
    }
    if (path[1] === 'parties' && method === 'POST') {
      return result(await wheatKhata.createParty(payload), 'Party saved', 201)
    }
    if (path[1] === 'products' && method === 'POST') {
      return result(await wheatKhata.addProduct(payload), 'Product saved', 201)
    }
    if (path[1] === 'payments' && method === 'POST') {
      return result(await wheatKhata.addPayment(payload), 'Amount saved', 201)
    }
    if (path[1] === 'preview' && method === 'POST') {
      return result(wheatKhata.previewProduct(payload))
    }
  }

  if (path[0] === 'paddy-khata') {
    const paddyKhata = await import('@/server/services/paddy-khata')
    const userId = user!.id
    if (path.length === 1 && method === 'GET') {
      return result(await paddyKhata.listBooks(userId))
    }
    if (path.length === 1 && method === 'POST') {
      return result(await paddyKhata.createBook(userId, payload), 'Paddy Khata ID created', 201)
    }
    if (path[1] === 'archive' && path.length === 2 && method === 'GET') {
      return result(await paddyKhata.listArchivedBooks(userId))
    }
    if (path[1] === 'preview' && method === 'POST') {
      return result(paddyKhata.previewPurchase(payload))
    }
    const id = numericId(path[1])
    const secret = payload.secret ?? url.searchParams.get('secret')
    if (secret != null && String(secret).length) payload.secret = secret
    if (path.length === 2 && method === 'GET') {
      return result(await paddyKhata.getBook(id, userId, secret))
    }
    if (path.length === 2 && method === 'DELETE') {
      return result(await paddyKhata.deleteBook(id, userId), 'Paddy Khata ID moved to archive')
    }
    if (path[2] === 'restore' && method === 'POST') {
      return result(await paddyKhata.restoreBook(id, userId), 'Paddy Khata ID restored')
    }
    if (path[2] === 'purge' && method === 'DELETE') {
      return result(await paddyKhata.purgeBook(id, userId), 'Paddy Khata ID deleted permanently')
    }
    if (path[2] === 'amounts' && method === 'POST') {
      return result(await paddyKhata.addAmount(id, userId, payload), 'Amount added', 201)
    }
    if (path[2] === 'parties' && path.length === 4 && method === 'PUT') {
      return result(await paddyKhata.updateParty(id, userId, numericId(path[3]), payload), 'Party updated')
    }
    if (path[2] === 'parties' && path.length === 4 && method === 'DELETE') {
      return result(await paddyKhata.deleteParty(id, userId, numericId(path[3]), secret), 'Party deleted')
    }
    if (path[2] === 'parties' && method === 'POST') {
      return result(await paddyKhata.createParty(id, userId, payload), 'Party saved', 201)
    }
    if (path[2] === 'purchases' && method === 'POST') {
      return result(await paddyKhata.addPurchase(id, userId, payload), 'Purchase saved', 201)
    }
    if (path[2] === 'cash' && method === 'POST') {
      return result(await paddyKhata.addCash(id, userId, payload), 'Amount saved', 201)
    }
    if (path[2] === 'heads' && method === 'GET') {
      return result(await paddyKhata.listKhataHeads(id, userId, secret))
    }
    if (path[2] === 'bank' && method === 'POST') {
      return result(await paddyKhata.addBank(id, userId, payload), 'Bank amount saved', 201)
    }
    if (path[2] === 'bank-receive' && method === 'POST') {
      return result(await paddyKhata.receiveBank(id, userId, payload), 'Received from bank', 201)
    }
    if (path[2] === 'other-expense' && method === 'POST') {
      return result(await paddyKhata.addOtherExpense(id, userId, payload), 'Other expense saved', 201)
    }
    if (path[2] === 'people' && path.length === 4 && method === 'GET') {
      return result(await paddyKhata.getLedgerPerson(id, userId, numericId(path[3]), secret))
    }
    if (path[2] === 'people' && path.length === 4 && method === 'PUT') {
      return result(await paddyKhata.updateLedgerPerson(id, userId, numericId(path[3]), payload), 'Person updated')
    }
    if (path[2] === 'people' && path.length === 4 && method === 'DELETE') {
      return result(await paddyKhata.deleteLedgerPerson(id, userId, numericId(path[3]), secret), 'Person deleted')
    }
    if (path[2] === 'people' && method === 'POST') {
      return result(await paddyKhata.addLedgerCash(id, userId, payload), 'Amount saved', 201)
    }
    if (path[2] === 'transfer' && method === 'POST') {
      return result(await paddyKhata.transferTo(id, userId, payload), 'Amount sent to khata', 201)
    }
    if (path[2] === 'process' && path[3] === 'complete' && method === 'POST') {
      return result(await paddyKhata.completeProcess(id, userId, payload), 'Processing complete. Rice moved to Sell Rice.')
    }
    if (path[2] === 'process' && method === 'POST') {
      return result(await paddyKhata.addProcess(id, userId, payload), 'Processing started. Tap Processing complete to move this variety to Sell Rice.', 201)
    }
    if (path[2] === 'expenses' && method === 'POST') {
      return result(await paddyKhata.addExpense(id, userId, payload), 'Bill paid', 201)
    }
    if (path[2] === 'rice' && method === 'POST') {
      return result(await paddyKhata.addRice(id, userId, payload), 'Rice bags added', 201)
    }
    if (path[2] === 'sales' && method === 'POST') {
      return result(await paddyKhata.addSale(id, userId, payload), 'Rice sold', 201)
    }
  }

  if (path[0] === 'register') {
    if (!isOwnerFinanceRole(user?.role)) throw new Error('Access denied')
    if (path[1] === 'parties' && path.length === 3 && method === 'GET') {
      return result(await register.getPartyLedger(numericId(path[2])))
    }
    if (path[1] === 'parties' && path.length === 3 && method === 'PUT') {
      return result(
        await register.updateParty(numericId(path[2]), payload as Parameters<typeof register.updateParty>[1]),
        'Person updated',
      )
    }
    if (path[1] === 'parties' && path.length === 3 && method === 'DELETE') {
      await register.deleteParty(numericId(path[2]))
      return result(null, 'Person deleted')
    }
    if (path[1] === 'parties' && method === 'GET') {
      return result(await register.listParties(url.searchParams.get('kind') ?? ''))
    }
    if (path[1] === 'parties' && method === 'POST') {
      return result(await register.createParty(payload as Parameters<typeof register.createParty>[0]), 'Person added', 201)
    }
    if (path[1] === 'entries' && path.length === 3 && method === 'PUT') {
      return result(
        await register.updateEntry(numericId(path[2]), payload as Parameters<typeof register.updateEntry>[1]),
        'Amount updated',
      )
    }
    if (path[1] === 'entries' && path.length === 3 && method === 'DELETE') {
      await register.deleteEntry(numericId(path[2]))
      return result(null, 'Amount deleted')
    }
    if (path[1] === 'entries' && method === 'GET') {
      return result(await register.listEntries(url.searchParams.get('kind')))
    }
    if (path[1] === 'entries' && method === 'POST') {
      return result(
        await register.createEntry(payload as Parameters<typeof register.createEntry>[0], user?.id),
        'Amount recorded',
        201,
      )
    }
    if (path[1] === 'person-amounts' && method === 'POST') {
      return result(
        await register.addPersonAmounts(payload as Parameters<typeof register.addPersonAmounts>[0], user?.id),
        'Person amounts saved',
        201,
      )
    }
    if (path[1] === 'zakat' && method === 'GET') {
      return result(await register.zakatSummary())
    }
    if (path[1] === 'statement' && method === 'GET') {
      return result(await register.getStatement(url.searchParams.get('key')))
    }
    if (path[1] === 'adjust' && method === 'POST') {
      return result(
        await register.adjustAccount(payload as Parameters<typeof register.adjustAccount>[0], user?.id),
        'Amount recorded',
        201,
      )
    }
  }

  if (path[0] === 'bills' && method === 'GET') {
    const bills = await import('@/server/services/bills')
    const lang = url.searchParams.get('lang') ?? 'en'
    if (path[1] === 'arhat-amount' && path[2] === 'merge' && path.length === 3) {
      if (!isOwnerFinanceRole(user?.role)) throw new Error('Only the owner can merge Wheat Khata into Arhat Amount')
      return html(await bills.arhatAmountMergeBillHtml(lang))
    }
    if (path[1] === 'arhat-amount' && path.length === 2) {
      return html(await bills.arhatAmountBillHtml(lang))
    }
    if (path[1] === 'wheat-khata' && path[2] === 'all' && path.length === 3) {
      return html(await bills.wheatKhataAllBillsHtml(url.searchParams.get('kind') ?? 'PARTY', lang, url.searchParams.get('book')))
    }
    if (path[1] === 'wheat-khata' && path.length === 3) {
      return html(await bills.wheatKhataBillHtml(numericId(path[2]), lang, url.searchParams.get('book')))
    }
    if (path[1] === 'grain-khata' && path[2] === 'all' && path.length === 3) {
      return html(await bills.wheatKhataAllBillsHtml(
        url.searchParams.get('kind') ?? 'PARTY',
        lang,
        url.searchParams.get('book'),
        { userId: user!.id, secret: url.searchParams.get('secret') },
      ))
    }
    if (path[1] === 'grain-khata' && path.length === 3) {
      return html(await bills.wheatKhataBillHtml(
        numericId(path[2]),
        lang,
        url.searchParams.get('book'),
        { userId: user!.id, secret: url.searchParams.get('secret') },
      ))
    }
    if (path[1] === 'paddy-khata' && path[3] === 'all' && path.length === 4) {
      return html(
        await bills.paddyKhataBillHtml(
          numericId(path[2]),
          user!.id,
          url.searchParams.get('secret'),
          lang,
          'all',
        ),
      )
    }
    if (path[1] === 'paddy-khata' && path[3] === 'party' && path.length === 5) {
      return html(
        await bills.paddyKhataPartyBillHtml(
          numericId(path[2]),
          numericId(path[4]),
          user!.id,
          url.searchParams.get('secret'),
          lang,
        ),
      )
    }
    if (path[1] === 'paddy-khata' && path.length === 3) {
      return html(
        await bills.paddyKhataBillHtml(
          numericId(path[2]),
          user!.id,
          url.searchParams.get('secret'),
          lang,
          url.searchParams.get('module'),
        ),
      )
    }
    if (path[1] === 'register' && path[2] === 'book' && path.length === 3) {
      return html(await bills.registerBookBill(lang))
    }
    if (path[1] === 'register' && path[2] === 'party' && path[4] === 'balance' && path.length === 5) {
      return html(await bills.accountBalanceBillByParty(numericId(path[3]), lang))
    }
    if (path[1] === 'register' && path[2] === 'party' && path.length === 4) {
      return html(await bills.registerPartyBill(numericId(path[3]), lang))
    }
    if (path[1] === 'register' && path.length === 3) {
      return html(await bills.registerEntryBill(numericId(path[2]), lang))
    }
    if (path[1] === 'farmer' && path[3] === 'balance' && path.length === 4) {
      return html(await bills.accountBalanceBillByFarmer(numericId(path[2]), lang))
    }
    if (path[1] === 'farmer' && path.length === 3) {
      return html(await bills.farmerBill(numericId(path[2]), lang))
    }
    if (path[1] === 'buyer' && path[3] === 'balance' && path.length === 4) {
      return html(await bills.accountBalanceBillByBuyer(numericId(path[2]), lang))
    }
    if (path[1] === 'buyer' && path.length === 3) {
      const itemsParam = url.searchParams.get('items')
      if (itemsParam) {
        const saleItemIds = itemsParam
          .split(',')
          .map((x) => Number(x.trim()))
          .filter((x) => Number.isSafeInteger(x) && x > 0)
        const groupSizeRaw = url.searchParams.get('groupSize')
        const groupSize = groupSizeRaw ? Number(groupSizeRaw) : null
        return html(
          await bills.buyerBillSelected(
            numericId(path[2]),
            saleItemIds,
            lang,
            groupSize,
          ),
        )
      }
      return html(await bills.buyerBill(numericId(path[2]), lang))
    }
    if (path[1] === 'sale' && path[3] === 'farmer') {
      return html(await bills.saleBill(numericId(path[2]), 'farmer', lang))
    }
    if (path[1] === 'sale' && path[3] === 'buyer') {
      return html(await bills.saleBill(numericId(path[2]), 'buyer', lang))
    }
    if (path.at(-1) === 'pdf') {
      throw new Error('PDF export is not available on Vercel serverless')
    }
  }

  if (path[0] === 'backup') {
    const backup = await import('@/server/services/backup')
    if (path[1] === 'export' && path[2] === 'json' && method === 'GET') {
      return result(await backup.exportBackupJson())
    }
    if (path[1] === 'export' && method === 'GET') {
      backup.unavailableArchive()
    }
    if (path[1] === 'restore' && method === 'POST') {
      if (user?.role !== 'OWNER') throw new Error('Access denied')
      await backup.restoreBackup(payload)
      return result(null, 'Backup restored')
    }
    if (path[1] === 'usage' && method === 'GET') {
      return result(await backup.getShopStorage())
    }
    if (path[1] === 'wipe' && method === 'POST') {
      if (user?.role !== 'OWNER') throw new Error('Only the owner can wipe shop data')
      const confirm = String(payload.confirm ?? '').trim().toUpperCase()
      if (confirm !== 'START NEW') {
        throw new Error('Type START NEW to wipe all shop records')
      }
      return result(await backup.wipeShopData(user.id), 'Shop data wiped — starting empty')
    }
  }

  throw new Error(`API route not found: ${method} /${path.join('/')}`)
}

async function handle(request: NextRequest, context: RouteContext) {
  const method = request.method.toUpperCase()
  const { path } = await context.params
  try {
    if (!process.env.DATABASE_URL?.trim()) {
      throw new Error(
        'Database is not configured. Set DATABASE_URL in Vercel Project Settings → Environment Variables.',
      )
    }
    try {
      if (path[0] === 'auth' && path[1] === 'login') {
        await ensureShopLogins()
      }
    } catch {
      // Login/data routes still run; they will surface a real DB error if needed.
    }
    const user = await authenticate(request, method, path)

    const dispatched = await runWithWorkspace(user?.workspace ?? 'live', async () => {
      const result = await dispatch(request, method, path, user)
      if (
        !(result instanceof Response) &&
        ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) &&
        path.join('/') !== 'auth/login'
      ) {
        await bumpRevision()
      }
      return result
    })

    if (dispatched instanceof Response) return dispatched
    return ok(
      dispatched.data,
      dispatched.message,
      dispatched.status ?? 200,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Request failed'
    const lower = message.toLowerCase()
    const isDbTransient =
      lower.includes("can't reach database") ||
      lower.includes('connection') ||
      lower.includes('timed out') ||
      lower.includes('pool') ||
      lower.includes('p1001') ||
      lower.includes('p1002') ||
      lower.includes('p1017') ||
      lower.includes('server has closed the connection')

    const status =
      message.startsWith('Too many login attempts')
        ? 429
        : message === 'Authentication required' ||
            message === 'Invalid or expired token' ||
            message === 'Access Denied' ||
            message === 'Invalid username or password' ||
            message.startsWith('Invalid username or password') ||
            message.startsWith('Account temporarily locked') ||
            message.startsWith('Username and password are required') ||
            message.startsWith('This account is suspended') ||
            message === 'User not found or inactive'
          ? 401
          : message === 'Access denied' ||
              message.startsWith('Demo account cannot')
            ? 403
            : message.startsWith('Database is not configured')
              ? 503
              : message.startsWith('API route not found')
              ? 404
              : isDbTransient
                ? 503
                : 400
    // Don't leak stack / internal details
    const safeMessage =
      message.startsWith('JWT_SECRET')
        ? 'Server misconfigured'
        : isDbTransient
          ? 'Service temporarily unavailable — retrying…'
          : message.slice(0, 240)
    return fail(safeMessage, status)
  }
}

export const maxDuration = 60
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = handle
export const POST = handle
export const PUT = handle
export const PATCH = handle
export const DELETE = handle

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { Allow: 'GET, POST, PUT, PATCH, DELETE, OPTIONS' },
  })
}
