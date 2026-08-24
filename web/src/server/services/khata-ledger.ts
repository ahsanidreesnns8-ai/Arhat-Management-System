import { prisma } from '@/server/db'
import { roundRupee } from '@/server/money'
import type { KhataBookType } from '@/server/services/khata-treasury'

export const LEDGER_KINDS = ['GIVING', 'RECEIVING'] as const
export type LedgerKind = (typeof LEDGER_KINDS)[number]

function parseAmount(value: unknown, label = 'Amount') {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Enter a valid ${label.toLowerCase()}`)
  }
  return roundRupee(amount).toNumber()
}

function parseKind(value: unknown): LedgerKind {
  const kind = String(value ?? '').trim().toUpperCase()
  if (kind === 'GIVE' || kind === 'GIVING') return 'GIVING'
  if (kind === 'RECEIVE' || kind === 'RECEIVING') return 'RECEIVING'
  throw new Error('Choose Give money or Receive money')
}

function parseOptionalText(value: unknown) {
  const text = String(value ?? '').trim()
  return text || null
}

function personNameKey(value: string) {
  return value.trim().replace(/\s+/g, ' ').toUpperCase()
}

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

function stampDto(createdAt: Date) {
  const stamp = karachiParts(createdAt)
  return {
    createdAt: createdAt.toISOString(),
    day: stamp.day,
    date: stamp.date,
    time: stamp.time,
  }
}

function namesMatch(a: string, b: string) {
  return personNameKey(a) === personNameKey(b)
}

type TradeBits = {
  productIn: number
  productOut: number
  productInCount: number
  productOutCount: number
  lines: Array<{ createdAt: Date; particular: string; addition: number; deduction: number; kind: string }>
}

function emptyTrade(): TradeBits {
  return { productIn: 0, productOut: 0, productInCount: 0, productOutCount: 0, lines: [] }
}

async function tradeForName(bookType: KhataBookType, bookRef: string, name: string): Promise<TradeBits> {
  const trade = emptyTrade()
  if (bookType === 'GRAIN') {
    const parties = await prisma.wheatKhataParty.findMany({
      where: { deleted: false, bookKey: bookRef },
      select: {
        id: true,
        kind: true,
        name: true,
        products: { select: { id: true, bags: true, totalPrice: true, notes: true, createdAt: true } },
      },
    })
    for (const party of parties) {
      if (!namesMatch(party.name, name)) continue
      for (const product of party.products) {
        const amount = product.totalPrice.toNumber()
        const note = product.notes || `${product.bags} bags`
        if (party.kind === 'RECEIVING') {
          trade.productIn += amount
          trade.productInCount += 1
          trade.lines.push({
            createdAt: product.createdAt,
            particular: `Product received · ${note}`,
            addition: amount,
            deduction: 0,
            kind: 'PRODUCT',
          })
        } else {
          trade.productOut += amount
          trade.productOutCount += 1
          trade.lines.push({
            createdAt: product.createdAt,
            particular: `Product given · ${note}`,
            addition: 0,
            deduction: amount,
            kind: 'SOLD',
          })
        }
      }
    }
    return trade
  }

  const bookId = BigInt(bookRef)
  const parties = await prisma.paddyKhataParty.findMany({
    where: { deleted: false, bookId },
    select: {
      id: true,
      kind: true,
      name: true,
      purchases: { select: { id: true, bags: true, variety: true, totalPrice: true, createdAt: true } },
      sales: { select: { id: true, bags: true, variety: true, totalPrice: true, createdAt: true } },
    },
  })
  for (const party of parties) {
    if (!namesMatch(party.name, name)) continue
    for (const row of party.purchases) {
      const amount = row.totalPrice.toNumber()
      trade.productIn += amount
      trade.productInCount += 1
      trade.lines.push({
        createdAt: row.createdAt,
        particular: `Paddy in · ${row.variety} · ${row.bags} bags`,
        addition: amount,
        deduction: 0,
        kind: 'PRODUCT',
      })
    }
    for (const row of party.sales) {
      const amount = row.totalPrice.toNumber()
      trade.productOut += amount
      trade.productOutCount += 1
      trade.lines.push({
        createdAt: row.createdAt,
        particular: `Rice sold · ${row.variety} · ${row.bags} bags`,
        addition: 0,
        deduction: amount,
        kind: 'SOLD',
      })
    }
  }
  return trade
}

function entryDto(row: {
  id: bigint
  kind: string
  amount: { toNumber(): number }
  notes: string | null
  createdAt: Date
}) {
  return {
    id: Number(row.id),
    kind: row.kind,
    amount: row.amount.toNumber(),
    notes: row.notes,
    ...stampDto(row.createdAt),
  }
}

function position(cashGiven: number, cashReceived: number, productIn: number, productOut: number) {
  const remaining = cashReceived + productIn - cashGiven - productOut
  return {
    remainingToGive: remaining > 0 ? remaining : 0,
    remainingToReceive: remaining < 0 ? -remaining : 0,
    displayLabel: remaining > 0
      ? 'Remaining to give'
      : remaining < 0
        ? 'Remaining to receive'
        : cashGiven || cashReceived || productIn || productOut
          ? 'Settled'
          : 'Total balance',
  }
}

export async function ledgerCashTotals(bookType: KhataBookType, bookRef: string) {
  const people = await prisma.khataLedgerPerson.findMany({
    where: { bookType, bookRef, deleted: false },
    include: { entries: true },
  })
  let given = 0
  let received = 0
  for (const person of people) {
    for (const row of person.entries) {
      if (row.kind === 'GIVING') given += row.amount.toNumber()
      if (row.kind === 'RECEIVING') received += row.amount.toNumber()
    }
  }
  return { given, received }
}

export async function listPeople(bookType: KhataBookType, bookRef: string) {
  const people = await prisma.khataLedgerPerson.findMany({
    where: { bookType, bookRef, deleted: false },
    include: { entries: { orderBy: { createdAt: 'asc' } } },
    orderBy: { name: 'asc' },
  })
  const rows = []
  for (const person of people) {
    const cashGiven = person.entries
      .filter((row) => row.kind === 'GIVING')
      .reduce((sum, row) => sum + row.amount.toNumber(), 0)
    const cashReceived = person.entries
      .filter((row) => row.kind === 'RECEIVING')
      .reduce((sum, row) => sum + row.amount.toNumber(), 0)
    const trade = await tradeForName(bookType, bookRef, person.name)
    const rest = position(cashGiven, cashReceived, trade.productIn, trade.productOut)
    rows.push({
      id: Number(person.id),
      name: person.name,
      address: person.address,
      notes: person.notes,
      createdAt: person.createdAt.toISOString(),
      cashGiven,
      cashReceived,
      givenCount: person.entries.filter((row) => row.kind === 'GIVING').length,
      receivedCount: person.entries.filter((row) => row.kind === 'RECEIVING').length,
      productIn: trade.productIn,
      productOut: trade.productOut,
      ...rest,
      entries: person.entries.map(entryDto),
    })
  }
  const givingToPerson = rows.reduce((sum, row) => sum + row.remainingToGive, 0)
  const receivingFromPerson = rows.reduce((sum, row) => sum + row.remainingToReceive, 0)
  const cash = await ledgerCashTotals(bookType, bookRef)
  return {
    people: rows,
    cashGiven: cash.given,
    cashReceived: cash.received,
    givingToPerson,
    receivingFromPerson,
  }
}

export async function getPerson(bookType: KhataBookType, bookRef: string, id: number | bigint) {
  const person = await prisma.khataLedgerPerson.findFirst({
    where: { id: BigInt(id), bookType, bookRef, deleted: false },
    include: { entries: { orderBy: { createdAt: 'asc' } } },
  })
  if (!person) throw new Error('Person not found')
  const cashGiven = person.entries
    .filter((row) => row.kind === 'GIVING')
    .reduce((sum, row) => sum + row.amount.toNumber(), 0)
  const cashReceived = person.entries
    .filter((row) => row.kind === 'RECEIVING')
    .reduce((sum, row) => sum + row.amount.toNumber(), 0)
  const trade = await tradeForName(bookType, bookRef, person.name)
  const rest = position(cashGiven, cashReceived, trade.productIn, trade.productOut)
  const lines = [
    ...person.entries.map((row) => {
      const amount = row.amount.toNumber()
      return {
        createdAt: row.createdAt.toISOString(),
        particular: row.notes || (row.kind === 'GIVING' ? 'Given' : 'Received'),
        addition: row.kind === 'RECEIVING' ? amount : 0,
        deduction: row.kind === 'GIVING' ? amount : 0,
        kind: row.kind,
        day: karachiParts(row.createdAt).day,
        date: karachiParts(row.createdAt).date,
        time: karachiParts(row.createdAt).time,
      }
    }),
    ...trade.lines.map((row) => {
      const stamp = stampDto(row.createdAt)
      return {
        particular: row.particular,
        addition: row.addition,
        deduction: row.deduction,
        kind: row.kind,
        ...stamp,
      }
    }),
  ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  return {
    id: Number(person.id),
    name: person.name,
    address: person.address,
    notes: person.notes,
    createdAt: person.createdAt.toISOString(),
    cashGiven,
    cashReceived,
    productIn: trade.productIn,
    productOut: trade.productOut,
    ...rest,
    entries: person.entries.map(entryDto),
    lines,
  }
}

async function findOrCreatePerson(
  bookType: KhataBookType,
  bookRef: string,
  name: string,
  extra?: { address?: string | null; notes?: string | null },
) {
  const existing = await prisma.khataLedgerPerson.findMany({
    where: { bookType, bookRef, deleted: false },
  })
  const hit = existing.find((row) => namesMatch(row.name, name))
  if (hit) {
    if (extra?.address || extra?.notes) {
      return prisma.khataLedgerPerson.update({
        where: { id: hit.id },
        data: {
          ...(extra.address ? { address: extra.address } : {}),
          ...(extra.notes ? { notes: extra.notes } : {}),
        },
      })
    }
    return hit
  }
  return prisma.khataLedgerPerson.create({
    data: {
      bookType,
      bookRef,
      name: name.trim().replace(/\s+/g, ' '),
      address: extra?.address || null,
      notes: extra?.notes || null,
    },
  })
}

export async function addPersonCash(
  bookType: KhataBookType,
  bookRef: string,
  inHand: number,
  input: {
    name?: unknown
    address?: unknown
    notes?: unknown
    kind?: unknown
    amount?: unknown
    personId?: unknown
  },
) {
  const kind = parseKind(input.kind)
  const amount = parseAmount(input.amount)
  if (kind === 'GIVING' && amount > inHand) {
    throw new Error(`Amount in hand is ${inHand}. Give that or less.`)
  }
  let person
  const personId = Number(input.personId)
  if (Number.isSafeInteger(personId) && personId > 0) {
    person = await prisma.khataLedgerPerson.findFirst({
      where: { id: BigInt(personId), bookType, bookRef, deleted: false },
    })
    if (!person) throw new Error('Person not found')
  } else {
    const name = String(input.name ?? '').trim()
    if (!name) throw new Error('Enter the name')
    person = await findOrCreatePerson(bookType, bookRef, name, {
      address: parseOptionalText(input.address),
      notes: parseOptionalText(input.notes) && !amount ? parseOptionalText(input.notes) : null,
    })
  }
  await prisma.khataLedgerEntry.create({
    data: {
      personId: person.id,
      kind,
      amount,
      notes: parseOptionalText(input.notes),
    },
  })
  return getPerson(bookType, bookRef, person.id)
}

export async function updatePerson(
  bookType: KhataBookType,
  bookRef: string,
  id: number | bigint,
  input: {
    name?: unknown
    address?: unknown
    notes?: unknown
    entries?: Array<{
      id?: unknown
      amount?: unknown
      kind?: unknown
      notes?: unknown
      delete?: unknown
    }>
  },
) {
  const person = await prisma.khataLedgerPerson.findFirst({
    where: { id: BigInt(id), bookType, bookRef, deleted: false },
  })
  if (!person) throw new Error('Person not found')
  const name = String(input.name ?? person.name).trim()
  if (!name) throw new Error('Name is required')
  await prisma.khataLedgerPerson.update({
    where: { id: person.id },
    data: {
      name,
      address: parseOptionalText(input.address),
      notes: parseOptionalText(input.notes),
    },
  })
  for (const line of input.entries || []) {
    const lineId = Number(line.id)
    if (!Number.isSafeInteger(lineId) || lineId <= 0) continue
    const existing = await prisma.khataLedgerEntry.findFirst({
      where: { id: BigInt(lineId), personId: person.id },
    })
    if (!existing) continue
    if (line.delete) {
      await prisma.khataLedgerEntry.delete({ where: { id: existing.id } })
      continue
    }
    const kind = line.kind != null ? parseKind(line.kind) : (existing.kind as LedgerKind)
    const amount = line.amount != null ? parseAmount(line.amount) : existing.amount.toNumber()
    await prisma.khataLedgerEntry.update({
      where: { id: existing.id },
      data: {
        kind,
        amount,
        notes: line.notes === undefined ? existing.notes : parseOptionalText(line.notes),
      },
    })
  }
  return getPerson(bookType, bookRef, person.id)
}

export async function deletePerson(bookType: KhataBookType, bookRef: string, id: number | bigint) {
  const person = await prisma.khataLedgerPerson.findFirst({
    where: { id: BigInt(id), bookType, bookRef, deleted: false },
  })
  if (!person) throw new Error('Person not found')
  await prisma.khataLedgerPerson.update({
    where: { id: person.id },
    data: { deleted: true },
  })
  return { id: Number(person.id), deleted: true }
}
