/**
 * Confirm hasham is a demo owner and its records never appear in live.
 * Usage: cd web && npx tsx scripts/smoke-demo-isolation.ts
 */
import { config } from 'dotenv'
config({ path: '.env' })

import { prisma, basePrisma } from '../src/server/db'
import { login, logout } from '../src/server/services/auth-service'
import { createFarmer, listFarmers } from '../src/server/services/farmers'
import { runWithWorkspace } from '../src/server/workspace'
import { DEFAULT_SHOP_LOGINS } from '../src/server/shop-login-defaults'
import { ensureShopLogins } from '../src/server/shop-logins'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

async function main() {
  await ensureShopLogins()
  const ownerPass = DEFAULT_SHOP_LOGINS.find((l) => l.username === 'owner')!.password
  const demoPass = DEFAULT_SHOP_LOGINS.find((l) => l.username === 'hasham')!.password

  const staff = await basePrisma.user.findFirst({ where: { username: 'staff' } })
  assert(!staff || staff.deleted === true || staff.active === false, 'staff must be retired')

  try {
    await login('staff', 'Nankana#Desk5831Rtc')
    throw new Error('staff login should fail')
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e)
    assert(
      m.includes('Invalid username or password') || m.includes('suspended'),
      `staff reject: ${m}`,
    )
  }

  const owner = await login('owner', ownerPass)
  assert(owner.role === 'OWNER' && owner.workspace === 'live' && owner.isDemo === false, 'owner must be live')
  const demo = await login('hasham', demoPass)
  assert(demo.role === 'OWNER' && demo.workspace === 'demo' && demo.isDemo === true, 'hasham must be demo owner')
  assert(demo.username === 'hasham', 'demo username must be hasham')

  const stamp = `ISO${Date.now().toString().slice(-8)}`
  const demoFarmer = await runWithWorkspace('demo', () =>
    createFarmer({ name: `Demo Only ${stamp}`, city: 'Lahore', code: stamp }),
  )
  const liveFarmers = await runWithWorkspace('live', () => listFarmers())
  const leaked = liveFarmers.some(
    (f: { farmerId?: string; name?: string }) => f.farmerId === stamp || f.name === `Demo Only ${stamp}`,
  )
  assert(!leaked, 'demo farmer leaked into live list')

  const liveStamp = `LIV${Date.now().toString().slice(-8)}`
  const liveFarmer = await runWithWorkspace('live', () =>
    createFarmer({ name: `Live Only ${liveStamp}`, city: 'Lahore', code: liveStamp }),
  )
  const demoFarmers = await runWithWorkspace('demo', () => listFarmers())
  const reverseLeak = demoFarmers.some((f: { farmerId?: string }) => f.farmerId === liveStamp)
  assert(!reverseLeak, 'live farmer leaked into demo list')

  await runWithWorkspace('demo', async () => {
    await prisma.farmer.delete({ where: { id: BigInt(demoFarmer.id) } })
  })
  await runWithWorkspace('live', async () => {
    await prisma.farmer.delete({ where: { id: BigInt(liveFarmer.id) } })
  })

  await logout(owner.token)
  await logout(demo.token)
  console.log('smoke-demo-isolation passed')
  console.log('demo username: hasham')
  console.log('demo password: hasham123')
}

main()
  .then(async () => {
    await prisma.$disconnect()
    await basePrisma.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    await basePrisma.$disconnect()
    process.exit(1)
  })
