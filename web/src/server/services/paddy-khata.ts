import { compare, hash } from 'bcryptjs'
import { prisma } from '@/server/db'
import { d, roundRupee } from '@/server/money'

const RATE_UNIT_KG = 40

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
  const count = Number(value)
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error(`Enter a valid ${label}`)
  }
  return count
}

function parseOptionalText(value: unknown) {
  const text = String(value ?? '').trim()
  return text || null
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

function parseSecret(value: unknown) {
  const secret = String(value ?? '').trim()
  if (secret.length < 4) throw new Error('Secret code must be at least 4 characters')
  return secret
}

function grainAmount(totalKg: number, ratePer40Kg: number) {
  return roundRupee(d(totalKg).div(RATE_UNIT_KG).mul(ratePer40Kg)).toNumber()
}

export function previewPurchase(input: {
  bags?: unknown
  bagWeightKg?: unknown
  extraWeightKg?: unknown
  ratePer40Kg?: unknown
  bagPrice?: unknown
  labourPrice?: unknown
}) {
  const bags = parseCount(input.bags, 'number of bags')
  const bagWeightRaw = input.bagWeightKg == null || String(input.bagWeightKg).trim() === ''
    ? RATE_UNIT_KG
    : Number(input.bagWeightKg)
  if (!Number.isFinite(bagWeightRaw) || bagWeightRaw <= 0) {
    throw new Error('Enter weight of one bag in KG')
  }
  const bagWeightKg = d(bagWeightRaw).toDecimalPlaces(2).toNumber()
  const extraWeightKg = parseOptionalMoney(input.extraWeightKg, 'extra weight')
  const ratePer40Kg = parseAmount(input.ratePer40Kg, 'Rate per 40 KG')
  const bagPrice = parseOptionalMoney(input.bagPrice, 'Bag price')
  const labourPrice = parseOptionalMoney(input.labourPrice, 'Labour price')
  const totalWeightKg = d(bags).mul(bagWeightKg).add(extraWeightKg).toDecimalPlaces(2).toNumber()
  const grain = grainAmount(totalWeightKg, ratePer40Kg)
  const bagAmount = roundRupee(d(bags).mul(bagPrice)).toNumber()
  const labourAmount = roundRupee(d(bags).mul(labourPrice)).toNumber()
  return {
    bags,
    bagWeightKg,
    extraWeightKg,
    ratePer40Kg,
    bagPrice,
    labourPrice,
    totalWeightKg,
    grainAmount: grain,
    bagAmount,
    labourAmount,
    totalPrice: grain + bagAmount + labourAmount,
  }
}

export function previewSale(input: {
  bags?: unknown
  bagWeightKg?: unknown
  ratePer40Kg?: unknown
}) {
  const bags = parseCount(input.bags, 'number of bags')
  const bagWeightRaw = input.bagWeightKg == null || String(input.bagWeightKg).trim() === ''
    ? RATE_UNIT_KG
    : Number(input.bagWeightKg)
  if (!Number.isFinite(bagWeightRaw) || bagWeightRaw <= 0) {
    throw new Error('Enter weight of one bag in KG')
  }
  const bagWeightKg = d(bagWeightRaw).toDecimalPlaces(2).toNumber()
  const ratePer40Kg = parseAmount(input.ratePer40Kg, 'Rate per 40 KG')
  const totalWeightKg = d(bags).mul(bagWeightKg).toDecimalPlaces(2).toNumber()
  const totalPrice = grainAmount(totalWeightKg, ratePer40Kg)
  return { bags, bagWeightKg, ratePer40Kg, totalWeightKg, totalPrice }
}

function bookSummary(row: {
  id: bigint
  publicId: string
  name: string
  createdAt: Date
}) {
  return {
    id: Number(row.id),
    publicId: row.publicId,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
  }
}

async function findOwnedBook(bookId: number | bigint, userId: bigint) {
  const book = await prisma.paddyKhataBook.findFirst({
    where: { id: BigInt(bookId), deleted: false, createdById: userId },
  })
  if (!book) throw new Error('Paddy Khata ID not found')
  return book
}

export async function requireBook(
  bookId: number | bigint,
  userId: bigint,
  secret: unknown,
) {
  const book = await findOwnedBook(bookId, userId)
  const ok = await compare(String(secret ?? ''), book.secretHash)
  if (!ok) throw new Error('Wrong secret code')
  return book
}

export async function listBooks(userId: bigint) {
  const rows = await prisma.paddyKhataBook.findMany({
    where: { deleted: false, createdById: userId },
    orderBy: { createdAt: 'desc' },
  })
  return rows.map(bookSummary)
}

export async function createBook(
  userId: bigint,
  input: { name?: unknown; secret?: unknown },
) {
  const name = String(input.name ?? '').trim() || 'Paddy Khata'
  const secret = parseSecret(input.secret)
  const secretHash = await hash(secret, 10)
  const publicId = `PK-${Date.now().toString(36).toUpperCase()}`
  const row = await prisma.paddyKhataBook.create({
    data: {
      publicId,
      name,
      secretHash,
      createdById: userId,
    },
  })
  return bookSummary(row)
}

function cashKind(partyKind: string, cashKind: string) {
  if (partyKind === 'PURCHASE' && cashKind === 'GIVE') return 'GIVE'
  if (partyKind === 'SALE' && cashKind === 'RECEIVE') return 'RECEIVE'
  throw new Error('This amount does not belong to that party')
}

export async function getBook(bookId: number | bigint, userId: bigint, secret: unknown) {
  const book = await requireBook(bookId, userId, secret)
  const [amounts, parties, purchases, processes, riceLots, sales, payments] = await Promise.all([
    prisma.paddyKhataAmount.findMany({ where: { bookId: book.id }, orderBy: { createdAt: 'desc' } }),
    prisma.paddyKhataParty.findMany({ where: { bookId: book.id, deleted: false }, orderBy: { name: 'asc' } }),
    prisma.paddyKhataPurchase.findMany({
      where: { bookId: book.id },
      include: { party: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.paddyKhataProcess.findMany({ where: { bookId: book.id }, orderBy: { createdAt: 'desc' } }),
    prisma.paddyKhataRice.findMany({ where: { bookId: book.id }, orderBy: { createdAt: 'desc' } }),
    prisma.paddyKhataSale.findMany({
      where: { bookId: book.id },
      include: { party: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.paddyKhataCash.findMany({
      where: { bookId: book.id },
      include: { party: true },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const amountRows = amounts.map((row) => ({
    id: Number(row.id),
    amount: row.amount.toNumber(),
    notes: row.notes,
    ...stampDto(row.createdAt),
  }))
  const purchaseRows = purchases.map((row) => {
    const totalWeightKg = d(row.bags).mul(row.bagWeightKg).add(row.extraWeightKg).toNumber()
    return {
      id: Number(row.id),
      partyId: Number(row.partyId),
      partyName: row.party.name,
      partyAddress: row.party.address,
      bags: row.bags,
      bagWeightKg: row.bagWeightKg.toNumber(),
      extraWeightKg: row.extraWeightKg.toNumber(),
      ratePer40Kg: row.ratePer40Kg.toNumber(),
      variety: row.variety,
      bagPrice: row.bagPrice.toNumber(),
      labourPrice: row.labourPrice.toNumber(),
      grainAmount: row.grainAmount.toNumber(),
      bagAmount: row.bagAmount.toNumber(),
      labourAmount: row.labourAmount.toNumber(),
      totalPrice: row.totalPrice.toNumber(),
      totalWeightKg,
      notes: row.notes,
      ...stampDto(row.createdAt),
    }
  })
  const processRows = processes.map((row) => ({
    id: Number(row.id),
    variety: row.variety,
    partyName: row.partyName,
    bags: row.bags,
    notes: row.notes,
    ...stampDto(row.createdAt),
  }))
  const riceRows = riceLots.map((row) => ({
    id: Number(row.id),
    bags: row.bags,
    notes: row.notes,
    ...stampDto(row.createdAt),
  }))
  const saleRows = sales.map((row) => {
    const totalWeightKg = d(row.bags).mul(row.bagWeightKg).toNumber()
    return {
      id: Number(row.id),
      partyId: Number(row.partyId),
      partyName: row.party.name,
      partyAddress: row.party.address,
      bags: row.bags,
      bagWeightKg: row.bagWeightKg.toNumber(),
      ratePer40Kg: row.ratePer40Kg.toNumber(),
      grainAmount: row.grainAmount.toNumber(),
      totalPrice: row.totalPrice.toNumber(),
      totalWeightKg,
      notes: row.notes,
      ...stampDto(row.createdAt),
    }
  })
  const cashRows = payments.map((row) => ({
    id: Number(row.id),
    partyId: Number(row.partyId),
    partyName: row.party.name,
    partyKind: row.party.kind,
    kind: row.kind,
    amount: row.amount.toNumber(),
    notes: row.notes,
    ...stampDto(row.createdAt),
  }))

  const purchaseParties = parties.filter((row) => row.kind === 'PURCHASE').map((party) => {
    const productRows = purchaseRows.filter((row) => row.partyId === Number(party.id))
    const given = cashRows.filter((row) => row.partyId === Number(party.id) && row.kind === 'GIVE')
    const productTotal = productRows.reduce((sum, row) => sum + row.totalPrice, 0)
    const cashTotal = given.reduce((sum, row) => sum + row.amount, 0)
    return {
      id: Number(party.id),
      kind: party.kind,
      name: party.name,
      address: party.address,
      notes: party.notes,
      createdAt: party.createdAt.toISOString(),
      productTotal,
      cashTotal,
      remaining: productTotal - cashTotal,
      totalBags: productRows.reduce((sum, row) => sum + row.bags, 0),
      purchases: productRows,
      payments: given,
    }
  })
  const saleParties = parties.filter((row) => row.kind === 'SALE').map((party) => {
    const sold = saleRows.filter((row) => row.partyId === Number(party.id))
    const received = cashRows.filter((row) => row.partyId === Number(party.id) && row.kind === 'RECEIVE')
    const productTotal = sold.reduce((sum, row) => sum + row.totalPrice, 0)
    const cashTotal = received.reduce((sum, row) => sum + row.amount, 0)
    return {
      id: Number(party.id),
      kind: party.kind,
      name: party.name,
      address: party.address,
      notes: party.notes,
      createdAt: party.createdAt.toISOString(),
      productTotal,
      cashTotal,
      remaining: productTotal - cashTotal,
      totalBags: sold.reduce((sum, row) => sum + row.bags, 0),
      sales: sold,
      payments: received,
    }
  })

  const varietyMap = new Map<string, {
    variety: string
    bags: number
    extraWeightKg: number
    totalWeightKg: number
    totalPrice: number
    processedBags: number
    lines: typeof purchaseRows
  }>()
  for (const row of purchaseRows) {
    const key = row.variety.trim() || 'Unnamed'
    const current = varietyMap.get(key) ?? {
      variety: key,
      bags: 0,
      extraWeightKg: 0,
      totalWeightKg: 0,
      totalPrice: 0,
      processedBags: 0,
      lines: [],
    }
    current.bags += row.bags
    current.extraWeightKg += row.extraWeightKg
    current.totalWeightKg += row.totalWeightKg
    current.totalPrice += row.totalPrice
    current.lines.push(row)
    varietyMap.set(key, current)
  }
  for (const row of processRows) {
    const key = row.variety.trim() || 'Unnamed'
    const current = varietyMap.get(key)
    if (current) current.processedBags += row.bags
  }
  const varieties = [...varietyMap.values()].map((row) => ({
    ...row,
    remainingBags: Math.max(0, row.bags - row.processedBags),
  }))

  const moneyIn = amountRows.reduce((sum, row) => sum + row.amount, 0)
  const purchaseTotal = purchaseRows.reduce((sum, row) => sum + row.totalPrice, 0)
  const givenCash = cashRows.filter((row) => row.kind === 'GIVE').reduce((sum, row) => sum + row.amount, 0)
  const receivedCash = cashRows.filter((row) => row.kind === 'RECEIVE').reduce((sum, row) => sum + row.amount, 0)
  const saleTotal = saleRows.reduce((sum, row) => sum + row.totalPrice, 0)
  const paddyBags = purchaseRows.reduce((sum, row) => sum + row.bags, 0)
  const processedBags = processRows.reduce((sum, row) => sum + row.bags, 0)
  const riceBags = riceRows.reduce((sum, row) => sum + row.bags, 0)
  const soldBags = saleRows.reduce((sum, row) => sum + row.bags, 0)

  return {
    ...bookSummary(book),
    totals: {
      moneyIn,
      purchaseTotal,
      givenCash,
      receivedCash,
      saleTotal,
      givingAmount: purchaseTotal + givenCash,
      receivingAmount: receivedCash,
      totalAmount: moneyIn + receivedCash - purchaseTotal - givenCash,
      paddyBags,
      processedBags,
      riceBags,
      soldBags,
      riceInStock: riceBags - soldBags,
    },
    amounts: amountRows,
    purchaseParties,
    saleParties,
    purchases: purchaseRows,
    processes: processRows,
    riceLots: riceRows,
    sales: saleRows,
    payments: cashRows,
    varieties,
  }
}

export async function addAmount(
  bookId: number | bigint,
  userId: bigint,
  input: { secret?: unknown; amount?: unknown; notes?: unknown },
) {
  const book = await requireBook(bookId, userId, input.secret)
  const amount = parseAmount(input.amount)
  const row = await prisma.paddyKhataAmount.create({
    data: { bookId: book.id, amount, notes: parseOptionalText(input.notes) },
  })
  return { id: Number(row.id), amount: row.amount.toNumber(), notes: row.notes, ...stampDto(row.createdAt) }
}

export async function createParty(
  bookId: number | bigint,
  userId: bigint,
  input: { secret?: unknown; kind?: unknown; name?: unknown; address?: unknown; notes?: unknown },
) {
  const book = await requireBook(bookId, userId, input.secret)
  const kind = String(input.kind ?? '').trim().toUpperCase()
  if (kind !== 'PURCHASE' && kind !== 'SALE') throw new Error('Choose purchase or sell party')
  const name = String(input.name ?? '').trim()
  if (!name) throw new Error('Party name is required')
  const existing = await prisma.paddyKhataParty.findFirst({
    where: { bookId: book.id, deleted: false, kind, name: { equals: name, mode: 'insensitive' } },
  })
  if (existing) {
    const updated = await prisma.paddyKhataParty.update({
      where: { id: existing.id },
      data: {
        ...(parseOptionalText(input.address) ? { address: parseOptionalText(input.address) } : {}),
        ...(parseOptionalText(input.notes) ? { notes: parseOptionalText(input.notes) } : {}),
      },
    })
    return {
      id: Number(updated.id),
      kind: updated.kind,
      name: updated.name,
      address: updated.address,
      notes: updated.notes,
    }
  }
  const row = await prisma.paddyKhataParty.create({
    data: {
      bookId: book.id,
      kind,
      name,
      address: parseOptionalText(input.address),
      notes: parseOptionalText(input.notes),
    },
  })
  return { id: Number(row.id), kind: row.kind, name: row.name, address: row.address, notes: row.notes }
}

export async function addPurchase(
  bookId: number | bigint,
  userId: bigint,
  input: {
    secret?: unknown
    partyId?: unknown
    bags?: unknown
    bagWeightKg?: unknown
    extraWeightKg?: unknown
    ratePer40Kg?: unknown
    variety?: unknown
    bagPrice?: unknown
    labourPrice?: unknown
    notes?: unknown
  },
) {
  const book = await requireBook(bookId, userId, input.secret)
  const partyId = Number(input.partyId)
  if (!Number.isSafeInteger(partyId) || partyId <= 0) throw new Error('Choose a party first')
  const party = await prisma.paddyKhataParty.findFirst({
    where: { id: BigInt(partyId), bookId: book.id, deleted: false, kind: 'PURCHASE' },
  })
  if (!party) throw new Error('Purchase party not found')
  const variety = String(input.variety ?? '').trim()
  if (!variety) throw new Error('Enter variety of product')
  const preview = previewPurchase(input)
  const snapshot = await getBook(book.id, userId, input.secret)
  if (preview.totalPrice > snapshot.totals.totalAmount) {
    throw new Error(
      `Not enough Paddy Khata amount. Available ${snapshot.totals.totalAmount}, this purchase is ${preview.totalPrice}`,
    )
  }
  const row = await prisma.paddyKhataPurchase.create({
    data: {
      bookId: book.id,
      partyId: party.id,
      bags: preview.bags,
      bagWeightKg: preview.bagWeightKg,
      extraWeightKg: preview.extraWeightKg,
      ratePer40Kg: preview.ratePer40Kg,
      variety,
      bagPrice: preview.bagPrice,
      labourPrice: preview.labourPrice,
      grainAmount: preview.grainAmount,
      bagAmount: preview.bagAmount,
      labourAmount: preview.labourAmount,
      totalPrice: preview.totalPrice,
      notes: parseOptionalText(input.notes),
    },
  })
  return { id: Number(row.id), totalPrice: row.totalPrice.toNumber(), variety: row.variety, bags: row.bags }
}

export async function addCash(
  bookId: number | bigint,
  userId: bigint,
  input: { secret?: unknown; partyId?: unknown; kind?: unknown; amount?: unknown; notes?: unknown },
) {
  const book = await requireBook(bookId, userId, input.secret)
  const partyId = Number(input.partyId)
  if (!Number.isSafeInteger(partyId) || partyId <= 0) throw new Error('Choose a party first')
  const party = await prisma.paddyKhataParty.findFirst({
    where: { id: BigInt(partyId), bookId: book.id, deleted: false },
  })
  if (!party) throw new Error('Party not found')
  const kind = cashKind(party.kind, String(input.kind ?? '').trim().toUpperCase())
  const amount = parseAmount(input.amount)
  const snapshot = await getBook(book.id, userId, input.secret)
  if (kind === 'GIVE' && amount > snapshot.totals.totalAmount) {
    throw new Error(`Not enough Paddy Khata amount. Available ${snapshot.totals.totalAmount}`)
  }
  if (kind === 'RECEIVE') {
    const partySnap = snapshot.saleParties.find((row) => row.id === Number(party.id))
    const remaining = partySnap ? partySnap.remaining : 0
    if (amount > remaining) {
      throw new Error(`This party still owes ${remaining}. Receive that or less.`)
    }
  }
  const row = await prisma.paddyKhataCash.create({
    data: {
      bookId: book.id,
      partyId: party.id,
      kind,
      amount,
      notes: parseOptionalText(input.notes),
    },
  })
  return { id: Number(row.id), kind: row.kind, amount: row.amount.toNumber() }
}

export async function addProcess(
  bookId: number | bigint,
  userId: bigint,
  input: { secret?: unknown; variety?: unknown; partyName?: unknown; bags?: unknown; notes?: unknown },
) {
  const book = await requireBook(bookId, userId, input.secret)
  const variety = String(input.variety ?? '').trim()
  if (!variety) throw new Error('Choose a variety')
  const partyName = String(input.partyName ?? '').trim()
  if (!partyName) throw new Error('Enter name of party')
  const bags = parseCount(input.bags, 'number of bags')
  const snapshot = await getBook(book.id, userId, input.secret)
  const frame = snapshot.varieties.find((row) => row.variety.toLowerCase() === variety.toLowerCase())
  if (!frame) throw new Error('This variety has no purchased stock')
  if (bags > frame.remainingBags) {
    throw new Error(`Only ${frame.remainingBags} bags of ${frame.variety} left to process`)
  }
  const row = await prisma.paddyKhataProcess.create({
    data: {
      bookId: book.id,
      variety: frame.variety,
      partyName,
      bags,
      notes: parseOptionalText(input.notes),
    },
  })
  return { id: Number(row.id), variety: row.variety, bags: row.bags, partyName: row.partyName }
}

export async function addRice(
  bookId: number | bigint,
  userId: bigint,
  input: { secret?: unknown; bags?: unknown; notes?: unknown },
) {
  const book = await requireBook(bookId, userId, input.secret)
  const bags = parseCount(input.bags, 'rice bags')
  const snapshot = await getBook(book.id, userId, input.secret)
  const remainingProcess = snapshot.totals.processedBags - snapshot.totals.riceBags
  if (bags > remainingProcess) {
    throw new Error(`Process paddy first. ${Math.max(0, remainingProcess)} processed bags are ready for rice`)
  }
  const row = await prisma.paddyKhataRice.create({
    data: { bookId: book.id, bags, notes: parseOptionalText(input.notes) },
  })
  return { id: Number(row.id), bags: row.bags }
}

export async function addSale(
  bookId: number | bigint,
  userId: bigint,
  input: {
    secret?: unknown
    partyId?: unknown
    bags?: unknown
    bagWeightKg?: unknown
    ratePer40Kg?: unknown
    notes?: unknown
  },
) {
  const book = await requireBook(bookId, userId, input.secret)
  const partyId = Number(input.partyId)
  if (!Number.isSafeInteger(partyId) || partyId <= 0) throw new Error('Choose a party first')
  const party = await prisma.paddyKhataParty.findFirst({
    where: { id: BigInt(partyId), bookId: book.id, deleted: false, kind: 'SALE' },
  })
  if (!party) throw new Error('Sell party not found')
  const preview = previewSale(input)
  const snapshot = await getBook(book.id, userId, input.secret)
  if (preview.bags > snapshot.totals.riceInStock) {
    throw new Error(`Only ${snapshot.totals.riceInStock} rice bags in stock`)
  }
  const row = await prisma.paddyKhataSale.create({
    data: {
      bookId: book.id,
      partyId: party.id,
      bags: preview.bags,
      bagWeightKg: preview.bagWeightKg,
      ratePer40Kg: preview.ratePer40Kg,
      grainAmount: preview.totalPrice,
      totalPrice: preview.totalPrice,
      notes: parseOptionalText(input.notes),
    },
  })
  return {
    id: Number(row.id),
    bags: row.bags,
    totalPrice: row.totalPrice.toNumber(),
    partyName: party.name,
    partyAddress: party.address,
  }
}
