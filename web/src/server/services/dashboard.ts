import { prisma } from '@/server/db'

function utcDayRange(offsetDays = 0) {
  const now = new Date()
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offsetDays),
  )
  const end = new Date(start.getTime() + 86_400_000)
  return { start, end }
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export async function getDashboardStats() {
  const { start, end } = utcDayRange(0)
  const weekStart = utcDayRange(-6).start

  const [
    sales,
    currentQueue,
    totalFarmers,
    totalBuyers,
    totalDheris,
    stock,
    outstanding,
    commission,
    activity,
    weekSales,
    stockLots,
  ] = await Promise.all([
    prisma.sale.aggregate({
      where: { deleted: false, saleDate: { gte: start, lt: end } },
      _sum: { totalAmount: true },
    }),
    prisma.queueEntry.count({ where: { status: 'PENDING' } }),
    prisma.farmer.count({ where: { deleted: false } }),
    prisma.buyer.count({ where: { deleted: false } }),
    prisma.dheri.count({ where: { deleted: false } }),
    prisma.stock.aggregate({ _sum: { quantity: true } }),
    prisma.buyer.aggregate({
      where: { deleted: false },
      _sum: { outstandingBalance: true },
    }),
    prisma.dheri.aggregate({
      where: {
        deleted: false,
        sellingStatus: 'SOLD',
        updatedAt: { gte: start, lt: end },
      },
      _sum: { arhatShare: true },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.sale.findMany({
      where: { deleted: false, saleDate: { gte: weekStart, lt: end } },
      select: { saleDate: true, totalAmount: true },
    }),
    prisma.stockLot.aggregate({ _sum: { remainingKg: true } }),
  ])

  const salesByDay = new Map<string, number>()
  for (const row of weekSales) {
    const key = row.saleDate.toISOString().slice(0, 10)
    salesByDay.set(key, (salesByDay.get(key) ?? 0) + row.totalAmount.toNumber())
  }

  const currentStock = stock._sum.quantity?.toNumber() ?? 0
  const extraKg = stockLots._sum.remainingKg?.toNumber() ?? 0
  const weeklyTrend = Array.from({ length: 7 }, (_, index) => {
    const { start: dayStart } = utcDayRange(index - 6)
    const key = dayStart.toISOString().slice(0, 10)
    return {
      name: DAY_NAMES[dayStart.getUTCDay()],
      sales: salesByDay.get(key) ?? 0,
      // Show live stock on today only; prior days stay 0 until history exists
      stock: index === 6 ? currentStock + extraKg : 0,
    }
  })

  const todaySales = sales._sum.totalAmount?.toNumber() ?? 0
  return {
    todaySales,
    currentQueue,
    totalFarmers,
    totalBuyers,
    totalDheris,
    currentStock,
    pendingPayments: outstanding._sum.outstandingBalance?.toNumber() ?? 0,
    revenue: todaySales,
    commission: commission._sum.arhatShare?.toNumber() ?? 0,
    weeklyTrend,
    recentActivity: activity.map((item) => ({
      action: item.action,
      entityType: item.entityType,
      description: `${item.action} on ${item.entityType}`,
      timestamp: item.createdAt.toISOString(),
    })),
  }
}
