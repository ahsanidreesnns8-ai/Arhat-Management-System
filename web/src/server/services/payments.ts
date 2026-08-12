import type { PaymentMethod, Prisma } from '@prisma/client'
import { prisma } from '@/server/db'
import { d, round2 } from '@/server/money'

const paymentInclude = {
  farmer: true,
  buyer: true,
  sale: true,
  dheri: true,
} as const

type PaymentRow = Prisma.PaymentGetPayload<{ include: typeof paymentInclude }>

export type PaymentInput = {
  paymentType?: string
  farmerId?: number | null
  buyerId?: number | null
  saleId?: number | null
  dheriId?: number | null
  amount?: number | string | null
  paymentMethod?: string | null
  paymentDate?: string | Date | null
  referenceNumber?: string | null
  notes?: string | null
}

export function paymentDto(row: PaymentRow) {
  return {
    id: Number(row.id),
    paymentType: row.paymentType,
    farmerId: row.farmerId == null ? null : Number(row.farmerId),
    farmerName: row.farmer?.name ?? null,
    farmerCode: row.farmer?.farmerId ?? null,
    buyerId: row.buyerId == null ? null : Number(row.buyerId),
    buyerName: row.buyer?.name ?? null,
    buyerCode: row.buyer?.buyerId ?? null,
    saleId: row.saleId == null ? null : Number(row.saleId),
    invoiceNumber: row.sale?.invoiceNumber ?? null,
    saleInvoiceNumber: row.sale?.invoiceNumber ?? null,
    dheriId: row.dheriId == null ? null : Number(row.dheriId),
    dheriCode: row.dheri?.dheriId ?? null,
    amount: row.amount.toNumber(),
    paymentMethod: row.paymentMethod,
    paymentDate: row.paymentDate.toISOString().slice(0, 10),
    referenceNumber: row.referenceNumber,
    notes: row.notes,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  }
}

function parseDate(value?: string | Date | null) {
  if (!value) return new Date()
  if (value instanceof Date) return value
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) throw new Error('Invalid payment date')
  return date
}

function parseMethod(value?: string | null): PaymentMethod {
  const method = String(value ?? 'CASH').toUpperCase()
  return ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'OTHER'].includes(method)
    ? (method as PaymentMethod)
    : 'CASH'
}

function salePaymentStatus(total: ReturnType<typeof d>, paid: ReturnType<typeof d>) {
  if (paid.lte(0)) return 'PENDING' as const
  return paid.gte(total) ? ('PAID' as const) : ('PARTIAL' as const)
}

async function fetchPayment(id: bigint) {
  const row = await prisma.payment.findUnique({
    where: { id },
    include: paymentInclude,
  })
  if (!row) throw new Error('Payment not found')
  return row
}

export async function listPayments() {
  const rows = await prisma.payment.findMany({
    include: paymentInclude,
    orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
  })
  return rows.map(paymentDto)
}

export async function listPaymentsByFarmer(farmerId: number | bigint) {
  const rows = await prisma.payment.findMany({
    where: { farmerId: BigInt(farmerId) },
    include: paymentInclude,
    orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
  })
  return rows.map(paymentDto)
}

export async function listPaymentsByBuyer(buyerId: number | bigint) {
  const rows = await prisma.payment.findMany({
    where: { buyerId: BigInt(buyerId) },
    include: paymentInclude,
    orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
  })
  return rows.map(paymentDto)
}

export async function listPaymentsByDheri(
  dheriId: number | bigint,
  date?: string | null,
) {
  const rows = await prisma.payment.findMany({
    where: {
      dheriId: BigInt(dheriId),
      ...(date && { paymentDate: parseDate(date) }),
    },
    include: paymentInclude,
    orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
  })
  return rows.map(paymentDto)
}

export async function listPaymentsByDate(date: string) {
  const rows = await prisma.payment.findMany({
    where: { paymentDate: parseDate(date) },
    include: paymentInclude,
    orderBy: { createdAt: 'desc' },
  })
  return rows.map(paymentDto)
}

export async function getPayment(id: number | bigint) {
  return paymentDto(await fetchPayment(BigInt(id)))
}

