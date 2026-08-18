import { prisma } from '@/server/db'
import { amountFromWeight, d, round2, totalWeight } from '@/server/money'
import { getWorkspace } from '@/server/workspace'

export type IntakeStockLotInput = {
  productId: number
  farmerId?: number | null
  dheriId?: number | null
  extraKg: number | string
  ratePer40Kg: number | string
  bagWeightKg?: number | string
  intakeDate?: string | null
  notes?: string | null
  createdById?: bigint
}

export function stockLotDto(row: {
  id: bigint
  productId: bigint
  farmerId: bigint | null
  dheriId: bigint | null
  remainingKg: { toNumber(): number }
  originalKg: { toNumber(): number }
  ratePer40Kg: { toNumber(): number }
  bagWeightKg: { toNumber(): number }
  amountValue: { toNumber(): number }
  intakeDate: Date
  notes: string | null
  product?: { name: string; productCode: string }
  farmer?: { name: string; farmerId: string } | null
  dheri?: { dheriId: string } | null
}) {
  return {
    id: Number(row.id),
    productId: Number(row.productId),
    productName: row.product?.name,
    productCode: row.product?.productCode,
    farmerId: row.farmerId == null ? null : Number(row.farmerId),
    farmerName: row.farmer?.name ?? null,
    farmerCode: row.farmer?.farmerId ?? null,
    dheriId: row.dheriId == null ? null : Number(row.dheriId),
    dheriCode: row.dheri?.dheriId ?? null,
    remainingKg: row.remainingKg.toNumber(),
    originalKg: row.originalKg.toNumber(),
    ratePer40Kg: row.ratePer40Kg.toNumber(),
    bagWeightKg: row.bagWeightKg.toNumber(),
    amountValue: row.amountValue.toNumber(),
    intakeDate: row.intakeDate.toISOString().slice(0, 10),
    notes: row.notes,
  }
}

export async function listStockLots(productId?: number, includeEmpty = false) {
  const rows = await prisma.stockLot.findMany({
    where: {
      ...(includeEmpty ? {} : { remainingKg: { gt: 0 } }),
      ...(productId != null && { productId: BigInt(productId) }),
    },
    include: { product: true, farmer: true, dheri: true },
    orderBy: [{ intakeDate: 'desc' }, { id: 'desc' }],
  })
  return rows.map(stockLotDto)
}

/** Manual top-up kg so leftover Extra KG can form another whole bag */
export async function topUpStockKg(input: {
  productId: number
  extraKg: number | string
  ratePer40Kg?: number | string | null
  bagWeightKg?: number | string | null
  notes?: string | null
  createdById?: bigint
}) {
  const productId = input.productId
  if (productId == null) throw new Error('Product is required')
  const extraKg = round2(input.extraKg ?? 0)
  if (extraKg.lte(0)) throw new Error('Top-up kg must be greater than zero')

  const existing = await prisma.stockLot.findMany({
    where: { productId: BigInt(productId), remainingKg: { gt: 0 } },
    orderBy: [{ intakeDate: 'desc' }, { id: 'desc' }],
    take: 1,
  })
  const rate = round2(
    input.ratePer40Kg ?? existing[0]?.ratePer40Kg?.toNumber() ?? 0,
  )
  const bagWeight = round2(
    input.bagWeightKg ?? existing[0]?.bagWeightKg?.toNumber() ?? 40,
  )

  return intakeExtraKgToStock({
    productId,
    farmerId: null,
    dheriId: null,
    extraKg: extraKg.toNumber(),
    ratePer40Kg: rate.toNumber(),
    bagWeightKg: bagWeight.toNumber(),
    notes:
      input.notes ||
      `Top-up Extra KG to complete bag(s) @ ${bagWeight.toFixed(2)} kg/bag`,
    createdById: input.createdById,
  })
}

export function previewBagsFromKg(totalKg: number, bagWeightKg: number) {
  const bw = bagWeightKg > 0 ? bagWeightKg : 40
  const wholeBags = Math.floor(totalKg / bw)
  const usedKg = wholeBags * bw
  const remainderKg = Math.round((totalKg - usedKg) * 100) / 100
  const kgToNextBag =
    remainderKg > 0 ? Math.round((bw - remainderKg) * 100) / 100 : 0
  return {
    totalKg,
    bagWeightKg: bw,
    wholeBags,
    usedKg,
    remainderKg,
    kgToNextBag,
    nextBagTotal: wholeBags + (kgToNextBag > 0 ? 1 : 0),
  }
}

