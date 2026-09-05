import { prisma } from '@/server/db'
import { normalizeAccountKey } from '@/server/ids'
import { d, round2 } from '@/server/money'
import { recordPayment } from '@/server/services/payments'
import {
  accountPosition,
  ensureRegisterPartyForAccount,
  findRegisterPartyByKey,
  getAccountStatement,
  loadTradeForKey,
  loadTradeIndex,
  syncAllAccountsToRegister,
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
    ownerCode?: string | null
    linkedFarmerId?: bigint | null
    linkedBuyerId?: bigint | null
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
    ownerCode: party.ownerCode ?? null,
    linkedFarmerId: party.linkedFarmerId != null ? Number(party.linkedFarmerId) : null,
    farmerCode: party.ownerCode ?? null,
    farmerName: null as string | null,
    linkedBuyerId: party.linkedBuyerId != null ? Number(party.linkedBuyerId) : null,
    buyerCode: party.ownerCode && party.linkedBuyerId != null ? party.ownerCode : null,
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
    ownerCode: dto.ownerCode || trade.farmerCode || trade.buyerCode,
    linkedFarmerId: dto.linkedFarmerId ?? trade.farmerId,
    farmerCode: dto.farmerCode || trade.farmerCode,
    farmerName: dto.farmerName || trade.farmerName,
    linkedBuyerId: dto.linkedBuyerId ?? trade.buyerId,
    buyerCode: dto.buyerCode || trade.buyerCode,
    buyerName: dto.buyerName || trade.buyerName,
    ...(includeEntries ? { entries } : {}),
  }
}

function tradeKeysForParty(dto: Pick<PartyDto, 'ownerCode' | 'farmerCode' | 'buyerCode' | 'name'>) {
  return [dto.ownerCode, dto.farmerCode, dto.buyerCode, dto.name].filter(
    (key): key is string => Boolean(key && String(key).trim()),
  )
}

function tradeForParty(index: Map<string, LinkedTrade>, dto: PartyDto) {
  for (const key of tradeKeysForParty(dto)) {
    const row = tradeForKey(index, key)
    if (row.farmerId || row.buyerId || row.farmerCode || row.buyerCode) return row
  }
  return tradeForKey(index, dto.name)
}

async function loadTradeForParty(dto: PartyDto) {
  for (const key of tradeKeysForParty(dto)) {
    const trade = await loadTradeForKey(key)
    if (trade.farmerId || trade.buyerId) return trade
  }
  return loadTradeForKey(dto.name)
}

async function withTrade<T extends PartyDto>(dto: T, includeEntries = false) {
  const trade = await loadTradeForParty(dto)
  return attachTrade(dto, trade, includeEntries) as T
}

