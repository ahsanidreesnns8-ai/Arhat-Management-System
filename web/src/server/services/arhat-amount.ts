import { prisma } from '@/server/db'
import { roundRupee } from '@/server/money'

const MANUAL_KINDS = ['ADD', 'RECEIVING', 'GIVING'] as const
export type ArhatAmountKind = (typeof MANUAL_KINDS)[number]

export type LedgerKind = 'ADD' | 'RECEIVING' | 'GIVING'
export type LedgerBook = 'ARHAT' | 'WHEAT_KHATA' | 'KHATA'
export type LedgerSource =
  | 'MANUAL'
  | 'BUYER'
  | 'FARMER'
  | 'REGISTER'
  | 'ZAKAT'
  | 'WHEAT_KHATA'
  | 'KHATA'

export type ArhatAmountLine = {
  id: string
  book: LedgerBook
  source: LedgerSource
  kind: LedgerKind
  amount: number
  reason: string
  createdAt: string
  day: string
  date: string
  time: string
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

function parseKind(value: unknown): ArhatAmountKind {
  const kind = String(value ?? '').trim().toUpperCase()
  if (kind === 'ADD' || kind === 'MONEY' || kind === 'ADD_AMOUNT') return 'ADD'
  if (kind === 'RECEIVING' || kind === 'RECEIVE') return 'RECEIVING'
  if (kind === 'GIVING' || kind === 'GIVE') return 'GIVING'
  throw new Error('Choose add, receiving, or giving')
}

function parseAmount(value: unknown, label = 'Amount') {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`Enter a valid ${label.toLowerCase()}`)
  }
  return roundRupee(amount).toNumber()
}

function parseOptionalText(value: unknown) {
  const text = String(value ?? '').trim()
  return text || null
}

function joinReason(parts: Array<string | null | undefined>) {
  return parts.map((part) => String(part ?? '').trim()).filter(Boolean).join(' · ')
}

function line(
  id: string,
  book: LedgerBook,
  source: LedgerSource,
  kind: LedgerKind,
  amount: number,
  reason: string,
  createdAt: Date,
): ArhatAmountLine {
  const stamp = karachiParts(createdAt)
  return {
    id,
    book,
    source,
    kind,
    amount,
    reason,
    createdAt: createdAt.toISOString(),
    day: stamp.day,
    date: stamp.date,
    time: stamp.time,
  }
}

