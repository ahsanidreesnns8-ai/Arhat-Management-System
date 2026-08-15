/** Only these two accounts may authenticate. */
export const ALLOWED_LOGIN_USERNAMES = ['owner', 'staff'] as const

export type AllowedLoginUsername = (typeof ALLOWED_LOGIN_USERNAMES)[number]

export function normalizeLoginUsername(username: string) {
  return username.trim().toLowerCase()
}

export function isAllowedLoginUsername(username: string): username is AllowedLoginUsername {
  const normalized = normalizeLoginUsername(username)
  return (ALLOWED_LOGIN_USERNAMES as readonly string[]).includes(normalized)
}
