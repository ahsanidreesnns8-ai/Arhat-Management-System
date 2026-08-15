import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

const products = [
  ['WHT-001', 'Wheat'],
  ['RCE-001', 'Rice'],
  ['MAZ-001', 'Maize'],
  ['BAR-001', 'Barley'],
] as const

const ALLOWED_USERNAMES = ['owner', 'staff'] as const

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

async function disableOtherLogins() {
  await prisma.user.updateMany({
    where: {
      username: { notIn: [...ALLOWED_USERNAMES] },
    },
    data: {
      active: false,
      deleted: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
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

  // Only two logins are permitted on this system.
  await upsertLoginUser({
    username: 'owner',
    email: 'owner@rehmanitrading.com',
    password: 'owner123',
    fullName: 'Owner',
    role: 'OWNER',
    workspace: 'live',
  })

  await upsertLoginUser({
    username: 'staff',
    email: 'staff@rehmanitrading.com',
    password: 'staff123',
    fullName: 'Staff',
    role: 'OPERATOR',
    workspace: 'live',
  })

  await disableOtherLogins()
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
