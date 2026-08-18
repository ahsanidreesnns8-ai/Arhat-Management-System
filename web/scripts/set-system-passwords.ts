/**
 * Set unique owner/staff passwords without committing them.
 * Usage: cd web && OWNER_PASSWORD='...' STAFF_PASSWORD='...' npx tsx scripts/set-system-passwords.ts
 */
import { config } from 'dotenv'
config({ path: '.env' })

import { prisma } from '../src/server/db'
import { hashPassword } from '../src/server/auth'
import { assertStrongPassword } from '../src/server/password-policy'
import { endAllSessionsForUser } from '../src/server/services/login-sessions'

async function setPassword(username: string, password: string) {
  assertStrongPassword(password, username)
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
  const owner = process.env.OWNER_PASSWORD?.trim()
  const staff = process.env.STAFF_PASSWORD?.trim()
  if (!owner || !staff) {
    throw new Error('OWNER_PASSWORD and STAFF_PASSWORD are required')
  }
  await setPassword('owner', owner)
  await setPassword('staff', staff)
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
