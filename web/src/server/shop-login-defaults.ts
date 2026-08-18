/** Permanent shop terminals. Seed, login repair, and docs all use these. */
export const DEFAULT_SHOP_LOGINS = [
  {
    username: 'owner' as const,
    password: 'owner123',
    email: 'owner@rehmanitrading.com',
    fullName: 'Owner',
    role: 'OWNER' as const,
  },
  {
    username: 'staff' as const,
    password: 'staff123',
    email: 'staff@rehmanitrading.com',
    fullName: 'Staff',
    role: 'OPERATOR' as const,
  },
]

export function canonicalShopPassword(username: string): string | null {
  const normalized = username.trim().toLowerCase()
  const row = DEFAULT_SHOP_LOGINS.find((login) => login.username === normalized)
  return row?.password ?? null
}

export function isCanonicalShopPassword(username: string | undefined, password: string) {
  if (!username) return false
  return canonicalShopPassword(username) === password
}
