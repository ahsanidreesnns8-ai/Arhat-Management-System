/** Same person ID: r74.a, R74.A, "R 74.A". */
export function normalizeAccountKey(value: string | null | undefined) {
  return String(value ?? '').trim().toUpperCase().replace(/\s+/g, '')
}

export function compactSearchText(value: string | null | undefined) {
  return String(value ?? '').toLowerCase().replace(/\s+/g, '')
}

export function accountKeysMatch(
  left: string | null | undefined,
  right: string | null | undefined,
) {
  const a = normalizeAccountKey(left)
  const b = normalizeAccountKey(right)
  return Boolean(a && b && a === b)
}
