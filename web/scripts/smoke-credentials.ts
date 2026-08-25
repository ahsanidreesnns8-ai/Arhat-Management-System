import { DEFAULT_SHOP_LOGINS } from '../src/server/shop-login-defaults'

/**
 * Shop passwords for smokes. Defaults are the permanent shop logins.
 * OWNER_PASSWORD / DEMO_PASSWORD override when set.
 */
export function requireShopPassword(kind: 'owner' | 'hasham') {
  const key = kind === 'owner' ? 'OWNER_PASSWORD' : 'DEMO_PASSWORD'
  const fromEnv = process.env[key]?.trim() || process.env[`SMOKE_${key}`]?.trim()
  if (fromEnv) return fromEnv
  const row = DEFAULT_SHOP_LOGINS.find((login) => login.username === kind)
  if (!row) throw new Error(`Unknown shop login ${kind}`)
  return row.password
}
