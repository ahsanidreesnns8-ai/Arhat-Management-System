/** Shared shop terminals (many people, same login) skip account lockout. */
export const SHARED_SHOP_USERNAMES = ['owner', 'staff'] as const

export type SharedShopUsername = (typeof SHARED_SHOP_USERNAMES)[number]

export function normalizeLoginUsername(username: string) {
  return username.trim().toLowerCase()
}

export function isSharedShopLogin(username: string): username is SharedShopUsername {
  const normalized = normalizeLoginUsername(username)
  return (SHARED_SHOP_USERNAMES as readonly string[]).includes(normalized)
}

/** @deprecated use isSharedShopLogin — kept so system accounts cannot be deleted */
export function isAllowedLoginUsername(username: string): username is SharedShopUsername {
  return isSharedShopLogin(username)
}
