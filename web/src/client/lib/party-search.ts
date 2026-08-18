export type PartySearchItem = {
  id: string
  code?: string
  name: string
  fatherName?: string | null
  address?: string | null
  city?: string | null
  phone?: string | null
  notes?: string | null
}

export function partySearchHaystack(item: PartySearchItem) {
  return [
    item.name,
    item.code,
    item.fatherName,
    item.address,
    item.city,
    item.phone,
    item.notes,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export function matchPartyQuery<T extends PartySearchItem>(items: T[], query: string, limit = 12): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return items.slice(0, limit)
  const starts: T[] = []
  const contains: T[] = []
  for (const item of items) {
    const name = (item.name || '').toLowerCase()
    const code = (item.code || '').toLowerCase()
    if (name.startsWith(q) || code.startsWith(q)) starts.push(item)
    else if (partySearchHaystack(item).includes(q)) contains.push(item)
  }
  return [...starts, ...contains].slice(0, limit)
}

export function partyDetailsLine(item: PartySearchItem | null | undefined) {
  if (!item) return ''
  return [
    item.code,
    item.fatherName ? `s/o ${item.fatherName}` : '',
    [item.address, item.city].filter(Boolean).join(', '),
    item.phone,
  ]
    .filter(Boolean)
    .join(' · ')
}
