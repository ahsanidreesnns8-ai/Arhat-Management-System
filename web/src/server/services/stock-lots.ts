import { prisma } from '@/server/db'
import { amountFromWeight, availableStockKg, d, round2, stockCoversRequestedKg, totalWeight } from '@/server/money'
import { getWorkspace } from '@/server/workspace'

type WorkspaceTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

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
  farmer?: {
    name: string
    farmerId: string
    fatherName?: string | null
    city?: string | null
    phone?: string | null
    address?: string | null
  } | null
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
    farmerFatherName: row.farmer?.fatherName ?? null,
    farmerCity: row.farmer?.city ?? null,
    farmerPhone: row.farmer?.phone ?? null,
    farmerAddress: row.farmer?.address ?? null,
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

export async function deleteStockLot(id: number) {
  return prisma.$transaction(async (tx) => {
    const lot = await tx.stockLot.findFirst({
      where: { id: BigInt(id) },
      include: { product: true, farmer: true, dheri: true },
    })
    if (!lot) throw new Error('Stock entry not found')
    const remaining = d(lot.remainingKg.toString())
    const stock = await tx.stock.findFirst({ where: { productId: lot.productId } })
    if (stock && remaining.gt(0)) {
      const previous = d(stock.quantity.toString())
      const next = previous.sub(remaining)
      const qty = next.lt(0) ? d(0) : next
      const settings = await tx.businessSettings.findFirst()
      await tx.stock.update({
        where: { id: stock.id },
        data: {
          quantity: qty.toFixed(2),
          lowStockAlert: qty.lt(d(settings?.lowStockThreshold?.toString() ?? 100)),
        },
      })
      await tx.stockTransaction.create({
        data: {
          productId: lot.productId,
          transactionType: 'ADJUSTMENT',
          quantity: remaining.toFixed(2),
          previousQuantity: previous.toFixed(2),
          newQuantity: qty.toFixed(2),
          referenceType: 'STOCK_LOT_DELETE',
          referenceId: lot.id,
          farmerId: lot.farmerId,
          dheriId: lot.dheriId,
          notes: `Deleted Extra KG batch · ${lot.product.name}${lot.dheri?.dheriId ? ` · ${lot.dheri.dheriId}` : ''}`,
        },
      })
    }
    await tx.stockLot.delete({ where: { id: lot.id } })
    return { id: Number(lot.id) }
  })
}

async function subtractLotKgFromStock(
  tx: WorkspaceTx,
  productId: bigint,
  removeKg: ReturnType<typeof d>,
) {
  if (removeKg.lte(0)) return
  const stock = await tx.stock.findFirst({ where: { productId } })
  if (!stock) return
  const settings = await tx.businessSettings.findFirst()
  const previous = d(stock.quantity.toString())
  const next = previous.sub(removeKg)
  const qty = next.lt(0) ? d(0) : next
  await tx.stock.update({
    where: { id: stock.id },
    data: {
      quantity: qty.toFixed(2),
      lowStockAlert: qty.lt(d(settings?.lowStockThreshold?.toString() ?? 100)),
    },
  })
}

/** Remove every Extra KG lot and stock qty tied to a farmer. */
export async function purgeStockForFarmer(farmerId: number | bigint) {
  const fid = BigInt(farmerId)
  const dheris = await prisma.dheri.findMany({
    where: { farmerId: fid },
    select: { id: true },
  })
  const dheriIds = dheris.map((row) => row.id)
  const lots = await prisma.stockLot.findMany({
    where: {
      OR: [
        { farmerId: fid },
        ...(dheriIds.length ? [{ dheriId: { in: dheriIds } }] : []),
      ],
    },
  })
  const lotIds = lots.map((lot) => lot.id)
  await prisma.$transaction(async (tx) => {
    const byProduct = new Map<string, ReturnType<typeof d>>()
    for (const lot of lots) {
      const key = String(lot.productId)
      byProduct.set(key, (byProduct.get(key) || d(0)).add(d(lot.remainingKg.toString())))
    }
    for (const [productId, removeKg] of byProduct) {
      await subtractLotKgFromStock(tx, BigInt(productId), removeKg)
    }
    if (lotIds.length) {
      await tx.stockLot.deleteMany({ where: { id: { in: lotIds } } })
    }
    await tx.stockTransaction.deleteMany({
      where: {
        OR: [
          { farmerId: fid },
          ...(dheriIds.length ? [{ dheriId: { in: dheriIds } }] : []),
        ],
      },
    })
  })
}

