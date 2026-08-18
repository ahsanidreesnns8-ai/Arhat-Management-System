/**
 * Owner can add a login; that username/password must be able to sign in.
 * Usage: cd web && npx tsx scripts/smoke-create-login.ts
 */
import { config } from 'dotenv'
config({ path: '.env' })

import { prisma } from '../src/server/db'
import {
  createUser,
  deleteUser,
  listUsers,
  updatePassword,
} from '../src/server/services/users'
import { login } from '../src/server/services/auth-service'

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message)
}

async function main() {
  const stamp = Date.now().toString().slice(-8)
  const username = `u${stamp}`
  const password = `Pass${stamp}!`
  const fullName = `Smoke User ${stamp}`
  const nextPassword = `Next${stamp}!`

  let rejectedWeak = false
  try {
    await createUser({
      username: `w${stamp}`,
      fullName: 'Weak Password User',
      password: 'owner123',
      role: 'OPERATOR',
    })
  } catch {
    rejectedWeak = true
  }
  assert(rejectedWeak, 'leaked password owner123 must be rejected')

  const created = await createUser({
    username,
    fullName,
    password,
    role: 'OPERATOR',
  })
  assert(created.username === username, 'created username mismatch')
  assert(created.fullName === fullName, 'created name mismatch')
  assert(created.role === 'OPERATOR', 'created role should be operator')

  const session = await login(username, password)
  assert(session.username === username, 'login username mismatch')
  assert(session.token && session.token.length > 20, 'login must return a token')
  console.log('created user can login OK', username)

  await updatePassword(created.id, nextPassword)
  const again = await login(username, nextPassword)
  assert(again.token && again.token.length > 20, 'login must work after password change')
  console.log('changed password can login OK', username)

  const owner = (await listUsers()).find((row) => row.username === 'owner')
  assert(owner, 'owner account must exist')
  let blockedOwnerDelete = false
  try {
    await deleteUser(owner.id)
  } catch (error) {
    blockedOwnerDelete = error instanceof Error && error.message.includes('cannot be deleted')
  }
  assert(blockedOwnerDelete, 'owner account must not be deletable')

  await deleteUser(created.id)

  let rejected = false
  try {
    await login(username, nextPassword)
  } catch {
    rejected = true
  }
  assert(rejected, 'deleted user must not login')
  console.log('smoke-create-login passed')
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
