import { prisma } from '@/server/db'
import { d } from '@/server/money'

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function reportRange(from?: string | null, to?: string | null) {
  const end = to ? new Date(`${to}T00:00:00.000Z`) : new Date()
  const start = from
    ? new Date(`${from}T00:00:00.000Z`)
    : new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 1, end.getUTCDate()))
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('Invalid report date range')
  }
  return {
    start,
    end,
    from: isoDate(start),
    to: isoDate(end),
    endExclusive: new Date(end.getTime() + 86_400_000),
  }
}

export async function getSalesReport(from?: string | null, to?: string | null) {
  const range = reportRange(from, to)
  const rows = await prisma.sale.findMany({
    where: {
      deleted: false,
      saleDate: { gte: range.start, lte: range.end },
    },
    include: { buyer: true },
    orderBy: { saleDate: 'desc' },
  })
  const totalAmount = rows.reduce(
    (sum, row) => sum.add(row.totalAmount.toString()),
    d(0),
  )
  const totalPaid = rows.reduce(
    (sum, row) => sum.add(row.paidAmount.toString()),
    d(0),
  )
  return {
    from: range.from,
    to: range.to,
    totalSales: rows.length,
    totalAmount: totalAmount.toNumber(),
    totalPaid: totalPaid.toNumber(),
    totalOutstanding: totalAmount.sub(totalPaid).toNumber(),
    lines: rows.map((row) => ({
      saleId: Number(row.id),
      invoiceNumber: row.invoiceNumber,
      saleDate: isoDate(row.saleDate),
      buyerName: row.buyer.name,
      totalBags: row.totalBags,
      totalWeight: row.totalWeight.toNumber(),
      totalAmount: row.totalAmount.toNumber(),
      paidAmount: row.paidAmount.toNumber(),
    })),
  }
}

export async function getCommissionReport(
  from?: string | null,
  to?: string | null,
) {
  const range = reportRange(from, to)
  const rows = await prisma.dheri.findMany({
    where: {
      deleted: false,
      createdAt: { gte: range.start, lt: range.endExclusive },
    },
    include: { farmer: true },
    orderBy: { createdAt: 'desc' },
  })
  const total = (key: 'commissionAmount' | 'arhatShare' | 'supervisorShare' | 'laborShare') =>
    rows.reduce((sum, row) => sum.add(row[key].toString()), d(0)).toNumber()
  return {
    from: range.from,
    to: range.to,
    totalCommission: total('commissionAmount'),
    totalArhatShare: total('arhatShare'),
    totalSupervisorShare: total('supervisorShare'),
    totalLaborShare: total('laborShare'),
    lines: rows.map((row) => ({
      dheriId: Number(row.id),
      dheriNumber: row.dheriId,
      farmerName: row.farmer.name,
      totalPrice: row.totalPrice.toNumber(),
      commissionAmount: row.commissionAmount.toNumber(),
      arhatShare: row.arhatShare.toNumber(),
      supervisorShare: row.supervisorShare.toNumber(),
      laborShare: row.laborShare.toNumber(),
    })),
  }
}

export async function getStockReport() {
  const rows = await prisma.stock.findMany({
    include: { product: true },
    orderBy: { product: { name: 'asc' } },
  })
  return {
    totalQuantity: rows
      .reduce((sum, row) => sum.add(row.quantity.toString()), d(0))
      .toNumber(),
    lowStockCount: rows.filter((row) => row.lowStockAlert).length,
    lines: rows.map((row) => ({
      productId: Number(row.productId),
      productCode: row.product.productCode,
      productName: row.product.name,
      quantity: row.quantity.toNumber(),
      lowStockAlert: row.lowStockAlert,
    })),
  }
}

export async function getProfitReport(from?: string | null, to?: string | null) {
  const [sales, commission] = await Promise.all([
    getSalesReport(from, to),
    getCommissionReport(from, to),
  ])
  return {
    from: sales.from,
    to: sales.to,
    totalSales: sales.totalAmount,
    totalCommission: commission.totalCommission,
    estimatedProfit: commission.totalCommission,
  }
}

function csvCell(value: unknown) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

function stampDate(createdAt: Date) {
  return createdAt.toLocaleDateString('en-PK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Karachi',
  })
}

function stampTime(createdAt: Date) {
  return createdAt.toLocaleTimeString('en-PK', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Karachi',
  })
}

export type CommissionHeadKind = 'ARHAT' | 'PALEDARI' | 'TOLAI'

function headShareKey(kind: CommissionHeadKind) {
  if (kind === 'ARHAT') return 'arhatShare' as const
  if (kind === 'PALEDARI') return 'supervisorShare' as const
  return 'laborShare' as const
}

export async function getCommissionHeads() {
  const rows = await prisma.dheri.findMany({
    where: { deleted: false },
    include: { farmer: true, product: true },
    orderBy: { createdAt: 'desc' },
  })
  const build = (kind: CommissionHeadKind, name: string, percentage: number) => {
    const key = headShareKey(kind)
    const history = rows
      .filter((row) => row.commissionAmount.gt(0) || row[key].gt(0))
      .map((row) => ({
        id: Number(row.id),
        dheriNumber: row.dheriId,
        farmerName: row.farmer.name,
        productName: row.product.name,
        bags: row.numberOfBags,
        totalPrice: row.totalPrice.toNumber(),
        commission: row.commissionAmount.toNumber(),
        share: row[key].toNumber(),
        createdAt: row.createdAt.toISOString(),
        date: stampDate(row.createdAt),
        time: stampTime(row.createdAt),
      }))
    const total = history.reduce((sum, row) => sum + row.share, 0)
    return {
      kind,
      name,
      percentage,
      total,
      recentlyAdded: history.slice(0, 12),
      history,
    }
  }
  return {
    commissionPercentage: 4,
    arhat: build('ARHAT', 'Arhat Head', 3),
    paledari: build('PALEDARI', 'Paledari Head', 0.7),
    tolai: build('TOLAI', 'Tolai Head', 0.3),
  }
}

export async function exportSalesCsv(from?: string | null, to?: string | null) {
  const report = await getSalesReport(from, to)
  return [
    'Invoice,Date,Buyer,Bags,Weight,Amount,Paid',
    ...report.lines.map((row) =>
      [
        row.invoiceNumber,
        row.saleDate,
        row.buyerName,
        row.totalBags,
        row.totalWeight,
        row.totalAmount,
        row.paidAmount,
      ]
        .map(csvCell)
        .join(','),
    ),
  ].join('\n')
}
