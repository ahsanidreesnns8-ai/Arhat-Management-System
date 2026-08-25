import { Prisma } from '@prisma/client'
import { prisma } from '@/server/db'
import { d, roundRupee, totalWeight } from '@/server/money'
import { requireOwnedBook, resolveShopBook } from '@/server/services/grain-khata'
import { addBank as parkInBank, addOtherExpense as parkExpense, listHeads, loadTreasury, receiveFromBank as takeFromBank, transferTo as sendToHead, withTreasury } from '@/server/services/khata-treasury'
import { addPersonCash, deletePerson, getPerson, listPeople, updatePerson } from '@/server/services/khata-ledger'
import { getWorkspace } from '@/server/workspace'

export type GrainBookAccess = { userId: bigint; secret?: unknown }

async function openBook(bookKey?: unknown, access?: GrainBookAccess) {
  if (access?.userId != null) return requireOwnedBook(bookKey ?? 'WHEAT', access.userId, access.secret)
  return resolveShopBook(bookKey ?? 'WHEAT')
}

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

function num(value: unknown) {
  if (value == null) return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'object' && value && 'toNumber' in value && typeof (value as { toNumber: () => number }).toNumber === 'function') {
    return (value as { toNumber: () => number }).toNumber()
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function partySummaryDto(
  party: {
    id: bigint
    bookKey?: string
    kind: string
    name: string
    address: string | null
    notes: string | null
    createdAt: Date
  },
  stats: {
    productCount: number
    paymentCount: number
    totalBags: number
    totalWeightKg: number
    wheatAmount: number
    bagAmount: number
    labourAmount: number
    productTotal: number
    cashTotal: number
  },
) {
  return {
    id: Number(party.id),
    bookKey: party.bookKey || 'WHEAT',
    kind: party.kind,
    name: party.name,
    address: party.address,
    notes: party.notes,
    createdAt: party.createdAt.toISOString(),
    productCount: stats.productCount,
    paymentCount: stats.paymentCount,
    totalBags: stats.totalBags,
    totalWeightKg: stats.totalWeightKg,
    wheatAmount: stats.wheatAmount,
    bagAmount: stats.bagAmount,
    labourAmount: stats.labourAmount,
    productTotal: stats.productTotal,
    cashTotal: stats.cashTotal,
    totalPrice: stats.productTotal + stats.cashTotal,
    remaining: stats.productTotal - stats.cashTotal,
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

type ProductStatRow = {
  party_id: bigint
  product_count: bigint | number
  bags: bigint | number
  weight_kg: unknown
  wheat_amount: unknown
  bag_amount: unknown
  labour_amount: unknown
  product_total: unknown
}

export async function getBook(bookKey?: unknown, access?: GrainBookAccess) {
  const book = await openBook(bookKey, access)
  const workspace = getWorkspace()
  const [moneySum, moneyRows, receivingRows, givingRows, productStats, paymentSums, treasury, ledger] = await Promise.all([
    prisma.wheatKhataMoney.aggregate({
      where: { bookKey: book.key },
      _sum: { amount: true },
    }),
    prisma.wheatKhataMoney.findMany({
      where: { bookKey: book.key },
      orderBy: { createdAt: 'desc' },
      take: 120,
    }),
    prisma.wheatKhataParty.findMany({
      where: { deleted: false, kind: 'RECEIVING', bookKey: book.key },
      orderBy: { name: 'asc' },
    }),
    prisma.wheatKhataParty.findMany({
      where: { deleted: false, kind: 'GIVING', bookKey: book.key },
      orderBy: { name: 'asc' },
    }),
    prisma.$queryRaw<ProductStatRow[]>(Prisma.sql`
      SELECT p.party_id,
        COUNT(*)::int AS product_count,
        COALESCE(SUM(p.bags), 0)::int AS bags,
        COALESCE(SUM(p.bags * p.bag_weight_kg), 0) AS weight_kg,
        COALESCE(SUM(ROUND(p.bags * p.rate_per_bag)), 0) AS wheat_amount,
        COALESCE(SUM(ROUND(p.bags * p.bag_price_per_bag)), 0) AS bag_amount,
        COALESCE(SUM(ROUND(p.bags * p.labour_per_bag)), 0) AS labour_amount,
        COALESCE(SUM(p.total_price), 0) AS product_total
      FROM wheat_khata_products p
      INNER JOIN wheat_khata_parties party ON party.id = p.party_id
      WHERE p.workspace = ${workspace}
        AND party.workspace = ${workspace}
        AND party.book_key = ${book.key}
        AND party.deleted = false
      GROUP BY p.party_id
    `),
    prisma.wheatKhataPayment.groupBy({
      by: ['partyId'],
      where: { party: { bookKey: book.key, deleted: false } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    loadTreasury('GRAIN', book.key),
    listPeople('GRAIN', book.key),
  ])

  const productByParty = new Map(
    productStats.map((row) => [
      String(row.party_id),
      {
        productCount: num(row.product_count),
        totalBags: num(row.bags),
        totalWeightKg: num(row.weight_kg),
        wheatAmount: num(row.wheat_amount),
        bagAmount: num(row.bag_amount),
        labourAmount: num(row.labour_amount),
        productTotal: num(row.product_total),
      },
    ]),
  )
  const paymentByParty = new Map(
    paymentSums.map((row) => [
      String(row.partyId),
      {
        paymentCount: row._count._all,
        cashTotal: row._sum.amount?.toNumber() ?? 0,
      },
    ]),
  )

  const summarize = (row: (typeof receivingRows)[number]) => {
    const products = productByParty.get(String(row.id))
    const payments = paymentByParty.get(String(row.id))
    return partySummaryDto(row, {
      productCount: products?.productCount ?? 0,
      paymentCount: payments?.paymentCount ?? 0,
      totalBags: products?.totalBags ?? 0,
      totalWeightKg: products?.totalWeightKg ?? 0,
      wheatAmount: products?.wheatAmount ?? 0,
      bagAmount: products?.bagAmount ?? 0,
      labourAmount: products?.labourAmount ?? 0,
      productTotal: products?.productTotal ?? 0,
      cashTotal: payments?.cashTotal ?? 0,
    })
  }

  const money = moneyRows.map(moneyDto)
  const parties = receivingRows.map(summarize)
  const companies = givingRows.map(summarize)
  const moneyIn = moneySum._sum.amount?.toNumber() ?? 0
  const givingToParty =
    parties.reduce((sum, row) => sum + row.productTotal, 0) +
    parties.reduce((sum, row) => sum + row.cashTotal, 0)
  const receivingFromCompany =
    companies.reduce((sum, row) => sum + row.productTotal, 0) +
    companies.reduce((sum, row) => sum + row.cashTotal, 0)
  const cashGiven = parties.reduce((sum, row) => sum + row.cashTotal, 0) + ledger.cashGiven
  const cashReceived = companies.reduce((sum, row) => sum + row.cashTotal, 0) + ledger.cashReceived
  const cashTotal = moneyIn + cashReceived - cashGiven
  const cash = withTreasury(cashTotal, treasury)
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
      totalAmount: cash.totalAmount,
      bankTotal: cash.bankTotal,
      inHand: cash.inHand,
      borrowedIn: cash.borrowedIn,
      borrowedOut: cash.borrowedOut,
      givingToPerson: ledger.givingToPerson,
      receivingFromPerson: ledger.receivingFromPerson,
      otherExpenseTotal: cash.expenseTotal,
      bagsReceived,
      bagsGiven,
      bagsInStock: bagsReceived - bagsGiven,
      bagsPerTruck: BAGS_PER_TRUCK,
    },
    money,
    banks: treasury.banks,
    bankGroups: treasury.bankGroups,
    withdrawals: treasury.withdrawals,
    otherExpenses: treasury.expenses,
    transfers: treasury.transfers,
    people: ledger.people,
    parties,
    companies,
  }
}

export async function addMoney(input: { amount?: unknown; notes?: unknown }, bookKey?: unknown, access?: GrainBookAccess) {
  const book = await openBook(bookKey, access)
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
}, bookKey?: unknown, access?: GrainBookAccess) {
  const book = await openBook(bookKey, access)
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

export async function updateParty(
  id: number | bigint,
  input: { name?: unknown; address?: unknown; notes?: unknown },
  bookKey?: unknown,
  access?: GrainBookAccess,
) {
  const existing = await prisma.wheatKhataParty.findFirst({
    where: { id: BigInt(id), deleted: false },
  })
  if (!existing) throw new Error('Party not found')
  const book = await openBook(bookKey ?? existing.bookKey, access)
  if (existing.bookKey !== book.key) throw new Error('Party not found')
  const name = String(input.name ?? existing.name).trim()
  if (!name) throw new Error(existing.kind === 'GIVING' ? 'Company name is required' : 'Party name is required')
  const clash = await prisma.wheatKhataParty.findFirst({
    where: {
      deleted: false,
      bookKey: book.key,
      kind: existing.kind,
      name: { equals: name, mode: 'insensitive' },
      NOT: { id: existing.id },
    },
  })
  if (clash) throw new Error(`${existing.kind === 'GIVING' ? 'Company' : 'Party'} ${name} is already used`)
  const row = await prisma.wheatKhataParty.update({
    where: { id: existing.id },
    data: {
      name,
      address: parseOptionalText(input.address),
      notes: parseOptionalText(input.notes),
    },
    include: partyInclude,
  })
  return partyDto(row)
}

export async function deleteParty(id: number | bigint, bookKey?: unknown, access?: GrainBookAccess) {
  const existing = await prisma.wheatKhataParty.findFirst({
    where: { id: BigInt(id), deleted: false },
  })
  if (!existing) throw new Error('Party not found')
  const book = await openBook(bookKey ?? existing.bookKey, access)
  if (existing.bookKey !== book.key) throw new Error('Party not found')
  await prisma.wheatKhataParty.update({
    where: { id: existing.id },
    data: { deleted: true },
  })
  return { id: Number(existing.id), deleted: true }
}

export async function getParty(id: number | bigint, bookKey?: unknown, access?: GrainBookAccess) {
  const party = await prisma.wheatKhataParty.findFirst({
    where: { id: BigInt(id), deleted: false },
    include: partyInclude,
  })
  if (!party) throw new Error('Party not found')
  const book = await openBook(bookKey ?? party.bookKey, access)
  if (party.bookKey !== book.key) throw new Error('Party not found')
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
}, bookKey?: unknown, access?: GrainBookAccess) {
  const partyId = Number(input.partyId)
  if (!Number.isSafeInteger(partyId) || partyId <= 0) {
    throw new Error('Choose a party first')
  }
  const party = await prisma.wheatKhataParty.findFirst({
    where: { id: BigInt(partyId), deleted: false },
  })
  if (!party) throw new Error('Party not found')
  const book = await openBook(bookKey ?? party.bookKey, access)
  if (party.bookKey !== book.key) throw new Error('Party not found')

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

export async function addPayment(input: { partyId?: unknown; amount?: unknown; notes?: unknown }, bookKey?: unknown, access?: GrainBookAccess) {
  const partyId = Number(input.partyId)
  if (!Number.isSafeInteger(partyId) || partyId <= 0) {
    throw new Error('Choose a party first')
  }
  const party = await prisma.wheatKhataParty.findFirst({
    where: { id: BigInt(partyId), deleted: false },
  })
  if (!party) throw new Error('Party not found')
  const book = await openBook(bookKey ?? party.bookKey, access)
  if (party.bookKey !== book.key) throw new Error('Party not found')

  const amount = parseAmount(input.amount)
  if (party.kind === 'RECEIVING') {
    const snapshot = await getBook(book.key, access)
    if (amount > snapshot.totals.inHand) {
      throw new Error(`Amount in hand is ${snapshot.totals.inHand}. Give that or less.`)
    }
  }
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

export async function listKhataHeads(bookKey?: unknown, access?: GrainBookAccess) {
  const book = await openBook(bookKey, access)
  return listHeads({ bookType: 'GRAIN', bookRef: book.key })
}

export async function addBank(input: { bankName?: unknown; amount?: unknown; notes?: unknown }, bookKey?: unknown, access?: GrainBookAccess) {
  const snapshot = await getBook(bookKey, access)
  return parkInBank('GRAIN', snapshot.book.key, snapshot.totals.inHand, input)
}

export async function receiveBank(input: { bankName?: unknown; amount?: unknown; notes?: unknown }, bookKey?: unknown, access?: GrainBookAccess) {
  const book = await openBook(bookKey, access)
  return takeFromBank('GRAIN', book.key, input)
}

export async function addOtherExpense(input: { reason?: unknown; amount?: unknown; notes?: unknown }, bookKey?: unknown, access?: GrainBookAccess) {
  const snapshot = await getBook(bookKey, access)
  return parkExpense('GRAIN', snapshot.book.key, snapshot.totals.inHand, input)
}

export async function addLedgerCash(input: Record<string, unknown>, bookKey?: unknown, access?: GrainBookAccess) {
  const snapshot = await getBook(bookKey, access)
  return addPersonCash('GRAIN', snapshot.book.key, snapshot.totals.inHand, input)
}

export async function getLedgerPerson(id: number | bigint, bookKey?: unknown, access?: GrainBookAccess) {
  const book = await openBook(bookKey, access)
  return getPerson('GRAIN', book.key, id)
}

export async function updateLedgerPerson(id: number | bigint, input: Record<string, unknown>, bookKey?: unknown, access?: GrainBookAccess) {
  const book = await openBook(bookKey, access)
  return updatePerson('GRAIN', book.key, id, input)
}

export async function deleteLedgerPerson(id: number | bigint, bookKey?: unknown, access?: GrainBookAccess) {
  const book = await openBook(bookKey, access)
  return deletePerson('GRAIN', book.key, id)
}

export async function transferTo(input: {
  bookType?: unknown
  bookRef?: unknown
  amount?: unknown
  notes?: unknown
}, bookKey?: unknown, access?: GrainBookAccess) {
  const snapshot = await getBook(bookKey, access)
  return sendToHead(
    { bookType: 'GRAIN', bookRef: snapshot.book.key, name: snapshot.book.name },
    snapshot.totals.inHand,
    input,
  )
}
