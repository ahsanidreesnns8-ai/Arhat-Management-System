import { prisma } from '@/server/db'
import { d, round2 } from '@/server/money'
import { recordPayment } from '@/server/services/payments'
import {
  accountPosition,
  findRegisterPartyByKey,
  loadTradeIndex,
  tradeForKey,
  type LinkedTrade,
} from '@/server/services/linked-account'

const KINDS = ['GIVING', 'RECEIVING', 'ZAKAT', 'FARMER_ADVANCE'] as const
const MONEY_PARTY_KINDS = ['GIVING', 'RECEIVING', 'PERSON'] as const
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

type EntryDto = ReturnType<typeof entryDto>

function totalsFromEntries(entries: Array<{ kind: string; amount: number }>) {
  const receivedTotal = entries
    .filter((row) => row.kind === 'RECEIVING')
    .reduce((sum, row) => sum + row.amount, 0)
  const givenTotal = entries
    .filter((row) => row.kind === 'GIVING')
    .reduce((sum, row) => sum + row.amount, 0)
  return {
    receivedTotal,
    givenTotal,
    balance: receivedTotal - givenTotal,
    receivedCount: entries.filter((row) => row.kind === 'RECEIVING').length,
    givenCount: entries.filter((row) => row.kind === 'GIVING').length,
  }
}

function partyDto(
  party: {
    id: bigint
    kind: string
    name: string
    address: string | null
    notes: string | null
    createdAt: Date
    entries?: Array<{
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
    }>
  },
  includeEntries = false,
) {
  const entries = (party.entries || []).map((row) =>
    entryDto({
      ...row,
      party: row.party ?? {
        id: party.id,
        name: party.name,
        address: party.address,
        notes: party.notes,
      },
    }),
  )
  const cash = totalsFromEntries(entries)
  return {
    id: Number(party.id),
    kind: party.kind,
    name: party.name,
    address: party.address,
    notes: party.notes,
    createdAt: party.createdAt.toISOString(),
    ...cash,
    cashReceivedTotal: cash.receivedTotal,
    cashGivenTotal: cash.givenTotal,
    productTotal: 0,
    productCount: 0,
    soldTotal: 0,
    soldCount: 0,
    farmerPaid: 0,
    buyerPaid: 0,
    remainingToGive: 0,
    remainingToReceive: 0,
    displayLabel: 'Settled',
    linkedFarmerId: null as number | null,
    farmerCode: null as string | null,
    farmerName: null as string | null,
    linkedBuyerId: null as number | null,
    buyerCode: null as string | null,
    buyerName: null as string | null,
    ...(includeEntries ? { entries } : {}),
  }
}

type PartyDto = ReturnType<typeof partyDto>

function tradeLineDto(line: LinkedTrade['lines'][number], party: PartyDto): EntryDto {
  const stamp = karachiParts(line.createdAt)
  return {
    id: line.id,
    kind: line.kind,
    amount: line.amount,
    notes: line.notes,
    createdAt: line.createdAt.toISOString(),
    day: stamp.day,
    date: stamp.date,
    time: stamp.time,
    partyId: party.id,
    farmerId: line.farmerId,
    paymentId: line.kind === 'FARMER_PAID' || line.kind === 'BUYER_PAID' ? line.id : null,
    partyName: party.name,
    partyAddress: party.address,
    farmerCode: line.farmerCode,
  }
}

function attachTrade(dto: PartyDto, trade: LinkedTrade, includeEntries = false): PartyDto {
  const cashReceived = dto.cashReceivedTotal
  const cashGiven = dto.cashGivenTotal
  const position = accountPosition({
    cashReceived,
    cashGiven,
    productTotal: trade.productTotal,
    soldTotal: trade.soldTotal,
    farmerPaid: trade.farmerPaid,
    buyerPaid: trade.buyerPaid,
  })
  const extra = includeEntries
    ? trade.lines.map((line) => tradeLineDto(line, dto))
    : []
  const entries = includeEntries
    ? [...(dto.entries || []), ...extra].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      )
    : dto.entries
  return {
    ...dto,
    cashReceivedTotal: cashReceived,
    cashGivenTotal: cashGiven,
    receivedTotal: position.receivedTotal,
    givenTotal: position.givenTotal,
    balance: position.netOwedToThem,
    receivedCount: dto.receivedCount,
    givenCount: dto.givenCount,
    productTotal: trade.productTotal,
    productCount: trade.productCount,
    soldTotal: trade.soldTotal,
    soldCount: trade.soldCount,
    farmerPaid: trade.farmerPaid,
    buyerPaid: trade.buyerPaid,
    remainingToGive: position.remainingToGive,
    remainingToReceive: position.remainingToReceive,
    displayLabel: position.displayLabel,
    linkedFarmerId: trade.farmerId,
    farmerCode: trade.farmerCode,
    farmerName: trade.farmerName,
    linkedBuyerId: trade.buyerId,
    buyerCode: trade.buyerCode,
    buyerName: trade.buyerName,
    ...(includeEntries ? { entries } : {}),
  }
}

