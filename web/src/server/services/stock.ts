import type { Prisma, StockTransactionType } from '@prisma/client'
import { prisma } from '@/server/db'
import { d, round2 } from '@/server/money'

type StockRow = Prisma.StockGetPayload<{ include: { product: true } }>
type TransactionRow = Prisma.StockTransactionGetPayload<{
  include: { product: true }
}>

export function stockDto(row: StockRow) {
  return {
    id: Number(row.id),
    productId: Number(row.productId),
    productCode: row.product.productCode,
    productName: row.product.name,
    quantity: row.quantity.toNumber(),
    lowStockAlert: row.lowStockAlert,
  }
}

export function stockTransactionDto(row: TransactionRow) {
  return {
    id: Number(row.id),
    productId: Number(row.productId),
    productName: row.product.name,
    transactionType: row.transactionType,
    quantity: row.quantity.toNumber(),
    previousQuantity: row.previousQuantity.toNumber(),
    newQuantity: row.newQuantity.toNumber(),
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function listStock() {
  const rows = await prisma.stock.findMany({
    include: { product: true },
    orderBy: { product: { name: 'asc' } },
  })
  return rows.map(stockDto)
}

export async function listStockHistory() {
  const rows = await prisma.stockTransaction.findMany({
    include: { product: true },
    orderBy: { createdAt: 'desc' },
  })
  return rows.map(stockTransactionDto)
}

export type StockAdjustmentInput = {
  productId?: number
  quantity?: number | string
  notes?: string | null
  type?: string | null
}

export async function adjustStock(input: StockAdjustmentInput) {
  if (input.productId == null) throw new Error('Product is required')
  const quantity = round2(input.quantity ?? 0)
  if (quantity.lt(0)) throw new Error('Stock quantity cannot be negative')
  const allowed = ['INCOMING', 'OUTGOING', 'ADJUSTMENT', 'TRANSFER', 'SALE']
  const normalized = String(input.type ?? 'ADJUSTMENT').toUpperCase()
  const type = (allowed.includes(normalized)
    ? normalized
    : 'ADJUSTMENT') as StockTransactionType

  await prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({
      where: { id: BigInt(input.productId!), deleted: false },
    })
    if (!product) throw new Error('Product not found')
    const settings = await tx.businessSettings.findFirst()
    const stock = await tx.stock.upsert({
      where: { productId: product.id },
      update: {},
      create: { productId: product.id, quantity: 0 },
    })
    const previous = d(stock.quantity.toString())
    const next =
      type === 'INCOMING'
        ? previous.add(quantity)
        : type === 'OUTGOING' || type === 'SALE'
          ? previous.sub(quantity)
          : quantity
    if (next.lt(0)) throw new Error('Stock quantity cannot be negative')
    await tx.stock.update({
      where: { id: stock.id },
      data: {
        quantity: next.toFixed(2),
        lowStockAlert: next.lt(d(settings?.lowStockThreshold?.toString() ?? 100)),
      },
    })
    await tx.stockTransaction.create({
      data: {
        productId: product.id,
        transactionType: type,
        quantity: quantity.toFixed(2),
        previousQuantity: previous.toFixed(2),
        newQuantity: next.toFixed(2),
        notes: input.notes,
        referenceType: 'MANUAL',
      },
    })
  })

  const row = await prisma.stock.findUnique({
    where: { productId: BigInt(input.productId) },
    include: { product: true },
  })
  if (!row) throw new Error('Stock not found')
  return stockDto(row)
}
