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
  createdAt: Date
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
    createdAt: row.createdAt.toISOString(),
  }
}

function parseBatchId(batchId?: number | string | null) {
  if (batchId == null || batchId === '') return null
  const n = Number(batchId)
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * Daily board. When `batchId` is set, receives/sales are only that tapped batch
 * so the UI cannot leak Batch 5 while Batch 1 is selected.
 */
export async function getDailyBoard(
  sessionDate?: string | null,
  batchId?: number | string | null,
) {
  const session = await getOrCreateOpenSession(sessionDate)
  const day = dateOnly(sessionDate)
  const scopedId = parseBatchId(batchId)
  // Batches/sales from before this open session belong to an archived day.
  const liveCutoff = new Date(session.createdAt)

  const [lots, batchInfo] = await Promise.all([
    listStockLots(),
    import('@/server/services/day-batches').then((m) => m.listDayBatches(sessionDate)),
  ])
  const liveBatches =
    scopedId != null
      ? batchInfo.batches.filter((b) => Number(b.id) === scopedId)
      : batchInfo.batches.filter((b) => new Date(b.createdAt) >= liveCutoff)
  const dayBatchIds = liveBatches.map((b) => BigInt(b.id))

  const dheriWhere =
    scopedId != null
      ? { deleted: false, dayBatchId: BigInt(scopedId) }
      : dayBatchIds.length
        ? { deleted: false, dayBatchId: { in: dayBatchIds } }
        : { deleted: false, id: { in: [] as bigint[] } }

  const saleOr: object[] = []
  if (dayBatchIds.length) {
    saleOr.push({ items: { some: { dheri: { dayBatchId: { in: dayBatchIds } } } } })
  }
  if (scopedId == null) {
    saleOr.push({
      saleDate: day,
      createdAt: { gte: liveCutoff },
      items: { some: { sourceType: 'BUSINESS_STOCK' } },
    })
  }

  const saleWhere =
    scopedId != null
      ? {
          deleted: false,
          items: { some: { dheri: { dayBatchId: BigInt(scopedId) } } },
        }
      : saleOr.length
        ? { deleted: false, OR: saleOr }
        : { deleted: false, id: { in: [] as bigint[] } }

  const [dheris, sales] = await Promise.all([
    prisma.dheri.findMany({
      where: dheriWhere,
      include: { farmer: true, product: true, dayBatch: true },
      orderBy: [{ dayBatchId: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.sale.findMany({
      where: saleWhere,
      include: {
        buyer: true,
        items: { include: { product: true, farmer: true, dheri: { include: { dayBatch: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    }),
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

  // Never overwrite day-level session counters from a single-batch query
  let sessionRow = await prisma.dailyTradeSession.findUnique({
    where: { id: BigInt(session.id) },
    include: { product: true },
  })
  if (scopedId == null) {
    sessionRow = await prisma.dailyTradeSession.update({
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
      include: { product: true },
    })
  }

  return {
    scopedBatchId: scopedId,
    session: sessionDto(sessionRow!),
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
      createdAt: x.createdAt.toISOString(),
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
      createdAt: x.createdAt.toISOString(),
      items: x.items
        .filter((item) => {
          if (scopedId == null) return true
          const itemBatch =
            item.dheri?.dayBatchId == null ? null : Number(item.dheri.dayBatchId)
          return itemBatch === scopedId
        })
        .map((item) => ({
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
        dayBatchId: item.dheri?.dayBatchId == null ? null : Number(item.dheri.dayBatchId),
        batchNumber: item.dheri?.dayBatch?.batchNumber ?? null,
      })),
    })).filter((sale) => scopedId == null || sale.items.length > 0),
    batches: scopedId != null ? batchInfo.batches : liveBatches,
    receivingBatch: liveBatches.find((b) => b.status === 'RECEIVING') ?? null,
    activeSellBatch: batchInfo.activeSellBatch,
  }
}

export async function listDailyHistory(limit = 60) {
  const rows = await prisma.dailyTradeSession.findMany({
    where: { status: 'ARCHIVED' },
    include: { product: true },
    orderBy: [{ sessionDate: 'desc' }, { closedAt: 'desc' }],
    take: limit,
  })
  return rows
    .map((row) => {
      const dto = sessionDto(row)
      const details =
        row.detailsJson && typeof row.detailsJson === 'object'
          ? (row.detailsJson as Record<string, unknown>)
          : {}
      const receives = Array.isArray(details.receives) ? details.receives : []
      const sales = Array.isArray(details.sales) ? details.sales : []
      return {
        ...dto,
        receiveCount: receives.length,
        saleCount: sales.length,
        receives,
        sales,
      }
    })
    .filter((row) => row.receiveCount > 0 || row.saleCount > 0)
}

/** Save today’s board to Records, close open batches, and start from zero. */
export async function refreshDailyBoard(sessionDate?: string | null) {
  const day = dateOnly(sessionDate)
  const board = await getDailyBoard(sessionDate)
  const now = new Date()
  const hasWork = board.receives.length > 0 || board.sales.length > 0
  const sessionId = BigInt(board.session.id)

  if (hasWork) {
    await prisma.dailyTradeSession.update({
      where: { id: sessionId },
      data: {
        status: 'ARCHIVED',
        closedAt: now,
        receivedBags: board.session.receivedBags,
        receivedWeightKg: Number(board.session.receivedWeightKg).toFixed(2),
        soldBags: board.session.soldBags,
        soldWeightKg: Number(board.session.soldWeightKg).toFixed(2),
        stockInKg: Number(board.session.stockInKg).toFixed(2),
        stockOutKg: Number(board.session.stockOutKg).toFixed(2),
        detailsJson: {
          archivedAt: now.toISOString(),
          sessionDate: board.session.sessionDate,
          receives: board.receives,
          sales: board.sales,
          stockLots: board.stockLots,
          farmerBags: board.farmerBags,
          stockBagsSold: board.stockBagsSold,
          stockKgAvailable: board.stockKgAvailable,
          batches: board.batches,
        },
      },
    })
  } else {
    await prisma.dailyTradeSession.update({
      where: { id: sessionId },
      data: {
        createdAt: now,
        receivedBags: 0,
        receivedWeightKg: '0.00',
        soldBags: 0,
        soldWeightKg: '0.00',
        detailsJson: { receives: [], sales: [] },
      },
    })
  }

  await prisma.dayBatch.updateMany({
    where: {
      batchDate: day,
      status: { in: ['RECEIVING', 'SELLING'] },
    },
    data: { status: 'CLOSED', closedAt: now },
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

export type ReceiveLineInput = {
  productId: number
  numberOfBags: number
  weightPerBag?: number | string
  extraKg?: number | string
}

export type ReceiveManyInput = {
  farmerId: number
  dayBatchId?: number | null
  truckId?: number | null
  notes?: string | null
  lines: ReceiveLineInput[]
}

/** Receive one or more dheris from the same farmer into a selected day batch. */
export async function receiveManyIntoBatch(
  input: ReceiveManyInput,
  userId?: bigint,
) {
  if (input.farmerId == null) throw new Error('Farmer is required')
  const lines = (input.lines || []).filter((l) => Number(l.numberOfBags) > 0 && l.productId != null)
  if (!lines.length) throw new Error('Add at least one dheri with bags and product')

  const { settle } = await import('@/server/services/arhat')

  const dayBatchId = parseBatchId(input.dayBatchId)
  if (dayBatchId == null) {
    throw new Error('Tap a batch first — dheris are received only into the selected batch')
  }
  const exists = await prisma.dayBatch.findFirst({ where: { id: BigInt(dayBatchId) } })
  if (!exists) throw new Error('Selected batch not found')
  // Completed (all sold) batches can still receive more dheris
  await prisma.dayBatch.update({
    where: { id: BigInt(dayBatchId) },
    data: { status: 'RECEIVING', closedAt: null },
  })

  const created: Array<{ id: number; dheriCode: string; productId: number; bags: number }> = []
  for (const line of lines) {
    const row = await settle(
      {
        settlementType: 'FARMER_PAYABLE',
        farmerId: input.farmerId,
        productId: line.productId,
        numberOfBags: Number(line.numberOfBags),
        weightPerBag: line.weightPerBag ?? 40,
        partialBagWeight: line.extraKg ?? 0,
        marketRate: 0,
        paymentNow: 0,
        truckId: input.truckId ?? undefined,
        notes: input.notes ?? undefined,
        dayBatchId,
      },
      userId,
    )
    if (row.dheriId == null) throw new Error('Receive did not create a dheri')
    created.push({
      id: Number(row.dheriId),
      dheriCode: 'dheriCode' in row ? String(row.dheriCode) : String(row.dheriId),
      productId: Number(line.productId),
      bags: Number(line.numberOfBags),
    })
  }

  const board = await getDailyBoard(null, dayBatchId)
  return {
    created,
    dayBatchId,
    board,
    message: `Received ${created.length} dheri${created.length === 1 ? '' : 's'} into this batch`,
  }
}

export async function nextDeskDheriNumber() {
  const { nextDheriQueueNumber } = await import('@/server/ids')
  const queueNumber = await nextDheriQueueNumber()
  return { queueNumber, dheriCode: String(queueNumber) }
}

export async function listBuyerSoldToday(buyerId: number, sessionDate?: string | null) {
  if (!buyerId) throw new Error('Buyer is required')
  const board = await getDailyBoard(sessionDate)
  const sales = board.sales.filter((s) => Number(s.buyerId) === Number(buyerId))
  return {
    buyerId,
    sales,
    itemCount: sales.reduce((n, s) => n + s.items.length, 0),
    bags: sales.reduce((n, s) => n + s.bags, 0),
    amount: sales.reduce((n, s) => n + s.amount, 0),
  }
}

export type DeskSoldInput = {
  farmerId: number
  productId: number
  dheriCode: string
  farmerBags: number
  weightPerBag?: number | string
  extraKg?: number | string
  farmerRatePer40: number | string
  buyerId: number
  buyerBags: number
  extraBags?: number
  buyerRatePer40: number | string
  stockBags?: number
  stockWeightPerBag?: number | string
  stockRatePer40?: number | string
  notes?: string | null
}

/**
 * One Daily Trade desk action: receive the farmer dheri (extra KG → stock),
 * then mark it sold to the chosen buyer. Buyer total has no commission.
 * Optional extra bags / stock bags are added from Extra KG stock.
 */
export async function markDeskSold(input: DeskSoldInput, userId?: bigint) {
  if (input.farmerId == null) throw new Error('Choose a farmer')
  if (input.buyerId == null) throw new Error('Choose a buyer')
  if (input.productId == null) throw new Error('Choose dheri type')
  const dheriCode = String(input.dheriCode || '').trim()
  if (!dheriCode) throw new Error('Enter the dheri number you assigned at entrance')
  const farmerBags = Number(input.farmerBags) || 0
  const buyerBags = Number(input.buyerBags) || 0
  if (farmerBags <= 0) throw new Error('Farmer bags must be greater than zero')
  if (buyerBags <= 0) throw new Error('Buyer bags must be greater than zero')
  const farmerRate = Number(input.farmerRatePer40) || 0
  const buyerRate = Number(input.buyerRatePer40) || 0
  if (farmerRate <= 0) throw new Error('Enter farmer rate per 40kg')
  if (buyerRate <= 0) throw new Error('Enter buyer rate per 40kg')

  const bagKg = Number(input.weightPerBag) || 40
  const extraKg = Number(input.extraKg) || 0
  const extraBags = Math.max(0, Number(input.extraBags) || 0)
  const stockBags = Math.max(0, Number(input.stockBags) || 0)
  const stockBagKg = Number(input.stockWeightPerBag) || bagKg
  const stockRate = Number(input.stockRatePer40) || buyerRate

  const { settle } = await import('@/server/services/arhat')
  const existing = await prisma.dheri.findFirst({
    where: { dheriId: dheriCode, deleted: false },
    include: { farmer: true, product: true },
  })

  let dheriId: number
  let farmerGross = 0
  let commission = 0
  let farmerNet = 0

  if (existing) {
    if (existing.sellingStatus === 'SOLD') {
      throw new Error(`Dheri ${dheriCode} is already sold`)
    }
    if (Number(existing.farmerId) !== Number(input.farmerId)) {
      throw new Error(`Dheri ${dheriCode} belongs to another farmer`)
    }
    dheriId = Number(existing.id)
    farmerGross = existing.totalPrice.toNumber()
    commission = existing.commissionAmount.toNumber()
    farmerNet = existing.farmerReceivable.toNumber()
  } else {
    const row = await settle(
      {
        settlementType: 'FARMER_PAYABLE',
        farmerId: input.farmerId,
        productId: input.productId,
        dheriCode,
        numberOfBags: farmerBags,
        weightPerBag: bagKg,
        partialBagWeight: extraKg,
        marketRate: farmerRate,
        paymentNow: 0,
        notes: input.notes ?? undefined,
      },
      userId,
    )
    if (row.dheriId == null) throw new Error('Could not create dheri')
    dheriId = Number(row.dheriId)
    farmerGross = Number(row.totalAmount ?? 0)
    commission = Number(row.commission ?? 0)
    farmerNet = Number(row.farmerPayable ?? 0)
  }

  const stockToSell = extraBags + stockBags
  let formed = { bagsFromStock: 0, kgUsed: 0, amount: 0, ratePer40Kg: stockRate }
  if (stockToSell > 0) {
    const { consumeStockLotsToBags } = await import('@/server/services/stock-lots')
    formed = await consumeStockLotsToBags({
      productId: input.productId,
      bagWeightKg: stockBagKg,
      highestRateHint: stockRate,
      createdById: userId,
      maxBags: stockToSell,
    })
    if (formed.bagsFromStock < stockToSell) {
      throw new Error(
        `Not enough Extra KG stock to sell ${stockToSell} extra/stock bags (can form ${formed.bagsFromStock})`,
      )
    }
  }

  const sale = await createSale(
    {
      buyerId: input.buyerId,
      notes:
        input.notes ||
        `Daily Trade sold dheri ${dheriCode} to buyer`,
      items: [
        {
          productId: input.productId,
          sourceType: 'FARMER',
          farmerId: input.farmerId,
          dheriId,
          numberOfBags: buyerBags,
          weightPerBag: bagKg,
          partialBagWeight: 0,
          rate: buyerRate,
        },
        ...(formed.bagsFromStock > 0
          ? [
              {
                productId: input.productId,
                sourceType: 'BUSINESS_STOCK' as const,
                numberOfBags: formed.bagsFromStock,
                weightPerBag: stockBagKg,
                partialBagWeight: 0,
                rate: stockRate,
                skipStockDeduction: true,
              },
            ]
          : []),
      ],
    },
    userId,
  )

  await prisma.dheri.update({
    where: { id: BigInt(dheriId) },
    data: { sellingStatus: 'SOLD' },
  })

  const buyerAmount = sale.items
    .filter((i) => i.sourceType === 'FARMER')
    .reduce((s, i) => s + i.amount, 0)
  const stockAmount = sale.items
    .filter((i) => i.sourceType === 'BUSINESS_STOCK')
    .reduce((s, i) => s + i.amount, 0)

  const board = await getDailyBoard()
  return {
    sale,
    dheriId,
    dheriCode,
    board,
    totals: {
      farmerGross,
      commission,
      farmerNet,
      buyerAmount,
      stockAmount,
      grandTotal: buyerAmount + stockAmount,
    },
    message: `Sold dheri ${dheriCode} — buyer ${sale.invoiceNumber}`,
  }
}


