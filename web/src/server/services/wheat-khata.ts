import { prisma } from '@/server/db'
import { d, roundRupee, totalWeight } from '@/server/money'

const PARTY_KINDS = ['RECEIVING', 'GIVING'] as const
export type WheatKhataPartyKind = (typeof PARTY_KINDS)[number]
const DEFAULT_BAG_KG = 40

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

function parseKind(value: unknown): WheatKhataPartyKind {
  const kind = String(value ?? '').trim().toUpperCase()
  if (!PARTY_KINDS.includes(kind as WheatKhataPartyKind)) {
    throw new Error('Choose receiving or selling party')
  }
  return kind as WheatKhataPartyKind
}

function parseAmount(value: unknown, label = 'Amount') {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Enter a valid ${label.toLowerCase()}`)
  }
  return roundRupee(amount).toNumber()
}

function parseBags(value: unknown) {
  const bags = Number(value)
  if (!Number.isInteger(bags) || bags <= 0) {
    throw new Error('Enter number of bags')
  }
  return bags
}

function parseOptionalText(value: unknown) {
  const text = String(value ?? '').trim()
  return text || null
}

function moneyDto(row: {
  id: bigint
  amount: { toNumber(): number }
  notes: string | null
  createdAt: Date
}) {
  const stamp = karachiParts(row.createdAt)
  return {
    id: Number(row.id),
    amount: row.amount.toNumber(),
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    day: stamp.day,
    date: stamp.date,
    time: stamp.time,
  }
}

function productDto(row: {
  id: bigint
  partyId: bigint
  bags: number
  bagWeightKg: { toNumber(): number }
  ratePerBag: { toNumber(): number }
  totalPrice: { toNumber(): number }
  notes: string | null
  createdAt: Date
  party?: { name: string; address: string | null } | null
}) {
  const stamp = karachiParts(row.createdAt)
  const bags = row.bags
  const bagWeightKg = row.bagWeightKg.toNumber()
  return {
    id: Number(row.id),
    partyId: Number(row.partyId),
    partyName: row.party?.name ?? null,
    partyAddress: row.party?.address ?? null,
    bags,
    bagWeightKg,
    totalWeightKg: totalWeight(bags, bagWeightKg).toNumber(),
    ratePerBag: row.ratePerBag.toNumber(),
    totalPrice: row.totalPrice.toNumber(),
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    day: stamp.day,
    date: stamp.date,
    time: stamp.time,
  }
}

type ProductDto = ReturnType<typeof productDto>

function partyDto(
  party: {
    id: bigint
    kind: string
    name: string
    address: string | null
    notes: string | null
    createdAt: Date
    products?: Array<{
      id: bigint
      partyId: bigint
      bags: number
      bagWeightKg: { toNumber(): number }
      ratePerBag: { toNumber(): number }
      totalPrice: { toNumber(): number }
      notes: string | null
      createdAt: Date
    }>
  },
  includeProducts = true,
) {
  const products = (party.products || []).map((row) =>
    productDto({
      ...row,
      party: { name: party.name, address: party.address },
    }),
  )
  const totalBags = products.reduce((sum, row) => sum + row.bags, 0)
  const totalWeightKg = products.reduce((sum, row) => sum + row.totalWeightKg, 0)
  const totalPrice = products.reduce((sum, row) => sum + row.totalPrice, 0)
  return {
    id: Number(party.id),
    kind: party.kind,
    name: party.name,
    address: party.address,
    notes: party.notes,
    createdAt: party.createdAt.toISOString(),
    productCount: products.length,
    totalBags,
    totalWeightKg,
    totalPrice,
    ...(includeProducts ? { products } : {}),
  }
}

export function previewProduct(input: { bags?: unknown; ratePerBag?: unknown; bagWeightKg?: unknown }) {
  const bags = parseBags(input.bags)
  const ratePerBag = parseAmount(input.ratePerBag, 'Rate of one bag')
  const bagWeightKgRaw = input.bagWeightKg == null || String(input.bagWeightKg).trim() === ''
    ? DEFAULT_BAG_KG
    : Number(input.bagWeightKg)
  if (!Number.isFinite(bagWeightKgRaw) || bagWeightKgRaw <= 0) {
    throw new Error('Enter weight of one bag in KG')
  }
  const bagWeightKg = d(bagWeightKgRaw).toDecimalPlaces(2).toNumber()
  const totalPrice = roundRupee(d(bags).mul(ratePerBag)).toNumber()
  const weightKg = totalWeight(bags, bagWeightKg).toNumber()
  return { bags, bagWeightKg, ratePerBag, totalPrice, totalWeightKg: weightKg }
}

export async function getBook() {
  const [moneyRows, receivingRows, givingRows] = await Promise.all([
    prisma.wheatKhataMoney.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.wheatKhataParty.findMany({
      where: { deleted: false, kind: 'RECEIVING' },
      orderBy: { name: 'asc' },
      include: { products: { orderBy: { createdAt: 'desc' } } },
    }),
    prisma.wheatKhataParty.findMany({
      where: { deleted: false, kind: 'GIVING' },
      orderBy: { name: 'asc' },
      include: { products: { orderBy: { createdAt: 'desc' } } },
    }),
  ])

  const money = moneyRows.map(moneyDto)
  const receivingParties = receivingRows.map((row) => partyDto(row))
  const givingParties = givingRows.map((row) => partyDto(row))
  const moneyIn = money.reduce((sum, row) => sum + row.amount, 0)
  const receivingAmount = receivingParties.reduce((sum, row) => sum + row.totalPrice, 0)
  const givingAmount = givingParties.reduce((sum, row) => sum + row.totalPrice, 0)

  return {
    totals: {
      moneyIn,
      receivingAmount,
      givingAmount,
      totalAmount: moneyIn + givingAmount - receivingAmount,
    },
    money,
    receivingParties,
    givingParties,
  }
}

export async function addMoney(input: { amount?: unknown; notes?: unknown }) {
  const amount = parseAmount(input.amount)
  const row = await prisma.wheatKhataMoney.create({
    data: {
      amount,
      notes: parseOptionalText(input.notes),
    },
  })
  return moneyDto(row)
}

export async function createParty(input: {
  kind?: unknown
  name?: unknown
  address?: unknown
  notes?: unknown
}) {
  const kind = parseKind(input.kind)
  const name = String(input.name ?? '').trim()
  if (!name) throw new Error('Party name is required')
  const address = parseOptionalText(input.address)
  const notes = parseOptionalText(input.notes)

  const existing = await prisma.wheatKhataParty.findFirst({
    where: {
      deleted: false,
      kind,
      name: { equals: name, mode: 'insensitive' },
    },
    include: { products: { orderBy: { createdAt: 'desc' } } },
  })
  if (existing) {
    const updated = await prisma.wheatKhataParty.update({
      where: { id: existing.id },
      data: {
        ...(address ? { address } : {}),
        ...(notes ? { notes } : {}),
      },
      include: { products: { orderBy: { createdAt: 'desc' } } },
    })
    return partyDto(updated)
  }

  const row = await prisma.wheatKhataParty.create({
    data: { kind, name, address, notes },
    include: { products: { orderBy: { createdAt: 'desc' } } },
  })
  return partyDto(row)
}

export async function getParty(id: number | bigint) {
  const party = await prisma.wheatKhataParty.findFirst({
    where: { id: BigInt(id), deleted: false },
    include: { products: { orderBy: { createdAt: 'desc' } } },
  })
  if (!party) throw new Error('Party not found')
  return partyDto(party)
}

export async function addProduct(input: {
  partyId?: unknown
  bags?: unknown
  ratePerBag?: unknown
  bagWeightKg?: unknown
  notes?: unknown
}) {
  const partyId = Number(input.partyId)
  if (!Number.isSafeInteger(partyId) || partyId <= 0) {
    throw new Error('Choose a party first')
  }
  const party = await prisma.wheatKhataParty.findFirst({
    where: { id: BigInt(partyId), deleted: false },
  })
  if (!party) throw new Error('Party not found')

  const preview = previewProduct(input)
  const row = await prisma.wheatKhataProduct.create({
    data: {
      partyId: party.id,
      bags: preview.bags,
      bagWeightKg: preview.bagWeightKg,
      ratePerBag: preview.ratePerBag,
      totalPrice: preview.totalPrice,
      notes: parseOptionalText(input.notes),
    },
  })
  return productDto({
    ...row,
    party: { name: party.name, address: party.address },
  })
}
