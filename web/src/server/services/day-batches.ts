import { prisma } from '@/server/db'
import { d, round2 } from '@/server/money'
import { saveCalculation } from '@/server/services/calculator'
import { createSale } from '@/server/services/sales'

function todayDate() {
  return new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z')
}

function dateOnly(value?: string | null) {
  if (!value) return todayDate()
  return new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`)
}

async function ensureOpenSession(batchDate?: string | null) {
  const day = dateOnly(batchDate)
  const existing = await prisma.dailyTradeSession.findFirst({
    where: { status: 'OPEN', sessionDate: day, productId: null },
  })
  if (existing) return existing
  return prisma.dailyTradeSession.create({
    data: {
      sessionDate: day,
      productId: null,
      status: 'OPEN',
      detailsJson: { receives: [], sales: [] },
    },
  })
}

export function batchDto(row: {
  id: bigint
  batchDate: Date
  batchNumber: number
  status: string
  notes: string | null
  closedAt: Date | null
  createdAt: Date
  _count?: { dheris: number }
  dheris?: Array<{ sellingStatus: string }>
}) {
  const dheris = row.dheris ?? []
  const total = row._count?.dheris ?? dheris.length
  const sold = dheris.filter((x) => x.sellingStatus === 'SOLD').length
  const unsold = Math.max(0, total - sold)
  return {
    id: Number(row.id),
    batchDate: row.batchDate.toISOString().slice(0, 10),
    batchNumber: row.batchNumber,
    status: row.status,
    notes: row.notes,
    closedAt: row.closedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    totalDheris: total,
    soldDheris: sold,
    unsoldDheris: unsold,
    canSell: unsold > 0 && (row.status === 'RECEIVING' || row.status === 'SELLING'),
  }
}

/** Earliest non-closed batch for the day (must finish before later batches sell). */
export async function getActiveSellBatch(batchDate?: string | null) {
  const day = dateOnly(batchDate)
  const row = await prisma.dayBatch.findFirst({
    where: {
      batchDate: day,
      status: { in: ['RECEIVING', 'SELLING'] },
      dheris: { some: { deleted: false, sellingStatus: { not: 'SOLD' } } },
    },
    include: {
      dheris: { where: { deleted: false }, select: { sellingStatus: true } },
      _count: { select: { dheris: true } },
    },
    orderBy: { batchNumber: 'asc' },
  })
  return row ? batchDto(row) : null
}

/** Current batch that accepts new dheris (latest RECEIVING, or create #1). */
export async function getOrCreateReceivingBatch(batchDate?: string | null) {
  await ensureOpenSession(batchDate)
  const day = dateOnly(batchDate)

  const receiving = await prisma.dayBatch.findFirst({
    where: { batchDate: day, status: 'RECEIVING' },
    include: {
      dheris: { where: { deleted: false }, select: { sellingStatus: true } },
      _count: { select: { dheris: true } },
    },
    orderBy: { batchNumber: 'desc' },
  })
  if (receiving) return batchDto(receiving)

  const last = await prisma.dayBatch.findFirst({
    where: { batchDate: day },
    orderBy: { batchNumber: 'desc' },
  })
  const nextNumber = (last?.batchNumber ?? 0) + 1
  const created = await prisma.dayBatch.create({
    data: {
      batchDate: day,
      batchNumber: nextNumber,
      status: 'RECEIVING',
    },
    include: {
      dheris: { where: { deleted: false }, select: { sellingStatus: true } },
      _count: { select: { dheris: true } },
    },
  })
  return batchDto(created)
}

/** Start the next batch for today (Batch 2, 3, …) while prior batches can still sell in order. */
export async function openNextBatch(batchDate?: string | null, notes?: string | null) {
  await ensureOpenSession(batchDate)
  const day = dateOnly(batchDate)
  const last = await prisma.dayBatch.findFirst({
    where: { batchDate: day },
    orderBy: { batchNumber: 'desc' },
  })

  // Close receiving on previous open receiving batch so new dheris go to the new one
  if (last?.status === 'RECEIVING') {
    const hasUnsold = await prisma.dheri.count({
      where: {
        dayBatchId: last.id,
        deleted: false,
        sellingStatus: { not: 'SOLD' },
      },
    })
    await prisma.dayBatch.update({
      where: { id: last.id },
      data: {
        status: hasUnsold > 0 ? 'SELLING' : 'CLOSED',
        ...(hasUnsold === 0 ? { closedAt: new Date() } : {}),
      },
    })
  }

  const created = await prisma.dayBatch.create({
    data: {
      batchDate: day,
      batchNumber: (last?.batchNumber ?? 0) + 1,
      status: 'RECEIVING',
      notes: notes ?? null,
    },
    include: {
      dheris: { where: { deleted: false }, select: { sellingStatus: true } },
      _count: { select: { dheris: true } },
    },
  })
  return batchDto(created)
}

export async function listDayBatches(batchDate?: string | null) {
  const day = dateOnly(batchDate)
  const rows = await prisma.dayBatch.findMany({
    where: { batchDate: day },
    include: {
      dheris: { where: { deleted: false }, select: { sellingStatus: true } },
      _count: { select: { dheris: true } },
    },
    orderBy: { batchNumber: 'asc' },
  })
  const activeSell = await getActiveSellBatch(batchDate)
  return {
    batches: rows.map(batchDto),
    receivingBatch: rows.map(batchDto).find((b) => b.status === 'RECEIVING') ?? null,
    activeSellBatch: activeSell,
  }
}

export async function attachDheriToReceivingBatch(
  dheriId: number | bigint,
  batchDate?: string | null,
) {
  const batch = await getOrCreateReceivingBatch(batchDate)
  await prisma.dheri.update({
    where: { id: BigInt(dheriId) },
    data: { dayBatchId: BigInt(batch.id) },
  })
  return batch
}

async function maybeCloseBatch(batchId: bigint) {
  const unsold = await prisma.dheri.count({
    where: {
      dayBatchId: batchId,
      deleted: false,
      sellingStatus: { not: 'SOLD' },
    },
  })
  if (unsold === 0) {
    await prisma.dayBatch.update({
      where: { id: batchId },
      data: { status: 'CLOSED', closedAt: new Date() },
    })
    return true
  }
  await prisma.dayBatch.update({
    where: { id: batchId },
    data: { status: 'SELLING' },
  })
  return false
}

export type SellDheriAuctionInput = {
  dheriId: number
  buyerId: number
  /** Winning buyer rate per 40 kg */
  ratePer40Kg: number | string
  /** When set, sell from this clicked batch instead of only the earliest unfinished one. */
  dayBatchId?: number | null
  saleDate?: string | null
  paidAmount?: number | string
  notes?: string | null
}

/**
 * Sell one dheri from a day batch to the buyer at the entered rate / 40kg.
 * If dayBatchId is provided (clicked batch), that batch is used.
 * Otherwise the earliest unfinished batch is required.
 */
export async function sellDheriAtAuctionRate(
  input: SellDheriAuctionInput,
  userId?: bigint,
) {
  if (input.dheriId == null) throw new Error('Dheri is required')
  if (input.buyerId == null) throw new Error('Buyer is required')
  const rate = round2(input.ratePer40Kg)
  if (rate.lte(0)) throw new Error('Enter the highest buyer rate per 40kg')

  const dheri = await prisma.dheri.findFirst({
    where: { id: BigInt(input.dheriId), deleted: false },
    include: { farmer: true, product: true, dayBatch: true },
  })
  if (!dheri) throw new Error('Dheri not found')
  if (!dheri.dayBatch) throw new Error('This dheri is not in a day batch')
  if (dheri.farmer.deleted || !dheri.farmer.active) {
    throw new Error(
      `Farmer ${dheri.farmer.name} is inactive/deleted — restore the farmer before selling`,
    )
  }
  if (dheri.sellingStatus === 'SOLD') throw new Error('This dheri is already sold')

  let targetBatch = batchDto({
    ...dheri.dayBatch,
    dheris: [{ sellingStatus: dheri.sellingStatus }],
  })
  if (input.dayBatchId != null) {
    if (Number(dheri.dayBatchId) !== Number(input.dayBatchId)) {
      throw new Error('Selected dheri does not belong to this batch')
    }
  } else {
    const active = await getActiveSellBatch(input.saleDate)
    if (!active) throw new Error('No unsold dheris in today’s batches')
    if (Number(dheri.dayBatchId) !== active.id) {
      throw new Error(
        `Sell Batch ${active.batchNumber} first — or click Batch ${dheri.dayBatch.batchNumber} to sell it`,
      )
    }
    targetBatch = active
  }

  const oldPayable = dheri.farmerReceivable.toNumber()

  // Create the buyer sale first so a failure does not leave half-updated rates.
  const sale = await createSale(
    {
      buyerId: input.buyerId,
      saleDate: input.saleDate || targetBatch.batchDate,
      paidAmount: input.paidAmount ?? 0,
      notes:
        input.notes ||
        `Batch ${targetBatch.batchNumber} auction: ${dheri.dheriId} @ ${rate.toFixed(2)}/40kg`,
      items: [
        {
          productId: Number(dheri.productId),
          sourceType: 'FARMER',
          farmerId: Number(dheri.farmerId),
          dheriId: Number(dheri.id),
          numberOfBags: dheri.numberOfBags,
          weightPerBag: dheri.weightPerBag.toNumber(),
          partialBagWeight: 0,
          rate: rate.toNumber(),
        },
      ],
    },
    userId,
  )

  // Apply winning auction rate and recalculate farmer payable
  await saveCalculation(dheri.id, {
    numberOfBags: dheri.numberOfBags,
    weightPerBag: dheri.weightPerBag.toNumber(),
    partialBagWeight: dheri.partialBagWeight.toNumber(),
    marketRate: rate.toNumber(),
    commissionPercentage: dheri.commissionPercentage.toNumber(),
  })

  const updated = await prisma.dheri.findFirst({ where: { id: dheri.id } })
  if (!updated) throw new Error('Dheri not found after rate update')
  const newPayable = updated.farmerReceivable.toNumber()

  await prisma.$transaction(async (tx) => {
    if (updated.payablePosted) {
      const delta = round2(d(newPayable).sub(oldPayable))
      if (!delta.eq(0)) {
        await tx.farmer.update({
          where: { id: updated.farmerId },
          data: { outstandingBalance: { increment: delta.toFixed(2) } },
        })
      }
    } else if (newPayable > 0) {
      await tx.farmer.update({
        where: { id: updated.farmerId },
        data: { outstandingBalance: { increment: newPayable.toFixed(2) } },
      })
      await tx.dheri.update({
        where: { id: updated.id },
        data: { payablePosted: true },
      })
    }

    const lots = await tx.stockLot.findMany({ where: { dheriId: updated.id } })
    for (const lot of lots) {
      const value = round2(d(lot.remainingKg).div(40).mul(rate))
      await tx.stockLot.update({
        where: { id: lot.id },
        data: {
          ratePer40Kg: rate.toFixed(2),
          amountValue: value.toFixed(2),
        },
      })
    }

    await tx.dheri.update({
      where: { id: dheri.id },
      data: { sellingStatus: 'SOLD' },
    })
  })

  const batchClosed = await maybeCloseBatch(dheri.dayBatchId!)

  const session = await prisma.dailyTradeSession.findFirst({
    where: {
      status: 'OPEN',
      sessionDate: dateOnly(input.saleDate || targetBatch.batchDate),
      productId: null,
    },
  })
  if (session) {
    await prisma.dailyTradeSession.update({
      where: { id: session.id },
      data: {
        highestRate: d(
          Math.max(session.highestRate.toNumber(), rate.toNumber()),
        ).toFixed(2),
      },
    })
  }

  const batches = await listDayBatches(input.saleDate || targetBatch.batchDate)
  return {
    sale,
    dheriId: Number(dheri.id),
    dheriCode: dheri.dheriId,
    batchNumber: targetBatch.batchNumber,
    ratePer40Kg: rate.toNumber(),
    farmerPayable: newPayable,
    batchClosed,
    batches,
    message: batchClosed
      ? `Sold ${dheri.dheriId} at PKR ${rate.toFixed(2)}/40kg — Batch ${targetBatch.batchNumber} complete`
      : `Sold ${dheri.dheriId} at PKR ${rate.toFixed(2)}/40kg to winning buyer`,
  }
}
