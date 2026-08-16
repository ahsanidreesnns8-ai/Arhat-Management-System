import { prisma } from '@/server/db'

export function nextCode(codes: string[], prefix: string, separator = '') {
  const maximum = codes.reduce((max, code) => {
    if (!code.startsWith(prefix)) return max
    const suffix = code.slice(prefix.length + separator.length)
    return /^\d+$/.test(suffix) ? Math.max(max, Number(suffix)) : max
  }, 0)
  return `${prefix}${separator}${String(maximum + 1).padStart(5, '0')}`
}

export async function nextFarmerCode() {
  const rows = await prisma.farmer.findMany({ select: { farmerId: true } })
  return nextCode(rows.map((row) => row.farmerId), 'FRM')
}

export async function nextBuyerCode() {
  const rows = await prisma.buyer.findMany({ select: { buyerId: true } })
  return nextCode(rows.map((row) => row.buyerId), 'BYR')
}

export async function nextTruckCode() {
  const rows = await prisma.truck.findMany({ select: { truckId: true } })
  return nextCode(rows.map((row) => row.truckId), 'TRK')
}

export async function nextDheriCode() {
  const rows = await prisma.dheri.findMany({ select: { dheriId: true } })
  return nextCode(rows.map((row) => row.dheriId), 'DHR')
}

export function normalizeOwnerCode(value: string | null | undefined) {
  return String(value ?? '').trim()
}

export async function nextDheriQueueNumber() {
  const last = await prisma.dheri.findFirst({
    where: { deleted: false, queueNumber: { not: null } },
    orderBy: { queueNumber: 'desc' },
    select: { queueNumber: true },
  })
  return (last?.queueNumber ?? 0) + 1
}

export async function nextInvoiceCode() {
  const rows = await prisma.sale.findMany({ select: { invoiceNumber: true } })
  return nextCode(rows.map((row) => row.invoiceNumber), 'INV', '-')
}
