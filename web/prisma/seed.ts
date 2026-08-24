import { PrismaClient } from '@prisma/client'
import { hash, compare } from 'bcryptjs'
import { DEFAULT_SHOP_LOGINS, legacyLeakedShopPassword } from '../src/server/shop-login-defaults'

const prisma = new PrismaClient()

const products = [
  ['WHT-001', 'Wheat'],
  ['RCE-001', 'Paddy'],
  ['MAZ-001', 'Maize'],
  ['BAR-001', 'Barley'],
] as const

async function ensureSettings(workspace: 'live' | 'demo', companyName: string) {
  const existing = await prisma.businessSettings.findFirst({ where: { workspace } })
  if (existing) return existing
  return prisma.businessSettings.create({
    data: {
      workspace,
      companyName,
      companyLogoUrl: null,
      address: 'Main Market, Grain Trading Hub',
      phone: '+92-300-0000000',
      email: 'info@rehmanitrading.com',
      defaultCommissionPercentage: '4.00',
      arhatSharePercentage: '3.00',
      supervisorSharePercentage: '0.70',
      laborSharePercentage: '0.30',
    },
  })
}

async function ensureProducts(workspace: 'live' | 'demo') {
  for (const [productCode, name] of products) {
    const product = await prisma.product.upsert({
      where: { workspace_productCode: { workspace, productCode } },
      update: { name, active: true, deleted: false },
      create: {
        workspace,
        productCode,
        name,
        defaultBagWeight: '40.00',
      },
    })
    await prisma.stock.upsert({
      where: { productId: product.id },
      update: { workspace },
      create: { workspace, productId: product.id, quantity: '0.00' },
    })
  }
  await prisma.product.updateMany({
    where: { workspace, name: 'Rice' },
    data: { name: 'Paddy' },
  })
}

async function ensureSync(id: number, workspace: 'live' | 'demo') {
  await prisma.syncState.upsert({
    where: { id },
    update: { workspace },
    create: { id, workspace, revision: 1 },
  })
}

async function upsertShopLogin(input: (typeof DEFAULT_SHOP_LOGINS)[number]) {
  const existing = await prisma.user.findUnique({ where: { username: input.username } })
  if (existing) {
    const leaked = legacyLeakedShopPassword(input.username)
    let stillLeaked = false
    if (leaked) {
      try {
        stillLeaked = await compare(leaked, existing.password)
      } catch {
        stillLeaked = false
      }
    }
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        email: existing.email || input.email,
        fullName: existing.fullName || input.fullName,
        role: input.role,
        workspace: 'live',
        deleted: false,
        failedLoginAttempts: 0,
        lockedUntil: null,
        ...(input.username === 'owner' ? { active: true } : {}),
        ...(stillLeaked ? { password: await hash(input.password, 12) } : {}),
      },
    })
  }
  return prisma.user.create({
    data: {
      username: input.username,
      email: input.email,
      password: await hash(input.password, 12),
      fullName: input.fullName,
      role: input.role,
      workspace: 'live',
      active: true,
      deleted: false,
    },
  })
}

async function main() {
  await ensureSettings('live', 'Rehmani Trading Company')
  await ensureSettings('demo', 'Rehmani Trading Company')
  await ensureProducts('live')
  await ensureProducts('demo')
  await ensureSync(1, 'live')
  await ensureSync(2, 'demo')

  for (const login of DEFAULT_SHOP_LOGINS) {
    await upsertShopLogin(login)
  }

  const liveSettings = await prisma.businessSettings.findFirst({ where: { workspace: 'live' } })
  if (liveSettings && !liveSettings.stockZeroedAt) {
    const stocks = await prisma.stock.findMany({ where: { workspace: 'live' }, include: { product: true } })
    for (const row of stocks) {
      const previous = row.quantity.toString()
      if (previous === '0' || previous === '0.00') continue
      await prisma.stock.update({
        where: { id: row.id },
        data: { quantity: '0.00', lowStockAlert: false },
      })
      await prisma.stockTransaction.create({
        data: {
          workspace: 'live',
          productId: row.productId,
          transactionType: 'ADJUSTMENT',
          quantity: '0.00',
          previousQuantity: previous,
          newQuantity: '0.00',
          notes: `Opening stock reset to zero · ${row.product.name}`,
          referenceType: 'OPENING_RESET',
        },
      })
    }
    await prisma.stockLot.updateMany({
      where: { workspace: 'live', remainingKg: { gt: 0 } },
      data: { remainingKg: '0.00' },
    })
    await prisma.businessSettings.update({
      where: { id: liveSettings.id },
      data: { stockZeroedAt: new Date() },
    })
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
