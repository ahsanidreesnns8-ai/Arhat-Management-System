import { prisma } from '@/server/db'

export { normalizeAccountKey } from '@/lib/account-key'

export function nextCode(codes: string[], prefix: string, separator = '') {
  const maximum = codes.reduce((max, code) => {
    if (!code.startsWith(prefix)) return max
    const suffix = code.slice(prefix.length + separator.length)
    return /^\d+$/.test(suffix) ? Math.max(max, Number(suffix)) : max
  }, 0)
  return `${prefix}${separator}${String(maximum + 1).padStart(5, '0')}`
}

export function isAutoRegisterCode(value: string | null | undefined) {
  return /^RG\d+$/i.test(String(value ?? '').trim())
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

/** Move a soft-deleted owner ID aside so a new person can reuse the same ID. */
export function retireOwnerCode(original: string, id: bigint, maxLen = 20) {
  const suffix = `#${id.toString()}`
  if (suffix.length >= maxLen) return id.toString().slice(-maxLen)
  const base = original.replace(/#\d+$/, '').slice(0, maxLen - suffix.length)
  return `${base}${suffix}`
}

export async function freeFarmerCode(farmerId: string) {
  const code = normalizeOwnerCode(farmerId)
  if (!code) return
  const ghost = await prisma.farmer.findFirst({
    where: { farmerId: code, deleted: true },
  })
  if (!ghost) return
  await prisma.farmer.update({
    where: { id: ghost.id },
    data: { farmerId: retireOwnerCode(code, ghost.id) },
  })
}

export async function freeBuyerCode(buyerId: string) {
  const code = normalizeOwnerCode(buyerId)
  if (!code) return
  const ghost = await prisma.buyer.findFirst({
    where: { buyerId: code, deleted: true },
  })
  if (!ghost) return
  await prisma.buyer.update({
    where: { id: ghost.id },
    data: { buyerId: retireOwnerCode(code, ghost.id) },
  })
}

export async function retireFarmerRecord(id: number | bigint) {
  const row = await prisma.farmer.findFirst({ where: { id: BigInt(id) } })
  if (!row) return
  if (row.deleted && row.farmerId.includes('#')) return
  await freeFarmerCode(row.farmerId)
  await prisma.farmer.update({
    where: { id: row.id },
    data: { deleted: true, farmerId: retireOwnerCode(row.farmerId, row.id) },
  })
}

export async function retireBuyerRecord(id: number | bigint) {
  const row = await prisma.buyer.findFirst({ where: { id: BigInt(id) } })
  if (!row) return
  if (row.deleted && row.buyerId.includes('#')) return
  await freeBuyerCode(row.buyerId)
  await prisma.buyer.update({
    where: { id: row.id },
    data: { deleted: true, buyerId: retireOwnerCode(row.buyerId, row.id) },
  })
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
