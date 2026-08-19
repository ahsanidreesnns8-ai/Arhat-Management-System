import type { ThemePreference } from '@prisma/client'
import { prisma, getLiveSettingsCompanyName, basePrisma } from '@/server/db'
import {
  signToken,
  updateTheme as persistTheme,
  verifyPassword,
  verifyToken,
} from '@/server/auth'
import {
  isSharedShopLogin,
  normalizeLoginUsername,
} from '@/server/allowed-logins'
import { WORKSPACE_DEMO, runWithWorkspace } from '@/server/workspace'
import {
  endLoginSession,
  startLoginSession,
  touchLoginSession,
} from '@/server/services/login-sessions'
import { ensureShopLogins } from '@/server/shop-logins'

const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_MINUTES = 15

export async function login(
  username: string,
  password: string,
  meta?: { ipAddress?: string | null; userAgent?: string | null },
) {
  const normalized = normalizeLoginUsername(username)
  if (!normalized || !password) {
    throw new Error('Username and password are required')
  }

  await ensureShopLogins()

  let user = await basePrisma.user.findFirst({
    where: { username: normalized, deleted: false },
  })

  // owner / staff are shared shop logins. Never lock the whole account
  // because one person mistyped the password — everyone else still needs in.
  const sharedShopLogin = isSharedShopLogin(normalized)

  if (
    !sharedShopLogin &&
    user?.lockedUntil &&
    user.lockedUntil.getTime() > Date.now()
  ) {
    const mins = Math.max(
      1,
      Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000),
    )
    throw new Error(
      `Account temporarily locked after failed attempts. Try again in ${mins} minute(s).`,
    )
  }

  if (user && !user.active) {
    throw new Error('This account is suspended. Contact an owner/admin.')
  }

  let valid = !!user && (await verifyPassword(password, user.password).catch(() => false))

  if (!valid) {
    if (user && sharedShopLogin) {
      if (user.failedLoginAttempts || user.lockedUntil) {
        await basePrisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: 0, lockedUntil: null },
        })
      }
      throw new Error('Invalid username or password')
    }
    if (user) {
      const attempts = user.failedLoginAttempts + 1
      await basePrisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts,
          lockedUntil:
            attempts >= MAX_FAILED_ATTEMPTS
              ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000)
              : null,
        },
      })
      if (attempts >= MAX_FAILED_ATTEMPTS) {
        throw new Error(
          `Account temporarily locked after ${MAX_FAILED_ATTEMPTS} failed attempts. Try again in ${LOCKOUT_MINUTES} minutes.`,
        )
      }
      throw new Error(
        `Invalid username or password (${attempts}/${MAX_FAILED_ATTEMPTS} attempts)`,
      )
    }
    throw new Error('Invalid username or password')
  }

  if (!user) {
    throw new Error('Invalid username or password')
  }

  const authenticated = await basePrisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    },
    select: {
      id: true,
      username: true,
      email: true,
      fullName: true,
      role: true,
      themePreference: true,
      workspace: true,
    },
  })

  const workspace = authenticated.workspace === WORKSPACE_DEMO ? WORKSPACE_DEMO : 'live'
  const session = await startLoginSession({
    userId: authenticated.id,
    workspace,
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  })

  const settings = await runWithWorkspace(workspace, async () =>
    prisma.businessSettings.findFirst({ select: { companyName: true } }),
  )
  const liveFallback =
    !settings?.companyName && workspace === WORKSPACE_DEMO
      ? await getLiveSettingsCompanyName()
      : null

  return {
    ...authenticated,
    workspace,
    isDemo: workspace === WORKSPACE_DEMO,
    sessionId: Number(session.id),
    companyName:
      settings?.companyName ??
      liveFallback?.companyName ??
      'Rehmani Trading Company',
    token: await signToken(
      {
        ...authenticated,
        workspace,
      },
      session.id,
    ),
  }
}

export async function logout(token: string | null | undefined) {
  if (!token) return { closed: false }
  try {
    const payload = await verifyToken(token)
    const sid = payload.sid
    if (sid == null) return { closed: false }
    await endLoginSession(String(sid))
    return { closed: true }
  } catch {
    return { closed: false }
  }
}

export async function heartbeat(token: string | null | undefined) {
  if (!token) throw new Error('Authentication required')
  const payload = await verifyToken(token)
  const sid = payload.sid
  if (sid == null) return { ok: true, lastSeenAt: null }
  try {
    const row = await touchLoginSession(String(sid))
    return { ok: true, lastSeenAt: row?.lastSeenAt?.toISOString() ?? null }
  } catch {
    // Shared concurrent logins must not fail the browser if a session row is gone.
    return { ok: true, lastSeenAt: null }
  }
}

export async function updateTheme(username: string, theme: string) {
  const normalized = theme.toUpperCase()
  if (!['LIGHT', 'DARK', 'SYSTEM'].includes(normalized)) {
    throw new Error('Invalid theme preference')
  }
  await persistTheme(username, normalized as ThemePreference)
}