/** Remove Extra KG lots created from a dheri / farmer product. */
export async function purgeStockForDheri(dheriId: number | bigint) {
  const did = BigInt(dheriId)
  const lots = await prisma.stockLot.findMany({ where: { dheriId: did } })
  await prisma.$transaction(async (tx) => {
    const byProduct = new Map<string, ReturnType<typeof d>>()
    for (const lot of lots) {
      const key = String(lot.productId)
      byProduct.set(key, (byProduct.get(key) || d(0)).add(d(lot.remainingKg.toString())))
    }
    for (const [productId, removeKg] of byProduct) {
      await subtractLotKgFromStock(tx, BigInt(productId), removeKg)
    }
    await tx.stockLot.deleteMany({ where: { dheriId: did } })
    await tx.stockTransaction.deleteMany({ where: { dheriId: did } })
  })
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
  const lotAvailable = lots.reduce(
    (sum, lot) => sum.add(d(lot.remainingKg.toString())),
    d(0),
  )
  const stockRow = await prisma.stock.findFirst({
    where: { productId: BigInt(input.productId) },
  })
  const qtyAvailable = stockRow ? d(stockRow.quantity.toString()) : d(0)
  const totalAvailable = availableStockKg(qtyAvailable, lotAvailable)
  const requestedBags =
    input.maxBags != null && input.maxBags >= 0 ? Math.floor(input.maxBags) : null
  let bagsFromStock: number
  let kgNeeded: ReturnType<typeof d>
  if (requestedBags != null) {
    kgNeeded = totalWeight(requestedBags, bagWeight, 0)
    const cover = stockCoversRequestedKg(totalAvailable.toString(), requestedBags, bagWeight)
    if (!cover.covers) {
      throw new Error(
        `Not enough stock: need ${cover.neededKg.toFixed(2)} kg (${requestedBags} bag(s) × ${bagWeight.toFixed(2)} kg). Available ${cover.availableKg.toFixed(2)} kg.`,
      )
    }
    bagsFromStock = requestedBags
  } else {
    bagsFromStock = Math.max(0, totalAvailable.div(bagWeight).floor().toNumber())
    kgNeeded = totalWeight(bagsFromStock, bagWeight, 0)
  }
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
    const nextRaw = previous.sub(kgNeeded)
    const cover = stockCoversRequestedKg(totalAvailable.toString(), bagsFromStock, bagWeight)
    if (!cover.covers) {
      throw new Error(
        `Not enough stock: need ${kgNeeded.toFixed(2)} kg (${bagsFromStock} bag(s) × ${bagWeight.toFixed(2)} kg). Available ${round2(totalAvailable).toFixed(2)} kg.`,
      )
    }
    const next = nextRaw.lt(0) ? d(0) : nextRaw
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

export async function assertStockCoversBags(
  productId: number,
  bags: number,
  bagWeightKg: number | string,
) {
  if (bags <= 0) return
  const lots = await prisma.stockLot.findMany({
    where: { productId: BigInt(productId), remainingKg: { gt: 0 } },
  })
  const lotKg = lots.reduce((sum, lot) => sum.add(d(lot.remainingKg.toString())), d(0))
  const stockRow = await prisma.stock.findFirst({
    where: { productId: BigInt(productId) },
  })
  const qty = stockRow ? d(stockRow.quantity.toString()) : d(0)
  const available = availableStockKg(qty, lotKg)
  const cover = stockCoversRequestedKg(available.toString(), bags, bagWeightKg)
  if (!cover.covers) {
    throw new Error(
      `Not enough stock: need ${cover.neededKg.toFixed(2)} kg (${bags} bag(s) × ${round2(bagWeightKg).toFixed(2)} kg). Available ${cover.availableKg.toFixed(2)} kg.`,
    )
  }
}

export { stockCoversRequestedKg, totalWeight }
