import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

const products = [
  ['WHT-001', 'Wheat'],
  ['RCE-001', 'Rice'],
  ['MAZ-001', 'Maize'],
  ['BAR-001', 'Barley'],
] as const

async function main() {
  const settings = await prisma.businessSettings.findFirst()
  if (!settings) {
    await prisma.businessSettings.create({
      data: {
        companyName: 'Rehmani Trading Company',
        companyLogoUrl: '/rehmani-logo.svg',
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

  for (const [productCode, name] of products) {
    const product = await prisma.product.upsert({
      where: { productCode },
      update: { name, active: true, deleted: false },
      create: {
        productCode,
        name,
        defaultBagWeight: '40.00',
      },
    })
    await prisma.stock.upsert({
      where: { productId: product.id },
      update: {},
      create: { productId: product.id, quantity: '0.00' },
    })
  }

  const owner = await prisma.user.findUnique({ where: { username: 'owner' } })
  if (!owner) {
    await prisma.user.create({
      data: {
        username: 'owner',
        email: 'owner@rehmanitrading.com',
        password: await hash('admin123', 12),
        fullName: 'System Owner',
        role: 'OWNER',
      },
    })
  }

  await prisma.syncState.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, revision: 1 },
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
