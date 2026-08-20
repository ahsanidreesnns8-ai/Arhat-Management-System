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

export async function loadTradeIndex(): Promise<Map<string, LinkedTrade>> {
  const [farmers, buyers] = await Promise.all([
    prisma.farmer.findMany({
      where: { deleted: false },
      include: {
        dheris: { where: { deleted: false }, include: { product: true } },
        payments: true,
      },
    }),
    prisma.buyer.findMany({
      where: { deleted: false },
      include: {
        sales: { where: { deleted: false } },
        payments: true,
      },
    }),
  ])
  const map = new Map<string, LinkedTrade>()

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
    for (const payment of farmer.payments) {
      const amount = payment.amount.toNumber()
      row.farmerPaid += amount
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
    for (const payment of buyer.payments) {
      const amount = payment.amount.toNumber()
      row.buyerPaid += amount
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

  for (const row of map.values()) {
    row.lines.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  }
  return map
}

export function tradeForKey(index: Map<string, LinkedTrade>, name: string | null | undefined) {
  return index.get(normalizeAccountKey(name)) ?? emptyTrade(normalizeAccountKey(name))
}

const MONEY_PARTY_KINDS = ['GIVING', 'RECEIVING', 'PERSON'] as const

export async function findRegisterPartyByKey(key: string) {
  const norm = normalizeAccountKey(key)
  if (!norm) return null
  const parties = await prisma.registerParty.findMany({
    where: { deleted: false, kind: { in: [...MONEY_PARTY_KINDS] } },
    include: {
      entries: { where: { kind: { in: ['GIVING', 'RECEIVING'] } } },
    },
  })
  return parties.find((row) => normalizeAccountKey(row.name) === norm) ?? null
}

/** Reuse the Arhat Register person when farmer/buyer ID matches (R74.1 / r74.1 / "R 74.1"). */
export async function ensureRegisterPartyForAccount(code: string) {
  const name = String(code ?? '').trim()
  if (!name) return null
  const existing = await findRegisterPartyByKey(name)
  if (existing) return existing
  return prisma.registerParty.create({
    data: { kind: 'PERSON', name, address: null, notes: null },
  })
}

export async function registerCashForKey(key: string) {
  const party = await findRegisterPartyByKey(key)
  if (!party) {
    return { partyId: null as number | null, registerReceived: 0, registerGiven: 0 }
  }
  const registerReceived = party.entries
    .filter((row) => row.kind === 'RECEIVING')
    .reduce((sum, row) => sum + row.amount.toNumber(), 0)
  const registerGiven = party.entries
    .filter((row) => row.kind === 'GIVING')
    .reduce((sum, row) => sum + row.amount.toNumber(), 0)
  return { partyId: Number(party.id), registerReceived, registerGiven }
}
