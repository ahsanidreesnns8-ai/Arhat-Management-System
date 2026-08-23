import { prisma } from '@/server/db'
import { normalizeAccountKey } from '@/server/ids'

export type TradeKind = 'PRODUCT' | 'SOLD' | 'FARMER_PAID' | 'BUYER_PAID'

export type TradeLine = {
  id: number
  kind: TradeKind
  amount: number
  notes: string | null
  createdAt: Date
  farmerId: number | null
  farmerCode: string | null
}

export type LinkedTrade = {
  key: string
  farmerId: number | null
  farmerCode: string | null
  farmerName: string | null
  buyerId: number | null
  buyerCode: string | null
  buyerName: string | null
  productTotal: number
  productCount: number
  farmerPaid: number
  soldTotal: number
  soldCount: number
  buyerPaid: number
  lines: TradeLine[]
}

function emptyTrade(key = ''): LinkedTrade {
  return {
    key,
    farmerId: null,
    farmerCode: null,
    farmerName: null,
    buyerId: null,
    buyerCode: null,
    buyerName: null,
    productTotal: 0,
    productCount: 0,
    farmerPaid: 0,
    soldTotal: 0,
    soldCount: 0,
    buyerPaid: 0,
    lines: [],
  }
}

function uniqueNameKeys<T extends { name: string }>(rows: T[]) {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const key = normalizeAccountKey(row.name)
    if (!key) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return new Set([...counts.entries()].filter(([, count]) => count === 1).map(([key]) => key))
}

function matchPerson<T extends { id: bigint; code: string; name: string }>(rows: T[], norm: string) {
  if (!norm) return null
  const byCode = rows.find((row) => normalizeAccountKey(row.code) === norm)
  if (byCode) return byCode
  const byName = rows.filter((row) => normalizeAccountKey(row.name) === norm)
  return byName.length === 1 ? byName[0] : null
}

function aliasUniqueName(
  map: Map<string, LinkedTrade>,
  rawCode: string,
  rawName: string,
  uniqueNames: Set<string>,
) {
  const nameKey = normalizeAccountKey(rawName)
  if (!nameKey || !uniqueNames.has(nameKey)) return
  const row = slot(map, rawCode)
  if (!row) return
  const existing = map.get(nameKey)
  if (existing && existing !== row) return
  map.set(nameKey, row)
}

function slot(map: Map<string, LinkedTrade>, raw: string) {
  const key = normalizeAccountKey(raw)
  if (!key) return null
  let row = map.get(key)
  if (!row) {
    row = emptyTrade(key)
    map.set(key, row)
  }
  return row
}

