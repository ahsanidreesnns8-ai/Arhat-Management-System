import { prisma } from '@/server/db'
import { d, round2 } from '@/server/money'
import { recordPayment } from '@/server/services/payments'

const KINDS = ['GIVING', 'RECEIVING', 'ZAKAT', 'FARMER_ADVANCE'] as const
type RegisterKind = (typeof KINDS)[number]

function karachiParts(date: Date) {
  const tz = 'Asia/Karachi'
  return {
    day: date.toLocaleDateString('en-PK', { weekday: 'long', timeZone: tz }),
    date: date.toLocaleDateString('en-PK', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: tz,
    }),
    time: date.toLocaleTimeString('en-PK', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: tz,
    }),
  }
}

function entryDto(row: {
  id: bigint
  kind: string
  amount: { toNumber(): number }
  notes: string | null
  createdAt: Date
  partyId: bigint | null
  farmerId: bigint | null
  paymentId: bigint | null
  party?: { id: bigint; name: string; address: string | null; notes: string | null } | null
  farmer?: { id: bigint; name: string; farmerId: string; address: string | null } | null
}) {
  const stamp = karachiParts(row.createdAt)
  return {
    id: Number(row.id),
    kind: row.kind,
    amount: row.amount.toNumber(),
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    day: stamp.day,
    date: stamp.date,
    time: stamp.time,
    partyId: row.partyId == null ? null : Number(row.partyId),
    farmerId: row.farmerId == null ? null : Number(row.farmerId),
    paymentId: row.paymentId == null ? null : Number(row.paymentId),
    partyName: row.party?.name ?? row.farmer?.name ?? null,
    partyAddress: row.party?.address ?? row.farmer?.address ?? null,
    farmerCode: row.farmer?.farmerId ?? null,
  }
}

function parseKind(value: unknown, allowed: readonly string[] = KINDS): RegisterKind {
  const kind = String(value ?? '').trim().toUpperCase()
  if (!allowed.includes(kind)) throw new Error('Invalid register type')
  return kind as RegisterKind
}

export async function listParties(kind: string) {
  const k = parseKind(kind, ['GIVING', 'RECEIVING'])
  const rows = await prisma.registerParty.findMany({
    where: { kind: k, deleted: false },
    orderBy: { name: 'asc' },
  })
  return rows.map((row) => ({
    id: Number(row.id),
    kind: row.kind,
    name: row.name,
    address: row.address,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  }))
}

export async function createParty(input: {
  kind?: string
  name?: string
  address?: string | null
  notes?: string | null
}) {
  const kind = parseKind(input.kind, ['GIVING', 'RECEIVING'])
  const name = String(input.name ?? '').trim()
  if (!name) throw new Error('Name is required')
  const row = await prisma.registerParty.create({
    data: {
      kind,
      name,
      address: String(input.address ?? '').trim() || null,
      notes: String(input.notes ?? '').trim() || null,
    },
  })
  return {
    id: Number(row.id),
    kind: row.kind,
    name: row.name,
    address: row.address,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function listEntries(kind?: string | null) {
  const where = kind ? { kind: parseKind(kind) } : {}
  const rows = await prisma.registerEntry.findMany({
    where,
    include: { party: true, farmer: true },
    orderBy: { createdAt: 'desc' },
  })
  return rows.map(entryDto)
}

export async function createEntry(
  input: {
    kind?: string
    partyId?: number | null
    farmerId?: number | null
    amount?: number | string | null
    notes?: string | null
  },
  userId?: bigint,
) {
  const kind = parseKind(input.kind)
  const amount = round2(input.amount ?? 0)
  if (amount.lte(0)) throw new Error('Amount must be greater than zero')
  const notes = String(input.notes ?? '').trim() || null

  if (kind === 'ZAKAT') {
    const row = await prisma.registerEntry.create({
      data: { kind, amount: amount.toFixed(2), notes },
    })
    return entryDto({ ...row, party: null, farmer: null })
  }

  if (kind === 'FARMER_ADVANCE') {
    if (input.farmerId == null) throw new Error('Choose a farmer')
    const farmer = await prisma.farmer.findFirst({
      where: { id: BigInt(input.farmerId), deleted: false },
    })
    if (!farmer) throw new Error('Farmer not found')
    const payment = await recordPayment(
      {
        paymentType: 'FARMER',
        farmerId: Number(farmer.id),
        amount: amount.toNumber(),
        paymentMethod: 'CASH',
        referenceNumber: 'ADVANCE',
        notes: notes || 'Advance payment',
        allowAdvance: true,
      },
      userId,
    )
    const row = await prisma.registerEntry.create({
      data: {
        kind,
        farmerId: farmer.id,
        paymentId: BigInt(payment.id),
        amount: amount.toFixed(2),
        notes: notes || 'Advance payment',
      },
      include: { party: true, farmer: true },
    })
    return entryDto(row)
  }

  if (input.partyId == null) throw new Error('Choose a person')
  const party = await prisma.registerParty.findFirst({
    where: { id: BigInt(input.partyId), deleted: false, kind },
  })
  if (!party) throw new Error('Person not found for this register')
  const row = await prisma.registerEntry.create({
    data: {
      kind,
      partyId: party.id,
      amount: amount.toFixed(2),
      notes,
    },
    include: { party: true, farmer: true },
  })
  return entryDto(row)
}

export async function zakatSummary() {
  const rows = await prisma.registerEntry.findMany({
    where: { kind: 'ZAKAT' },
    orderBy: { createdAt: 'desc' },
  })
  const allTime = rows.reduce((sum, row) => sum + d(row.amount.toString()).toNumber(), 0)
  const yearAgo = new Date()
  yearAgo.setFullYear(yearAgo.getFullYear() - 1)
  const last12 = rows
    .filter((row) => row.createdAt >= yearAgo)
    .reduce((sum, row) => sum + d(row.amount.toString()).toNumber(), 0)
  return {
    allTime,
    last12Months: last12,
    yearStart: yearAgo.toISOString(),
    entries: rows.map((row) => entryDto({ ...row, party: null, farmer: null })),
  }
}
