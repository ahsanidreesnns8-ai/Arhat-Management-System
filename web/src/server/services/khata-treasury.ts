import { prisma } from '@/server/db'
import { roundRupee } from '@/server/money'

export type KhataBookType = 'GRAIN' | 'PADDY'

export type KhataHead = {
  bookType: KhataBookType
  bookRef: string
  name: string
  publicId: string
  crop: string
}

function parseAmount(value: unknown, label = 'Amount') {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Enter a valid ${label.toLowerCase()}`)
  }
  return roundRupee(amount).toNumber()
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

function rowDto(row: {
  id: bigint
  kind: string
  amount: { toNumber(): number }
  bankName: string | null
  counterBookType: string | null
  counterBookRef: string | null
  counterName: string | null
  notes: string | null
  createdAt: Date
}) {
  const stamp = karachiParts(row.createdAt)
  return {
    id: Number(row.id),
    kind: row.kind,
    amount: row.amount.toNumber(),
    bankName: row.bankName,
    counterBookType: row.counterBookType,
    counterBookRef: row.counterBookRef,
    counterName: row.counterName,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    day: stamp.day,
    date: stamp.date,
    time: stamp.time,
  }
}

export async function listHeads(exclude?: { bookType: KhataBookType; bookRef: string }): Promise<KhataHead[]> {
  const [grain, paddy] = await Promise.all([
    prisma.grainKhataBook.findMany({
      where: { deleted: false },
      orderBy: { name: 'asc' },
    }),
    prisma.paddyKhataBook.findMany({
      where: { deleted: false },
      orderBy: { name: 'asc' },
    }),
  ])
  const heads: KhataHead[] = [
    ...grain.map((row) => ({
      bookType: 'GRAIN' as const,
      bookRef: row.key,
      name: row.name,
      publicId: row.publicId || row.key,
      crop: row.crop,
    })),
    ...paddy.map((row) => ({
      bookType: 'PADDY' as const,
      bookRef: String(Number(row.id)),
      name: row.name,
      publicId: row.publicId,
      crop: 'paddy',
    })),
  ]
  if (!heads.some((head) => head.bookType === 'GRAIN' && head.bookRef === 'WHEAT')) {
    heads.unshift({
      bookType: 'GRAIN',
      bookRef: 'WHEAT',
      name: 'Wheat Khata',
      publicId: 'WK-SHOP',
      crop: 'wheat',
    })
  }
  return heads.filter((head) => {
    if (!exclude) return true
    return !(head.bookType === exclude.bookType && head.bookRef === exclude.bookRef)
  })
}

export async function loadTreasury(bookType: KhataBookType, bookRef: string) {
  const rows = await prisma.khataTreasury.findMany({
    where: { bookType, bookRef },
    orderBy: { createdAt: 'desc' },
  })
  const items = rows.map(rowDto)
  const bankTotal = items.filter((row) => row.kind === 'BANK').reduce((sum, row) => sum + row.amount, 0)
  const transferIn = items.filter((row) => row.kind === 'TRANSFER_IN').reduce((sum, row) => sum + row.amount, 0)
  const transferOut = items.filter((row) => row.kind === 'TRANSFER_OUT').reduce((sum, row) => sum + row.amount, 0)
  return {
    banks: items.filter((row) => row.kind === 'BANK'),
    transfers: items.filter((row) => row.kind === 'TRANSFER_IN' || row.kind === 'TRANSFER_OUT'),
    bankTotal,
    transferIn,
    transferOut,
  }
}

export function withTreasury(cashTotal: number, treasury: Awaited<ReturnType<typeof loadTreasury>>) {
  const totalAmount = cashTotal + treasury.transferIn - treasury.transferOut
  const inHand = totalAmount - treasury.bankTotal
  return {
    totalAmount,
    bankTotal: treasury.bankTotal,
    inHand,
    borrowedIn: treasury.transferIn,
    borrowedOut: treasury.transferOut,
  }
}

async function resolveHead(bookType: unknown, bookRef: unknown): Promise<KhataHead> {
  const type = String(bookType ?? '').trim().toUpperCase()
  const ref = String(bookRef ?? '').trim()
  if (!ref) throw new Error('Choose a khata head')
  if (type === 'GRAIN') {
    const row = await prisma.grainKhataBook.findFirst({ where: { key: ref, deleted: false } })
    if (row) {
      return {
        bookType: 'GRAIN',
        bookRef: row.key,
        name: row.name,
        publicId: row.publicId || row.key,
        crop: row.crop,
      }
    }
    if (ref === 'WHEAT') {
      return {
        bookType: 'GRAIN',
        bookRef: 'WHEAT',
        name: 'Wheat Khata',
        publicId: 'WK-SHOP',
        crop: 'wheat',
      }
    }
    throw new Error('Khata not found')
  }
  if (type === 'PADDY') {
    const id = Number(ref)
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Khata not found')
    const row = await prisma.paddyKhataBook.findFirst({ where: { id: BigInt(id), deleted: false } })
    if (!row) throw new Error('Khata not found')
    return {
      bookType: 'PADDY',
      bookRef: String(Number(row.id)),
      name: row.name,
      publicId: row.publicId,
      crop: 'paddy',
    }
  }
  throw new Error('Choose a khata head')
}

export async function addBank(
  bookType: KhataBookType,
  bookRef: string,
  inHand: number,
  input: { bankName?: unknown; amount?: unknown; notes?: unknown },
) {
  const bankName = String(input.bankName ?? '').trim()
  if (!bankName) throw new Error('Enter the bank name')
  const amount = parseAmount(input.amount)
  if (amount > inHand) {
    throw new Error(`Amount in hand is ${inHand}. Put that or less in the bank.`)
  }
  const row = await prisma.khataTreasury.create({
    data: {
      bookType,
      bookRef,
      kind: 'BANK',
      amount,
      bankName,
      notes: String(input.notes ?? '').trim() || null,
    },
  })
  return rowDto(row)
}

export async function transferTo(
  from: { bookType: KhataBookType; bookRef: string; name: string },
  inHand: number,
  input: { bookType?: unknown; bookRef?: unknown; amount?: unknown; notes?: unknown },
) {
  const to = await resolveHead(input.bookType, input.bookRef)
  if (to.bookType === from.bookType && to.bookRef === from.bookRef) {
    throw new Error('Choose another khata head')
  }
  const amount = parseAmount(input.amount)
  if (amount > inHand) {
    throw new Error(`Amount in hand is ${inHand}. Send that or less.`)
  }
  const note = String(input.notes ?? '').trim() || null
  const [outRow] = await prisma.$transaction([
    prisma.khataTreasury.create({
      data: {
        bookType: from.bookType,
        bookRef: from.bookRef,
        kind: 'TRANSFER_OUT',
        amount,
        counterBookType: to.bookType,
        counterBookRef: to.bookRef,
        counterName: `${to.name} · ${to.publicId}`,
        notes: note,
      },
    }),
    prisma.khataTreasury.create({
      data: {
        bookType: to.bookType,
        bookRef: to.bookRef,
        kind: 'TRANSFER_IN',
        amount,
        counterBookType: from.bookType,
        counterBookRef: from.bookRef,
        counterName: `${from.name} · borrowed`,
        notes: note,
      },
    }),
  ])
  return rowDto(outRow)
}

export async function allTreasuryRows() {
  const rows = await prisma.khataTreasury.findMany({ orderBy: { createdAt: 'desc' } })
  return rows.map(rowDto)
}
