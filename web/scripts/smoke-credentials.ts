/**
 * Live shop passwords for smokes. Never fall back to leaked passwords.
 * Set OWNER_PASSWORD / STAFF_PASSWORD in web/.env (gitignored).
 */
export function requireShopPassword(kind: 'owner' | 'staff') {
  const key = kind === 'owner' ? 'OWNER_PASSWORD' : 'STAFF_PASSWORD'
  const value = process.env[key]?.trim() || process.env[`SMOKE_${key}`]?.trim()
  if (!value) {
    throw new Error(`Set ${key} in the environment (do not use leaked defaults)`)
  }
  return value
}
