import { prisma } from '@/server/db'
import { hashPassword, verifyPassword } from '@/server/auth'
import { DEFAULT_SHOP_LOGINS } from '@/server/shop-login-defaults'

export {
  DEFAULT_SHOP_LOGINS,
  canonicalShopPassword,
  isCanonicalShopPassword,
} from '@/server/shop-login-defaults'

let ensureOnce: Promise<void> | null = null

/**
 * Create owner/staff if missing and reset their passwords to the shop defaults.
 * Safe to call on every login: runs at most once per serverless instance.
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

async function repairShopLogins() {
  for (const login of DEFAULT_SHOP_LOGINS) {
    const existing = await prisma.user.findUnique({
      where: { username: login.username },
    })
    const passwordOk =
      !!existing && (await verifyPassword(login.password, existing.password))
    const healthy =
      !!existing &&
      passwordOk &&
      existing.active &&
      !existing.deleted &&
      existing.role === login.role &&
      !existing.lockedUntil

    if (healthy) continue

    const password =
      existing && passwordOk ? existing.password : await hashPassword(login.password)
    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          email: login.email,
          password,
          fullName: existing.fullName || login.fullName,
          role: login.role,
          workspace: 'live',
          active: true,
          deleted: false,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      })
      continue
    }

    await prisma.user.create({
      data: {
        username: login.username,
        email: login.email,
        password,
        fullName: login.fullName,
        role: login.role,
        workspace: 'live',
        active: true,
        deleted: false,
      },
    })
  }
}
