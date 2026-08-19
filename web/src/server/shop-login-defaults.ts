/** Default shop terminals. Used only when the account is first created or still on a leaked password. */
export const LEGACY_LEAKED_SHOP_PASSWORDS: Record<string, string> = {
  owner: 'owner123',
  staff: 'staff123',
}

export const DEFAULT_SHOP_LOGINS = [
  {
    username: 'owner' as const,
    password: 'Nankana#Shop9472Rtc',
    email: 'owner@rehmanitrading.com',
    fullName: 'Owner',
    role: 'OWNER' as const,
  },
  {
    username: 'staff' as const,
    password: 'Nankana#Desk5831Rtc',
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

export function legacyLeakedShopPassword(username: string): string | null {
  const normalized = username.trim().toLowerCase()
  return LEGACY_LEAKED_SHOP_PASSWORDS[normalized] ?? null
}
