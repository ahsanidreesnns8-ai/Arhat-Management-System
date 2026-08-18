import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import { assertStrongPassword } from '../src/server/password-policy'

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

async function bootstrapPassword(username: string, envKey: string) {
  const fromEnv = process.env[envKey]?.trim()
  if (fromEnv) {
    assertStrongPassword(fromEnv, username)
    return fromEnv
  }
  const generated = `Rtc-${randomBytes(9).toString('base64url')}`
  console.warn(
    `[seed] ${envKey} is not set. Created ${username} with a one-time password. Change it in Owner Panel immediately.`,
  )
  return generated
}

async function ensureLoginUser(input: {
  username: string
  email: string
  passwordEnv: string
  fullName: string
  role: 'OWNER' | 'OPERATOR'
  workspace: 'live' | 'demo'
}) {
  const existing = await prisma.user.findUnique({ where: { username: input.username } })
  if (existing) {
    // Never overwrite an existing password — deploys must not reset live logins.
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        email: input.email,
        fullName: input.fullName,
        role: input.role,
        workspace: input.workspace,
        active: true,
        deleted: false,
      },
    })
  }

  const password = await bootstrapPassword(input.username, input.passwordEnv)
  return prisma.user.create({
    data: {
      username: input.username,
      email: input.email,
      password: await hash(password, 12),
      fullName: input.fullName,
      role: input.role,
      workspace: input.workspace,
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

  await ensureLoginUser({
    username: 'owner',
    email: 'owner@rehmanitrading.com',
    passwordEnv: 'OWNER_PASSWORD',
    fullName: 'Owner',
    role: 'OWNER',
    workspace: 'live',
  })

  await ensureLoginUser({
    username: 'staff',
    email: 'staff@rehmanitrading.com',
    passwordEnv: 'STAFF_PASSWORD',
    fullName: 'Staff',
    role: 'OPERATOR',
    workspace: 'live',
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