async function loadTradeTotalsIndex(): Promise<Map<string, LinkedTrade>> {
  const [farmers, buyers, dheriSums, farmerPays, saleSums, buyerPays] = await Promise.all([
    prisma.farmer.findMany({
      where: { deleted: false },
      select: { id: true, farmerId: true, name: true },
    }),
    prisma.buyer.findMany({
      where: { deleted: false },
      select: { id: true, buyerId: true, name: true },
    }),
    prisma.dheri.groupBy({
      by: ['farmerId'],
      where: { deleted: false },
      _sum: { farmerReceivable: true },
      _count: { _all: true },
    }),
    prisma.payment.groupBy({
      by: ['farmerId'],
      where: { farmerId: { not: null } },
      _sum: { amount: true },
    }),
    prisma.sale.groupBy({
      by: ['buyerId'],
      where: { deleted: false },
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),
    prisma.payment.groupBy({
      by: ['buyerId'],
      where: { buyerId: { not: null } },
      _sum: { amount: true },
    }),
  ])

  const map = new Map<string, LinkedTrade>()
  const uniqueFarmerNames = uniqueNameKeys(farmers)
  const uniqueBuyerNames = uniqueNameKeys(buyers)
  const dheriByFarmer = new Map(
    dheriSums.map((row) => [
      String(row.farmerId),
      { total: row._sum.farmerReceivable?.toNumber() ?? 0, count: row._count._all },
    ]),
  )
  const farmerPaidByFarmer = new Map(
    farmerPays
      .filter((row) => row.farmerId != null)
      .map((row) => [String(row.farmerId), row._sum.amount?.toNumber() ?? 0]),
  )
  const soldByBuyer = new Map(
    saleSums.map((row) => [
      String(row.buyerId),
      { total: row._sum.totalAmount?.toNumber() ?? 0, count: row._count._all },
    ]),
  )
  const buyerPaidByBuyer = new Map(
    buyerPays
      .filter((row) => row.buyerId != null)
      .map((row) => [String(row.buyerId), row._sum.amount?.toNumber() ?? 0]),
  )

  for (const farmer of farmers) {
    const row = slot(map, farmer.farmerId)
    if (!row) continue
    const dheri = dheriByFarmer.get(String(farmer.id))
    row.farmerId = Number(farmer.id)
    row.farmerCode = farmer.farmerId
    row.farmerName = farmer.name
    row.productTotal = dheri?.total ?? 0
    row.productCount = dheri?.count ?? 0
    row.farmerPaid = farmerPaidByFarmer.get(String(farmer.id)) ?? 0
    aliasUniqueName(map, farmer.farmerId, farmer.name, uniqueFarmerNames)
  }

  for (const buyer of buyers) {
    const row = slot(map, buyer.buyerId)
    if (!row) continue
    const sold = soldByBuyer.get(String(buyer.id))
    row.buyerId = Number(buyer.id)
    row.buyerCode = buyer.buyerId
    row.buyerName = buyer.name
    row.soldTotal = sold?.total ?? 0
    row.soldCount = sold?.count ?? 0
    row.buyerPaid = buyerPaidByBuyer.get(String(buyer.id)) ?? 0
    aliasUniqueName(map, buyer.buyerId, buyer.name, uniqueBuyerNames)
  }

  return map
}

export async function loadTradeIndex(includeLines = true): Promise<Map<string, LinkedTrade>> {
  if (!includeLines) return loadTradeTotalsIndex()
  const [farmers, buyers] = await Promise.all([
    prisma.farmer.findMany({
      where: { deleted: false },
      select: {
        id: true,
        farmerId: true,
        name: true,
        dheris: {
          where: { deleted: false },
          select: includeLines
            ? {
                id: true,
                dheriId: true,
                numberOfBags: true,
                farmerReceivable: true,
                createdAt: true,
                product: { select: { name: true } },
              }
            : { farmerReceivable: true },
        },
        payments: {
          select: includeLines
            ? { id: true, amount: true, notes: true, createdAt: true }
            : { amount: true },
        },
      },
    }),
    prisma.buyer.findMany({
      where: { deleted: false },
      select: {
        id: true,
        buyerId: true,
        name: true,
        sales: {
          where: { deleted: false },
          select: includeLines
            ? { id: true, invoiceNumber: true, totalAmount: true, createdAt: true }
            : { totalAmount: true },
        },
        payments: {
          select: includeLines
            ? { id: true, amount: true, notes: true, createdAt: true }
            : { amount: true },
        },
      },
    }),
  ])
  const map = new Map<string, LinkedTrade>()
  const uniqueFarmerNames = uniqueNameKeys(farmers)
  const uniqueBuyerNames = uniqueNameKeys(buyers)

  for (const farmer of farmers) {
    const row = slot(map, farmer.farmerId)
    if (!row) continue
    row.farmerId = Number(farmer.id)
    row.farmerCode = farmer.farmerId
    row.farmerName = farmer.name
    for (const dheri of farmer.dheris) {
      const amount = dheri.farmerReceivable.toNumber()
      row.productTotal += amount
      row.productCount += 1
      if (includeLines && 'id' in dheri) {
        row.lines.push({
          id: Number(dheri.id),
          kind: 'PRODUCT',
          amount,
          notes: `${dheri.product?.name || 'Product'} · ${dheri.numberOfBags} bags · dheri ${dheri.dheriId}`,
          createdAt: dheri.createdAt,
          farmerId: Number(farmer.id),
          farmerCode: farmer.farmerId,
        })
      }
    }
    for (const payment of farmer.payments) {
      const amount = payment.amount.toNumber()
      row.farmerPaid += amount
      if (includeLines && 'id' in payment) {
        row.lines.push({
          id: Number(payment.id),
          kind: 'FARMER_PAID',
          amount,
          notes: payment.notes || 'Paid to farmer',
          createdAt: payment.createdAt,
          farmerId: Number(farmer.id),
          farmerCode: farmer.farmerId,
        })
      }
    }
    aliasUniqueName(map, farmer.farmerId, farmer.name, uniqueFarmerNames)
  }

  for (const buyer of buyers) {
    const row = slot(map, buyer.buyerId)
    if (!row) continue
    row.buyerId = Number(buyer.id)
    row.buyerCode = buyer.buyerId
    row.buyerName = buyer.name
    for (const sale of buyer.sales) {
      const amount = sale.totalAmount.toNumber()
      row.soldTotal += amount
      row.soldCount += 1
      if (includeLines && 'id' in sale) {
        row.lines.push({
          id: Number(sale.id),
          kind: 'SOLD',
          amount,
          notes: `Sold · invoice ${sale.invoiceNumber}`,
          createdAt: sale.createdAt,
          farmerId: null,
          farmerCode: buyer.buyerId,
        })
      }
    }
    for (const payment of buyer.payments) {
      const amount = payment.amount.toNumber()
      row.buyerPaid += amount
      if (includeLines && 'id' in payment) {
        row.lines.push({
          id: Number(payment.id),
          kind: 'BUYER_PAID',
          amount,
          notes: payment.notes || 'Paid by buyer',
          createdAt: payment.createdAt,
          farmerId: null,
          farmerCode: buyer.buyerId,
        })
      }
    }
    aliasUniqueName(map, buyer.buyerId, buyer.name, uniqueBuyerNames)
  }

  if (includeLines) {
    for (const row of map.values()) {
      row.lines.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    }
  }
  return map
}

async function findRegisterPartiesForKeys(keys: Array<string | null | undefined>) {
  const wanted = new Set(
    keys.map((key) => normalizeAccountKey(key)).filter(Boolean),
  )
  if (!wanted.size) return []
  const parties = await prisma.registerParty.findMany({
    where: { deleted: false, kind: { in: [...MONEY_PARTY_KINDS] } },
    include: {
      entries: { where: { kind: { in: ['GIVING', 'RECEIVING'] } } },
    },
  })
  return parties.filter((row) => wanted.has(normalizeAccountKey(row.name)))
}

async function resolveAccountKeys(key: string, extraName?: string | null) {
  const raw = String(key ?? '').trim()
  const aliases = new Set<string>([raw, extraName || ''].filter(Boolean))
  const norm = normalizeAccountKey(raw)
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
  const farmer = matchPerson(
    farmers.map((row) => ({ id: row.id, code: row.farmerId, name: row.name })),
    norm,
  ) || (extraName
    ? matchPerson(
        farmers.map((row) => ({ id: row.id, code: row.farmerId, name: row.name })),
        normalizeAccountKey(extraName),
      )
    : null)
  const buyer = matchPerson(
    buyers.map((row) => ({ id: row.id, code: row.buyerId, name: row.name })),
    norm,
  ) || (extraName
    ? matchPerson(
        buyers.map((row) => ({ id: row.id, code: row.buyerId, name: row.name })),
        normalizeAccountKey(extraName),
      )
    : null)
  if (farmer) {
    aliases.add(farmer.code)
    aliases.add(farmer.name)
  }
  if (buyer) {
    aliases.add(buyer.code)
    aliases.add(buyer.name)
  }
  return { aliases: [...aliases], farmer, buyer, norm }
}

export async function findRegisterPartyByKey(key: string, extraName?: string | null) {
  const parties = await findRegisterPartiesForKeys(
    (await resolveAccountKeys(key, extraName)).aliases,
  )
  if (!parties.length) return null
  const norm = normalizeAccountKey(key)
  return parties.find((row) => normalizeAccountKey(row.name) === norm) ?? parties[0]
}

export function tradeForKey(index: Map<string, LinkedTrade>, name: string | null | undefined) {
  return index.get(normalizeAccountKey(name)) ?? emptyTrade(normalizeAccountKey(name))
}

const MONEY_PARTY_KINDS = ['GIVING', 'RECEIVING', 'PERSON'] as const

/** Reuse the Arhat Register person when farmer/buyer ID or unique name matches. */
export async function ensureRegisterPartyForAccount(code: string, extraName?: string | null) {
  const name = String(code ?? '').trim()
  if (!name) return null
  const existing = await findRegisterPartyByKey(name, extraName)
  if (existing) return existing
  return prisma.registerParty.create({
    data: { kind: 'PERSON', name, address: null, notes: null },
  })
}

export async function registerCashForKey(key: string, extraName?: string | null) {
  const parties = await findRegisterPartiesForKeys(
    (await resolveAccountKeys(key, extraName)).aliases,
  )
  if (!parties.length) {
    return { partyId: null as number | null, registerReceived: 0, registerGiven: 0 }
  }
  let registerReceived = 0
  let registerGiven = 0
  for (const party of parties) {
    for (const row of party.entries) {
      if (row.kind === 'RECEIVING') registerReceived += row.amount.toNumber()
      if (row.kind === 'GIVING') registerGiven += row.amount.toNumber()
    }
  }
  return { partyId: Number(parties[0].id), registerReceived, registerGiven }
}

export type AccountParts = {
  cashReceived: number
  cashGiven: number
  productTotal: number
  soldTotal: number
  farmerPaid: number
  buyerPaid: number
}

/**
 * Current account for one ID.
 * Product in and cash received from them add what we still owe.
 * Cash given, farmer payments, and goods sold deduct.
 * Example: given 80,000 then product 150,000 → remaining to give 70,000.
 */
export function accountPosition(parts: AccountParts) {
  const credit = parts.productTotal + parts.cashReceived + parts.buyerPaid
  const debit = parts.cashGiven + parts.soldTotal + parts.farmerPaid
  const hasTrade =
    parts.productTotal > 0 || parts.soldTotal > 0 || parts.farmerPaid > 0 || parts.buyerPaid > 0
  const netOwedToThem = hasTrade ? credit - debit : parts.cashReceived - parts.cashGiven
  const remainingToGive = netOwedToThem > 0 ? netOwedToThem : 0
  const remainingToReceive = netOwedToThem < 0 ? -netOwedToThem : 0
  const displayLabel = !hasTrade
    ? parts.cashReceived > parts.cashGiven
      ? 'Received'
      : parts.cashGiven > parts.cashReceived
        ? 'Given'
        : 'Settled'
    : remainingToGive > 0
      ? 'Remaining to give'
      : remainingToReceive > 0
        ? 'Remaining to receive'
        : 'Settled'
  return {
    hasTrade,
    netOwedToThem,
    remainingToGive: hasTrade ? remainingToGive : 0,
    remainingToReceive: hasTrade ? remainingToReceive : 0,
    receivedTotal: hasTrade ? remainingToReceive : parts.cashReceived,
    givenTotal: hasTrade ? remainingToGive : parts.cashGiven,
    displayLabel,
  }
}

export type AccountStatementLine = {
  createdAt: Date
  particular: string
  addition: number
  deduction: number
  kind: string
}

export type AccountStatement = {
  key: string
  name: string
  partyId: number | null
  farmerId: number | null
  farmerCode: string | null
  farmerName: string | null
  buyerId: number | null
  buyerCode: string | null
  buyerName: string | null
  cashGiven: number
  cashReceived: number
  productTotal: number
  soldTotal: number
  farmerPaid: number
  buyerPaid: number
  additionTotal: number
  deductionTotal: number
  remainingToGive: number
  remainingToReceive: number
  lines: AccountStatementLine[]
}

function stampLine(createdAt: Date, particular: string, addition: number, deduction: number, kind: string): AccountStatementLine {
  return { createdAt, particular, addition, deduction, kind }
}

function matchByNormalizedCode<T extends { id: bigint; code: string; name: string }>(
  rows: T[],
  norm: string,
) {
  return matchPerson(rows, norm)
}

export async function loadTradeForKey(key: string): Promise<LinkedTrade> {
  const raw = String(key ?? '').trim()
  const norm = normalizeAccountKey(raw)
  const row = emptyTrade(norm)
  if (!norm) return row

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
  const farmer = matchByNormalizedCode(
    farmers.map((item) => ({ id: item.id, code: item.farmerId, name: item.name })),
    norm,
  )
  const buyer = matchByNormalizedCode(
    buyers.map((item) => ({ id: item.id, code: item.buyerId, name: item.name })),
    norm,
  )

  if (farmer) {
    row.farmerId = Number(farmer.id)
    row.farmerCode = farmer.code
    row.farmerName = farmer.name
    const [dheris, payments] = await Promise.all([
      prisma.dheri.findMany({
        where: { farmerId: farmer.id, deleted: false },
        select: {
          id: true,
          dheriId: true,
          numberOfBags: true,
          farmerReceivable: true,
          createdAt: true,
          product: { select: { name: true } },
        },
      }),
      prisma.payment.findMany({
        where: { farmerId: farmer.id },
        select: { id: true, amount: true, notes: true, createdAt: true },
      }),
    ])
    for (const dheri of dheris) {
      const amount = dheri.farmerReceivable.toNumber()
      row.productTotal += amount
      row.productCount += 1
      row.lines.push({
        id: Number(dheri.id),
        kind: 'PRODUCT',
        amount,
        notes: `${dheri.product?.name || 'Product'} · ${dheri.numberOfBags} bags · dheri ${dheri.dheriId}`,
        createdAt: dheri.createdAt,
        farmerId: Number(farmer.id),
        farmerCode: farmer.code,
      })
    }
    for (const payment of payments) {
      const amount = payment.amount.toNumber()
      row.farmerPaid += amount
      row.lines.push({
        id: Number(payment.id),
        kind: 'FARMER_PAID',
        amount,
        notes: payment.notes || 'Paid to farmer',
        createdAt: payment.createdAt,
        farmerId: Number(farmer.id),
        farmerCode: farmer.code,
      })
    }
  }

  if (buyer) {
    row.buyerId = Number(buyer.id)
    row.buyerCode = buyer.code
    row.buyerName = buyer.name
    const [sales, payments] = await Promise.all([
      prisma.sale.findMany({
        where: { buyerId: buyer.id, deleted: false },
        select: { id: true, invoiceNumber: true, totalAmount: true, createdAt: true },
      }),
      prisma.payment.findMany({
        where: { buyerId: buyer.id },
        select: { id: true, amount: true, notes: true, createdAt: true },
      }),
    ])
    for (const sale of sales) {
      const amount = sale.totalAmount.toNumber()
      row.soldTotal += amount
      row.soldCount += 1
      row.lines.push({
        id: Number(sale.id),
        kind: 'SOLD',
        amount,
        notes: `Sold · invoice ${sale.invoiceNumber}`,
        createdAt: sale.createdAt,
        farmerId: null,
        farmerCode: buyer.code,
      })
    }
    for (const payment of payments) {
      const amount = payment.amount.toNumber()
      row.buyerPaid += amount
      row.lines.push({
        id: Number(payment.id),
        kind: 'BUYER_PAID',
        amount,
        notes: payment.notes || 'Paid by buyer',
        createdAt: payment.createdAt,
        farmerId: null,
        farmerCode: buyer.code,
      })
    }
  }

  row.lines.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  return row
}

export async function getAccountStatement(key: string, extraName?: string | null): Promise<AccountStatement> {
  const resolved = await resolveAccountKeys(key, extraName)
  const [parties, trade] = await Promise.all([
    findRegisterPartiesForKeys(resolved.aliases),
    loadTradeForKey(key),
  ])
  const entries = parties.flatMap((party) => party.entries)
  const cashReceived = entries
    .filter((row) => row.kind === 'RECEIVING')
    .reduce((sum, row) => sum + row.amount.toNumber(), 0)
  const cashGiven = entries
    .filter((row) => row.kind === 'GIVING')
    .reduce((sum, row) => sum + row.amount.toNumber(), 0)

  const lines: AccountStatementLine[] = []
  for (const row of entries) {
    const amount = row.amount.toNumber()
    if (row.kind === 'RECEIVING') {
      lines.push(stampLine(row.createdAt, row.notes || 'Received on Arhat Register', amount, 0, 'RECEIVING'))
    }
    if (row.kind === 'GIVING') {
      lines.push(stampLine(row.createdAt, row.notes || 'Given on Arhat Register', 0, amount, 'GIVING'))
    }
  }
  for (const line of trade.lines) {
    if (line.kind === 'PRODUCT') {
      lines.push(stampLine(line.createdAt, line.notes || 'Farmer product', line.amount, 0, 'PRODUCT'))
    } else if (line.kind === 'SOLD') {
      lines.push(stampLine(line.createdAt, line.notes || 'Sold', 0, line.amount, 'SOLD'))
    } else if (line.kind === 'FARMER_PAID') {
      lines.push(stampLine(line.createdAt, line.notes || 'Paid to farmer', 0, line.amount, 'FARMER_PAID'))
    } else if (line.kind === 'BUYER_PAID') {
      lines.push(stampLine(line.createdAt, line.notes || 'Paid by buyer', line.amount, 0, 'BUYER_PAID'))
    }
  }
  lines.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  const additionTotal = lines.reduce((sum, row) => sum + row.addition, 0)
  const deductionTotal = lines.reduce((sum, row) => sum + row.deduction, 0)
  const remaining = additionTotal - deductionTotal
  const party = parties.find((row) => normalizeAccountKey(row.name) === resolved.norm) ?? parties[0] ?? null
  return {
    key: resolved.norm,
    name: trade.farmerName || trade.buyerName || party?.name || key,
    partyId: party ? Number(party.id) : null,
    farmerId: trade.farmerId,
    farmerCode: trade.farmerCode,
    farmerName: trade.farmerName,
    buyerId: trade.buyerId,
    buyerCode: trade.buyerCode,
    buyerName: trade.buyerName,
    cashGiven,
    cashReceived,
    productTotal: trade.productTotal,
    soldTotal: trade.soldTotal,
    farmerPaid: trade.farmerPaid,
    buyerPaid: trade.buyerPaid,
    additionTotal,
    deductionTotal,
    remainingToGive: remaining > 0 ? remaining : 0,
    remainingToReceive: remaining < 0 ? -remaining : 0,
    lines,
  }
}
