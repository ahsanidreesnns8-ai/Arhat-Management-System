/**
 * Wipe all transactional business data so the app starts brand-new.
 * Keeps login users, business settings, and the product catalog.
 * Resets stock quantities to zero and sync revisions to 1.
 *
 * Usage: cd web && npx tsx scripts/factory-reset.ts
 */
import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'

config({ path: '.env' })
config({ path: '.env.local' }) // do not override DATABASE_URL from .env

const prisma = new PrismaClient()

async function countAll() {
  const [
    farmers,
    buyers,
    trucks,
    dheris,
    sales,
    saleItems,
    payments,
    stockLots,
    stockTx,
    queue,
    dailyTrade,
    audit,
  ] = await Promise.all([
    prisma.farmer.count(),
    prisma.buyer.count(),
    prisma.truck.count(),
    prisma.dheri.count(),
    prisma.sale.count(),
    prisma.saleItem.count(),
    prisma.payment.count(),
    prisma.stockLot.count(),
    prisma.stockTransaction.count(),
    prisma.queueEntry.count(),
    prisma.dailyTradeSession.count(),
    prisma.auditLog.count(),
  ])
  return {
    farmers,
    buyers,
    trucks,
    dheris,
    sales,
    saleItems,
    payments,
    stockLots,
    stockTx,
    queue,
    dailyTrade,
    audit,
  }
}

async function main() {
  console.log('Factory reset — before:', await countAll())

  // Children first (FK-safe order)
  const deleted = {
    saleItems: (await prisma.saleItem.deleteMany({})).count,
    payments: (await prisma.payment.deleteMany({})).count,
    queueEntries: (await prisma.queueEntry.deleteMany({})).count,
    stockLots: (await prisma.stockLot.deleteMany({})).count,
    stockTransactions: (await prisma.stockTransaction.deleteMany({})).count,
    dailyTradeSessions: (await prisma.dailyTradeSession.deleteMany({})).count,
    sales: (await prisma.sale.deleteMany({})).count,
    dheris: (await prisma.dheri.deleteMany({})).count,
    trucks: (await prisma.truck.deleteMany({})).count,
    auditLogs: (await prisma.auditLog.deleteMany({})).count,
    farmers: (await prisma.farmer.deleteMany({})).count,
    buyers: (await prisma.buyer.deleteMany({})).count,
  }

  // Zero stock; keep product rows
  const stockReset = await prisma.stock.updateMany({
    data: { quantity: '0.00', lowStockAlert: false },
  })

  await prisma.syncState.updateMany({ data: { revision: BigInt(1) } })

  console.log('Deleted:', deleted)
  console.log('Stock rows zeroed:', stockReset.count)
  console.log('Factory reset — after:', await countAll())

  const users = await prisma.user.findMany({
    where: { deleted: false },
    select: { username: true, workspace: true, role: true },
  })
  const products = await prisma.product.count({ where: { deleted: false } })
  console.log('Preserved logins:', users)
  console.log('Preserved products:', products)
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
