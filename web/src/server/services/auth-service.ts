import type { ThemePreference } from '@prisma/client'
import { prisma } from '@/server/db'
import {
  signToken,
  updateTheme as persistTheme,
  verifyPassword,
} from '@/server/auth'

const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_MINUTES = 15

export async function login(username: string, password: string) {
  const normalized = username.trim()
  if (!normalized || !password) {
    throw new Error('Username and password are required')
  }

  const user = await prisma.user.findFirst({
    where: { username: normalized, deleted: false },
  })

  if (
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

  const valid =
    !!user && (await verifyPassword(password, user.password))

  if (!valid) {
    if (user) {
      const attempts = user.failedLoginAttempts + 1
      await prisma.user.update({
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

  const authenticated = await prisma.user.update({
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
    },
  })
  const settings = await prisma.businessSettings.findFirst({
    select: { companyName: true },
  })

  return {
    ...authenticated,
    companyName: settings?.companyName ?? 'Rehmani Trading Company',
    token: await signToken(authenticated),
  }
}

export async function updateTheme(username: string, theme: string) {
  const normalized = theme.toUpperCase()
  if (!['LIGHT', 'DARK', 'SYSTEM'].includes(normalized)) {
    throw new Error('Invalid theme preference')
  }
  await persistTheme(username, normalized as ThemePreference)
}
