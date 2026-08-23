import type { Prisma } from '@prisma/client'
import { prisma } from '@/server/db'
import { nextDheriCode, nextDheriQueueNumber, normalizeOwnerCode } from '@/server/ids'
import { calculatePrice, type PriceInput } from '@/server/services/calculator'

const dheriInclude = {
  farmer: { select: { id: true, name: true, farmerId: true } },
  truck: { select: { id: true, truckId: true } },
  product: { select: { id: true, name: true } },
  dayBatch: { select: { id: true, batchNumber: true } },
} as const

type DheriRow = Prisma.DheriGetPayload<{ include: typeof dheriInclude }>

export type DheriInput = PriceInput & {
  farmerId?: number | null
  truckId?: number | null
  productId?: number | null
  dayBatchId?: number | null
  dheriCode?: string | null
  queueNumber?: number | null
  notes?: string | null
}

function retireDheriCode(original: string, id: bigint) {
  const suffix = `#${id.toString()}`
  if (suffix.length >= 20) return id.toString().slice(-20)
  const base = original.replace(/#\d+$/, '').slice(0, 20 - suffix.length)
  return `${base}${suffix}`
}

async function freeDheriCode(dheriId: string) {
  const ghost = await prisma.dheri.findFirst({
    where: { dheriId, deleted: true },
  })
  if (!ghost) return
  await prisma.dheri.update({
    where: { id: ghost.id },
    data: { dheriId: retireDheriCode(dheriId, ghost.id) },
  })
}

export function dheriDto(row: DheriRow) {
  return {
    id: Number(row.id),
    dheriId: row.dheriId,
    farmerId: Number(row.farmerId),
    farmerName: row.farmer.name,
    farmerCode: row.farmer.farmerId,
    truckId: row.truckId == null ? null : Number(row.truckId),
    truckCode: row.truck?.truckId ?? null,
    productId: Number(row.productId),
    productName: row.product.name,
    dayBatchId: row.dayBatchId == null ? null : Number(row.dayBatchId),
    batchNumber: row.dayBatch?.batchNumber ?? null,
    queueNumber: row.queueNumber,
    numberOfBags: row.numberOfBags,
    weightPerBag: row.weightPerBag.toNumber(),
    partialBagWeight: row.partialBagWeight.toNumber(),
    totalWeight: row.totalWeight.toNumber(),
    marketRate: row.marketRate.toNumber(),
    commissionPercentage: row.commissionPercentage.toNumber(),
    totalPrice: row.totalPrice.toNumber(),
    commissionAmount: row.commissionAmount.toNumber(),
    farmerReceivable: row.farmerReceivable.toNumber(),
    supervisorShare: row.supervisorShare.toNumber(),
    laborShare: row.laborShare.toNumber(),
    arhatShare: row.arhatShare.toNumber(),
    sellingStatus: row.sellingStatus,
    payablePosted: row.payablePosted,
    notes: row.notes,
  }
}

export async function listDheris() {
  const rows = await prisma.dheri.findMany({
    where: { deleted: false },
    include: dheriInclude,
    orderBy: { createdAt: 'desc' },
  })
  return rows.map(dheriDto)
}

export async function listDherisByFarmer(farmerId: number | bigint) {
  const farmer = await prisma.farmer.findFirst({
    where: { id: BigInt(farmerId), deleted: false },
  })
  if (!farmer) throw new Error('Farmer not found')
  const rows = await prisma.dheri.findMany({
    where: { farmerId: BigInt(farmerId), deleted: false },
    include: dheriInclude,
    orderBy: { createdAt: 'desc' },
  })
  return rows.map(dheriDto)
}

export async function getDheri(id: number | bigint) {
  const row = await prisma.dheri.findFirst({
    where: { id: BigInt(id), deleted: false },
    include: dheriInclude,
  })
  if (!row) throw new Error('Dheri not found')
  return dheriDto(row)
}

async function validateRelations(input: DheriInput, partial = false) {
  if (!partial || input.farmerId != null) {
    if (input.farmerId == null) throw new Error('Farmer is required')
    const farmer = await prisma.farmer.findFirst({
      where: { id: BigInt(input.farmerId), deleted: false },
    })
    if (!farmer) throw new Error('Farmer not found')
  }
  if (!partial || input.productId != null) {
    if (input.productId == null) throw new Error('Product is required')
    const product = await prisma.product.findFirst({
      where: { id: BigInt(input.productId), deleted: false, active: true },
    })
    if (!product) throw new Error('Product not found')
  }
  if (input.truckId != null) {
    const truck = await prisma.truck.findFirst({
      where: { id: BigInt(input.truckId), deleted: false },
    })
    if (!truck) throw new Error('Truck not found')
  }
}

export async function createDheri(input: DheriInput) {
  await validateRelations(input)
  const result = await calculatePrice(input)
  let dayBatchId =
    input.dayBatchId != null ? BigInt(input.dayBatchId) : null
  if (dayBatchId == null) {
    const { getOrCreateReceivingBatch } = await import(
      '@/server/services/day-batches'
    )
    const batch = await getOrCreateReceivingBatch()
    dayBatchId = BigInt(batch.id)
  }
  const requested = normalizeOwnerCode(input.dheriCode)
  const dheriId = requested || (await nextDheriCode())
  const taken = await prisma.dheri.findFirst({
    where: { dheriId, deleted: false },
  })
  if (taken) throw new Error(`Dheri number ${dheriId} is already used`)
  await freeDheriCode(dheriId)
  const numericQueue = requested && /^\d+$/.test(requested) ? Number(requested) : null
  const queueNumber = input.queueNumber ?? numericQueue ?? (await nextDheriQueueNumber())
  try {
    const row = await prisma.dheri.create({
      data: {
        dheriId,
        farmerId: BigInt(input.farmerId!),
        truckId: input.truckId == null ? null : BigInt(input.truckId),
        productId: BigInt(input.productId!),
        dayBatchId,
        queueNumber,
        numberOfBags: input.numberOfBags ?? 0,
        weightPerBag: String(input.weightPerBag ?? 40),
        partialBagWeight: String(input.partialBagWeight ?? 0),
        totalWeight: result.totalWeight.toFixed(2),
        marketRate: String(input.marketRate ?? 0),
        commissionPercentage: result.commissionPercentage.toFixed(2),
        totalPrice: result.totalAmount.toFixed(2),
        commissionAmount: result.commission.toFixed(2),
        farmerReceivable: result.farmerFinalBalance.toFixed(2),
        supervisorShare: result.munshiNigranShare.toFixed(2),
        laborShare: result.workersShare.toFixed(2),
        arhatShare: result.arhatShare.toFixed(2),
        notes: input.notes,
      },
      include: dheriInclude,
    })
    const { ensureRegisterPartyForAccount } = await import('@/server/services/linked-account')
    await ensureRegisterPartyForAccount(row.farmer.farmerId, row.farmer.name)
    return dheriDto(row)
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === 'P2002') throw new Error(`Dheri number ${dheriId} is already used`)
    throw err
  }
}

