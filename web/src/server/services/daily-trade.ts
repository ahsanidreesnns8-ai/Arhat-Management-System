import { prisma } from '@/server/db'
import { d, round2 } from '@/server/money'
import { createSale } from '@/server/services/sales'
import { consumeStockLotsToBags, listStockLots } from '@/server/services/stock-lots'

function todayDate() {
  return new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z')
}

function dateOnly(value?: string | null) {
  if (!value) return todayDate()
  return new Date(`${value}T00:00:00.000Z`)
}

export async function getOrCreateOpenSession(sessionDate?: string | null, productId?: number | null) {
  const day = dateOnly(sessionDate)
  const existing = await prisma.dailyTradeSession.findFirst({
    where: {
      status: 'OPEN',
      sessionDate: day,
      ...(productId != null ? { productId: BigInt(productId) } : { productId: null }),
    },
    include: { product: true },
  })
  if (existing) return sessionDto(existing)

  const created = await prisma.dailyTradeSession.create({
    data: {
      sessionDate: day,
      productId: productId != null ? BigInt(productId) : null,
      status: 'OPEN',
      detailsJson: { receives: [], sales: [] },
    },
    include: { product: true },
  })
  return sessionDto(created)
}

function sessionDto(row: {
  id: bigint
  sessionDate: Date
  status: string
  productId: bigint | null
  receivedBags: number
  receivedWeightKg: { toNumber(): number }
  soldBags: number
  soldWeightKg: { toNumber(): number }
  stockInKg: { toNumber(): number }
  stockOutKg: { toNumber(): number }
  highestRate: { toNumber(): number }
  detailsJson: unknown
  closedAt: Date | null
  product?: { name: string } | null
}) {
  const receivedBags = row.receivedBags
  const soldBags = row.soldBags
  const stockIn = row.stockInKg.toNumber()
  const stockOut = row.stockOutKg.toNumber()
  return {
    id: Number(row.id),
    sessionDate: row.sessionDate.toISOString().slice(0, 10),
    status: row.status,
    productId: row.productId == null ? null : Number(row.productId),
    productName: row.product?.name ?? null,
    receivedBags,
    receivedWeightKg: row.receivedWeightKg.toNumber(),
    soldBags,
    soldWeightKg: row.soldWeightKg.toNumber(),
    stockInKg: stockIn,
    stockOutKg: stockOut,
    highestRate: row.highestRate.toNumber(),
    balanced: receivedBags === soldBags,
    remainingBags: receivedBags - soldBags,
    details: row.detailsJson,
    closedAt: row.closedAt?.toISOString() ?? null,
  }
}

