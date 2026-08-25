/**
 * Shared owner/hasham logins + owner-only finance fields.
 * Demo workspace for sales; live login users only for session/lockout checks.
 * Usage: cd web && npx tsx scripts/smoke-shared-accounts.ts
 */
import { config } from 'dotenv'
config({ path: '.env' })

import { prisma } from '../src/server/db'
import { signToken } from '../src/server/auth'
import { heartbeat, login, logout } from '../src/server/services/auth-service'
import { getDashboardStats } from '../src/server/services/dashboard'
import {
  endLoginSession,
  startLoginSession,
} from '../src/server/services/login-sessions'
import { createBuyer } from '../src/server/services/buyers'
import { createSale } from '../src/server/services/sales'
import { runWithWorkspace } from '../src/server/workspace'

import { requireShopPassword } from './smoke-credentials'

const stamp = `SHR${Date.now().toString().slice(-8)}`
const DEMO_PASSWORD = requireShopPassword('hasham')

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message)
}

async function main() {
  const ownerStats = await getDashboardStats('OWNER')
  const staffStats = await getDashboardStats('OPERATOR')
  assert(
    typeof ownerStats.pendingPayments === 'number' &&
      typeof ownerStats.revenue === 'number' &&
      typeof ownerStats.commission === 'number',
    'owner stats must include finance fields',
  )
  assert(staffStats.pendingPayments === 0, 'operator pendingPayments must be 0')
  assert(staffStats.revenue === 0, 'operator revenue must be 0')
  assert(staffStats.commission === 0, 'operator commission must be 0')
  assert(
    staffStats.todaySales === ownerStats.todaySales,
    'operator still sees today sales operational total',
  )
  console.log('dashboard finance redaction OK')

  const retiredStaff = await prisma.user.findFirst({
    where: { username: 'staff', deleted: false, active: true },
  })
  assert(!retiredStaff, 'staff login must be retired')

  const demoUser = await prisma.user.findFirst({
    where: { username: 'hasham', deleted: false },
  })
  assert(demoUser, 'hasham demo user must exist')
  assert(demoUser.role === 'OWNER', 'hasham must be OWNER')
  assert(demoUser.workspace === 'demo', 'hasham must use demo workspace')

  const createdSessionIds: bigint[] = []
  try {
    const [sessionA, sessionB] = await Promise.all([
      startLoginSession({
        userId: demoUser.id,
        workspace: demoUser.workspace || 'demo',
        userAgent: 'smoke-a',
      }),
      startLoginSession({
        userId: demoUser.id,
        workspace: demoUser.workspace || 'demo',
        userAgent: 'smoke-b',
      }),
    ])
    createdSessionIds.push(sessionA.id, sessionB.id)
    assert(sessionA.id !== sessionB.id, 'concurrent demo sessions must be distinct')
    assert(sessionA.active && sessionB.active, 'both demo sessions must stay active')
    console.log('concurrent login sessions OK', Number(sessionA.id), Number(sessionB.id))

    const token = await signToken(
      {
        id: demoUser.id,
        username: demoUser.username,
        email: demoUser.email,
        fullName: demoUser.fullName,
        role: demoUser.role,
        themePreference: demoUser.themePreference,
        workspace: demoUser.workspace,
      },
      sessionA.id,
    )
    await prisma.loginSession.delete({ where: { id: sessionA.id } })
    createdSessionIds.splice(0, 1)
    const beat = await heartbeat(token)
    assert(beat.ok === true, 'heartbeat must stay ok when session row is missing')
    console.log('heartbeat missing session OK')

    await prisma.user.update({
      where: { id: demoUser.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: new Date(Date.now() + 15 * 60_000),
      },
    })
    for (let i = 0; i < 6; i++) {
      try {
        await login('hasham', 'wrong-password-smoke')
        throw new Error('wrong password should fail')
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        assert(
          message === 'Invalid username or password',
          `shared demo must not lock out, got: ${message}`,
        )
      }
    }
    const refreshed = await prisma.user.findFirst({
      where: { id: demoUser.id },
    })
    assert(!refreshed?.lockedUntil, 'shared demo lock must be cleared after a mistype')
    assert(
      (refreshed?.failedLoginAttempts ?? 0) === 0,
      'shared demo failed attempts must stay at 0',
    )
    const okLogin = await login('hasham', DEMO_PASSWORD, { userAgent: 'smoke-ok' })
    createdSessionIds.push(BigInt(okLogin.sessionId))
    assert(okLogin.token, 'hasham must still log in after many mistypes')
    assert(okLogin.isDemo === true, 'hasham login must be demo')
    assert(okLogin.role === 'OWNER', 'hasham login must be owner')
    await logout(okLogin.token)
    console.log('shared demo lockout skip OK')

    const [loginOne, loginTwo] = await Promise.all([
      login('hasham', DEMO_PASSWORD, { userAgent: 'smoke-parallel-1' }),
      login('hasham', DEMO_PASSWORD, { userAgent: 'smoke-parallel-2' }),
    ])
    createdSessionIds.push(BigInt(loginOne.sessionId), BigInt(loginTwo.sessionId))
    assert(loginOne.token !== loginTwo.token, 'parallel demo logins need distinct tokens')
    assert(
      loginOne.sessionId !== loginTwo.sessionId,
      'parallel demo logins need distinct sessions',
    )
    await logout(loginOne.token)
    await logout(loginTwo.token)
    console.log('parallel demo login OK')
  } finally {
    await prisma.user.update({
      where: { id: demoUser.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    })
    for (const id of createdSessionIds) {
      await endLoginSession(id).catch(() => {})
    }
  }

  await runWithWorkspace('demo', async () => {
    const ids = {
      buyerId: undefined as bigint | undefined,
      saleIds: [] as bigint[],
    }
    try {
      const paddy = await prisma.product.findFirst({
        where: { productCode: 'RCE-001', deleted: false },
      })
      assert(paddy, 'Need RCE-001 product in demo workspace')
      const buyer = await createBuyer({
        name: `Shared Buyer ${stamp}`,
        fatherName: 'Smoke',
        code: `SB-${stamp}`,
        city: 'Lahore',
      })
      ids.buyerId = BigInt(buyer.id)
      const payload = {
        buyerId: buyer.id,
        paidAmount: 0,
        items: [
          {
            productId: Number(paddy.id),
            sourceType: 'BUSINESS_STOCK',
            numberOfBags: 1,
            weightPerBag: 40,
            partialBagWeight: 0,
            rate: 100,
            skipStockDeduction: true,
          },
        ],
      }
      const [saleA, saleB] = await Promise.all([
        createSale(payload),
        createSale(payload),
      ])
      ids.saleIds.push(BigInt(saleA.id), BigInt(saleB.id))
      assert(saleA.invoiceNumber !== saleB.invoiceNumber, 'parallel sales must not share invoice numbers')
      console.log('parallel invoice retry OK', saleA.invoiceNumber, saleB.invoiceNumber)
    } finally {
      if (ids.saleIds.length) {
        await prisma.payment.deleteMany({ where: { saleId: { in: ids.saleIds } } })
        await prisma.saleItem.deleteMany({ where: { saleId: { in: ids.saleIds } } })
        await prisma.sale.deleteMany({ where: { id: { in: ids.saleIds } } })
      }
      if (ids.buyerId) {
        await prisma.payment.deleteMany({ where: { buyerId: ids.buyerId } })
        await prisma.buyer.deleteMany({ where: { id: ids.buyerId } })
      }
    }
  })

  console.log('smoke-shared-accounts passed')
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