export async function updateDheri(id: number | bigint, input: DheriInput) {
  await getDheri(id)
  await validateRelations(input, true)
  const row = await prisma.dheri.update({
    where: { id: BigInt(id) },
    data: {
      ...(input.farmerId != null && { farmerId: BigInt(input.farmerId) }),
      ...(input.productId != null && { productId: BigInt(input.productId) }),
      ...(input.truckId != null && { truckId: BigInt(input.truckId) }),
      ...(input.numberOfBags != null && { numberOfBags: input.numberOfBags }),
      ...(input.weightPerBag != null && {
        weightPerBag: String(input.weightPerBag),
      }),
      ...(input.partialBagWeight != null && {
        partialBagWeight: String(input.partialBagWeight),
      }),
      ...(input.marketRate != null && { marketRate: String(input.marketRate) }),
      ...(input.notes != null && { notes: input.notes }),
    },
    include: dheriInclude,
  })
  return dheriDto(row)
}

export async function deleteDheri(id: number | bigint) {
  const existing = await getDheri(id)
  await prisma.$transaction(async (tx) => {
    const dheri = await tx.dheri.findFirst({
      where: { id: BigInt(existing.id), deleted: false },
    })
    if (!dheri) throw new Error('Dheri not found')

    const payments = await tx.payment.findMany({
      where: { dheriId: dheri.id, paymentType: 'FARMER' },
    })
    for (const payment of payments) {
      if (payment.farmerId) {
        await tx.farmer.update({
          where: { id: payment.farmerId },
          data: { outstandingBalance: { increment: payment.amount.toFixed(2) } },
        })
      }
      await tx.payment.delete({ where: { id: payment.id } })
    }

    if (dheri.payablePosted) {
      await tx.farmer.update({
        where: { id: dheri.farmerId },
        data: { outstandingBalance: { decrement: dheri.farmerReceivable.toFixed(2) } },
      })
    }

    await tx.dheri.update({
      where: { id: dheri.id },
      data: {
        deleted: true,
        dheriId: retireDheriCode(dheri.dheriId, dheri.id),
        commissionAmount: 0,
        arhatShare: 0,
        supervisorShare: 0,
        laborShare: 0,
        payablePosted: false,
      },
    })
  })
}
