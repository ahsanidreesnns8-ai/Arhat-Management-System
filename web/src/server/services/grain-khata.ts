import { compare, hash } from 'bcryptjs'
import { prisma } from '@/server/db'

export const DEFAULT_BOOK_KEY = 'WHEAT'

export type GrainCrop = 'wheat' | 'barley' | 'maize' | 'other'

const CROP_META: Record<GrainCrop, { label: string; labelUr: string; prefix: string; keyPrefix: string }> = {
  wheat: { label: 'Wheat Khata', labelUr: 'گندم کھاتہ', prefix: 'WK', keyPrefix: 'WHEAT' },
  barley: { label: 'Barley Khata', labelUr: 'جو کھاتہ', prefix: 'BK', keyPrefix: 'BARLEY' },
  maize: { label: 'Maize Khata', labelUr: 'مکئی کھاتہ', prefix: 'MK', keyPrefix: 'MAIZE' },
  other: { label: 'Others Khata', labelUr: 'دیگر کھاتہ', prefix: 'OK', keyPrefix: 'OTHER' },
}

export function parseCrop(value?: unknown): GrainCrop {
  const crop = String(value ?? '').trim().toLowerCase()
  if (crop === 'wheat' || crop === 'barley' || crop === 'maize' || crop === 'other') return crop
  throw new Error('Choose Wheat, Barley, Maize, or Others Khata')
}

export function cropWord(crop: string) {
  if (crop === 'wheat' || crop === 'barley' || crop === 'maize') return crop
  return 'grain'
}

export function bookHref(cropOrKey: string) {
  const crop = cropOrKey.includes('-') || cropOrKey === cropOrKey.toUpperCase()
    ? cropFromKey(cropOrKey)
    : cropOrKey
  if (crop === 'wheat' || crop === 'WHEAT') return '/wheat-khata'
  if (crop === 'barley' || crop === 'BARLEY') return '/barley-khata'
  if (crop === 'maize' || crop === 'MAIZE') return '/maize-khata'
  return '/others-khata'
}

function cropFromKey(key: string) {
  const upper = key.toUpperCase()
  if (upper === 'WHEAT' || upper.startsWith('WHEAT-')) return 'wheat'
  if (upper === 'BARLEY' || upper.startsWith('BARLEY-')) return 'barley'
  if (upper === 'MAIZE' || upper.startsWith('MAIZE-')) return 'maize'
  return 'other'
}

export function normalizeBookKey(value?: unknown) {
  const raw = String(value ?? DEFAULT_BOOK_KEY).trim()
  if (!raw) return DEFAULT_BOOK_KEY
  const upper = raw.toUpperCase()
  if (upper === 'WHEAT' || upper === 'BARLEY' || upper === 'MAIZE') return upper
  const match = upper.match(/^(WHEAT|BARLEY|MAIZE|OTHER)-([A-Z0-9][A-Z0-9-]{0,47})$/)
  if (match) return `${match[1]}-${match[2]}`
  throw new Error('Khata not found')
}

export function bookLabel(book: { name: string; nameUr?: string | null }, urdu: boolean) {
  if (urdu && book.nameUr) return book.nameUr
  return book.name
}

function parseSecret(value: unknown) {
  const secret = String(value ?? '').trim()
  if (secret.length < 4) throw new Error('Secret code must be at least 4 characters')
  return secret
}

function bookDto(row: {
  id: bigint
  key: string
  publicId?: string | null
  name: string
  crop: string
  secretHash?: string | null
  createdById?: bigint | null
  builtin: boolean
  createdAt: Date
}) {
  const crop = (['wheat', 'barley', 'maize', 'other'].includes(row.crop) ? row.crop : cropFromKey(row.key)) as GrainCrop
  const meta = CROP_META[crop]
  return {
    id: Number(row.id),
    key: row.key,
    publicId: row.publicId || (row.builtin ? `${meta.prefix}-SHOP` : row.key),
    name: row.name,
    nameUr: row.builtin ? meta.labelUr : null,
    crop,
    cropWord: cropWord(crop),
    builtin: row.builtin,
    locked: Boolean(row.secretHash),
    href: bookHref(crop),
    createdAt: row.createdAt.toISOString(),
  }
}

