import { prisma } from '@/server/db'
import { normalizeAccountKey, normalizeOwnerCode } from '@/server/ids'
import { d, round2 } from '@/server/money'
import { recordPayment } from '@/server/services/payments'
import { logAudit } from '@/server/services/audit'
import { isShopPurgePersonName, SHOP_PURGE_NAMES } from '@/lib/shop-purge-names'
import {
  accountPosition,
  ensureRegisterPartyForAccount,
  getAccountStatement,
  hiddenRegisterAccountLinks,
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
  const codes = [dto.ownerCode, dto.farmerCode, dto.buyerCode].filter(
    (key): key is string => Boolean(key && String(key).trim()),
  )
  if (codes.length) return codes
  return dto.name && String(dto.name).trim() ? [dto.name] : []
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

function partyHasAccountCode(dto: PartyDto, code: string, linkedId?: number | null) {
  const key = normalizeAccountKey(code)
  if (!key) return false
  if (linkedId != null && (dto.linkedFarmerId === linkedId || dto.linkedBuyerId === linkedId)) {
    return true
  }
  return [dto.ownerCode, dto.farmerCode, dto.buyerCode, dto.name].some((value) => normalizeAccountKey(value) === key)
    || normalizeAccountKey(dto.notes) === key
    || normalizeAccountKey(dto.notes) === normalizeAccountKey(`ID ${code}`)
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
  const [farmers, buyers, hidden] = await Promise.all([
    prisma.farmer.findMany({
      where: { deleted: false },
      select: { id: true, farmerId: true, name: true, address: true, createdAt: true },
    }),
    prisma.buyer.findMany({
      where: { deleted: false },
      select: { id: true, buyerId: true, name: true, address: true, createdAt: true },
    }),
    hiddenRegisterAccountLinks(),
  ])
  const next = [...dtos]
  for (const farmer of farmers) {
    const id = Number(farmer.id)
    if (hidden.farmerIds.has(id)) continue
    const row = { id, farmerId: farmer.farmerId, name: farmer.name }
    const hit = next.find((dto) => partyHasAccountCode(dto, farmer.farmerId, id))
    if (hit) {
      Object.assign(hit, stampPartyFromFarmer(hit, row))
      continue
    }
    try {
      const party = await ensureRegisterPartyForAccount(farmer.farmerId, farmer.name)
      if (party) {
        next.push(stampPartyFromFarmer(partyDto({ ...party, entries: [] }), row))
      }
    } catch {
      /* skip cards without a real register person id */
    }
  }
  for (const buyer of buyers) {
    const id = Number(buyer.id)
    if (hidden.buyerIds.has(id)) continue
    const row = { id, buyerId: buyer.buyerId, name: buyer.name }
    const hit = next.find((dto) => partyHasAccountCode(dto, buyer.buyerId, id))
    if (hit) {
      Object.assign(hit, stampPartyFromBuyer(hit, row))
      continue
    }
    try {
      const party = await ensureRegisterPartyForAccount(buyer.buyerId, buyer.name)
      if (party) {
        next.push(stampPartyFromBuyer(partyDto({ ...party, entries: [] }), row))
      }
    } catch {
      /* skip cards without a real register person id */
    }
  }
  return next
}

export async function listParties(kind: string) {
  if (kind) parseKind(kind, ['GIVING', 'RECEIVING'])
  try {
    await purgeKnownDuplicatePeopleOnce()
  } catch {
    /* continue listing even if a one-time cleanup cannot run */
  }
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

function partyHasNoAccountIdentity(row: {
  ownerCode?: string | null
  linkedFarmerId?: bigint | null
  linkedBuyerId?: bigint | null
}) {
  return !row.ownerCode && row.linkedFarmerId == null && row.linkedBuyerId == null
}

async function findPartyByExactName(name: string, deleted: boolean) {
  const norm = normalizeAccountKey(name)
  if (!norm) return null
  const rows = await prisma.registerParty.findMany({
    where: { deleted, kind: { in: [...MONEY_PARTY_KINDS] } },
    include: moneyEntryInclude(),
    orderBy: { updatedAt: 'desc' },
  })
  const matches = rows.filter((row) => normalizeAccountKey(row.name) === norm)
  return matches.length === 1 ? matches[0] : null
}

async function findExactAccountCode(name: string) {
  const norm = normalizeAccountKey(name)
  if (!norm) return null
  const [farmers, buyers] = await Promise.all([
    prisma.farmer.findMany({
      where: { deleted: false },
      select: { id: true, farmerId: true, name: true },
    }),
    prisma.buyer.findMany({
      where: { deleted: false },
      select: { id: true, buyerId: true, name: true },
    }),
  ])
  const farmer = farmers.find((row) => normalizeAccountKey(row.farmerId) === norm)
  if (farmer) return { code: farmer.farmerId, name: farmer.name }
  const buyer = buyers.find((row) => normalizeAccountKey(row.buyerId) === norm)
  if (buyer) return { code: buyer.buyerId, name: buyer.name }
  return null
}

export async function getPartyLedger(id: number | bigint) {
  const live = await liveMoneyParty(id)
  const party = await prisma.registerParty.findFirst({
    where: { id: live.id, deleted: false, kind: { in: [...MONEY_PARTY_KINDS] } },
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
  code?: string | null
  ownerCode?: string | null
  address?: string | null
  notes?: string | null
}) {
  if (input.kind) parseKind(input.kind, ['GIVING', 'RECEIVING'])
  const name = String(input.name ?? '').trim()
  if (!name) throw new Error('Name is required')
  const address = String(input.address ?? '').trim() || null
  const notes = String(input.notes ?? '').trim() || null
  const code = normalizeOwnerCode(input.code ?? input.ownerCode)

  if (code) {
    const account = (await findExactAccountCode(code)) || { code, name }
    const linked = await ensureRegisterPartyForAccount(account.code, name, { reviveDeleted: true })
    if (!linked) throw new Error('Could not open this ID')
    const row = await prisma.registerParty.update({
      where: { id: linked.id },
      data: {
        name,
        address: address ?? linked.address,
        notes: notes || linked.notes || `ID ${account.code}`,
        ownerCode: linked.ownerCode || account.code,
      },
      include: moneyEntryInclude(),
    })
    return withTrade(partyDto(row, true), true)
  }

  const account = await findExactAccountCode(name)
  if (account) {
    const linked = await ensureRegisterPartyForAccount(account.code, account.name, { reviveDeleted: true })
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
  }

  const live = await findPartyByExactName(name, false)
  if (live && partyHasNoAccountIdentity(live)) {
    const row = await prisma.registerParty.update({
      where: { id: live.id },
      data: {
        address: address ?? live.address,
        notes: notes ?? live.notes,
      },
      include: moneyEntryInclude(),
    })
    return withTrade(partyDto(row, true), true)
  }

  const tombstone = await findPartyByExactName(name, true)
  if (tombstone && partyHasNoAccountIdentity(tombstone)) {
    const row = await prisma.registerParty.update({
      where: { id: tombstone.id },
      data: {
        deleted: false,
        name,
        address: address ?? tombstone.address,
        notes: notes ?? tombstone.notes,
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
  const party = await liveMoneyParty(input.partyId)
  const farmer = await farmerForAccountKey(
    party.ownerCode || party.name,
    input.farmerId ?? (party.linkedFarmerId != null ? Number(party.linkedFarmerId) : null),
  )
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

async function buyerForAccountKey(key: string, buyerId?: number | null) {
  if (buyerId != null) {
    const row = await prisma.buyer.findFirst({
      where: { id: BigInt(buyerId), deleted: false },
    })
    if (row) return row
  }
  const raw = String(key ?? '').trim()
  const norm = normalizeAccountKey(raw)
  if (!norm) return null
  const buyers = await prisma.buyer.findMany({
    where: { deleted: false },
    select: { id: true, buyerId: true, name: true },
  })
  const byCode = buyers.find((row) => normalizeAccountKey(row.buyerId) === norm)
  if (byCode) {
    return prisma.buyer.findFirst({ where: { id: byCode.id, deleted: false } })
  }
  const byName = buyers.filter((row) => normalizeAccountKey(row.name) === norm)
  if (byName.length === 1) {
    return prisma.buyer.findFirst({ where: { id: byName[0].id, deleted: false } })
  }
  return null
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
  return null
}

export async function getStatement(key: unknown) {
  const raw = String(key ?? '').trim()
  if (!raw) throw new Error('Enter an ID')
  const farmer = await farmerForAccountKey(raw)
  const buyer = farmer ? null : await buyerForAccountKey(raw)
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
  const buyer = farmer ? null : await buyerForAccountKey(key, input.buyerId)
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
  const partyId = BigInt(id)
  const party = await prisma.registerParty.findFirst({
    where: { id: partyId, deleted: false, kind: { in: [...MONEY_PARTY_KINDS] } },
  })
  if (party) return party
  const linked = await prisma.registerParty.findFirst({
    where: {
      deleted: false,
      kind: { in: [...MONEY_PARTY_KINDS] },
      OR: [{ linkedFarmerId: partyId }, { linkedBuyerId: partyId }],
    },
    orderBy: { id: 'asc' },
  })
  if (!linked) throw new Error('Person not found')
  return linked
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
    code?: string | null
    ownerCode?: string | null
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
  const code = input.code !== undefined || input.ownerCode !== undefined
    ? normalizeOwnerCode(input.code ?? input.ownerCode)
    : party.ownerCode
  const nameKey = normalizeAccountKey(name)
  const codeKey = normalizeAccountKey(code)
  if (nameKey || codeKey) {
    const others = await prisma.registerParty.findMany({
      where: { deleted: false, kind: { in: [...MONEY_PARTY_KINDS] }, id: { not: party.id } },
      select: { ownerCode: true },
    })
    const idTaken = others.some((row) => {
      const owner = normalizeAccountKey(row.ownerCode)
      return Boolean(owner) && (owner === codeKey || owner === nameKey)
    })
    if (idTaken) throw new Error('Another person already has this ID')
  }
  const nextNotes = input.notes !== undefined
    ? (String(input.notes ?? '').trim() || null)
    : party.notes
  await prisma.registerParty.update({
    where: { id: party.id },
    data: {
      name,
      address: input.address !== undefined ? (String(input.address ?? '').trim() || null) : undefined,
      notes: nextNotes || (code ? `ID ${code}` : null),
      ...(code ? { ownerCode: code } : {}),
    },
  })
  if (code) {
    try {
      await ensureRegisterPartyForAccount(code, name)
    } catch {
      /* person ID is already saved on the register card */
    }
  }
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

export async function hideAccountsForFarmer(farmerId: number | bigint, name?: string | null, code?: string | null) {
  await retireMatchingRegisterParties({
    farmerId: BigInt(farmerId),
    name,
    code,
  })
  await prisma.dheri.updateMany({
    where: { farmerId: BigInt(farmerId), deleted: false },
    data: { deleted: true },
  })
}

export async function hideAccountsForBuyer(buyerId: number | bigint, name?: string | null, code?: string | null) {
  await retireMatchingRegisterParties({
    buyerId: BigInt(buyerId),
    name,
    code,
  })
}

async function retireMatchingRegisterParties(input: {
  partyId?: bigint
  farmerId?: bigint | null
  buyerId?: bigint | null
  name?: string | null
  code?: string | null
}) {
  const nameKey = normalizeAccountKey(input.name)
  const codeKey = normalizeAccountKey(input.code)
  const or: Array<Record<string, unknown>> = [
    ...(input.partyId ? [{ id: input.partyId }] : []),
    ...(input.farmerId ? [{ linkedFarmerId: input.farmerId }] : []),
    ...(input.buyerId ? [{ linkedBuyerId: input.buyerId }] : []),
    ...(codeKey ? [{ ownerCode: { equals: String(input.code).trim(), mode: 'insensitive' as const } }] : []),
  ]
  const rows = or.length
    ? await prisma.registerParty.findMany({
        where: { kind: { in: [...MONEY_PARTY_KINDS] }, OR: or },
      })
    : []
  const extra =
    nameKey && !input.partyId && !input.farmerId && !input.buyerId && !codeKey
      ? (await prisma.registerParty.findMany({
          where: { kind: { in: [...MONEY_PARTY_KINDS] } },
        })).filter((row) => normalizeAccountKey(row.name) === nameKey && partyHasNoAccountIdentity(row))
      : []
  const seen = new Set<string>()
  const all = [...rows, ...extra].filter((row) => {
    const key = String(row.id)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  for (const row of all) {
    await prisma.registerEntry.deleteMany({
      where: { partyId: row.id, kind: { in: [...MONEY_ENTRY_KINDS] } },
    })
    await prisma.registerParty.update({
      where: { id: row.id },
      data: {
        deleted: true,
        name: `Removed ${row.id}`,
        notes: null,
        ownerCode: null,
        linkedFarmerId: null,
        linkedBuyerId: null,
      },
    })
  }
}

export async function deleteParty(id: number | bigint) {
  const party = await liveMoneyParty(id)
  if (party.linkedFarmerId) {
    await prisma.dheri.updateMany({
      where: { farmerId: party.linkedFarmerId, deleted: false },
      data: { deleted: true },
    })
    await prisma.farmer.updateMany({
      where: { id: party.linkedFarmerId, deleted: false },
      data: { deleted: true },
    })
  }
  if (party.linkedBuyerId) {
    await prisma.buyer.updateMany({
      where: { id: party.linkedBuyerId, deleted: false },
      data: { deleted: true },
    })
  }
  await retireMatchingRegisterParties({
    partyId: party.id,
    farmerId: party.linkedFarmerId,
    buyerId: party.linkedBuyerId,
    name: party.name,
    code: party.ownerCode,
  })
}

export async function removePeopleFromShop(names: string[] = SHOP_PURGE_NAMES) {
  const custom = names.map((name) => normalizeAccountKey(name)).filter(Boolean)
  const [farmers, buyers, parties] = await Promise.all([
    prisma.farmer.findMany(),
    prisma.buyer.findMany(),
    prisma.registerParty.findMany({ where: { kind: { in: [...MONEY_PARTY_KINDS] } } }),
  ])
  const matchesName = (name: string) => {
    if (isShopPurgePersonName(name)) return true
    const key = normalizeAccountKey(name)
    if (!key || /\d/.test(key)) return false
    return custom.some((target) => key === target)
  }
  const hitFarmers = farmers.filter((row) => matchesName(row.name))
  const hitBuyers = buyers.filter((row) => matchesName(row.name))
  for (const farmer of hitFarmers) {
    await hideAccountsForFarmer(farmer.id, farmer.name, farmer.farmerId)
    if (!farmer.deleted) {
      await prisma.farmer.update({ where: { id: farmer.id }, data: { deleted: true } })
    }
  }
  for (const buyer of hitBuyers) {
    await hideAccountsForBuyer(buyer.id, buyer.name, buyer.buyerId)
    if (!buyer.deleted) {
      await prisma.buyer.update({ where: { id: buyer.id }, data: { deleted: true } })
    }
  }
  const leftover = parties.filter((row) => matchesName(row.name) && !row.deleted)
  for (const party of leftover) {
    await retireMatchingRegisterParties({ partyId: party.id, name: party.name, code: party.ownerCode })
  }
  return {
    farmers: hitFarmers.length,
    buyers: hitBuyers.length,
    register: leftover.length + hitFarmers.length + hitBuyers.length,
  }
}

const PURGE_ACTION = 'PURGE_RANA_OWNER_FARMERS_V3'

/** Remove the mixed Rana people from this shop once. Runs on the owner (live) shop too. */
export async function purgeMixedRanaPeopleOnce() {
  const done = await prisma.auditLog.findFirst({ where: { action: PURGE_ACTION } })
  if (done) return
  const result = await removePeopleFromShop()
  await logAudit({
    action: PURGE_ACTION,
    entityType: 'farmer',
    newValue: result,
  })
}

async function purgeKnownDuplicatePeopleOnce() {
  await purgeMixedRanaPeopleOnce()
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