function sortLines(rows: ArhatAmountLine[]) {
  return [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
}

function sumKind(rows: ArhatAmountLine[], kind: LedgerKind) {
  return rows.filter((row) => row.kind === kind).reduce((sum, row) => sum + row.amount, 0)
}

function manualDto(row: {
  id: bigint
  kind: string
  amount: { toNumber(): number }
  notes: string | null
  createdAt: Date
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
  }
}

function defaultManualReason(kind: ArhatAmountKind, notes: string | null) {
  const fallback =
    kind === 'ADD'
      ? 'Amount added to Arhat Amount'
      : kind === 'RECEIVING'
        ? 'Receiving amount'
        : 'Giving amount'
  return notes || fallback
}

export async function addEntry(input: { kind?: unknown; amount?: unknown; notes?: unknown }) {
  const kind = parseKind(input.kind)
  const amount = parseAmount(input.amount)
  const notes = parseOptionalText(input.notes)
  const row = await prisma.arhatAmountEntry.create({
    data: { kind, amount, notes },
  })
  return manualDto(row)
}

const HISTORY_TAKE = 80

async function arhatLines(): Promise<{
  lines: ArhatAmountLine[]
  commission: number
  zakat: number
  manual: ReturnType<typeof manualDto>[]
  totals: { added: number; receiving: number; giving: number }
}> {
  const [manualRows, paymentRows, registerRows, commissionAgg, manualSum, buyerSum, farmerSum, registerSum] = await Promise.all([
    prisma.arhatAmountEntry.findMany({ orderBy: { createdAt: 'desc' }, take: HISTORY_TAKE }),
    prisma.payment.findMany({
      where: {
        OR: [{ dheriId: null }, { dheri: { deleted: false } }],
      },
      select: {
        id: true,
        paymentType: true,
        amount: true,
        notes: true,
        referenceNumber: true,
        createdAt: true,
        farmer: { select: { name: true } },
        buyer: { select: { name: true } },
        sale: { select: { invoiceNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_TAKE,
    }),
    prisma.registerEntry.findMany({
      where: {
        kind: { in: ['GIVING', 'RECEIVING', 'ZAKAT'] },
        OR: [{ partyId: null }, { party: { deleted: false } }],
      },
      select: {
        id: true,
        kind: true,
        amount: true,
        notes: true,
        createdAt: true,
        party: { select: { name: true } },
        farmer: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_TAKE,
    }),
    prisma.dheri.aggregate({
      _sum: { commissionAmount: true },
      where: { deleted: false },
    }),
    prisma.arhatAmountEntry.groupBy({ by: ['kind'], _sum: { amount: true } }),
    prisma.payment.aggregate({
      where: {
        paymentType: 'BUYER',
        OR: [{ dheriId: null }, { dheri: { deleted: false } }],
      },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: {
        paymentType: 'FARMER',
        OR: [{ dheriId: null }, { dheri: { deleted: false } }],
      },
      _sum: { amount: true },
    }),
    prisma.registerEntry.groupBy({
      by: ['kind'],
      where: {
        kind: { in: ['GIVING', 'RECEIVING', 'ZAKAT'] },
        OR: [{ partyId: null }, { party: { deleted: false } }],
      },
      _sum: { amount: true },
    }),
  ])

  const lines: ArhatAmountLine[] = []

  for (const row of manualRows) {
    const kind = parseKind(row.kind)
    lines.push(
      line(
        `manual-${row.id}`,
        'ARHAT',
        'MANUAL',
        kind,
        row.amount.toNumber(),
        defaultManualReason(kind, row.notes),
        row.createdAt,
      ),
    )
  }

  for (const row of paymentRows) {
    if (row.paymentType === 'BUYER') {
      const who = row.buyer?.name || 'buyer'
      const invoice = row.sale?.invoiceNumber
      lines.push(
        line(
          `pay-${row.id}`,
          'ARHAT',
          'BUYER',
          'RECEIVING',
          row.amount.toNumber(),
          joinReason([
            `Received from buyer ${who}`,
            invoice ? `Invoice ${invoice}` : null,
            row.notes,
          ]),
          row.createdAt,
        ),
      )
      continue
    }
    if (row.paymentType === 'FARMER') {
      const who = row.farmer?.name || 'farmer'
      const advance = row.referenceNumber === 'ADVANCE'
      lines.push(
        line(
          `pay-${row.id}`,
          'ARHAT',
          'FARMER',
          'GIVING',
          row.amount.toNumber(),
          joinReason([
            advance ? `Advance given to farmer ${who}` : `Given to farmer ${who}`,
            row.notes,
          ]),
          row.createdAt,
        ),
      )
    }
  }

  for (const row of registerRows) {
    const who = row.party?.name || row.farmer?.name
    if (row.kind === 'ZAKAT') {
      lines.push(
        line(
          `reg-${row.id}`,
          'ARHAT',
          'ZAKAT',
          'GIVING',
          row.amount.toNumber(),
          joinReason(['Zakat', row.notes]),
          row.createdAt,
        ),
      )
      continue
    }
    if (row.kind === 'RECEIVING') {
      lines.push(
        line(
          `reg-${row.id}`,
          'ARHAT',
          'REGISTER',
          'RECEIVING',
          row.amount.toNumber(),
          joinReason([who ? `Register received from ${who}` : 'Register receiving', row.notes]),
          row.createdAt,
        ),
      )
      continue
    }
    if (row.kind === 'GIVING') {
      lines.push(
        line(
          `reg-${row.id}`,
          'ARHAT',
          'REGISTER',
          'GIVING',
          row.amount.toNumber(),
          joinReason([who ? `Register given to ${who}` : 'Register giving', row.notes]),
          row.createdAt,
        ),
      )
    }
  }

  const sorted = sortLines(lines)
  const kindSum = (rows: typeof manualSum, kind: string) =>
    rows.find((row) => row.kind === kind)?._sum.amount?.toNumber() ?? 0
  const added = kindSum(manualSum, 'ADD')
  const receiving =
    kindSum(manualSum, 'RECEIVING') +
    (buyerSum._sum.amount?.toNumber() ?? 0) +
    kindSum(registerSum, 'RECEIVING')
  const giving =
    kindSum(manualSum, 'GIVING') +
    (farmerSum._sum.amount?.toNumber() ?? 0) +
    kindSum(registerSum, 'GIVING') +
    kindSum(registerSum, 'ZAKAT')
  return {
    lines: sorted,
    commission: commissionAgg._sum.commissionAmount?.toNumber() ?? 0,
    zakat: kindSum(registerSum, 'ZAKAT'),
    manual: manualRows.map(manualDto),
    totals: { added, receiving, giving },
  }
}

async function khataCashLines(): Promise<{ lines: ArhatAmountLine[]; totals: { added: number; receiving: number; giving: number } }> {
  const [
    grainBooks,
    paddyBooks,
    moneyRows,
    paymentRows,
    paddyAmounts,
    paddyCash,
    paddyExpenses,
    treasury,
    moneySum,
    payGive,
    payReceive,
    paddyAdd,
    paddyGive,
    paddyReceive,
    paddyExp,
    transferOut,
    transferIn,
  ] = await Promise.all([
    prisma.grainKhataBook.findMany({ where: { deleted: false }, select: { key: true, name: true } }),
    prisma.paddyKhataBook.findMany({ where: { deleted: false }, select: { id: true, name: true } }),
    prisma.wheatKhataMoney.findMany({ orderBy: { createdAt: 'desc' }, take: HISTORY_TAKE }),
    prisma.wheatKhataPayment.findMany({
      include: { party: { select: { deleted: true, bookKey: true, kind: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_TAKE,
    }),
    prisma.paddyKhataAmount.findMany({ orderBy: { createdAt: 'desc' }, take: HISTORY_TAKE }),
    prisma.paddyKhataCash.findMany({
      include: { party: { select: { name: true } }, book: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_TAKE,
    }),
    prisma.paddyKhataExpense.findMany({ orderBy: { createdAt: 'desc' }, take: HISTORY_TAKE }),
    prisma.khataTreasury.findMany({
      where: { kind: { in: ['TRANSFER_IN', 'TRANSFER_OUT'] } },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_TAKE,
    }),
    prisma.wheatKhataMoney.aggregate({ _sum: { amount: true } }),
    prisma.wheatKhataPayment.aggregate({
      where: { party: { deleted: false, kind: 'RECEIVING' } },
      _sum: { amount: true },
    }),
    prisma.wheatKhataPayment.aggregate({
      where: { party: { deleted: false, kind: 'GIVING' } },
      _sum: { amount: true },
    }),
    prisma.paddyKhataAmount.aggregate({ _sum: { amount: true } }),
    prisma.paddyKhataCash.aggregate({ where: { kind: 'GIVE' }, _sum: { amount: true } }),
    prisma.paddyKhataCash.aggregate({ where: { kind: 'RECEIVE' }, _sum: { amount: true } }),
    prisma.paddyKhataExpense.aggregate({ _sum: { amount: true } }),
    prisma.khataTreasury.aggregate({ where: { kind: 'TRANSFER_OUT' }, _sum: { amount: true } }),
    prisma.khataTreasury.aggregate({ where: { kind: 'TRANSFER_IN' }, _sum: { amount: true } }),
  ])
  const grainName = new Map(grainBooks.map((row) => [row.key, row.name]))
  const paddyName = new Map(paddyBooks.map((row) => [Number(row.id), row.name]))
  const [otherExpenses, otherExpenseSum, ledgerEntries, ledgerGive, ledgerReceive] = await Promise.all([
    prisma.khataTreasury.findMany({
      where: { kind: 'EXPENSE' },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_TAKE,
    }),
    prisma.khataTreasury.aggregate({ where: { kind: 'EXPENSE' }, _sum: { amount: true } }),
    prisma.khataLedgerEntry.findMany({
      where: { person: { deleted: false } },
      include: { person: { select: { name: true, bookType: true, bookRef: true, deleted: true } } },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_TAKE,
    }),
    prisma.khataLedgerEntry.aggregate({
      where: { kind: 'GIVING', person: { deleted: false } },
      _sum: { amount: true },
    }),
    prisma.khataLedgerEntry.aggregate({
      where: { kind: 'RECEIVING', person: { deleted: false } },
      _sum: { amount: true },
    }),
  ])
  const lines: ArhatAmountLine[] = []

  for (const row of moneyRows) {
    const who = grainName.get(row.bookKey) || row.bookKey
    lines.push(
      line(
        `khata-add-${row.id}`,
        'KHATA',
        'KHATA',
        'ADD',
        row.amount.toNumber(),
        joinReason([`${who} added amount`, row.notes]),
        row.createdAt,
      ),
    )
  }
  for (const row of paymentRows) {
    if (row.party?.deleted) continue
    const who = grainName.get(row.party.bookKey) || row.party.bookKey
    const giving = row.party.kind === 'RECEIVING'
    lines.push(
      line(
        `khata-pay-${row.id}`,
        'KHATA',
        'KHATA',
        giving ? 'GIVING' : 'RECEIVING',
        row.amount.toNumber(),
        joinReason([
          giving
            ? `${who} given to party ${row.party.name}`
            : `${who} received from company ${row.party.name}`,
          row.notes,
        ]),
        row.createdAt,
      ),
    )
  }
  for (const row of paddyAmounts) {
    const who = paddyName.get(Number(row.bookId)) || 'Paddy Khata'
    lines.push(
      line(
        `paddy-add-${row.id}`,
        'KHATA',
        'KHATA',
        'ADD',
        row.amount.toNumber(),
        joinReason([`${who} added amount`, row.notes]),
        row.createdAt,
      ),
    )
  }
  for (const row of paddyCash) {
    const who = row.book?.name || paddyName.get(Number(row.bookId)) || 'Paddy Khata'
    const giving = row.kind === 'GIVE'
    lines.push(
      line(
        `paddy-cash-${row.id}`,
        'KHATA',
        'KHATA',
        giving ? 'GIVING' : 'RECEIVING',
        row.amount.toNumber(),
        joinReason([
          giving
            ? `${who} given to party ${row.party?.name || ''}`
            : `${who} received from party ${row.party?.name || ''}`,
          row.notes,
        ]),
        row.createdAt,
      ),
    )
  }
  for (const row of paddyExpenses) {
    const who = paddyName.get(Number(row.bookId)) || 'Paddy Khata'
    lines.push(
      line(
        `paddy-exp-${row.id}`,
        'KHATA',
        'KHATA',
        'GIVING',
        row.amount.toNumber(),
        joinReason([`${who} paid bill`, row.reason, row.variety]),
        row.createdAt,
      ),
    )
  }
  for (const row of otherExpenses) {
    const who = row.bookType === 'PADDY'
      ? (paddyName.get(Number(row.bookRef)) || 'Paddy Khata')
      : (grainName.get(row.bookRef) || row.bookRef)
    lines.push(
      line(
        `khata-exp-${row.id}`,
        'KHATA',
        'KHATA',
        'GIVING',
        row.amount.toNumber(),
        joinReason([`${who} other expense`, row.notes]),
        row.createdAt,
      ),
    )
  }
  for (const row of ledgerEntries) {
    if (row.person?.deleted) continue
    const who = row.person.bookType === 'PADDY'
      ? (paddyName.get(Number(row.person.bookRef)) || 'Paddy Khata')
      : (grainName.get(row.person.bookRef) || row.person.bookRef)
    const giving = row.kind === 'GIVING'
    lines.push(
      line(
        `khata-person-${row.id}`,
        'KHATA',
        'KHATA',
        giving ? 'GIVING' : 'RECEIVING',
        row.amount.toNumber(),
        joinReason([
          giving
            ? `${who} given to ${row.person.name}`
            : `${who} received from ${row.person.name}`,
          row.notes,
        ]),
        row.createdAt,
      ),
    )
  }
  for (const row of treasury) {
    if (row.kind === 'BANK') continue
    const giving = row.kind === 'TRANSFER_OUT'
    lines.push(
      line(
        `khata-move-${row.id}`,
        'KHATA',
        'KHATA',
        giving ? 'GIVING' : 'RECEIVING',
        row.amount.toNumber(),
        joinReason([
          giving
            ? `Borrowed to ${row.counterName || 'another khata'}`
            : `Borrowed from ${row.counterName || 'another khata'}`,
          row.notes,
        ]),
        row.createdAt,
      ),
    )
  }
  const n = (value?: { toNumber(): number } | null) => value?.toNumber() ?? 0
  return {
    lines: sortLines(lines),
    totals: {
      added: n(moneySum._sum.amount) + n(paddyAdd._sum.amount),
      receiving: n(payReceive._sum.amount) + n(paddyReceive._sum.amount) + n(transferIn._sum.amount) + n(ledgerReceive._sum.amount),
      giving: n(payGive._sum.amount) + n(paddyGive._sum.amount) + n(paddyExp._sum.amount) + n(transferOut._sum.amount) + n(otherExpenseSum._sum.amount) + n(ledgerGive._sum.amount),
    },
  }
}

function totalsFromLines(
  lines: ArhatAmountLine[],
  extra: { commission: number; zakat?: number },
) {
  const added = sumKind(lines, 'ADD')
  const receiving = sumKind(lines, 'RECEIVING')
  const giving = sumKind(lines, 'GIVING')
  return {
    added,
    receiving,
    giving,
    zakat: extra.zakat ?? 0,
    commission: extra.commission,
    totalAmount: added + receiving - giving,
  }
}

export async function getBook() {
  const [arhat, khata] = await Promise.all([arhatLines(), khataCashLines()])
  const history = sortLines([...arhat.lines, ...khata.lines])
  const added = arhat.totals.added + khata.totals.added
  const receiving = arhat.totals.receiving + khata.totals.receiving
  const giving = arhat.totals.giving + khata.totals.giving
  return {
    totals: {
      added,
      receiving,
      giving,
      zakat: arhat.zakat,
      commission: arhat.commission,
      totalAmount: added + receiving - giving,
    },
    manual: arhat.manual,
    history,
  }
}

export async function getMergeReport() {
  const [arhat, khata] = await Promise.all([arhatLines(), khataCashLines()])
  const arhatTotals = {
    ...arhat.totals,
    zakat: arhat.zakat,
    commission: arhat.commission,
    totalAmount: arhat.totals.added + arhat.totals.receiving - arhat.totals.giving,
  }
  const khataTotals = {
    ...khata.totals,
    zakat: 0,
    commission: 0,
    totalAmount: khata.totals.added + khata.totals.receiving - khata.totals.giving,
  }
  return {
    arhat: arhatTotals,
    wheatKhata: khataTotals,
    khatas: khataTotals,
    combined: {
      added: arhatTotals.added + khataTotals.added,
      receiving: arhatTotals.receiving + khataTotals.receiving,
      giving: arhatTotals.giving + khataTotals.giving,
      zakat: arhatTotals.zakat,
      commission: arhatTotals.commission,
      totalAmount: arhatTotals.totalAmount + khataTotals.totalAmount,
    },
    history: sortLines([...arhat.lines, ...khata.lines]),
  }
}
