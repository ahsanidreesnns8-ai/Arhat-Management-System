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
  const user = await prisma.user.findFirst({
    where: { username, deleted: false },
  })

  if (
    user?.lockedUntil &&
    user.lockedUntil.getTime() > Date.now()
  ) {
    throw new Error('Account temporarily locked. Try again later.')
  }

  const valid =
    !!user &&
    user.active &&
    (await verifyPassword(password, user.password))

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
    }
    throw new Error('Access Denied')
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
