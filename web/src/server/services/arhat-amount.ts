import { prisma } from '@/server/db'
import { roundRupee } from '@/server/money'
import { allTreasuryRows } from '@/server/services/khata-treasury'

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

async function arhatLines(): Promise<{
  lines: ArhatAmountLine[]
  commission: number
  zakat: number
  manual: ReturnType<typeof manualDto>[]
}> {
  const [manualRows, paymentRows, registerRows, commissionAgg] = await Promise.all([
    prisma.arhatAmountEntry.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.payment.findMany({
      where: {
        OR: [{ dheriId: null }, { dheri: { deleted: false } }],
      },
      include: { farmer: true, buyer: true, sale: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.registerEntry.findMany({
      where: {
        kind: { in: ['GIVING', 'RECEIVING', 'ZAKAT'] },
        OR: [{ partyId: null }, { party: { deleted: false } }],
      },
      include: { party: true, farmer: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.dheri.aggregate({
      _sum: { commissionAmount: true },
      where: { deleted: false },
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
  return {
    lines: sorted,
    commission: commissionAgg._sum.commissionAmount?.toNumber() ?? 0,
    zakat: sorted.filter((row) => row.source === 'ZAKAT').reduce((sum, row) => sum + row.amount, 0),
    manual: manualRows.map(manualDto),
  }
}

async function khataCashLines(): Promise<ArhatAmountLine[]> {
  const [grainBooks, paddyBooks, moneyRows, paymentRows, paddyAmounts, paddyCash, paddyExpenses, treasury] = await Promise.all([
    prisma.grainKhataBook.findMany({ where: { deleted: false } }),
    prisma.paddyKhataBook.findMany({ where: { deleted: false } }),
    prisma.wheatKhataMoney.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.wheatKhataPayment.findMany({
      include: { party: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.paddyKhataAmount.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.paddyKhataCash.findMany({
      include: { party: true, book: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.paddyKhataExpense.findMany({ orderBy: { createdAt: 'desc' } }),
    allTreasuryRows(),
  ])
  const grainName = new Map(grainBooks.map((row) => [row.key, row.name]))
  const paddyName = new Map(paddyBooks.map((row) => [Number(row.id), row.name]))
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
  for (const row of treasury) {
    if (row.kind === 'BANK') continue
    const giving = row.kind === 'TRANSFER_OUT'
    lines.push(
      line(
        `khata-move-${row.id}`,
        'KHATA',
        'KHATA',
        giving ? 'GIVING' : 'RECEIVING',
        row.amount,
        joinReason([
          giving
            ? `Borrowed to ${row.counterName || 'another khata'}`
            : `Borrowed from ${row.counterName || 'another khata'}`,
          row.notes,
        ]),
        new Date(row.createdAt),
      ),
    )
  }
  return sortLines(lines)
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
  const [arhat, khataHistory] = await Promise.all([arhatLines(), khataCashLines()])
  const history = sortLines([...arhat.lines, ...khataHistory])
  const totals = totalsFromLines(history, {
    commission: arhat.commission,
    zakat: arhat.zakat,
  })
  return {
    totals,
    manual: arhat.manual,
    history,
  }
}

export async function getMergeReport() {
  const [arhat, khataHistory] = await Promise.all([arhatLines(), khataCashLines()])
  const arhatTotals = totalsFromLines(arhat.lines, {
    commission: arhat.commission,
    zakat: arhat.zakat,
  })
  const khataTotals = totalsFromLines(khataHistory, { commission: 0, zakat: 0 })
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
    history: sortLines([...arhat.lines, ...khataHistory]),
  }
}
