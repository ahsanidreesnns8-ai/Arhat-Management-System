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

function bankKey(name: string | null | undefined) {
  return String(name ?? '').trim().replace(/\s+/g, ' ').toUpperCase()
}

export async function loadTreasury(bookType: KhataBookType, bookRef: string) {
  const rows = await prisma.khataTreasury.findMany({
    where: { bookType, bookRef },
    orderBy: { createdAt: 'desc' },
  })
  const items = rows.map(rowDto)
  const deposits = items.filter((row) => row.kind === 'BANK')
  const withdrawals = items.filter((row) => row.kind === 'BANK_OUT')
  const expenses = items.filter((row) => row.kind === 'EXPENSE')
  const bankIn = deposits.reduce((sum, row) => sum + row.amount, 0)
  const bankOut = withdrawals.reduce((sum, row) => sum + row.amount, 0)
  const expenseTotal = expenses.reduce((sum, row) => sum + row.amount, 0)
  const transferIn = items.filter((row) => row.kind === 'TRANSFER_IN').reduce((sum, row) => sum + row.amount, 0)
  const transferOut = items.filter((row) => row.kind === 'TRANSFER_OUT').reduce((sum, row) => sum + row.amount, 0)

  const grouped = new Map<string, {
    bankName: string
    deposited: number
    withdrawn: number
    remaining: number
  }>()
  for (const row of deposits) {
    const key = bankKey(row.bankName) || 'BANK'
    const current = grouped.get(key) || {
      bankName: row.bankName?.trim() || 'Bank',
      deposited: 0,
      withdrawn: 0,
      remaining: 0,
    }
    current.deposited += row.amount
    grouped.set(key, current)
  }
  for (const row of withdrawals) {
    const key = bankKey(row.bankName) || 'BANK'
    const current = grouped.get(key) || {
      bankName: row.bankName?.trim() || 'Bank',
      deposited: 0,
      withdrawn: 0,
      remaining: 0,
    }
    current.withdrawn += row.amount
    grouped.set(key, current)
  }
  const bankGroups = [...grouped.values()].map((row) => ({
    ...row,
    remaining: Math.max(0, row.deposited - row.withdrawn),
  }))

  return {
    banks: deposits,
    withdrawals,
    expenses,
    transfers: items.filter((row) => row.kind === 'TRANSFER_IN' || row.kind === 'TRANSFER_OUT'),
    bankGroups,
    bankTotal: Math.max(0, bankIn - bankOut),
    bankIn,
    bankOut,
    expenseTotal,
    transferIn,
    transferOut,
  }
}

export function withTreasury(cashTotal: number, treasury: Awaited<ReturnType<typeof loadTreasury>>) {
  const totalAmount = cashTotal + treasury.transferIn - treasury.transferOut - treasury.expenseTotal
  const inHand = totalAmount - treasury.bankTotal
  return {
    totalAmount,
    bankTotal: treasury.bankTotal,
    inHand,
    borrowedIn: treasury.transferIn,
    borrowedOut: treasury.transferOut,
    expenseTotal: treasury.expenseTotal,
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

export async function receiveFromBank(
  bookType: KhataBookType,
  bookRef: string,
  input: { bankName?: unknown; amount?: unknown; notes?: unknown },
) {
  const bankName = String(input.bankName ?? '').trim()
  if (!bankName) throw new Error('Enter the bank name')
  const amount = parseAmount(input.amount)
  const treasury = await loadTreasury(bookType, bookRef)
  const group = treasury.bankGroups.find((row) => bankKey(row.bankName) === bankKey(bankName))
  const remaining = group?.remaining ?? 0
  if (!group || remaining <= 0) {
    throw new Error(`No amount in ${bankName}. Add money in bank first.`)
  }
  if (amount > remaining) {
    throw new Error(`${bankName} has ${remaining}. Receive that or less.`)
  }
  const row = await prisma.khataTreasury.create({
    data: {
      bookType,
      bookRef,
      kind: 'BANK_OUT',
      amount,
      bankName: group.bankName,
      notes: String(input.notes ?? '').trim() || 'Received from bank to amount in hand',
    },
  })
  return rowDto(row)
}

export async function addOtherExpense(
  bookType: KhataBookType,
  bookRef: string,
  inHand: number,
  input: { reason?: unknown; amount?: unknown; notes?: unknown },
) {
  const reason = String(input.reason ?? input.notes ?? '').trim()
  if (!reason) throw new Error('Enter the reason')
  const amount = parseAmount(input.amount)
  if (amount > inHand) {
    throw new Error(`Amount in hand is ${inHand}. Spend that or less.`)
  }
  const row = await prisma.khataTreasury.create({
    data: {
      bookType,
      bookRef,
      kind: 'EXPENSE',
      amount,
      notes: reason,
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