async function withTrade<T extends PartyDto>(dto: T, includeEntries = false) {
  const index = await loadTradeIndex()
  return attachTrade(dto, tradeForKey(index, dto.name), includeEntries) as T
}

async function withTradeAll(dtos: PartyDto[], includeEntries = false) {
  const index = await loadTradeIndex()
  return dtos.map((dto) => attachTrade(dto, tradeForKey(index, dto.name), includeEntries))
}

function parseKind(value: unknown, allowed: readonly string[] = KINDS): RegisterKind {
  const kind = String(value ?? '').trim().toUpperCase()
  if (!allowed.includes(kind)) throw new Error('Invalid register type')
  return kind as RegisterKind
}

const MONEY_ENTRY_KINDS = ['GIVING', 'RECEIVING'] as const

function moneyEntryInclude() {
  return {
    entries: {
      where: { kind: { in: [...MONEY_ENTRY_KINDS] } },
      orderBy: { createdAt: 'asc' as const },
    },
  }
}

export async function listParties(kind: string) {
  if (kind) parseKind(kind, ['GIVING', 'RECEIVING'])
  const rows = await prisma.registerParty.findMany({
    where: { deleted: false, kind: { in: [...MONEY_PARTY_KINDS] } },
    orderBy: { name: 'asc' },
    include: moneyEntryInclude(),
  })
  return withTradeAll(rows.map((row) => partyDto(row, true)), true)
}

export async function getPartyLedger(id: number | bigint) {
  const party = await prisma.registerParty.findFirst({
    where: { id: BigInt(id), deleted: false, kind: { in: [...MONEY_PARTY_KINDS] } },
    include: {
      entries: {
        where: { kind: { in: [...MONEY_ENTRY_KINDS] } },
        orderBy: { createdAt: 'asc' },
        include: { farmer: true },
      },
    },
  })
  if (!party) throw new Error('Person not found')
  return withTrade(partyDto(party, true), true)
}

export async function createParty(input: {
  kind?: string
  name?: string
  address?: string | null
  notes?: string | null
}) {
  if (input.kind) parseKind(input.kind, ['GIVING', 'RECEIVING'])
  const name = String(input.name ?? '').trim()
  if (!name) throw new Error('Name is required')
  const address = String(input.address ?? '').trim() || null
  const notes = String(input.notes ?? '').trim() || null

  const existing = await findRegisterPartyByKey(name)
  if (existing) {
    const row = await prisma.registerParty.update({
      where: { id: existing.id },
      data: {
        address: address ?? existing.address,
        notes: notes ?? existing.notes,
      },
      include: moneyEntryInclude(),
    })
    return withTrade(partyDto(row, true), true)
  }

  const row = await prisma.registerParty.create({
    data: {
      kind: 'PERSON',
      name,
      address,
      notes,
    },
  })
  return withTrade(partyDto({ ...row, entries: [] }), true)
}