export async function getDailyBoard(sessionDate?: string | null) {
  const session = await getOrCreateOpenSession(sessionDate)
  const day = dateOnly(sessionDate)
  const start = day
  const end = new Date(day.getTime() + 86_400_000)

  const [dheris, sales, lots, batchInfo] = await Promise.all([
    prisma.dheri.findMany({
      where: { deleted: false, createdAt: { gte: start, lt: end } },
      include: { farmer: true, product: true, dayBatch: true },
      orderBy: [{ dayBatchId: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.sale.findMany({
      where: { deleted: false, saleDate: day },
      include: {
        buyer: true,
        items: { include: { product: true, farmer: true, dheri: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    listStockLots(),
    import('@/server/services/day-batches').then((m) => m.listDayBatches(sessionDate)),
  ])

  const farmerBags = dheris.reduce((s, x) => s + x.numberOfBags, 0)
  const stockBagsSold = sales.reduce(
    (sum, sale) =>
      sum +
      sale.items
        .filter((item) => item.sourceType === 'BUSINESS_STOCK')
        .reduce((s, item) => s + item.numberOfBags, 0),
    0,
  )
  // Equality: farmer bags + bags formed from Extra KG stock = bags sold to buyer
  const receivedBags = farmerBags + stockBagsSold
  const receivedWeight = dheris.reduce((s, x) => s + x.totalWeight.toNumber(), 0)
  const soldBags = sales.reduce((s, x) => s + x.totalBags, 0)
  const soldWeight = sales.reduce((s, x) => s + x.totalWeight.toNumber(), 0)
  const highestRate = dheris.reduce(
    (max, x) => Math.max(max, x.marketRate.toNumber()),
    session.highestRate || 0,
  )
  const stockKg = lots.reduce((s, x) => s + x.remainingKg, 0)

  // Keep session counters in sync with live day data
  await prisma.dailyTradeSession.update({
    where: { id: BigInt(session.id) },
    data: {
      receivedBags,
      receivedWeightKg: receivedWeight.toFixed(2),
      soldBags,
      soldWeightKg: soldWeight.toFixed(2),
      highestRate: highestRate.toFixed(2),
      detailsJson: {
        receives: dheris.map((x) => ({
          id: Number(x.id),
          dheriId: x.dheriId,
          farmer: x.farmer.name,
          product: x.product.name,
          bags: x.numberOfBags,
          weight: x.totalWeight.toNumber(),
          rate: x.marketRate.toNumber(),
          amount: x.totalPrice.toNumber(),
          date: x.createdAt.toISOString().slice(0, 10),
        })),
        sales: sales.map((x) => ({
          id: Number(x.id),
          invoice: x.invoiceNumber,
          buyer: x.buyer.name,
          bags: x.totalBags,
          weight: x.totalWeight.toNumber(),
          amount: x.totalAmount.toNumber(),
        })),
        stockLots: lots,
      },
    },
  })

  const refreshed = await prisma.dailyTradeSession.findUnique({
    where: { id: BigInt(session.id) },
    include: { product: true },
  })

  return {
    session: sessionDto(refreshed!),
    stockLots: lots,
    stockKgAvailable: stockKg,
    farmerBags,
    stockBagsSold,
    receives: dheris.map((x) => ({
      id: Number(x.id),
      dheriId: x.dheriId,
      farmerId: Number(x.farmerId),
      farmerName: x.farmer.name,
      productId: Number(x.productId),
      productName: x.product.name,
      dayBatchId: x.dayBatchId == null ? null : Number(x.dayBatchId),
      batchNumber: x.dayBatch?.batchNumber ?? null,
      bags: x.numberOfBags,
      weightPerBag: x.weightPerBag.toNumber(),
      partialBagWeight: x.partialBagWeight.toNumber(),
      weight: x.totalWeight.toNumber(),
      rate: x.marketRate.toNumber(),
      amount: x.totalPrice.toNumber(),
      date: x.createdAt.toISOString().slice(0, 10),
      sellingStatus: x.sellingStatus,
    })),
    sales: sales.map((x) => ({
      id: Number(x.id),
      invoiceNumber: x.invoiceNumber,
      buyerId: Number(x.buyerId),
      buyerName: x.buyer.name,
      bags: x.totalBags,
      weight: x.totalWeight.toNumber(),
      amount: x.totalAmount.toNumber(),
      items: x.items.map((item) => ({
        id: Number(item.id),
        productName: item.product.name,
        bags: item.numberOfBags,
        weight: item.totalWeight.toNumber(),
        rate: item.rate.toNumber(),
        amount: item.amount.toNumber(),
        sourceType: item.sourceType,
        farmerName: item.farmer?.name,
        dheriId: item.dheriId == null ? null : Number(item.dheriId),
        dheriCode: item.dheri?.dheriId,
      })),
    })),
    batches: batchInfo.batches,
    receivingBatch: batchInfo.receivingBatch,
    activeSellBatch: batchInfo.activeSellBatch,
  }
}

export async function listDailyHistory(limit = 30) {
  const rows = await prisma.dailyTradeSession.findMany({
    where: { status: 'ARCHIVED' },
    include: { product: true },
    orderBy: [{ sessionDate: 'desc' }, { closedAt: 'desc' }],
    take: limit,
  })
  return rows.map(sessionDto)
}

/** Archive current open session into history and open a fresh board */
export async function refreshDailyBoard(sessionDate?: string | null) {
  const board = await getDailyBoard(sessionDate)
  await prisma.dailyTradeSession.update({
    where: { id: BigInt(board.session.id) },
    data: {
      status: 'ARCHIVED',
      closedAt: new Date(),
      detailsJson: {
        ...(typeof board.session.details === 'object' && board.session.details
          ? (board.session.details as object)
          : {}),
        archivedAt: new Date().toISOString(),
        receives: board.receives,
        sales: board.sales,
        stockLots: board.stockLots,
      },
    },
  })
  return getDailyBoard(sessionDate)
}

export type BatchSellInput = {
  buyerId: number
  productId: number
  dheriIds?: number[]
  bagWeightKg?: number | string
  saleDate?: string | null
  paidAmount?: number | string
  notes?: string | null
  includeStockBags?: boolean
}

/**
 * Sell selected (or all unpaid/unsold) dheris for the day to one buyer,
 * optionally forming extra bags from stock KG at the highest rate.
 */
export async function batchSellToBuyer(input: BatchSellInput, userId?: bigint) {
  if (input.buyerId == null) throw new Error('Buyer is required')
  if (input.productId == null) throw new Error('Product is required')

  const board = await getDailyBoard(input.saleDate)
  const { getActiveSellBatch } = await import('@/server/services/day-batches')
  const active = await getActiveSellBatch(input.saleDate)
  if (!active) throw new Error('No unsold dheris in today’s batches')

  const bagWeight = round2(input.bagWeightKg ?? 40)
  const selected = board.receives.filter((r) => {
    if (r.productId !== input.productId) return false
    if (r.dayBatchId !== active.id) return false
    if (input.dheriIds?.length) return input.dheriIds.includes(r.id)
    return r.sellingStatus !== 'SOLD'
  })
  if (!selected.length) {
    throw new Error(
      `No unsold dheris in Batch ${active.batchNumber} for this product — finish this batch first`,
    )
  }

  const farmerBags = selected.reduce((s, x) => s + x.bags, 0)
  const farmerWeight = selected.reduce((s, x) => s + x.weight, 0)
  const farmerAmount = selected.reduce((s, x) => s + x.amount, 0)
  const highestRate = Math.max(
    board.session.highestRate,
    ...selected.map((x) => x.rate),
    ...board.stockLots.filter((l) => l.productId === input.productId).map((l) => l.ratePer40Kg),
  )

  let stockBags = 0
  let stockKgUsed = 0
  let stockAmount = 0
  let stockRate = highestRate

  if (input.includeStockBags !== false) {
    const consumed = await consumeStockLotsToBags({
      productId: input.productId,
      bagWeightKg: bagWeight.toNumber(),
      highestRateHint: highestRate,
      createdById: userId,
    })
    stockBags = consumed.bagsFromStock
    stockKgUsed = consumed.kgUsed
    stockAmount = consumed.amount
    stockRate = consumed.ratePer40Kg
  }

  type SaleLine = {
    productId: number
    sourceType: 'FARMER' | 'BUSINESS_STOCK'
    farmerId?: number
    dheriId?: number
    numberOfBags: number
    weightPerBag: number
    partialBagWeight: number
    rate: number
    skipStockDeduction?: boolean
  }

  const items: SaleLine[] = selected.map((r) => ({
    productId: r.productId,
    sourceType: 'FARMER',
    farmerId: r.farmerId,
    dheriId: r.id,
    numberOfBags: r.bags,
    weightPerBag: r.weightPerBag,
    // Sell whole bags only; Extra KG already lives in stock lots
    partialBagWeight: 0,
    rate: r.rate,
  }))
  if (stockBags > 0) {
    items.push({
      productId: input.productId,
      sourceType: 'BUSINESS_STOCK',
      numberOfBags: stockBags,
      weightPerBag: bagWeight.toNumber(),
      partialBagWeight: 0,
      rate: stockRate,
      skipStockDeduction: true,
    })
  }

  const sale = await createSale(
    {
      buyerId: input.buyerId,
      saleDate: input.saleDate || board.session.sessionDate,
      paidAmount: input.paidAmount ?? 0,
      notes:
        input.notes ||
        `Daily batch sale: ${farmerBags} farmer bags + ${stockBags} stock bags`,
      items,
    },
    userId,
  )

  await prisma.dheri.updateMany({
    where: { id: { in: selected.map((x) => BigInt(x.id)) } },
    data: { sellingStatus: 'SOLD' },
  })

  if (stockKgUsed > 0) {
    await prisma.dailyTradeSession.update({
      where: { id: BigInt(board.session.id) },
      data: {
        stockOutKg: { increment: stockKgUsed.toFixed(2) },
        highestRate: d(Math.max(highestRate, stockRate)).toFixed(2),
      },
    })
  }

  const refreshed = await getDailyBoard(input.saleDate)
  return {
    sale,
    breakdown: {
      farmerBags,
      farmerWeight,
      farmerAmount,
      stockBags,
      stockKgUsed,
      stockAmount,
      stockRate,
      totalBags: farmerBags + stockBags,
      totalAmount: farmerAmount + stockAmount,
      highestRate: Math.max(highestRate, stockRate),
      bagWeightKg: bagWeight.toNumber(),
    },
    board: refreshed,
    message: `Sold ${farmerBags + stockBags} bags to buyer (invoice ${sale.invoiceNumber})`,
  }
}