export async function recordPayment(input: PaymentInput, createdById?: bigint) {
  const type = String(input.paymentType ?? '').toUpperCase()
  if (!['FARMER', 'BUYER'].includes(type)) {
    throw new Error(`Invalid payment type: ${input.paymentType}`)
  }
  const amount = round2(input.amount ?? 0)
  if (amount.lte(0)) throw new Error('Payment amount must be greater than zero')

  const id = await prisma.$transaction(async (tx) => {
    let farmerId: bigint | undefined
    let buyerId: bigint | undefined
    let saleId: bigint | undefined
    let dheriId: bigint | undefined

    if (input.dheriId != null) {
      const dheri = await tx.dheri.findFirst({
        where: { id: BigInt(input.dheriId), deleted: false },
      })
      if (!dheri) throw new Error('Dheri not found')
      dheriId = dheri.id
    }

    if (type === 'FARMER') {
      if (input.farmerId == null) {
        throw new Error('Farmer ID is required for farmer payments')
      }
      const farmer = await tx.farmer.findFirst({
        where: { id: BigInt(input.farmerId), deleted: false },
      })
      if (!farmer) throw new Error('Farmer not found')
      const outstanding = d(farmer.outstandingBalance.toString())
      if (amount.gt(outstanding)) {
        throw new Error(
          `Amount exceeds farmer outstanding balance of PKR ${outstanding}`,
        )
      }
      farmerId = farmer.id
      await tx.farmer.update({
        where: { id: farmer.id },
        data: { outstandingBalance: outstanding.sub(amount).toFixed(2) },
      })
    } else {
      if (input.buyerId == null) {
        throw new Error('Buyer ID is required for buyer payments')
      }
      const buyer = await tx.buyer.findFirst({
        where: { id: BigInt(input.buyerId), deleted: false },
      })
      if (!buyer) throw new Error('Buyer not found')
      const outstanding = d(buyer.outstandingBalance.toString())
      if (amount.gt(outstanding)) {
        throw new Error(
          `Amount exceeds buyer outstanding balance of PKR ${outstanding}`,
        )
      }
      buyerId = buyer.id
      await tx.buyer.update({
        where: { id: buyer.id },
        data: { outstandingBalance: outstanding.sub(amount).toFixed(2) },
      })
      if (input.saleId != null) {
        const sale = await tx.sale.findFirst({
          where: { id: BigInt(input.saleId), deleted: false },
        })
        if (!sale) throw new Error('Sale not found')
        const total = d(sale.totalAmount.toString())
        const paid = d(sale.paidAmount.toString())
        const remaining = total.sub(paid)
        if (amount.gt(remaining)) {
          throw new Error(
            `Amount exceeds sale remaining balance of PKR ${remaining}`,
          )
        }
        const newPaid = paid.add(amount)
        saleId = sale.id
        await tx.sale.update({
          where: { id: sale.id },
          data: {
            paidAmount: newPaid.toFixed(2),
            paymentStatus: salePaymentStatus(total, newPaid),
          },
        })
      }
    }

    const payment = await tx.payment.create({
      data: {
        paymentType: type as 'FARMER' | 'BUYER',
        farmerId,
        buyerId,
        saleId,
        dheriId,
        amount: amount.toFixed(2),
        paymentMethod: parseMethod(input.paymentMethod),
        paymentDate: parseDate(input.paymentDate),
        referenceNumber: input.referenceNumber,
        notes: input.notes,
        createdById,
      },
    })
    await tx.auditLog.create({
      data: {
        userId: createdById,
        action: 'CREATE',
        entityType: 'Payment',
        entityId: payment.id,
        newValue: amount.toFixed(2),
      },
    })
    return payment.id
  })
  return paymentDto(await fetchPayment(id))
}