export async function findBookRow(value?: unknown) {
  const key = normalizeBookKey(value)
  const row = await prisma.grainKhataBook.findFirst({ where: { key, deleted: false } })
  if (!row) throw new Error('Khata not found')
  return row
}

function virtualShopWheat() {
  return bookDto({
    id: BigInt(0),
    key: 'WHEAT',
    publicId: 'WK-SHOP',
    name: 'Wheat Khata',
    crop: 'wheat',
    secretHash: null,
    createdById: null,
    builtin: true,
    createdAt: new Date(0),
  })
}

export async function resolveShopBook(value?: unknown) {
  const key = normalizeBookKey(value)
  const row = await prisma.grainKhataBook.findFirst({ where: { key, deleted: false } })
  if (row) {
    if (row.secretHash) throw new Error('Secret code required')
    return bookDto(row)
  }
  if (key === 'WHEAT') return virtualShopWheat()
  throw new Error('Khata not found')
}

export async function resolveBook(value?: unknown) {
  const key = normalizeBookKey(value)
  const row = await prisma.grainKhataBook.findFirst({ where: { key, deleted: false } })
  if (row) return bookDto(row)
  if (key === 'WHEAT') return virtualShopWheat()
  throw new Error('Khata not found')
}

export async function requireOwnedBook(value: unknown, userId: bigint, secret: unknown) {
  const row = await findBookRow(value)
  if (row.createdById != null && row.createdById !== userId) {
    throw new Error('Khata not found')
  }
  if (row.secretHash) {
    const ok = await compare(String(secret ?? ''), row.secretHash)
    if (!ok) throw new Error('Wrong secret code')
  }
  return bookDto(row)
}

async function ensureLegacyShopWheat() {
  const existing = await prisma.grainKhataBook.findFirst({ where: { key: 'WHEAT' } })
  if (existing) {
    if (existing.deleted) {
      await prisma.grainKhataBook.update({
        where: { id: existing.id },
        data: { deleted: false, builtin: true, crop: 'wheat', name: existing.name || 'Wheat Khata' },
      })
    }
    return
  }
  const [money, parties] = await Promise.all([
    prisma.wheatKhataMoney.count({ where: { bookKey: 'WHEAT' } }),
    prisma.wheatKhataParty.count({ where: { bookKey: 'WHEAT', deleted: false } }),
  ])
  if (!money && !parties) return
  await prisma.grainKhataBook.create({
    data: {
      key: 'WHEAT',
      publicId: 'WK-SHOP',
      name: 'Wheat Khata',
      crop: 'wheat',
      builtin: true,
    },
  })
}

export async function listBooks(userId: bigint, cropValue?: unknown) {
  const crop = parseCrop(cropValue)
  if (crop === 'wheat') await ensureLegacyShopWheat()
  const rows = await prisma.grainKhataBook.findMany({
    where: {
      deleted: false,
      crop,
      OR: [{ createdById: userId }, { createdById: null }],
    },
    orderBy: { createdAt: 'desc' },
  })
  return rows.map(bookDto)
}

export async function createBook(
  userId: bigint,
  input: { crop?: unknown; name?: unknown; secret?: unknown },
) {
  const crop = parseCrop(input.crop)
  const meta = CROP_META[crop]
  const name = String(input.name ?? '').trim() || (crop === 'other' ? '' : meta.label)
  if (!name) throw new Error('Enter a name for this khata')
  if (name.length > 80) throw new Error('Khata name is too long')
  const secret = parseSecret(input.secret)
  const secretHash = await hash(secret, 10)
  const publicId = `${meta.prefix}-${Date.now().toString(36).toUpperCase()}`
  const key = `${meta.keyPrefix}-${publicId}`
  const row = await prisma.grainKhataBook.create({
    data: {
      key,
      publicId,
      name,
      crop,
      secretHash,
      createdById: userId,
      builtin: false,
    },
  })
  return bookDto(row)
}

export const createOtherBook = createBook
