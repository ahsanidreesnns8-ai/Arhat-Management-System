/**
 * Reset owner (live) and hasham (demo) to the shop passwords (or env overrides).
 * Usage: cd web && npx tsx scripts/set-system-passwords.ts
 * Optional: OWNER_PASSWORD='...' DEMO_PASSWORD='...'
 */
import { config } from 'dotenv'
config({ path: '.env' })

import { prisma } from '../src/server/db'
import { hashPassword } from '../src/server/auth'
import { assertStrongPassword } from '../src/server/password-policy'
import {
  DEFAULT_SHOP_LOGINS,
  isCanonicalShopPassword,
} from '../src/server/shop-login-defaults'
import { endAllSessionsForUser } from '../src/server/services/login-sessions'

async function setPassword(username: string, password: string) {
  if (!isCanonicalShopPassword(username, password)) {
    assertStrongPassword(password, username)
  }
  const user = await prisma.user.findFirst({
    where: { username, deleted: false },
  })
  if (!user) throw new Error(`${username} account not found`)
  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: await hashPassword(password),
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  })
  const closed = await endAllSessionsForUser(user.id)
  console.log(`Updated ${username} and closed ${closed} session(s)`)
}

async function main() {
  for (const login of DEFAULT_SHOP_LOGINS) {
    const envKey = login.username === 'owner' ? 'OWNER_PASSWORD' : 'DEMO_PASSWORD'
    const password = process.env[envKey]?.trim() || login.password
    await setPassword(login.username, password)
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
