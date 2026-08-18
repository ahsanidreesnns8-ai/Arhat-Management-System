import type { Prisma } from '@prisma/client'
import { prisma } from '@/server/db'
import { normalizeOwnerCode } from '@/server/ids'
import type { PartyInput } from '@/server/services/farmers'
import { listPaymentsByBuyer } from '@/server/services/payments'
import { listSalesByBuyer } from '@/server/services/sales'

type BuyerRow = Prisma.BuyerGetPayload<{
  include: { sales: true; payments: true }
}>

export function buyerDto(buyer: BuyerRow) {
  return {
    id: Number(buyer.id),
    buyerId: buyer.buyerId,
    name: buyer.name,
    fatherName: buyer.fatherName,
    cnic: buyer.cnic,
    phone: buyer.phone,
    address: buyer.address,
    city: buyer.city,
    outstandingBalance: buyer.outstandingBalance.toNumber(),
    totalBilled: buyer.sales.reduce(
      (sum, item) => sum + item.totalAmount.toNumber(),
      0,
    ),
    totalPaid: buyer.payments.reduce(
      (sum, item) => sum + item.amount.toNumber(),
      0,
    ),
    notes: buyer.notes,
    active: buyer.active,
  }
}

const includeTotals = {
  sales: { where: { deleted: false } },
  payments: true,
} as const

export async function listBuyers() {
  const rows = await prisma.buyer.findMany({
    where: { deleted: false },
    include: includeTotals,
    orderBy: { createdAt: 'desc' },
  })
  return rows.map(buyerDto)
}

export async function getBuyer(id: number | bigint) {
  const row = await prisma.buyer.findFirst({
    where: { id: BigInt(id), deleted: false },
    include: includeTotals,
  })
  if (!row) throw new Error('Buyer not found')
  return buyerDto(row)
}

export async function createBuyer(input: PartyInput) {
  if (!input.name?.trim()) throw new Error('Buyer name is required')
  const buyerId = normalizeOwnerCode(input.code ?? input.buyerId)
  if (!buyerId) throw new Error('Buyer ID is required — enter the ID you assign')
  const taken = await prisma.buyer.findFirst({ where: { buyerId, deleted: false } })
  if (taken) throw new Error(`Buyer ID ${buyerId} is already used`)
  const row = await prisma.buyer.create({
    data: {
      buyerId,
      name: input.name.trim(),
      fatherName: input.fatherName?.trim() || null,
      cnic: input.cnic,
      phone: input.phone,
      address: input.address,
      city: input.city,
      notes: input.notes,
    },
    include: includeTotals,
  })
  return buyerDto(row)
}

export async function updateBuyer(id: number | bigint, input: PartyInput) {
  await getBuyer(id)
  if (!input.name?.trim()) throw new Error('Buyer name is required')
  const buyerId = normalizeOwnerCode(input.code ?? input.buyerId)
  const data: Prisma.BuyerUpdateInput = {
    name: input.name.trim(),
    fatherName: input.fatherName?.trim() || null,
    cnic: input.cnic,
    phone: input.phone,
    address: input.address,
    city: input.city,
    notes: input.notes,
  }
  if (buyerId) {
    const taken = await prisma.buyer.findFirst({
      where: { buyerId, deleted: false, id: { not: BigInt(id) } },
    })
    if (taken) throw new Error(`Buyer ID ${buyerId} is already used`)
    data.buyerId = buyerId
  }
  const row = await prisma.buyer.update({
    where: { id: BigInt(id) },
    data,
    include: includeTotals,
  })
  return buyerDto(row)
}

export async function deleteBuyer(id: number | bigint) {
  await getBuyer(id)
  await prisma.buyer.update({
    where: { id: BigInt(id) },
    data: { deleted: true },
  })
}

export async function getBuyerLedger(id: number | bigint) {
  const buyer = await getBuyer(id)
  const [payments, sales] = await Promise.all([
    listPaymentsByBuyer(id),
    listSalesByBuyer(id),
  ])
  const entries = [
    ...sales.map((sale) => ({
      date: sale.saleDate,
      entryType: 'SALE',
      description: `Sale ${sale.invoiceNumber}`,
      amount: sale.totalAmount,
      referenceId: sale.id,
      referenceType: 'Sale',
    })),
    ...payments.map((payment) => ({
      date: payment.paymentDate,
      entryType: 'PAYMENT',
      description: 'Payment made',
      amount: -payment.amount,
      referenceId: payment.id,
      referenceType: 'Payment',
    })),
  ].sort((a, b) => String(b.date).localeCompare(String(a.date)))
  return { balance: buyer.outstandingBalance, entries, payments, sales }
}
