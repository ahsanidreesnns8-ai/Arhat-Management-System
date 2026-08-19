import { basePrisma } from '@/server/db'
import { hashPassword, verifyPassword } from '@/server/auth'
import { DEFAULT_SHOP_LOGINS, legacyLeakedShopPassword } from '@/server/shop-login-defaults'

export {
  DEFAULT_SHOP_LOGINS,
  canonicalShopPassword,
  isCanonicalShopPassword,
  legacyLeakedShopPassword,
} from '@/server/shop-login-defaults'

let ensureOnce: Promise<void> | null = null

/**
 * Create owner/staff if missing. Upgrade only leaked shop passwords.
 * Never overwrite a password the owner has already changed.
 */
export function ensureShopLogins() {
  if (!ensureOnce) {
    ensureOnce = repairShopLogins().catch((error) => {
      ensureOnce = null
      throw error
    })
  }
  return ensureOnce
}

async function passwordMatches(plain: string, encoded: string | null | undefined) {
  if (!encoded) return false
  try {
    return await verifyPassword(plain, encoded)
  } catch {
    return false
  }
}

async function repairShopLogins() {
  for (const login of DEFAULT_SHOP_LOGINS) {
    const existing = await basePrisma.user.findUnique({
      where: { username: login.username },
    })

    if (!existing) {
      await basePrisma.user.create({
        data: {
          username: login.username,
          email: login.email,
          password: await hashPassword(login.password),
          fullName: login.fullName,
          role: login.role,
          workspace: 'live',
          active: true,
          deleted: false,
        },
      })
      continue
    }

    const leaked = legacyLeakedShopPassword(login.username)
    const stillLeaked = leaked ? await passwordMatches(leaked, existing.password) : false
    await basePrisma.user.update({
      where: { id: existing.id },
      data: {
        email: existing.email || login.email,
        fullName: existing.fullName || login.fullName,
        role: login.role,
        workspace: existing.workspace || 'live',
        deleted: false,
        failedLoginAttempts: 0,
        lockedUntil: null,
        ...(login.username === 'owner' ? { active: true } : {}),
        ...(stillLeaked ? { password: await hashPassword(login.password) } : {}),
      },
    })
  }
}
