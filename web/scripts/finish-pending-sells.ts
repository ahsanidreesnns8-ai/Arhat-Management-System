/**
 * Restore soft-deleted smoke farmers and finish pending auction sells.
 */
import { config } from 'dotenv'
config({ path: '.env' })

import { PrismaClient } from '@prisma/client'
import { sellDheriAtAuctionRate } from '../src/server/services/day-batches'
import { runWithWorkspace } from '../src/server/workspace'

const prisma = new PrismaClient()

async function main() {
  await prisma.farmer.updateMany({
    where: { farmerId: { in: ['FRM00001', 'FRM00002'] } },
    data: { deleted: false, active: true },
  })
  const farmers = await prisma.farmer.findMany({
    where: { deleted: false },
    select: { id: true, name: true, farmerId: true },
  })
  const buyer = await prisma.buyer.findFirst({ where: { deleted: false } })
  const pending = await prisma.dheri.findMany({
    where: { deleted: false, sellingStatus: { not: 'SOLD' } },
    select: { id: true, dheriId: true, marketRate: true },
  })
  console.log({ farmers, buyer: buyer?.name, pending })

  await runWithWorkspace('live', async () => {
    if (!buyer) throw new Error('no buyer')
    for (const d of pending) {
      const rate = d.marketRate.toNumber() > 0 ? d.marketRate.toNumber() : 4300
      const res = await sellDheriAtAuctionRate({
        dheriId: Number(d.id),
        buyerId: Number(buyer.id),
        ratePer40Kg: rate,
      })
      console.log(res.message)
    }
  })
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
