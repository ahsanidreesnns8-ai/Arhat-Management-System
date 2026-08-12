import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

const products = [
  ['WHT-001', 'Wheat'],
  ['RCE-001', 'Rice'],
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
      address:
        workspace === 'demo'
          ? 'Demo sandbox — changes do not affect live data'
          : 'Main Market, Grain Trading Hub',
      phone: '+92-300-0000000',
      email: workspace === 'demo' ? 'demo@rehmanitrading.com' : 'info@rehmanitrading.com',
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
}

async function ensureSync(id: number, workspace: 'live' | 'demo') {
  await prisma.syncState.upsert({
    where: { id },
    update: { workspace },
    create: { id, workspace, revision: 1 },
  })
}

async function upsertLoginUser(input: {
  username: string
  email: string
  password: string
  fullName: string
  role: 'OWNER' | 'OPERATOR'
  workspace: 'live' | 'demo'
}) {
  const passwordHash = await hash(input.password, 12)
  const existing = await prisma.user.findUnique({ where: { username: input.username } })
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        email: input.email,
        password: passwordHash,
        fullName: input.fullName,
        role: input.role,
        workspace: input.workspace,
        active: true,
        deleted: false,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    })
  }
  return prisma.user.create({
    data: {
      username: input.username,
      email: input.email,
      password: passwordHash,
      fullName: input.fullName,
      role: input.role,
      workspace: input.workspace,
    },
  })
}

async function main() {
  // Migrate legacy owner → rehmani (keep same row / id)
  const legacyOwner = await prisma.user.findUnique({ where: { username: 'owner' } })
  const rehmaniExists = await prisma.user.findUnique({ where: { username: 'rehmani' } })
  if (legacyOwner && !rehmaniExists) {
    await prisma.user.update({
      where: { id: legacyOwner.id },
      data: {
        username: 'rehmani',
        email: 'rehmani@rehmanitrading.com',
        fullName: 'Rehmani Owner',
        role: 'OWNER',
        workspace: 'live',
        password: await hash('rehmani123', 12),
        active: true,
        deleted: false,
      },
    })
  } else if (legacyOwner && rehmaniExists) {
    // Prefer rehmani; disable legacy owner login
    await prisma.user.update({
      where: { id: legacyOwner.id },
      data: { active: false, deleted: true },
    })
  }

  await ensureSettings('live', 'Rehmani Trading Company')
  await ensureSettings('demo', 'Rehmani Trading Company (Demo)')
  await ensureProducts('live')
  await ensureProducts('demo')
  await ensureSync(1, 'live')
  await ensureSync(2, 'demo')

  await upsertLoginUser({
    username: 'rehmani',
    email: 'rehmani@rehmanitrading.com',
    password: 'rehmani123',
    fullName: 'Rehmani Owner',
    role: 'OWNER',
    workspace: 'live',
  })

  // Shared guest login — isolated demo sandbox
  await upsertLoginUser({
    username: 'demo',
    email: 'demo@rehmanitrading.com',
    password: 'demo123',
    fullName: 'Demo Guest',
    role: 'OPERATOR',
    workspace: 'demo',
  })
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
