import { prisma } from '@/server/db'
import { roundRupee } from '@/server/money'
import { getBook as getWheatKhataBook } from '@/server/services/wheat-khata'

const MANUAL_KINDS = ['ADD', 'RECEIVING', 'GIVING'] as const
export type ArhatAmountKind = (typeof MANUAL_KINDS)[number]

export type LedgerKind = 'ADD' | 'RECEIVING' | 'GIVING'
export type LedgerBook = 'ARHAT' | 'WHEAT_KHATA'
export type LedgerSource =
  | 'MANUAL'
  | 'BUYER'
  | 'FARMER'
  | 'REGISTER'
  | 'ZAKAT'
  | 'WHEAT_KHATA'

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
      include: { farmer: true, buyer: true, sale: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.registerEntry.findMany({
      where: { kind: { in: ['GIVING', 'RECEIVING', 'ZAKAT'] } },
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

function wheatLinesFromBook(book: Awaited<ReturnType<typeof getWheatKhataBook>>): ArhatAmountLine[] {
  const lines: ArhatAmountLine[] = []
  for (const row of book.money) {
    lines.push(
      line(
        `wk-money-${row.id}`,
        'WHEAT_KHATA',
        'WHEAT_KHATA',
        'ADD',
        row.amount,
        row.notes || 'Amount added to Wheat Khata',
        new Date(row.createdAt),
      ),
    )
  }
  for (const party of book.parties) {
    for (const row of party.payments || []) {
      lines.push(
        line(
          `wk-pay-${row.id}`,
          'WHEAT_KHATA',
          'WHEAT_KHATA',
          'GIVING',
          row.amount,
          joinReason([`Given to party ${party.name}`, row.notes]),
          new Date(row.createdAt),
        ),
      )
    }
  }
  for (const company of book.companies) {
    for (const row of company.payments || []) {
      lines.push(
        line(
          `wk-pay-${row.id}`,
          'WHEAT_KHATA',
          'WHEAT_KHATA',
          'RECEIVING',
          row.amount,
          joinReason([`Received from company ${company.name}`, row.notes]),
          new Date(row.createdAt),
        ),
      )
    }
  }
  return sortLines(lines)
}

function wheatCommission(book: Awaited<ReturnType<typeof getWheatKhataBook>>) {
  return [...book.parties, ...book.companies].reduce(
    (sum, party) => sum + (party.bagAmount || 0) + (party.labourAmount || 0),
    0,
  )
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
  const arhat = await arhatLines()
  const totals = totalsFromLines(arhat.lines, {
    commission: arhat.commission,
    zakat: arhat.zakat,
  })
  return {
    totals,
    manual: arhat.manual,
    history: arhat.lines,
  }
}

export async function getMergeReport() {
  const [arhat, wheatBook] = await Promise.all([arhatLines(), getWheatKhataBook()])
  const wheatHistory = wheatLinesFromBook(wheatBook)
  const arhatTotals = totalsFromLines(arhat.lines, {
    commission: arhat.commission,
    zakat: arhat.zakat,
  })
  const wheatTotals = {
    added: wheatBook.totals.moneyIn,
    receiving: wheatBook.totals.cashReceived,
    giving: wheatBook.totals.cashGiven,
    zakat: 0,
    commission: wheatCommission(wheatBook),
    totalAmount: wheatBook.totals.totalAmount,
  }
  return {
    arhat: arhatTotals,
    wheatKhata: wheatTotals,
    combined: {
      added: arhatTotals.added + wheatTotals.added,
      receiving: arhatTotals.receiving + wheatTotals.receiving,
      giving: arhatTotals.giving + wheatTotals.giving,
      zakat: arhatTotals.zakat,
      commission: arhatTotals.commission + wheatTotals.commission,
      totalAmount: arhatTotals.totalAmount + wheatTotals.totalAmount,
    },
    history: sortLines([...arhat.lines, ...wheatHistory]),
  }
}
