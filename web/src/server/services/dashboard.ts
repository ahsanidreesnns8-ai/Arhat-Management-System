import { prisma } from '@/server/db'

function utcDayRange() {
  const now = new Date()
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  )
  const end = new Date(start.getTime() + 86_400_000)
  return { start, end }
}

export async function getDashboardStats() {
  const { start, end } = utcDayRange()
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
  ] = await Promise.all([
    prisma.sale.aggregate({
      where: { deleted: false, saleDate: start },
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
  ])
  const todaySales = sales._sum.totalAmount?.toNumber() ?? 0
  return {
    todaySales,
    currentQueue,
    totalFarmers,
    totalBuyers,
    totalDheris,
    currentStock: stock._sum.quantity?.toNumber() ?? 0,
    pendingPayments: outstanding._sum.outstandingBalance?.toNumber() ?? 0,
    revenue: todaySales,
    commission: commission._sum.arhatShare?.toNumber() ?? 0,
    recentActivity: activity.map((item) => ({
      action: item.action,
      entityType: item.entityType,
      description: `${item.action} on ${item.entityType}`,
      timestamp: item.createdAt.toISOString(),
    })),
  }
}
