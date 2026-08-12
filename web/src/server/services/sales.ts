import type { Prisma, SaleSourceType } from '@prisma/client'
import { prisma } from '@/server/db'
import { nextInvoiceCode } from '@/server/ids'
import { amountFromWeight, d, round2, totalWeight } from '@/server/money'

const saleInclude = {
  buyer: true,
  items: {
    include: {
      product: true,
      farmer: true,
      dheri: true,
    },
  },
} as const

type SaleRow = Prisma.SaleGetPayload<{ include: typeof saleInclude }>

export type SaleItemInput = {
  productId?: number
  sourceType?: string
  farmerId?: number | null
  dheriId?: number | null
  numberOfBags?: number | null
  weightPerBag?: number | string | null
  partialBagWeight?: number | string | null
  rate?: number | string | null
}

export type SaleInput = {
  buyerId?: number
  saleDate?: string | Date | null
  paidAmount?: number | string | null
  notes?: string | null
  items?: SaleItemInput[]
}

export function saleDto(row: SaleRow) {
  return {
    id: Number(row.id),
    invoiceNumber: row.invoiceNumber,
    buyerId: Number(row.buyerId),
    buyerName: row.buyer.name,
    buyerCode: row.buyer.buyerId,
    saleDate: row.saleDate.toISOString().slice(0, 10),
    totalBags: row.totalBags,
    totalWeight: row.totalWeight.toNumber(),
    totalAmount: row.totalAmount.toNumber(),
    paidAmount: row.paidAmount.toNumber(),
    paymentStatus: row.paymentStatus,
    notes: row.notes,
    items: row.items.map((item) => ({
      id: Number(item.id),
      productId: Number(item.productId),
      productName: item.product.name,
      sourceType: item.sourceType,
      farmerId: item.farmerId == null ? null : Number(item.farmerId),
      farmerName: item.farmer?.name ?? null,
      dheriId: item.dheriId == null ? null : Number(item.dheriId),
      dheriCode: item.dheri?.dheriId ?? null,
      numberOfBags: item.numberOfBags,
      weightPerBag: item.weightPerBag.toNumber(),
      partialBagWeight: item.partialBagWeight.toNumber(),
      totalWeight: item.totalWeight.toNumber(),
      rate: item.rate.toNumber(),
      amount: item.amount.toNumber(),
    })),
  }
}

function paymentStatus(total: ReturnType<typeof d>, paid: ReturnType<typeof d>) {
  if (paid.lte(0)) return 'PENDING' as const
  if (paid.gte(total)) return 'PAID' as const
  return 'PARTIAL' as const
}

