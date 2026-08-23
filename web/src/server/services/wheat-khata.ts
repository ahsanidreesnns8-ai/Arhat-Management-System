import { prisma } from '@/server/db'
import { d, roundRupee, totalWeight } from '@/server/money'
import { resolveBook } from '@/server/services/grain-khata'

const PARTY_KINDS = ['RECEIVING', 'GIVING'] as const
export type WheatKhataPartyKind = (typeof PARTY_KINDS)[number]
const DEFAULT_BAG_KG = 40
export const BAGS_PER_TRUCK = 600

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
  if (kind === 'PARTY' || kind === 'RECEIVING') return 'RECEIVING'
  if (kind === 'COMPANY' || kind === 'GIVING') return 'GIVING'
  throw new Error('Choose party or company')
}

function parseAmount(value: unknown, label = 'Amount') {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Enter a valid ${label.toLowerCase()}`)
  }
  return roundRupee(amount).toNumber()
}

function parseOptionalMoney(value: unknown, label: string) {
  if (value == null || String(value).trim() === '') return 0
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`Enter a valid ${label.toLowerCase()}`)
  }
  return roundRupee(amount).toNumber()
}

function parseCount(value: unknown, label: string) {
  if (value == null || String(value).trim() === '') return 0
  const count = Number(value)
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(`Enter a valid ${label}`)
  }
  return count
}

function resolveBagsAndTrucks(input: { bags?: unknown; trucks?: unknown }) {
  const extraBags = parseCount(input.bags, 'bags')
  const trucks = parseCount(input.trucks, 'trucks')
  const bags = trucks * BAGS_PER_TRUCK + extraBags
  if (bags <= 0) throw new Error('Enter number of bags')
  return { bags, trucks, extraBags }
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

function paymentDto(row: {
  id: bigint
  partyId: bigint
  amount: { toNumber(): number }
  notes: string | null
  createdAt: Date
  party?: { name: string; kind: string } | null
}) {
  const stamp = karachiParts(row.createdAt)
  return {
    id: Number(row.id),
    partyId: Number(row.partyId),
    partyName: row.party?.name ?? null,
    partyKind: row.party?.kind ?? null,
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
  trucks?: number | null
  bagWeightKg: { toNumber(): number }
  ratePerBag: { toNumber(): number }
  bagPricePerBag?: { toNumber(): number } | null
  labourPerBag?: { toNumber(): number } | null
  totalPrice: { toNumber(): number }
  notes: string | null
  createdAt: Date
  party?: { name: string; address: string | null } | null
}) {
  const stamp = karachiParts(row.createdAt)
  const bags = row.bags
  const trucks = row.trucks ?? 0
  const bagWeightKg = row.bagWeightKg.toNumber()
  const ratePerBag = row.ratePerBag.toNumber()
  const bagPricePerBag = row.bagPricePerBag?.toNumber() ?? 0
  const labourPerBag = row.labourPerBag?.toNumber() ?? 0
  const wheatAmount = roundRupee(d(bags).mul(ratePerBag)).toNumber()
  const bagAmount = roundRupee(d(bags).mul(bagPricePerBag)).toNumber()
  const labourAmount = roundRupee(d(bags).mul(labourPerBag)).toNumber()
  return {
    id: Number(row.id),
    partyId: Number(row.partyId),
    partyName: row.party?.name ?? null,
    partyAddress: row.party?.address ?? null,
    bags,
    trucks,
    bagWeightKg,
    totalWeightKg: totalWeight(bags, bagWeightKg).toNumber(),
    ratePerBag,
    bagPricePerBag,
    labourPerBag,
    wheatAmount,
    bagAmount,
    labourAmount,
    totalPrice: row.totalPrice.toNumber(),
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    day: stamp.day,
    date: stamp.date,
    time: stamp.time,
  }
}

type ProductRow = {
  id: bigint
  partyId: bigint
  bags: number
  trucks?: number | null
  bagWeightKg: { toNumber(): number }
  ratePerBag: { toNumber(): number }
  bagPricePerBag?: { toNumber(): number } | null
  labourPerBag?: { toNumber(): number } | null
  totalPrice: { toNumber(): number }
  notes: string | null
  createdAt: Date
}

type PaymentRow = {
  id: bigint
  partyId: bigint
  amount: { toNumber(): number }
  notes: string | null
  createdAt: Date
}

function partyDto(
  party: {
    id: bigint
    bookKey?: string
    kind: string
    name: string
    address: string | null
    notes: string | null
    createdAt: Date
    products?: ProductRow[]
    payments?: PaymentRow[]
  },
  includeDetails = true,
) {
  const products = (party.products || []).map((row) =>
    productDto({
      ...row,
      party: { name: party.name, address: party.address },
    }),
  )
  const payments = (party.payments || []).map((row) =>
    paymentDto({
      ...row,
      party: { name: party.name, kind: party.kind },
    }),
  )
  const totalBags = products.reduce((sum, row) => sum + row.bags, 0)
  const totalWeightKg = products.reduce((sum, row) => sum + row.totalWeightKg, 0)
  const productTotal = products.reduce((sum, row) => sum + row.totalPrice, 0)
  const cashTotal = payments.reduce((sum, row) => sum + row.amount, 0)
  const bagAmount = products.reduce((sum, row) => sum + row.bagAmount, 0)
  const labourAmount = products.reduce((sum, row) => sum + row.labourAmount, 0)
  const wheatAmount = products.reduce((sum, row) => sum + row.wheatAmount, 0)
  return {
    id: Number(party.id),
    bookKey: party.bookKey || 'WHEAT',
    kind: party.kind,
    name: party.name,
    address: party.address,
    notes: party.notes,
    createdAt: party.createdAt.toISOString(),
    productCount: products.length,
    paymentCount: payments.length,
    totalBags,
    totalWeightKg,
    wheatAmount,
    bagAmount,
    labourAmount,
    productTotal,
    cashTotal,
    totalPrice: productTotal + cashTotal,
    remaining: productTotal - cashTotal,
    ...(includeDetails ? { products, payments } : {}),
  }
}

const partyInclude = {
  products: { orderBy: { createdAt: 'desc' as const } },
  payments: { orderBy: { createdAt: 'desc' as const } },
}

export function previewProduct(input: {
  bags?: unknown
  trucks?: unknown
  ratePerBag?: unknown
  bagWeightKg?: unknown
  bagPricePerBag?: unknown
  labourPerBag?: unknown
}) {
  const { bags, trucks } = resolveBagsAndTrucks(input)
  const ratePerBag = parseAmount(input.ratePerBag, 'Rate of one bag')
  const bagPricePerBag = parseOptionalMoney(input.bagPricePerBag, 'Bag price')
  const labourPerBag = parseOptionalMoney(input.labourPerBag, 'Labour per bag')
  const bagWeightKgRaw = input.bagWeightKg == null || String(input.bagWeightKg).trim() === ''
    ? DEFAULT_BAG_KG
    : Number(input.bagWeightKg)
  if (!Number.isFinite(bagWeightKgRaw) || bagWeightKgRaw <= 0) {
    throw new Error('Enter weight of one bag in KG')
  }
  const bagWeightKg = d(bagWeightKgRaw).toDecimalPlaces(2).toNumber()
  const wheatAmount = roundRupee(d(bags).mul(ratePerBag)).toNumber()
  const bagAmount = roundRupee(d(bags).mul(bagPricePerBag)).toNumber()
  const labourAmount = roundRupee(d(bags).mul(labourPerBag)).toNumber()
  const totalPrice = wheatAmount + bagAmount + labourAmount
  const weightKg = totalWeight(bags, bagWeightKg).toNumber()
  return {
    bags,
    trucks,
    bagWeightKg,
    ratePerBag,
    bagPricePerBag,
    labourPerBag,
    wheatAmount,
    bagAmount,
    labourAmount,
    totalPrice,
    totalWeightKg: weightKg,
  }
}

async function bagStock(bookKey: string) {
  const [received, given] = await Promise.all([
    prisma.wheatKhataProduct.aggregate({
      _sum: { bags: true },
      where: { party: { deleted: false, kind: 'RECEIVING', bookKey } },
    }),
    prisma.wheatKhataProduct.aggregate({
      _sum: { bags: true },
      where: { party: { deleted: false, kind: 'GIVING', bookKey } },
    }),
  ])
  const bagsReceived = received._sum.bags ?? 0
  const bagsGiven = given._sum.bags ?? 0
  return {
    bagsReceived,
    bagsGiven,
    bagsInStock: bagsReceived - bagsGiven,
  }
}

export async function getBook(bookKey?: unknown) {
  const book = await resolveBook(bookKey)
  const [moneyRows, receivingRows, givingRows] = await Promise.all([
    prisma.wheatKhataMoney.findMany({
      where: { bookKey: book.key },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.wheatKhataParty.findMany({
      where: { deleted: false, kind: 'RECEIVING', bookKey: book.key },
      orderBy: { name: 'asc' },
      include: partyInclude,
    }),
    prisma.wheatKhataParty.findMany({
      where: { deleted: false, kind: 'GIVING', bookKey: book.key },
      orderBy: { name: 'asc' },
      include: partyInclude,
    }),
  ])

  const money = moneyRows.map(moneyDto)
  const parties = receivingRows.map((row) => partyDto(row))
  const companies = givingRows.map((row) => partyDto(row))
  const moneyIn = money.reduce((sum, row) => sum + row.amount, 0)
  const givingToParty =
    parties.reduce((sum, row) => sum + row.productTotal, 0) +
    parties.reduce((sum, row) => sum + row.cashTotal, 0)
  const receivingFromCompany =
    companies.reduce((sum, row) => sum + row.productTotal, 0) +
    companies.reduce((sum, row) => sum + row.cashTotal, 0)
  const cashGiven = parties.reduce((sum, row) => sum + row.cashTotal, 0)
  const cashReceived = companies.reduce((sum, row) => sum + row.cashTotal, 0)
  const bagsReceived = parties.reduce((sum, row) => sum + row.totalBags, 0)
  const bagsGiven = companies.reduce((sum, row) => sum + row.totalBags, 0)

  return {
    book,
    totals: {
      moneyIn,
      receivingFromCompany,
      givingToParty,
      cashGiven,
      cashReceived,
      totalAmount: moneyIn + cashReceived - cashGiven,
      bagsReceived,
      bagsGiven,
      bagsInStock: bagsReceived - bagsGiven,
      bagsPerTruck: BAGS_PER_TRUCK,
    },
    money,
    parties,
    companies,
  }
}

export async function addMoney(input: { amount?: unknown; notes?: unknown }, bookKey?: unknown) {
  const book = await resolveBook(bookKey)
  const amount = parseAmount(input.amount)
  const row = await prisma.wheatKhataMoney.create({
    data: {
      bookKey: book.key,
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
}, bookKey?: unknown) {
  const book = await resolveBook(bookKey)
  const kind = parseKind(input.kind)
  const name = String(input.name ?? '').trim()
  if (!name) throw new Error(kind === 'GIVING' ? 'Company name is required' : 'Party name is required')
  const address = parseOptionalText(input.address)
  const notes = parseOptionalText(input.notes)

  const existing = await prisma.wheatKhataParty.findFirst({
    where: {
      deleted: false,
      bookKey: book.key,
      kind,
      name: { equals: name, mode: 'insensitive' },
    },
    include: partyInclude,
  })
  if (existing) {
    const updated = await prisma.wheatKhataParty.update({
      where: { id: existing.id },
      data: {
        ...(address ? { address } : {}),
        ...(notes ? { notes } : {}),
      },
      include: partyInclude,
    })
    return partyDto(updated)
  }

  const row = await prisma.wheatKhataParty.create({
    data: { bookKey: book.key, kind, name, address, notes },
    include: partyInclude,
  })
  return partyDto(row)
}

export async function getParty(id: number | bigint, bookKey?: unknown) {
  const party = await prisma.wheatKhataParty.findFirst({
    where: { id: BigInt(id), deleted: false },
    include: partyInclude,
  })
  if (!party) throw new Error('Party not found')
  if (bookKey != null && String(bookKey).trim()) {
    const book = await resolveBook(bookKey)
    if (party.bookKey !== book.key) throw new Error('Party not found')
  }
  return partyDto(party)
}

export async function addProduct(input: {
  partyId?: unknown
  bags?: unknown
  trucks?: unknown
  ratePerBag?: unknown
  bagWeightKg?: unknown
  bagPricePerBag?: unknown
  labourPerBag?: unknown
  notes?: unknown
}, bookKey?: unknown) {
  const partyId = Number(input.partyId)
  if (!Number.isSafeInteger(partyId) || partyId <= 0) {
    throw new Error('Choose a party first')
  }
  const party = await prisma.wheatKhataParty.findFirst({
    where: { id: BigInt(partyId), deleted: false },
  })
  if (!party) throw new Error('Party not found')
  if (bookKey != null && String(bookKey).trim()) {
    const book = await resolveBook(bookKey)
    if (party.bookKey !== book.key) throw new Error('Party not found')
  }

  const preview = previewProduct(input)
  if (party.kind === 'GIVING') {
    const stock = await bagStock(party.bookKey)
    if (preview.bags > stock.bagsInStock) {
      throw new Error(
        `Only ${stock.bagsInStock} bags in stock. Received ${stock.bagsReceived} from parties, sold ${stock.bagsGiven} to companies.`,
      )
    }
  }
  const row = await prisma.wheatKhataProduct.create({
    data: {
      partyId: party.id,
      bags: preview.bags,
      trucks: preview.trucks,
      bagWeightKg: preview.bagWeightKg,
      ratePerBag: preview.ratePerBag,
      bagPricePerBag: preview.bagPricePerBag,
      labourPerBag: preview.labourPerBag,
      totalPrice: preview.totalPrice,
      notes: parseOptionalText(input.notes),
    },
  })
  return productDto({
    ...row,
    party: { name: party.name, address: party.address },
  })
}

export async function addPayment(input: { partyId?: unknown; amount?: unknown; notes?: unknown }, bookKey?: unknown) {
  const partyId = Number(input.partyId)
  if (!Number.isSafeInteger(partyId) || partyId <= 0) {
    throw new Error('Choose a party first')
  }
  const party = await prisma.wheatKhataParty.findFirst({
    where: { id: BigInt(partyId), deleted: false },
  })
  if (!party) throw new Error('Party not found')
  if (bookKey != null && String(bookKey).trim()) {
    const book = await resolveBook(bookKey)
    if (party.bookKey !== book.key) throw new Error('Party not found')
  }

  const amount = parseAmount(input.amount)
  const row = await prisma.wheatKhataPayment.create({
    data: {
      partyId: party.id,
      amount,
      notes: parseOptionalText(input.notes),
    },
  })
  return paymentDto({
    ...row,
    party: { name: party.name, kind: party.kind },
  })
}