/** Deposit extra KG from a farmer settlement into stock + stock lot */
export async function intakeExtraKgToStock(input: IntakeStockLotInput) {
  const extraKg = round2(input.extraKg ?? 0)
  if (extraKg.lte(0)) return null
  if (input.productId == null) throw new Error('Product is required for stock extra KG')

  const rate = round2(input.ratePer40Kg ?? 0)
  const bagWeight = round2(input.bagWeightKg ?? 40)
  const amount = amountFromWeight(extraKg, rate)
  const intakeDate = input.intakeDate
    ? new Date(`${input.intakeDate}T00:00:00.000Z`)
    : new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z')

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({
      where: { id: BigInt(input.productId), deleted: false },
    })
    if (!product) throw new Error('Product not found')

    const settings = await tx.businessSettings.findFirst()
    const stock = await tx.stock.upsert({
      where: { productId: product.id },
      update: {},
      create: { productId: product.id, quantity: 0 },
    })
    const previous = d(stock.quantity.toString())
    const next = previous.add(extraKg)
    await tx.stock.update({
      where: { id: stock.id },
      data: {
        quantity: next.toFixed(2),
        lowStockAlert: next.lt(d(settings?.lowStockThreshold?.toString() ?? 100)),
      },
    })

    const lot = await tx.stockLot.create({
      data: {
        productId: product.id,
        farmerId: input.farmerId != null ? BigInt(input.farmerId) : null,
        dheriId: input.dheriId != null ? BigInt(input.dheriId) : null,
        remainingKg: extraKg.toFixed(2),
        originalKg: extraKg.toFixed(2),
        ratePer40Kg: rate.toFixed(2),
        bagWeightKg: bagWeight.toFixed(2),
        amountValue: amount.toFixed(2),
        intakeDate,
        notes:
          input.notes ||
          `Extra KG from farmer settle @ PKR ${rate.toFixed(2)}/40kg`,
      },
      include: { product: true, farmer: true, dheri: true },
    })

    await tx.stockTransaction.create({
      data: {
        productId: product.id,
        transactionType: 'INCOMING',
        quantity: extraKg.toFixed(2),
        previousQuantity: previous.toFixed(2),
        newQuantity: next.toFixed(2),
        referenceType: 'FARMER_EXTRA_KG',
        referenceId: input.dheriId != null ? BigInt(input.dheriId) : lot.id,
        farmerId: input.farmerId != null ? BigInt(input.farmerId) : null,
        dheriId: input.dheriId != null ? BigInt(input.dheriId) : null,
        ratePer40Kg: rate.toFixed(2),
        amountValue: amount.toFixed(2),
        notes: lot.notes,
        createdById: input.createdById,
      },
    })

    return stockLotDto(lot)
  })
}

/**
 * Consume stock lots FIFO to form whole bags.
 * Rate for formed bags = max(highestRateHint, max lot rates consumed).
 */
export async function consumeStockLotsToBags(input: {
  productId: number
  bagWeightKg: number | string
  highestRateHint?: number | string
  createdById?: bigint
  saleId?: number
  maxBags?: number
}) {
  const bagWeight = round2(input.bagWeightKg ?? 40)
  if (bagWeight.lte(0)) throw new Error('Bag weight must be greater than zero')

  const lots = await prisma.stockLot.findMany({
    where: { productId: BigInt(input.productId), remainingKg: { gt: 0 } },
    orderBy: [{ intakeDate: 'asc' }, { id: 'asc' }],
  })
  const totalAvailable = lots.reduce(
    (sum, lot) => sum.add(d(lot.remainingKg.toString())),
    d(0),
  )
  const wholeAvailable = Math.floor(totalAvailable.div(bagWeight).toNumber())
  const bagsFromStock =
    input.maxBags != null && input.maxBags >= 0
      ? Math.min(wholeAvailable, input.maxBags)
      : wholeAvailable
  const kgNeeded = bagWeight.mul(bagsFromStock)
  if (bagsFromStock <= 0) {
    return {
      bagsFromStock: 0,
      kgUsed: 0,
      leftoverKg: totalAvailable.toNumber(),
      ratePer40Kg: round2(input.highestRateHint ?? 0).toNumber(),
      amount: 0,
      bagWeightKg: bagWeight.toNumber(),
    }
  }

  let remainingToTake = kgNeeded
  let highestRate = round2(input.highestRateHint ?? 0)

  await prisma.$transaction(async (tx) => {
    for (const lot of lots) {
      if (remainingToTake.lte(0)) break
      const avail = d(lot.remainingKg.toString())
      const take = avail.lt(remainingToTake) ? avail : remainingToTake
      const lotRate = d(lot.ratePer40Kg.toString())
      if (lotRate.gt(highestRate)) highestRate = round2(lotRate)
      await tx.stockLot.update({
        where: { id: lot.id },
        data: { remainingKg: avail.sub(take).toFixed(2) },
      })
      remainingToTake = remainingToTake.sub(take)
    }

    const settings = await tx.businessSettings.findFirst()
    const stock = await tx.stock.upsert({
      where: { productId: BigInt(input.productId) },
      update: {},
      create: { productId: BigInt(input.productId), quantity: 0 },
    })
    const previous = d(stock.quantity.toString())
    const next = previous.sub(kgNeeded)
    if (next.lt(0)) throw new Error('Insufficient stock KG')
    await tx.stock.update({
      where: { id: stock.id },
      data: {
        quantity: next.toFixed(2),
        lowStockAlert: next.lt(d(settings?.lowStockThreshold?.toString() ?? 100)),
      },
    })
    await tx.stockTransaction.create({
      data: {
        productId: BigInt(input.productId),
        transactionType: 'SALE',
        quantity: kgNeeded.toFixed(2),
        previousQuantity: previous.toFixed(2),
        newQuantity: next.toFixed(2),
        referenceType: 'BATCH_STOCK_BAGS',
        referenceId: input.saleId != null ? BigInt(input.saleId) : null,
        ratePer40Kg: highestRate.toFixed(2),
        amountValue: amountFromWeight(kgNeeded, highestRate).toFixed(2),
        notes: `Formed ${bagsFromStock} bags from stock @ ${bagWeight.toFixed(2)} kg/bag`,
        createdById: input.createdById,
      },
    })
  })

  const leftover = totalAvailable.sub(kgNeeded)
  return {
    bagsFromStock,
    kgUsed: kgNeeded.toNumber(),
    leftoverKg: leftover.toNumber(),
    ratePer40Kg: highestRate.toNumber(),
    amount: amountFromWeight(kgNeeded, highestRate).toNumber(),
    bagWeightKg: bagWeight.toNumber(),
    workspace: getWorkspace(),
  }
}