export async function listEntries(kind?: string | null) {
  const rows = await prisma.registerEntry.findMany({
    where: {
      ...(kind ? { kind: parseKind(kind) } : {}),
      OR: [{ partyId: null }, { party: { deleted: false } }],
    },
    include: { party: true, farmer: true },
    orderBy: { createdAt: 'asc' },
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
    where: {
      id: BigInt(input.partyId),
      deleted: false,
      kind: { in: [...MONEY_PARTY_KINDS] },
    },
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

async function liveMoneyParty(id: number | bigint) {
  const party = await prisma.registerParty.findFirst({
    where: { id: BigInt(id), deleted: false, kind: { in: [...MONEY_PARTY_KINDS] } },
  })
  if (!party) throw new Error('Person not found')
  return party
}

async function liveMoneyEntry(id: number | bigint) {
  const row = await prisma.registerEntry.findFirst({
    where: { id: BigInt(id) },
    include: { party: true, farmer: true },
  })
  if (!row) throw new Error('Amount not found')
  if (row.kind !== 'GIVING' && row.kind !== 'RECEIVING') {
    throw new Error('Only received or given amounts can be changed here')
  }
  if (row.partyId && row.party?.deleted) throw new Error('Person not found')
  return row
}

export async function updateParty(
  id: number | bigint,
  input: {
    name?: string
    address?: string | null
    notes?: string | null
    entries?: Array<{
      id?: number
      amount?: number | string | null
      kind?: string
      notes?: string | null
      delete?: boolean
    }>
  },
) {
  const party = await liveMoneyParty(id)
  const name = input.name != null ? String(input.name).trim() : party.name
  if (!name) throw new Error('Name is required')
  const clash = await findRegisterPartyByKey(name)
  if (clash && clash.id !== party.id) throw new Error('Another person already has this name')
  await prisma.registerParty.update({
    where: { id: party.id },
    data: {
      name,
      address: input.address !== undefined ? (String(input.address ?? '').trim() || null) : undefined,
      notes: input.notes !== undefined ? (String(input.notes ?? '').trim() || null) : undefined,
    },
  })
  for (const line of input.entries || []) {
    if (line.id == null) continue
    const owned = await prisma.registerEntry.findFirst({
      where: { id: BigInt(line.id), partyId: party.id, kind: { in: [...MONEY_ENTRY_KINDS] } },
    })
    if (!owned) throw new Error('Amount does not belong to this person')
    if (line.delete) {
      await deleteEntry(line.id)
      continue
    }
    await updateEntry(line.id, {
      amount: line.amount,
      kind: line.kind,
      notes: line.notes,
    })
  }
  return getPartyLedger(party.id)
}

export async function deleteParty(id: number | bigint) {
  const party = await liveMoneyParty(id)
  await prisma.registerParty.update({
    where: { id: party.id },
    data: { deleted: true },
  })
}

export async function updateEntry(
  id: number | bigint,
  input: {
    amount?: number | string | null
    kind?: string
    notes?: string | null
  },
) {
  const row = await liveMoneyEntry(id)
  const data: { amount?: string; kind?: string; notes?: string | null } = {}
  if (input.kind != null && String(input.kind).trim() !== '') {
    data.kind = parseKind(input.kind, [...MONEY_ENTRY_KINDS])
  }
  if (input.amount != null && String(input.amount).trim() !== '') {
    const amount = round2(input.amount)
    if (amount.lte(0)) throw new Error('Amount must be greater than zero')
    data.amount = amount.toFixed(2)
  }
  if (input.notes !== undefined) {
    data.notes = String(input.notes ?? '').trim() || null
  }
  if (!Object.keys(data).length) return entryDto(row)
  const updated = await prisma.registerEntry.update({
    where: { id: row.id },
    data,
    include: { party: true, farmer: true },
  })
  return entryDto(updated)
}

export async function deleteEntry(id: number | bigint) {
  const row = await liveMoneyEntry(id)
  await prisma.registerEntry.delete({ where: { id: row.id } })
}

export async function addPersonAmounts(input: {
  partyId?: number | null
  receivedAmount?: number | string | null
  givenAmount?: number | string | null
  notes?: string | null
}, userId?: bigint) {
  if (input.partyId == null) throw new Error('Choose a person')
  const received = input.receivedAmount == null || String(input.receivedAmount).trim() === ''
    ? 0
    : round2(input.receivedAmount).toNumber()
  const given = input.givenAmount == null || String(input.givenAmount).trim() === ''
    ? 0
    : round2(input.givenAmount).toNumber()
  if (received > 0 && given > 0) {
    throw new Error('Save received or given, not both at once')
  }
  if (received <= 0 && given <= 0) {
    throw new Error('Enter how much you received or how much you gave')
  }
  const notes = String(input.notes ?? '').trim() || null
  const saved = []
  if (received > 0) {
    saved.push(await createEntry({
      kind: 'RECEIVING',
      partyId: input.partyId,
      amount: received,
      notes,
    }, userId))
  }
  if (given > 0) {
    saved.push(await createEntry({
      kind: 'GIVING',
      partyId: input.partyId,
      amount: given,
      notes,
    }, userId))
  }
  const ledger = await getPartyLedger(input.partyId)
  return { entries: saved, person: ledger }
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

export type { EntryDto }
