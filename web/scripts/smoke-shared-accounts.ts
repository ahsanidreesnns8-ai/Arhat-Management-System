/**
 * Shared owner/staff logins + owner-only finance fields.
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

const stamp = `SHR${Date.now().toString().slice(-8)}`

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
  assert(staffStats.pendingPayments === 0, 'staff pendingPayments must be 0')
  assert(staffStats.revenue === 0, 'staff revenue must be 0')
  assert(staffStats.commission === 0, 'staff commission must be 0')
  assert(
    staffStats.todaySales === ownerStats.todaySales,
    'staff still sees today sales operational total',
  )
  console.log('dashboard finance redaction OK')

  const staffUser = await prisma.user.findFirst({
    where: { username: 'staff', deleted: false },
  })
  assert(staffUser, 'staff user must exist')

  const createdSessionIds: bigint[] = []
  try {
    const [sessionA, sessionB] = await Promise.all([
      startLoginSession({
        userId: staffUser.id,
        workspace: staffUser.workspace || 'live',
        userAgent: 'smoke-a',
      }),
      startLoginSession({
        userId: staffUser.id,
        workspace: staffUser.workspace || 'live',
        userAgent: 'smoke-b',
      }),
    ])
    createdSessionIds.push(sessionA.id, sessionB.id)
    assert(sessionA.id !== sessionB.id, 'concurrent staff sessions must be distinct')
    assert(sessionA.active && sessionB.active, 'both staff sessions must stay active')
    console.log('concurrent login sessions OK', Number(sessionA.id), Number(sessionB.id))

    const token = await signToken(
      {
        id: staffUser.id,
        username: staffUser.username,
        email: staffUser.email,
        fullName: staffUser.fullName,
        role: staffUser.role,
        themePreference: staffUser.themePreference,
        workspace: staffUser.workspace,
      },
      sessionA.id,
    )
    await prisma.loginSession.delete({ where: { id: sessionA.id } })
    createdSessionIds.splice(0, 1)
    const beat = await heartbeat(token)
    assert(beat.ok === true, 'heartbeat must stay ok when session row is missing')
    console.log('heartbeat missing session OK')

    await prisma.user.update({
      where: { id: staffUser.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: new Date(Date.now() + 15 * 60_000),
      },
    })
    for (let i = 0; i < 6; i++) {
      try {
        await login('staff', 'wrong-password-smoke')
        throw new Error('wrong password should fail')
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        assert(
          message === 'Invalid username or password',
          `shared staff must not lock out, got: ${message}`,
        )
      }
    }
    const refreshed = await prisma.user.findFirst({
      where: { id: staffUser.id },
    })
    assert(!refreshed?.lockedUntil, 'shared staff lock must be cleared after a mistype')
    assert(
      (refreshed?.failedLoginAttempts ?? 0) === 0,
      'shared staff failed attempts must stay at 0',
    )
    const okLogin = await login('staff', 'staff123', { userAgent: 'smoke-ok' })
    createdSessionIds.push(BigInt(okLogin.sessionId))
    assert(okLogin.token, 'staff must still log in after many mistypes')
    await logout(okLogin.token)
    console.log('shared staff lockout skip OK')

    const [loginOne, loginTwo] = await Promise.all([
      login('staff', 'staff123', { userAgent: 'smoke-parallel-1' }),
      login('staff', 'staff123', { userAgent: 'smoke-parallel-2' }),
    ])
    createdSessionIds.push(BigInt(loginOne.sessionId), BigInt(loginTwo.sessionId))
    assert(loginOne.token !== loginTwo.token, 'parallel staff logins need distinct tokens')
    assert(
      loginOne.sessionId !== loginTwo.sessionId,
      'parallel staff logins need distinct sessions',
    )
    await logout(loginOne.token)
    await logout(loginTwo.token)
    console.log('parallel staff login OK')
  } finally {
    await prisma.user.update({
      where: { id: staffUser.id },
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