/** Put consumed Extra KG back onto lots (edit/reverse a stock-bag sale). */
export async function restoreStockKg(input: {
  productId: number
  kg: number | string
  ratePer40Kg?: number | string
  bagWeightKg?: number | string
  saleId?: number
  notes?: string | null
  createdById?: bigint
}) {
  const kg = round2(input.kg)
  if (kg.lte(0)) return { restoredKg: 0 }
  const productId = BigInt(input.productId)
  const rate = round2(input.ratePer40Kg ?? 0)
  const bagWeight = round2(input.bagWeightKg ?? 40)

  await prisma.$transaction(async (tx) => {
    const lots = await tx.stockLot.findMany({
      where: { productId },
      orderBy: [{ intakeDate: 'desc' }, { id: 'desc' }],
    })
    let leftover = kg
    for (const lot of lots) {
      if (leftover.lte(0)) break
      const remaining = d(lot.remainingKg.toString())
      const original = d(lot.originalKg.toString())
      const room = original.sub(remaining)
      if (room.lte(0)) continue
      const add = leftover.lt(room) ? leftover : room
      await tx.stockLot.update({
        where: { id: lot.id },
        data: { remainingKg: remaining.add(add).toFixed(2) },
      })
      leftover = leftover.sub(add)
    }
    if (leftover.gt(0)) {
      await tx.stockLot.create({
        data: {
          productId,
          remainingKg: leftover.toFixed(2),
          originalKg: leftover.toFixed(2),
          ratePer40Kg: rate.toFixed(2),
          bagWeightKg: bagWeight.toFixed(2),
          amountValue: amountFromWeight(leftover, rate).toFixed(2),
          intakeDate: new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z'),
          notes: input.notes || 'Restored Extra KG from edited sale',
        },
      })
    }

    const settings = await tx.businessSettings.findFirst()
    const stock = await tx.stock.upsert({
      where: { productId },
      update: {},
      create: { productId, quantity: 0 },
    })
    const previous = d(stock.quantity.toString())
    const next = previous.add(kg)
    await tx.stock.update({
      where: { id: stock.id },
      data: {
        quantity: next.toFixed(2),
        lowStockAlert: next.lt(d(settings?.lowStockThreshold?.toString() ?? 100)),
      },
    })
    await tx.stockTransaction.create({
      data: {
        productId,
        transactionType: 'INCOMING',
        quantity: kg.toFixed(2),
        previousQuantity: previous.toFixed(2),
        newQuantity: next.toFixed(2),
        referenceType: 'SALE_EDIT_RESTORE',
        referenceId: input.saleId != null ? BigInt(input.saleId) : null,
        ratePer40Kg: rate.toFixed(2),
        amountValue: amountFromWeight(kg, rate).toFixed(2),
        notes: input.notes || 'Restored Extra KG from edited Daily Trade sale',
        createdById: input.createdById,
      },
    })
  })
  return { restoredKg: kg.toNumber() }
}

export function priceForKg(kg: number, ratePer40: number) {
  return amountFromWeight(d(kg), d(ratePer40)).toNumber()
}

export function bagsFromWeight(kg: number, bagWeight: number) {
  const bw = bagWeight || 40
  return {
    wholeBags: Math.floor(kg / bw),
    usedKg: Math.floor(kg / bw) * bw,
    remainderKg: kg - Math.floor(kg / bw) * bw,
  }
}

export { totalWeight }
