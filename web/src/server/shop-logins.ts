import { basePrisma } from '@/server/db'
import { hashPassword } from '@/server/auth'
import { DEFAULT_SHOP_LOGINS } from '@/server/shop-login-defaults'

export {
  DEFAULT_SHOP_LOGINS,
  canonicalShopPassword,
  isCanonicalShopPassword,
  legacyLeakedShopPassword,
} from '@/server/shop-login-defaults'

let ensureOnce: Promise<void> | null = null

/**
 * Create owner (live) and hasham (demo) if missing. Password upgrades happen at login, not on every API call.
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

async function retireStaffLogin() {
  const staff = await basePrisma.user.findUnique({
    where: { username: 'staff' },
    select: { id: true, deleted: true, active: true },
  })
  if (!staff || (staff.deleted && !staff.active)) return
  await basePrisma.loginSession.updateMany({
    where: { userId: staff.id, active: true },
    data: { active: false, logoutAt: new Date() },
  })
  await basePrisma.user.update({
    where: { id: staff.id },
    data: {
      deleted: true,
      active: false,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  })
}

async function repairShopLogins() {
  for (const login of DEFAULT_SHOP_LOGINS) {
    const existing = await basePrisma.user.findUnique({
      where: { username: login.username },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        workspace: true,
        deleted: true,
        active: true,
      },
    })

    if (!existing) {
      await basePrisma.user.create({
        data: {
          username: login.username,
          email: login.email,
          password: await hashPassword(login.password),
          fullName: login.fullName,
          role: login.role,
          workspace: login.workspace,
          active: true,
          deleted: false,
        },
      })
      continue
    }

    const converting =
      existing.deleted ||
      !existing.active ||
      existing.role !== login.role ||
      (existing.workspace || 'live') !== login.workspace
    const needsRepair =
      converting ||
      !(existing.email || '').trim() ||
      !(existing.fullName || '').trim()
    if (!needsRepair) continue

    await basePrisma.user.update({
      where: { id: existing.id },
      data: {
        email: existing.email || login.email,
        fullName: existing.fullName || login.fullName,
        role: login.role,
        workspace: login.workspace,
        deleted: false,
        active: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
        ...(login.username === 'hasham' && converting
          ? { password: await hashPassword(login.password) }
          : {}),
      },
    })
  }

  await retireStaffLogin()
}