function dateValue(input?: string | Date | null) {
  if (!input) return new Date()
  if (input instanceof Date) return input
  const date = new Date(`${input.slice(0, 10)}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) throw new Error('Invalid sale date')
  return date
}

export async function listSales() {
  const rows = await prisma.sale.findMany({
    where: { deleted: false },
    include: saleInclude,
    orderBy: [{ saleDate: 'desc' }, { createdAt: 'desc' }],
  })
  return rows.map(saleDto)
}

export async function listSalesByBuyer(buyerId: number | bigint) {
  const buyer = await prisma.buyer.findFirst({
    where: { id: BigInt(buyerId), deleted: false },
  })
  if (!buyer) throw new Error('Buyer not found')
  const rows = await prisma.sale.findMany({
    where: { buyerId: BigInt(buyerId), deleted: false },
    include: saleInclude,
    orderBy: [{ saleDate: 'desc' }, { createdAt: 'desc' }],
  })
  return rows.map(saleDto)
}

export async function getSale(id: number | bigint) {
  const row = await prisma.sale.findFirst({
    where: { id: BigInt(id), deleted: false },
    include: saleInclude,
  })
  if (!row) throw new Error('Sale not found')
  return saleDto(row)
}

export async function createSale(input: SaleInput, createdById?: bigint) {
  if (input.buyerId == null) throw new Error('Buyer is required')
  if (!input.items?.length) throw new Error('At least one sale item is required')
  const invoiceNumber = await nextInvoiceCode()

  const saleId = await prisma.$transaction(async (tx) => {
    const buyer = await tx.buyer.findFirst({
      where: { id: BigInt(input.buyerId!), deleted: false },
    })
    if (!buyer) throw new Error('Buyer not found')

    const prepared = []
    for (const item of input.items!) {
      if (item.productId == null) throw new Error('Product is required')
      const product = await tx.product.findFirst({
        where: { id: BigInt(item.productId), deleted: false, active: true },
      })
      if (!product) throw new Error('Product not found')
      const sourceType = String(item.sourceType ?? '').toUpperCase()
      if (!['FARMER', 'BUSINESS_STOCK'].includes(sourceType)) {
        throw new Error(`Invalid source type: ${item.sourceType}`)
      }
      let farmer = null
      let dheri = null
      if (sourceType === 'FARMER') {
        if (item.farmerId == null) {
          throw new Error('Farmer ID is required for farmer-sourced items')
        }
        farmer = await tx.farmer.findFirst({
          where: { id: BigInt(item.farmerId), deleted: false },
        })
        if (!farmer) throw new Error('Farmer not found')
        if (item.dheriId != null) {
          dheri = await tx.dheri.findFirst({
            where: { id: BigInt(item.dheriId), deleted: false },
          })
          if (!dheri) throw new Error('Dheri not found')
        }
      }
      const weight = totalWeight(
        item.numberOfBags ?? 0,
        item.weightPerBag ?? 40,
        item.partialBagWeight ?? 0,
      )
      const amount = amountFromWeight(weight, item.rate ?? 0)
      prepared.push({
        request: item,
        product,
        sourceType: sourceType as SaleSourceType,
        farmer,
        dheri,
        weight,
        amount,
      })
    }

    const totalBags = prepared.reduce(
      (sum, item) => sum + (item.request.numberOfBags ?? 0),
      0,
    )
    const weight = round2(
      prepared.reduce((sum, item) => sum.add(item.weight), d(0)),
    )
    const amount = round2(
      prepared.reduce((sum, item) => sum.add(item.amount), d(0)),
    )
    const paid = round2(input.paidAmount ?? 0)
    if (paid.gt(amount)) throw new Error('Paid amount cannot exceed total amount')

    const sale = await tx.sale.create({
      data: {
        invoiceNumber,
        buyerId: buyer.id,
        saleDate: dateValue(input.saleDate),
        totalBags,
        totalWeight: weight.toFixed(2),
        totalAmount: amount.toFixed(2),
        paidAmount: paid.toFixed(2),
        paymentStatus: paymentStatus(amount, paid),
        notes: input.notes,
        createdById,
      },
    })

    for (const item of prepared) {
      await tx.saleItem.create({
        data: {
          saleId: sale.id,
          productId: item.product.id,
          sourceType: item.sourceType,
          farmerId: item.farmer?.id,
          dheriId: item.dheri?.id,
          numberOfBags: item.request.numberOfBags ?? 0,
          weightPerBag: String(item.request.weightPerBag ?? 40),
          partialBagWeight: String(item.request.partialBagWeight ?? 0),
          totalWeight: item.weight.toFixed(2),
          rate: String(item.request.rate ?? 0),
          amount: item.amount.toFixed(2),
        },
      })

      if (item.sourceType === 'FARMER' && item.farmer) {
        let farmerAmount = item.amount
        let alreadyPosted = false
        if (item.dheri) {
          farmerAmount = item.dheri.farmerReceivable.gt(0)
            ? d(item.dheri.farmerReceivable.toString())
            : item.amount
          alreadyPosted = item.dheri.payablePosted
          await tx.dheri.update({
            where: { id: item.dheri.id },
            data: {
              sellingStatus: item.weight.gte(
                d(item.dheri.totalWeight.toString()),
              )
                ? 'SOLD'
                : 'SELLING',
              ...(!alreadyPosted &&
                farmerAmount.gt(0) && { payablePosted: true }),
            },
          })
        }
        if (!alreadyPosted) {
          await tx.farmer.update({
            where: { id: item.farmer.id },
            data: {
              outstandingBalance: {
                increment: farmerAmount.toFixed(2),
              },
            },
          })
        }
      } else {
        const stock = await tx.stock.upsert({
          where: { productId: item.product.id },
          update: {},
          create: { productId: item.product.id, quantity: 0 },
        })
        const previous = d(stock.quantity.toString())
        if (previous.lt(item.weight)) {
          throw new Error(
            `Insufficient stock for ${item.product.name} (available ${previous} kg, needed ${item.weight} kg)`,
          )
        }
        const next = previous.sub(item.weight)
        const settings = await tx.businessSettings.findFirst()
        await tx.stock.update({
          where: { id: stock.id },
          data: {
            quantity: next.toFixed(2),
            lowStockAlert: next.lt(
              d(settings?.lowStockThreshold?.toString() ?? 100),
            ),
          },
        })
        await tx.stockTransaction.create({
          data: {
            productId: item.product.id,
            transactionType: 'SALE',
            quantity: item.weight.toFixed(2),
            previousQuantity: previous.toFixed(2),
            newQuantity: next.toFixed(2),
            referenceType: 'SALE',
            referenceId: sale.id,
            notes: `Sale ${invoiceNumber}`,
          },
        })
      }
    }

    const unpaid = amount.sub(paid)
    if (unpaid.gt(0)) {
      await tx.buyer.update({
        where: { id: buyer.id },
        data: { outstandingBalance: { increment: unpaid.toFixed(2) } },
      })
    }
    if (paid.gt(0)) {
      await tx.payment.create({
        data: {
          paymentType: 'BUYER',
          buyerId: buyer.id,
          saleId: sale.id,
          amount: paid.toFixed(2),
          paymentMethod: 'CASH',
          paymentDate: sale.saleDate,
          notes: `Initial payment on sale ${invoiceNumber}`,
          createdById,
        },
      })
    }
    await tx.auditLog.create({
      data: {
        userId: createdById,
        action: 'CREATE',
        entityType: 'Sale',
        entityId: sale.id,
        newValue: invoiceNumber,
      },
    })
    return sale.id
  })

  return getSale(saleId)
}

export async function deleteSale(id: number | bigint, userId?: bigint) {
  await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findFirst({
      where: { id: BigInt(id), deleted: false },
      include: { items: { include: { dheri: true } }, buyer: true },
    })
    if (!sale) throw new Error('Sale not found')
    const unpaid = d(sale.totalAmount.toString()).sub(
      d(sale.paidAmount.toString()),
    )
    if (unpaid.gt(0)) {
      await tx.buyer.update({
        where: { id: sale.buyerId },
        data: { outstandingBalance: { decrement: unpaid.toFixed(2) } },
      })
    }
    for (const item of sale.items) {
      if (item.sourceType === 'FARMER' && item.farmerId) {
        let amount = d(item.amount.toString())
        if (item.dheri) {
          if (item.dheri.farmerReceivable.gt(0)) {
            amount = d(item.dheri.farmerReceivable.toString())
          }
          await tx.dheri.update({
            where: { id: item.dheri.id },
            data: { sellingStatus: 'PENDING' },
          })
        }
        await tx.farmer.update({
          where: { id: item.farmerId },
          data: { outstandingBalance: { decrement: amount.toFixed(2) } },
        })
      } else if (item.sourceType === 'BUSINESS_STOCK') {
        const stock = await tx.stock.upsert({
          where: { productId: item.productId },
          update: {},
          create: { productId: item.productId, quantity: 0 },
        })
        const previous = d(stock.quantity.toString())
        const quantity = d(item.totalWeight.toString())
        const next = previous.add(quantity)
        await tx.stock.update({
          where: { id: stock.id },
          data: { quantity: next.toFixed(2), lowStockAlert: false },
        })
        await tx.stockTransaction.create({
          data: {
            productId: item.productId,
            transactionType: 'INCOMING',
            quantity: quantity.toFixed(2),
            previousQuantity: previous.toFixed(2),
            newQuantity: next.toFixed(2),
            referenceType: 'SALE_REVERSAL',
            referenceId: sale.id,
            notes: `Sale deleted: ${sale.invoiceNumber}`,
          },
        })
      }
    }
    await tx.sale.update({
      where: { id: sale.id },
      data: { deleted: true },
    })
    await tx.auditLog.create({
      data: {
        userId,
        action: 'DELETE',
        entityType: 'Sale',
        entityId: sale.id,
        oldValue: sale.invoiceNumber,
      },
    })
  })
}
