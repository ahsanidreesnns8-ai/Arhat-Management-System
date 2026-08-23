import type { Prisma } from '@prisma/client'
import { prisma } from '@/server/db'
import { normalizeOwnerCode } from '@/server/ids'
import { listDherisByFarmer } from '@/server/services/dheris'
import { listPaymentsByFarmer } from '@/server/services/payments'
import { listTrucksByFarmer } from '@/server/services/trucks'
import { ensureRegisterPartyForAccount, registerCashForKey } from '@/server/services/linked-account'

type FarmerRow = Prisma.FarmerGetPayload<{
  include: {
    dheris: { where: { deleted: false }; select: { farmerReceivable: true } }
    payments: { select: { amount: true } }
  }
}>

export type PartyInput = {
  name?: string
  fatherName?: string | null
  code?: string | null
  farmerId?: string | null
  buyerId?: string | null
  cnic?: string | null
  phone?: string | null
  address?: string | null
  city?: string | null
  notes?: string | null
}

function ownerPartyCode(input: PartyInput, kind: 'farmer' | 'buyer') {
  const raw = normalizeOwnerCode(input.code ?? (kind === 'farmer' ? input.farmerId : input.buyerId))
  if (!raw) throw new Error(`${kind === 'farmer' ? 'Farmer' : 'Buyer'} ID is required — enter the ID you assign`)
  return raw
}

function farmerDtoFromTotals(
  farmer: {
    id: bigint
    farmerId: string
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
    id: Number(farmer.id),
    farmerId: farmer.farmerId,
    name: farmer.name,
    fatherName: farmer.fatherName,
    cnic: farmer.cnic,
    phone: farmer.phone,
    address: farmer.address,
    city: farmer.city,
    outstandingBalance: farmer.outstandingBalance.toNumber(),
    totalBilled,
    totalPaid,
    notes: farmer.notes,
    active: farmer.active,
  }
}

export function farmerDto(farmer: FarmerRow) {
  const totalBilled = farmer.dheris.reduce(
    (sum, item) => sum + item.farmerReceivable.toNumber(),
    0,
  )
  const totalPaid = farmer.payments.reduce(
    (sum, item) => sum + item.amount.toNumber(),
    0,
  )
  return farmerDtoFromTotals(farmer, totalBilled, totalPaid)
}

async function withRegisterAccount<T extends ReturnType<typeof farmerDto>>(dto: T) {
  const cash = await registerCashForKey(dto.farmerId, dto.name)
  const productBalance = (dto.totalBilled || 0) - (dto.totalPaid || 0)
  return {
    ...dto,
    registerPartyId: cash.partyId,
    registerReceived: cash.registerReceived,
    registerGiven: cash.registerGiven,
    accountBalance: productBalance,
    combinedRemaining:
      (dto.totalBilled || 0) + cash.registerReceived - cash.registerGiven - (dto.totalPaid || 0),
  }
}

const includeTotals = {
  dheris: { where: { deleted: false }, select: { farmerReceivable: true } },
  payments: { select: { amount: true } },
} as const

export async function listFarmers() {
  const [rows, billed, paid] = await Promise.all([
    prisma.farmer.findMany({
      where: { deleted: false },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.dheri.groupBy({
      by: ['farmerId'],
      where: { deleted: false },
      _sum: { farmerReceivable: true },
    }),
    prisma.payment.groupBy({
      by: ['farmerId'],
      where: { farmerId: { not: null } },
      _sum: { amount: true },
    }),
  ])
  const billedByFarmer = new Map(
    billed.map((row) => [String(row.farmerId), row._sum.farmerReceivable?.toNumber() ?? 0]),
  )
  const paidByFarmer = new Map(
    paid
      .filter((row) => row.farmerId != null)
      .map((row) => [String(row.farmerId), row._sum.amount?.toNumber() ?? 0]),
  )
  return rows.map((row) =>
    farmerDtoFromTotals(
      row,
      billedByFarmer.get(String(row.id)) ?? 0,
      paidByFarmer.get(String(row.id)) ?? 0,
    ),
  )
}

export async function getFarmer(id: number | bigint) {
  const row = await prisma.farmer.findFirst({
    where: { id: BigInt(id), deleted: false },
    include: includeTotals,
  })
  if (!row) throw new Error('Farmer not found')
  return withRegisterAccount(farmerDto(row))
}

export async function createFarmer(input: PartyInput) {
  if (!input.name?.trim()) throw new Error('Farmer name is required')
  const farmerId = ownerPartyCode(input, 'farmer')
  const taken = await prisma.farmer.findFirst({
    where: { farmerId, deleted: false },
  })
  if (taken) throw new Error(`Farmer ID ${farmerId} is already used`)
  const row = await prisma.farmer.create({
    data: {
      farmerId,
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
  await ensureRegisterPartyForAccount(farmerId, input.name.trim())
  return withRegisterAccount(farmerDto(row))
}

export async function updateFarmer(id: number | bigint, input: PartyInput) {
  await getFarmer(id)
  if (!input.name?.trim()) throw new Error('Farmer name is required')
  const farmerId = normalizeOwnerCode(input.code ?? input.farmerId)
  const data: Prisma.FarmerUpdateInput = {
    name: input.name.trim(),
    fatherName: input.fatherName?.trim() || null,
    cnic: input.cnic,
    phone: input.phone,
    address: input.address,
    city: input.city,
    notes: input.notes,
  }
  if (farmerId) {
    const taken = await prisma.farmer.findFirst({
      where: { farmerId, deleted: false, id: { not: BigInt(id) } },
    })
    if (taken) throw new Error(`Farmer ID ${farmerId} is already used`)
    data.farmerId = farmerId
  }
  const row = await prisma.farmer.update({
    where: { id: BigInt(id) },
    data,
    include: includeTotals,
  })
  await ensureRegisterPartyForAccount(row.farmerId, row.name)
  return withRegisterAccount(farmerDto(row))
}

export async function deleteFarmer(id: number | bigint) {
  await getFarmer(id)
  await prisma.farmer.update({
    where: { id: BigInt(id) },
    data: { deleted: true },
  })
}

export async function getFarmerLedger(id: number | bigint) {
  const farmer = await getFarmer(id)
  const [payments, dheris, trucks] = await Promise.all([
    listPaymentsByFarmer(id),
    listDherisByFarmer(id),
    listTrucksByFarmer(id),
  ])
  const entries = [
    ...dheris
      .filter((item) => item.farmerReceivable > 0)
      .map((item) => ({
        date: null,
        entryType: 'DHERI',
        description: `Dheri ${item.dheriId} receivable`,
        amount: item.farmerReceivable,
        referenceId: item.id,
        referenceType: 'Dheri',
      })),
    ...payments.map((item) => ({
      date: item.paymentDate,
      entryType: 'PAYMENT',
      description: 'Payment received',
      amount: -item.amount,
      referenceId: item.id,
      referenceType: 'Payment',
    })),
  ].sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')))
  return { balance: farmer.outstandingBalance, entries, payments, dheris, trucks }
}