async function withTradeAll(dtos: PartyDto[], includeEntries = false) {
  const index = await loadTradeIndex(includeEntries)
  return dtos.map((dto) => attachTrade(dto, tradeForParty(index, dto), includeEntries))
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

function emptyAccountParty(
  name: string,
  code: string,
  extras: Partial<PartyDto>,
): PartyDto {
  return {
    id: extras.id ?? 0,
    kind: 'PERSON',
    name,
    address: extras.address ?? null,
    notes: extras.notes ?? `ID ${code}`,
    createdAt: extras.createdAt ?? new Date().toISOString(),
    receivedTotal: 0,
    givenTotal: 0,
    balance: 0,
    receivedCount: 0,
    givenCount: 0,
    cashReceivedTotal: 0,
    cashGivenTotal: 0,
    productTotal: 0,
    productCount: 0,
    soldTotal: 0,
    soldCount: 0,
    farmerPaid: 0,
    buyerPaid: 0,
    remainingToGive: 0,
    remainingToReceive: 0,
    displayLabel: extras.displayLabel ?? 'Settled',
    ownerCode: code,
    linkedFarmerId: extras.linkedFarmerId ?? null,
    farmerCode: extras.farmerCode ?? null,
    farmerName: extras.farmerName ?? null,
    linkedBuyerId: extras.linkedBuyerId ?? null,
    buyerCode: extras.buyerCode ?? null,
    buyerName: extras.buyerName ?? null,
  }
}

function partyHasAccountCode(dto: PartyDto, code: string, linkedId?: number | null) {
  const key = normalizeAccountKey(code)
  if (linkedId != null && (dto.linkedFarmerId === linkedId || dto.linkedBuyerId === linkedId)) {
    return true
  }
  return [dto.ownerCode, dto.farmerCode, dto.buyerCode, dto.name, dto.notes].some(
    (value) => normalizeAccountKey(value) === key || normalizeAccountKey(value).includes(key),
  )
}

function stampPartyFromFarmer(
  dto: PartyDto,
  farmer: { id: number; farmerId: string; name: string },
): PartyDto {
  return {
    ...dto,
    ownerCode: dto.ownerCode || farmer.farmerId,
    linkedFarmerId: dto.linkedFarmerId ?? farmer.id,
    farmerCode: dto.farmerCode || farmer.farmerId,
    farmerName: dto.farmerName || farmer.name,
    notes: dto.notes || `ID ${farmer.farmerId}`,
  }
}

function stampPartyFromBuyer(
  dto: PartyDto,
  buyer: { id: number; buyerId: string; name: string },
): PartyDto {
  return {
    ...dto,
    ownerCode: dto.ownerCode || buyer.buyerId,
    linkedBuyerId: dto.linkedBuyerId ?? buyer.id,
    buyerCode: dto.buyerCode || buyer.buyerId,
    buyerName: dto.buyerName || buyer.name,
    notes: dto.notes || `ID ${buyer.buyerId}`,
  }
}

async function overlayAccountsOnParties(dtos: PartyDto[]) {
  const [farmers, buyers] = await Promise.all([
    prisma.farmer.findMany({
      where: { deleted: false },
      select: { id: true, farmerId: true, name: true, address: true, createdAt: true },
    }),
    prisma.buyer.findMany({
      where: { deleted: false },
      select: { id: true, buyerId: true, name: true, address: true, createdAt: true },
    }),
  ])
  const next = [...dtos]
  for (const farmer of farmers) {
    const id = Number(farmer.id)
    const row = { id, farmerId: farmer.farmerId, name: farmer.name }
    const hit = next.find((dto) => partyHasAccountCode(dto, farmer.farmerId, id))
      || next.find((dto) => normalizeAccountKey(dto.name) === normalizeAccountKey(farmer.name))
    if (hit) {
      Object.assign(hit, stampPartyFromFarmer(hit, row))
      continue
    }
    try {
      const party = await ensureRegisterPartyForAccount(farmer.farmerId, farmer.name)
      if (party) {
        next.push(stampPartyFromFarmer(partyDto({ ...party, entries: [] }), row))
        continue
      }
    } catch {
      /* fall through to a visible card */
    }
    next.push(emptyAccountParty(farmer.name, farmer.farmerId, {
      id,
      linkedFarmerId: id,
      farmerCode: farmer.farmerId,
      farmerName: farmer.name,
      address: farmer.address,
      createdAt: farmer.createdAt.toISOString(),
    }))
  }
  for (const buyer of buyers) {
    const id = Number(buyer.id)
    const row = { id, buyerId: buyer.buyerId, name: buyer.name }
    const hit = next.find((dto) => partyHasAccountCode(dto, buyer.buyerId, id))
      || next.find((dto) => normalizeAccountKey(dto.name) === normalizeAccountKey(buyer.name))
    if (hit) {
      Object.assign(hit, stampPartyFromBuyer(hit, row))
      continue
    }
    try {
      const party = await ensureRegisterPartyForAccount(buyer.buyerId, buyer.name)
      if (party) {
        next.push(stampPartyFromBuyer(partyDto({ ...party, entries: [] }), row))
        continue
      }
    } catch {
      /* fall through to a visible card */
    }
    next.push(emptyAccountParty(buyer.name, buyer.buyerId, {
      id,
      linkedBuyerId: id,
      buyerCode: buyer.buyerId,
      buyerName: buyer.name,
      address: buyer.address,
      createdAt: buyer.createdAt.toISOString(),
    }))
  }
  return next
}

export async function listParties(kind: string) {
  if (kind) parseKind(kind, ['GIVING', 'RECEIVING'])
  try {
    await syncAllAccountsToRegister()
  } catch {
    /* overlay below still lists every farmer and buyer */
  }
  try {
    const [rows, sums] = await Promise.all([
      prisma.registerParty.findMany({
        where: { deleted: false, kind: { in: [...MONEY_PARTY_KINDS] } },
        orderBy: { name: 'asc' },
      }),
      prisma.registerEntry.groupBy({
        by: ['partyId', 'kind'],
        where: { kind: { in: [...MONEY_ENTRY_KINDS] }, partyId: { not: null } },
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ])
    const received = new Map<string, { amount: number; count: number }>()
    const given = new Map<string, { amount: number; count: number }>()
    for (const row of sums) {
      if (row.partyId == null) continue
      const key = String(row.partyId)
      const amount = row._sum.amount?.toNumber() ?? 0
      const count = row._count._all
      if (row.kind === 'RECEIVING') received.set(key, { amount, count })
      if (row.kind === 'GIVING') given.set(key, { amount, count })
    }
    const dtos = rows.map((row) => {
      const dto = partyDto({ ...row, entries: [] }, false)
      const r = received.get(String(row.id)) ?? { amount: 0, count: 0 }
      const g = given.get(String(row.id)) ?? { amount: 0, count: 0 }
      return {
        ...dto,
        receivedTotal: r.amount,
        givenTotal: g.amount,
        cashReceivedTotal: r.amount,
        cashGivenTotal: g.amount,
        receivedCount: r.count,
        givenCount: g.count,
        balance: r.amount - g.amount,
      }
    })
    return overlayAccountsOnParties(await withTradeAll(dtos, false))
  } catch {
    return overlayAccountsOnParties([])
  }
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

  const linked = await ensureRegisterPartyForAccount(name, name)
  if (linked) {
    const row = await prisma.registerParty.update({
      where: { id: linked.id },
      data: {
        address: address ?? linked.address,
        notes: notes ?? linked.notes,
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
  const farmer = await farmerForAccountKey(party.name, input.farmerId)
  const row = await prisma.registerEntry.create({
    data: {
      kind,
      partyId: party.id,
      farmerId: farmer?.id ?? null,
      amount: amount.toFixed(2),
      notes,
    },
    include: { party: true, farmer: true },
  })
  return entryDto(row)
}

async function farmerForAccountKey(key: string, farmerId?: number | null) {
  if (farmerId != null) {
    const row = await prisma.farmer.findFirst({
      where: { id: BigInt(farmerId), deleted: false },
    })
    if (row) return row
  }
  const raw = String(key ?? '').trim()
  const norm = normalizeAccountKey(raw)
  if (!norm) return null
  const farmers = await prisma.farmer.findMany({
    where: { deleted: false },
    select: { id: true, farmerId: true, name: true },
  })
  const byCode = farmers.find((row) => normalizeAccountKey(row.farmerId) === norm)
  if (byCode) {
    return prisma.farmer.findFirst({ where: { id: byCode.id, deleted: false } })
  }
  const byName = farmers.filter((row) => normalizeAccountKey(row.name) === norm)
  if (byName.length === 1) {
    return prisma.farmer.findFirst({ where: { id: byName[0].id, deleted: false } })
  }
  const token = String(raw).trim().split(/\s+/)[0] || raw
  const tokenKey = normalizeAccountKey(token)
  const byFirst = farmers.filter((row) => {
    const first = row.name.trim().split(/\s+/)[0] || row.name
    return normalizeAccountKey(first) === tokenKey || normalizeAccountKey(first) === norm
  })
  if (byFirst.length !== 1) return null
  return prisma.farmer.findFirst({ where: { id: byFirst[0].id, deleted: false } })
}

export async function getStatement(key: unknown) {
  const raw = String(key ?? '').trim()
  if (!raw) throw new Error('Enter an ID')
  const farmer = await farmerForAccountKey(raw)
  const buyer = farmer
    ? null
    : await prisma.buyer.findFirst({
        where: {
          deleted: false,
          OR: [
            { buyerId: { equals: raw, mode: 'insensitive' } },
            { name: { equals: raw, mode: 'insensitive' } },
          ],
        },
      })
  return getAccountStatement(raw, farmer?.name || buyer?.name)
}

export async function adjustAccount(
  input: {
    key?: unknown
    kind?: unknown
    amount?: number | string | null
    notes?: string | null
    farmerId?: number | null
    buyerId?: number | null
  },
  userId?: bigint,
) {
  const key = String(input.key ?? '').trim()
  if (!key) throw new Error('Enter the ID')
  const kind = parseKind(input.kind, [...MONEY_ENTRY_KINDS])
  const farmer = await farmerForAccountKey(key, input.farmerId)
  const buyer = farmer
    ? null
    : input.buyerId != null
      ? await prisma.buyer.findFirst({ where: { id: BigInt(input.buyerId), deleted: false } })
      : await prisma.buyer.findFirst({
          where: {
            deleted: false,
            OR: [
              { buyerId: { equals: key, mode: 'insensitive' } },
              { name: { equals: key, mode: 'insensitive' } },
            ],
          },
        })
  const extraName = farmer?.name || buyer?.name
  const party = await ensureRegisterPartyForAccount(key, extraName)
  if (!party) throw new Error('Could not open this ID')
  const entry = await createEntry({
    kind,
    partyId: Number(party.id),
    farmerId: farmer ? Number(farmer.id) : null,
    amount: input.amount,
    notes: input.notes,
  }, userId)
  return {
    entry,
    statement: await getAccountStatement(key, extraName),
  }
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
    data: { deleted: true, linkedFarmerId: null, linkedBuyerId: null, ownerCode: null },
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
