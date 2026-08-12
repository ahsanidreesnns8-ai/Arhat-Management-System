import type { NextRequest } from 'next/server'
import { requireAuth, requireRoles, type AuthUser } from '@/server/auth'
import { fail, html, ok } from '@/server/http'
import { bumpRevision, getPulse } from '@/server/sync'
import * as authService from '@/server/services/auth-service'
import * as farmers from '@/server/services/farmers'
import * as buyers from '@/server/services/buyers'
import * as trucks from '@/server/services/trucks'
import * as dheris from '@/server/services/dheris'
import * as sales from '@/server/services/sales'
import * as payments from '@/server/services/payments'
import * as queue from '@/server/services/queue'
import * as stock from '@/server/services/stock'
import * as calculator from '@/server/services/calculator'
import * as settings from '@/server/services/settings'
import * as users from '@/server/services/users'
import * as dashboard from '@/server/services/dashboard'
import * as searchService from '@/server/services/search'
import * as reports from '@/server/services/reports'
import * as bills from '@/server/services/bills'
import * as weather from '@/server/services/weather'
import * as ai from '@/server/services/ai'
import * as audit from '@/server/services/audit'
import * as backup from '@/server/services/backup'
import * as arhat from '@/server/services/arhat'

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
  if (
    path[0] === 'users' ||
    path[0] === 'audit' ||
    path[0] === 'backup' ||
    (path[0] === 'settings' && method === 'PUT')
  ) {
    return requireRoles(request, 'OWNER', 'ADMIN')
  }
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
    return result({
      status: 'UP',
      application: 'Rehmani Trading Company ERP',
    })
  }
  if (path[0] === 'auth' && path[1] === 'login' && method === 'POST') {
    return result(
      await authService.login(
        String(payload.username ?? ''),
        String(payload.password ?? ''),
      ),
    )
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
    if (path[1] === 'pending' && method === 'GET') {
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
    const id = numericId(path[1])
    if (path[2] === 'activate' && method === 'POST') {
      return result(await queue.activateQueue(id), 'Queue activated')
    }
    if (path[2] === 'complete' && method === 'POST') {
      return result(await queue.completeQueue(id), 'Queue completed')
    }
    if (path[2] === 'cancel' && method === 'POST') {
      return result(await queue.cancelQueue(id), 'Queue cancelled')
    }
  }

  if (path[0] === 'stock') {
    if (path.length === 1 && method === 'GET') {
      return result(await stock.listStock())
    }
    if (path[1] === 'history' && method === 'GET') {
      return result(await stock.listStockHistory())
    }
    if (path[1] === 'adjust' && method === 'POST') {
      return result(
        await stock.adjustStock(payload as stock.StockAdjustmentInput),
        'Stock updated',
      )
    }
  }

  if (path[0] === 'calculator') {
    if (path[1] === 'calculate' && method === 'POST') {
      return result(
        await calculator.calculatePrice(payload as calculator.PriceInput),
      )
    }
    if (path[1] === 'save' && method === 'POST') {
      const id = numericId(path[2])
      await calculator.saveCalculation(id, payload as calculator.PriceInput)
      return result(await dheris.getDheri(id), 'Calculation saved to dheri record')
    }
  }

  if (path[0] === 'arhat' && path[1] === 'settle' && method === 'POST') {
    const data = await arhat.settle(
      payload as arhat.ArhatSettlementInput,
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
    if (path.length === 2 && method === 'DELETE') {
      await users.deleteUser(id)
      return result(null, 'User deleted')
    }
  }

  if (path[0] === 'dashboard' && path[1] === 'stats' && method === 'GET') {
    return result(await dashboard.getDashboardStats())
  }
  if (path[0] === 'search' && method === 'GET') {
    return result(await searchService.search(url.searchParams.get('q') ?? ''))
  }
  if (path[0] === 'weather' && method === 'GET') {
    return result(await weather.getWeather())
  }
  if (path[0] === 'sync' && path[1] === 'pulse' && method === 'GET') {
    return result(await getPulse())
  }
  if (path[0] === 'ai' && path[1] === 'chat' && method === 'POST') {
    return result(await ai.chat(payload as ai.AiChatInput))
  }
  if (path[0] === 'audit' && method === 'GET') {
    return result(await audit.listAuditLogs())
  }

  if (path[0] === 'reports') {
    const from = url.searchParams.get('from')
    const to = url.searchParams.get('to')
    if (path[1] === 'sales' && method === 'GET') {
      return result(await reports.getSalesReport(from, to))
    }
    if (path[1] === 'commission' && method === 'GET') {
      return result(await reports.getCommissionReport(from, to))
    }
    if (path[1] === 'stock' && method === 'GET') {
      return result(await reports.getStockReport())
    }
    if (path[1] === 'profit' && method === 'GET') {
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

  if (path[0] === 'bills' && method === 'GET') {
    const lang = url.searchParams.get('lang') ?? 'en'
    if (path[1] === 'farmer' && path.length === 3) {
      return html(await bills.farmerBill(numericId(path[2]), lang))
    }
    if (path[1] === 'buyer' && path.length === 3) {
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
  }

  throw new Error(`API route not found: ${method} /${path.join('/')}`)
}

async function handle(request: NextRequest, context: RouteContext) {
  const method = request.method.toUpperCase()
  const { path } = await context.params
  try {
    const user = await authenticate(request, method, path)
    const dispatched = await dispatch(request, method, path, user)
    if (dispatched instanceof Response) return dispatched
    if (
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) &&
      path.join('/') !== 'auth/login'
    ) {
      await bumpRevision()
    }
    return ok(
      dispatched.data,
      dispatched.message,
      dispatched.status ?? 200,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Request failed'
    const status =
      message === 'Authentication required' ||
      message === 'Invalid or expired token' ||
      message === 'Access Denied' ||
      message.startsWith('Account temporarily locked')
        ? 401
        : message === 'Access denied'
          ? 403
          : message.startsWith('API route not found')
            ? 404
            : 400
    return fail(message, status)
  }
}

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
