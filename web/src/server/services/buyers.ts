import type { Prisma } from '@prisma/client'
import { prisma } from '@/server/db'
import { normalizeOwnerCode } from '@/server/ids'
import type { PartyInput } from '@/server/services/farmers'
import { listPaymentsByBuyer } from '@/server/services/payments'
import { listSalesByBuyer } from '@/server/services/sales'
import { ensureRegisterPartyForAccount, getAccountStatement } from '@/server/services/linked-account'

type BuyerRow = Prisma.BuyerGetPayload<{
  include: {
    sales: { where: { deleted: false }; select: { totalAmount: true } }
    payments: { select: { amount: true } }
  }
}>

function buyerDtoFromTotals(
  buyer: {
    id: bigint
    buyerId: string
    name: string
    fatherName: string | null
    cnic: string | null
    phone: string | null
    address: string | null
    city: string | null
    outstandingBalance: { toNumber(): number }
    notes: string | null
    active: boolean
  },
  totalBilled: number,
  totalPaid: number,
) {
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
    totalBilled,
    totalPaid,
    notes: buyer.notes,
    active: buyer.active,
  }
}

export function buyerDto(buyer: BuyerRow) {
  return buyerDtoFromTotals(
    buyer,
    buyer.sales.reduce((sum, item) => sum + item.totalAmount.toNumber(), 0),
    buyer.payments.reduce((sum, item) => sum + item.amount.toNumber(), 0),
  )
}

const includeTotals = {
  sales: { where: { deleted: false }, select: { totalAmount: true } },
  payments: { select: { amount: true } },
} as const

export async function listBuyers() {
  const [rows, billed, paid] = await Promise.all([
    prisma.buyer.findMany({
      where: { deleted: false },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.sale.groupBy({
      by: ['buyerId'],
      where: { deleted: false },
      _sum: { totalAmount: true },
    }),
    prisma.payment.groupBy({
      by: ['buyerId'],
      where: { buyerId: { not: null } },
      _sum: { amount: true },
    }),
  ])
  const billedByBuyer = new Map(
    billed.map((row) => [String(row.buyerId), row._sum.totalAmount?.toNumber() ?? 0]),
  )
  const paidByBuyer = new Map(
    paid
      .filter((row) => row.buyerId != null)
      .map((row) => [String(row.buyerId), row._sum.amount?.toNumber() ?? 0]),
  )
  return rows.map((row) =>
    buyerDtoFromTotals(
      row,
      billedByBuyer.get(String(row.id)) ?? 0,
      paidByBuyer.get(String(row.id)) ?? 0,
    ),
  )
}

async function withRegisterAccount<T extends ReturnType<typeof buyerDto>>(dto: T) {
  try {
    await ensureRegisterPartyForAccount(dto.buyerId, dto.name)
  } catch {
    /* buyer stays saved even if the register row cannot be written */
  }
  const statement = await getAccountStatement(dto.buyerId, dto.name)
  return {
    ...dto,
    registerPartyId: statement.partyId,
    registerReceived: statement.cashReceived,
    registerGiven: statement.cashGiven,
    remainingToGive: statement.remainingToGive,
    remainingToReceive: statement.remainingToReceive,
    statement,
  }
}

export async function getBuyer(id: number | bigint) {
  const row = await prisma.buyer.findFirst({
    where: { id: BigInt(id), deleted: false },
    include: includeTotals,
  })
  if (!row) throw new Error('Buyer not found')
  return withRegisterAccount(buyerDto(row))
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
  try {
    await ensureRegisterPartyForAccount(buyerId, input.name.trim())
  } catch {
    /* buyer is already saved; register overlay will still show the ID */
  }
  return withRegisterAccount(buyerDto(row))
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
  await ensureRegisterPartyForAccount(row.buyerId, row.name)
  return withRegisterAccount(buyerDto(row))
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
