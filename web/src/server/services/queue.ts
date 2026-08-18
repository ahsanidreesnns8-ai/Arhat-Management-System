import type { Prisma, QueueStatus, SellingStatus } from '@prisma/client'
import { prisma } from '@/server/db'

const queueInclude = {
  dheri: { include: { farmer: true, product: true } },
} as const

type QueueRow = Prisma.QueueEntryGetPayload<{ include: typeof queueInclude }>

export function queueDto(row: QueueRow) {
  return {
    id: Number(row.id),
    queueNumber: row.queueNumber,
    dheriId: Number(row.dheriId),
    dheriCode: row.dheri.dheriId,
    farmerName: row.dheri.farmer.name,
    productName: row.dheri.product.name,
    status: row.status,
    position: row.position,
    numberOfBags: row.dheri.numberOfBags,
  }
}

async function listByStatus(status: QueueStatus) {
  const rows = await prisma.queueEntry.findMany({
    where: { status },
    include: queueInclude,
    orderBy: { position: 'asc' },
  })
  return rows.map(queueDto)
}

export const listPendingQueue = () => listByStatus('PENDING')
export const listActiveQueue = () => listByStatus('ACTIVE')
export const listCompletedQueue = () => listByStatus('COMPLETED')

export async function addToQueue(dheriId: number | bigint) {
  const id = await prisma.$transaction(async (tx) => {
    const dheri = await tx.dheri.findFirst({
      where: { id: BigInt(dheriId), deleted: false },
    })
    if (!dheri) throw new Error('Dheri not found')
    if (await tx.queueEntry.findUnique({ where: { dheriId: dheri.id } })) {
      throw new Error('Dheri already in queue')
    }
    const [lastNumber, lastPosition] = await Promise.all([
      tx.queueEntry.findFirst({ orderBy: { queueNumber: 'desc' } }),
      tx.queueEntry.findFirst({ orderBy: { position: 'desc' } }),
    ])
    const queueNumber = (lastNumber?.queueNumber ?? 0) + 1
    const row = await tx.queueEntry.create({
      data: {
        dheriId: dheri.id,
        queueNumber,
        position: (lastPosition?.position ?? 0) + 1,
      },
    })
    await tx.dheri.update({
      where: { id: dheri.id },
      data: { queueNumber, sellingStatus: 'IN_QUEUE' },
    })
    return row.id
  })
  return getQueueEntry(id)
}

async function getQueueEntry(id: bigint) {
  const row = await prisma.queueEntry.findUnique({
    where: { id },
    include: queueInclude,
  })
  if (!row) throw new Error('Queue entry not found')
  return queueDto(row)
}

async function transition(
  id: number | bigint,
  status: QueueStatus,
  sellingStatus: SellingStatus,
) {
  const existing = await prisma.queueEntry.findUnique({
    where: { id: BigInt(id) },
  })
  if (!existing) throw new Error('Queue entry not found')
  await prisma.$transaction([
    prisma.queueEntry.update({
      where: { id: existing.id },
      data: {
        status,
        ...(status === 'ACTIVE' && { startedAt: new Date() }),
        ...(status === 'COMPLETED' && { completedAt: new Date() }),
      },
    }),
    prisma.dheri.update({
      where: { id: existing.dheriId },
      data: { sellingStatus },
    }),
  ])
  return getQueueEntry(existing.id)
}

export const activateQueue = (id: number | bigint) =>
  transition(id, 'ACTIVE', 'SELLING')
export const completeQueue = (id: number | bigint) =>
  transition(id, 'COMPLETED', 'SOLD')
export const cancelQueue = (id: number | bigint) =>
  transition(id, 'CANCELLED', 'CANCELLED')
