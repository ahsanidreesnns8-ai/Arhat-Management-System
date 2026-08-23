import { prisma } from '@/server/db'

export const DEFAULT_BOOK_KEY = 'WHEAT'

export const BUILTIN_BOOKS = [
  { key: 'WHEAT', name: 'Wheat Khata', nameUr: 'گندم کھاتہ', crop: 'wheat' },
  { key: 'BARLEY', name: 'Barley Khata', nameUr: 'جو کھاتہ', crop: 'barley' },
  { key: 'MAIZE', name: 'Maize Khata', nameUr: 'مکئی کھاتہ', crop: 'maize' },
] as const

const BUILTIN_BY_KEY = Object.fromEntries(BUILTIN_BOOKS.map((item) => [item.key, item])) as Record<
  string,
  (typeof BUILTIN_BOOKS)[number]
>

export function isBuiltinBookKey(key: string) {
  return key === 'WHEAT' || key === 'BARLEY' || key === 'MAIZE'
}

export function normalizeBookKey(value?: unknown) {
  const raw = String(value ?? DEFAULT_BOOK_KEY).trim()
  if (!raw) return DEFAULT_BOOK_KEY
  const upper = raw.toUpperCase()
  if (isBuiltinBookKey(upper)) return upper
  if (upper.startsWith('OTHER-')) {
    const slug = upper.slice(6).toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '')
    if (slug.length < 2 || slug.length > 48) throw new Error('Khata not found')
    return `OTHER-${slug}`
  }
  throw new Error('Khata not found')
}

export function bookHref(key: string) {
  if (key === 'WHEAT') return '/wheat-khata'
  if (key === 'BARLEY') return '/barley-khata'
  if (key === 'MAIZE') return '/maize-khata'
  if (key.startsWith('OTHER-')) return `/others-khata/${key}`
  return '/others-khata'
}

export function cropWord(crop: string) {
  if (crop === 'wheat' || crop === 'barley' || crop === 'maize') return crop
  return 'grain'
}

export function bookLabel(book: { name: string; nameUr?: string | null }, urdu: boolean) {
  if (urdu && book.nameUr) return book.nameUr
  return book.name
}

function bookDto(row: {
  key: string
  name: string
  crop: string
  builtin: boolean
  createdAt: Date
}) {
  const builtin = BUILTIN_BY_KEY[row.key]
  return {
    key: row.key,
    name: row.name,
    nameUr: builtin?.nameUr ?? null,
    crop: row.crop,
    cropWord: cropWord(row.crop),
    builtin: row.builtin,
    href: bookHref(row.key),
    createdAt: row.createdAt.toISOString(),
  }
}

export async function ensureBuiltinBooks() {
  for (const item of BUILTIN_BOOKS) {
    const existing = await prisma.grainKhataBook.findFirst({ where: { key: item.key } })
    if (!existing) {
      await prisma.grainKhataBook.create({
        data: {
          key: item.key,
          name: item.name,
          crop: item.crop,
          builtin: true,
        },
      })
      continue
    }
    if (existing.deleted || !existing.builtin || existing.name !== item.name) {
      await prisma.grainKhataBook.update({
        where: { id: existing.id },
        data: {
          deleted: false,
          builtin: true,
          name: item.name,
          crop: item.crop,
        },
      })
    }
  }
}

export async function resolveBook(value?: unknown) {
  const key = normalizeBookKey(value)
  if (isBuiltinBookKey(key)) {
    let row = await prisma.grainKhataBook.findFirst({ where: { key, deleted: false } })
    if (!row) {
      const meta = BUILTIN_BY_KEY[key]
      row = await prisma.grainKhataBook.create({
        data: {
          key,
          name: meta.name,
          crop: meta.crop,
          builtin: true,
        },
      })
    }
    return bookDto(row)
  }
  const row = await prisma.grainKhataBook.findFirst({
    where: { key, deleted: false, builtin: false },
  })
  if (!row) throw new Error('Khata not found')
  return bookDto(row)
}

export async function listBooks() {
  await ensureBuiltinBooks()
  const rows = await prisma.grainKhataBook.findMany({
    where: { deleted: false },
    orderBy: [{ builtin: 'desc' }, { createdAt: 'asc' }, { name: 'asc' }],
  })
  return rows.map(bookDto)
}

function slugFromName(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36)
  return slug || 'khata'
}

export async function createOtherBook(input: { name?: unknown }) {
  const name = String(input.name ?? '').trim()
  if (!name) throw new Error('Enter a name for this khata')
  if (name.length > 80) throw new Error('Khata name is too long')

  await ensureBuiltinBooks()
  const sameName = await prisma.grainKhataBook.findFirst({
    where: {
      deleted: false,
      builtin: false,
      name: { equals: name, mode: 'insensitive' },
    },
  })
  if (sameName) return bookDto(sameName)

  let slug = slugFromName(name)
  let key = `OTHER-${slug}`
  let attempt = 0
  while (await prisma.grainKhataBook.findFirst({ where: { key } })) {
    attempt += 1
    if (attempt > 8) throw new Error('Could not create this khata')
    key = `OTHER-${slug}-${Math.random().toString(36).slice(2, 6)}`
  }

  const row = await prisma.grainKhataBook.create({
    data: {
      key,
      name,
      crop: 'other',
      builtin: false,
    },
  })
  return bookDto(row)
}