export async function updatePayment(
  id: number | bigint,
  input: PaymentInput,
  userId?: bigint,
) {
  const newAmount = round2(input.amount ?? 0)
  if (newAmount.lte(0)) throw new Error('Payment amount must be greater than zero')
  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: BigInt(id) } })
    if (!payment) throw new Error('Payment not found')
    const oldAmount = d(payment.amount.toString())

    if (payment.paymentType === 'FARMER') {
      if (!payment.farmerId) throw new Error('Farmer not linked to this payment')
      const farmer = await tx.farmer.findFirst({
        where: { id: payment.farmerId, deleted: false },
      })
      if (!farmer) throw new Error('Farmer not found')
      const available = d(farmer.outstandingBalance.toString()).add(oldAmount)
      if (newAmount.gt(available)) {
        throw new Error(
          `Amount exceeds farmer remaining to pay of PKR ${available} (includes this payment after reverse)`,
        )
      }
      await tx.farmer.update({
        where: { id: farmer.id },
        data: { outstandingBalance: available.sub(newAmount).toFixed(2) },
      })
    } else {
      if (!payment.buyerId) throw new Error('Buyer not linked to this payment')
      const buyer = await tx.buyer.findFirst({
        where: { id: payment.buyerId, deleted: false },
      })
      if (!buyer) throw new Error('Buyer not found')
      const available = d(buyer.outstandingBalance.toString()).add(oldAmount)
      if (newAmount.gt(available)) {
        throw new Error(
          `Amount exceeds buyer remaining receivable of PKR ${available} (includes this payment after reverse)`,
        )
      }
      await tx.buyer.update({
        where: { id: buyer.id },
        data: { outstandingBalance: available.sub(newAmount).toFixed(2) },
      })
      if (payment.saleId) {
        const previousSale = await tx.sale.findFirst({
          where: { id: payment.saleId, deleted: false },
        })
        if (previousSale) {
          const total = d(previousSale.totalAmount.toString())
          const paid = d(previousSale.paidAmount.toString())
            .sub(oldAmount)
            .max(0)
          await tx.sale.update({
            where: { id: previousSale.id },
            data: {
              paidAmount: paid.toFixed(2),
              paymentStatus: salePaymentStatus(total, paid),
            },
          })
        }
      }
      if (input.saleId != null) {
        const sale = await tx.sale.findFirst({
          where: { id: BigInt(input.saleId), deleted: false },
        })
        if (!sale) throw new Error('Sale not found')
        const total = d(sale.totalAmount.toString())
        const paid = d(sale.paidAmount.toString())
        if (newAmount.gt(total.sub(paid))) {
          throw new Error(
            `Amount exceeds sale remaining balance of PKR ${total.sub(paid)}`,
          )
        }
        const nextPaid = paid.add(newAmount)
        await tx.sale.update({
          where: { id: sale.id },
          data: {
            paidAmount: nextPaid.toFixed(2),
            paymentStatus: salePaymentStatus(total, nextPaid),
          },
        })
      }
    }

    let dheriId = payment.dheriId
    if (input.dheriId != null) {
      const dheri = await tx.dheri.findFirst({
        where: { id: BigInt(input.dheriId), deleted: false },
      })
      if (!dheri) throw new Error('Dheri not found')
      dheriId = dheri.id
    }
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        amount: newAmount.toFixed(2),
        paymentMethod: parseMethod(input.paymentMethod),
        ...(input.paymentDate != null && {
          paymentDate: parseDate(input.paymentDate),
        }),
        ...(input.referenceNumber != null && {
          referenceNumber: input.referenceNumber,
        }),
        ...(input.notes != null && { notes: input.notes }),
        dheriId,
        ...(payment.paymentType === 'BUYER' && {
          saleId: input.saleId == null ? null : BigInt(input.saleId),
        }),
      },
    })
    await tx.auditLog.create({
      data: {
        userId,
        action: 'UPDATE',
        entityType: 'Payment',
        entityId: payment.id,
        oldValue: oldAmount.toFixed(2),
        newValue: newAmount.toFixed(2),
      },
    })
  })
  return paymentDto(await fetchPayment(BigInt(id)))
}

export async function deletePayment(id: number | bigint, userId?: bigint) {
  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: BigInt(id) } })
    if (!payment) throw new Error('Payment not found')
    const amount = d(payment.amount.toString())
    if (payment.paymentType === 'FARMER' && payment.farmerId) {
      await tx.farmer.update({
        where: { id: payment.farmerId },
        data: { outstandingBalance: { increment: amount.toFixed(2) } },
      })
    } else if (payment.paymentType === 'BUYER' && payment.buyerId) {
      await tx.buyer.update({
        where: { id: payment.buyerId },
        data: { outstandingBalance: { increment: amount.toFixed(2) } },
      })
      if (payment.saleId) {
        const sale = await tx.sale.findFirst({
          where: { id: payment.saleId, deleted: false },
        })
        if (sale) {
          const total = d(sale.totalAmount.toString())
          const paid = d(sale.paidAmount.toString()).sub(amount).max(0)
          await tx.sale.update({
            where: { id: sale.id },
            data: {
              paidAmount: paid.toFixed(2),
              paymentStatus: salePaymentStatus(total, paid),
            },
          })
        }
      }
    }
    await tx.payment.delete({ where: { id: payment.id } })
    await tx.auditLog.create({
      data: {
        userId,
        action: 'DELETE',
        entityType: 'Payment',
        entityId: payment.id,
        oldValue: amount.toFixed(2),
      },
    })
  })
}
