/**
 * Smoke-test day batch receive → auction sell ordering against the DB.
 * Usage: cd web && npx tsx scripts/smoke-day-batches.ts
 */
import { config } from 'dotenv'
config({ path: '.env' })

import { PrismaClient } from '@prisma/client'
import {
  getOrCreateReceivingBatch,
  listDayBatches,
  openNextBatch,
  sellDheriAtAuctionRate,
} from '../src/server/services/day-batches'
import { createDheri } from '../src/server/services/dheris'
import { runWithWorkspace } from '../src/server/workspace'

const prisma = new PrismaClient()

async function main() {
  await runWithWorkspace('live', async () => {
    // Clean today's batches for a clean smoke (optional soft - only create test farmers)
    const product = await prisma.product.findFirst({ where: { deleted: false, active: true } })
    if (!product) throw new Error('Need a product')

    let farmerA = await prisma.farmer.findFirst({ where: { name: 'Batch Smoke A', deleted: false } })
    if (!farmerA) {
      farmerA = await prisma.farmer.create({
        data: {
          workspace: 'live',
          farmerId: `SMK${Date.now().toString().slice(-5)}A`,
          name: 'Batch Smoke A',
        },
      })
    }
    let farmerB = await prisma.farmer.findFirst({ where: { name: 'Batch Smoke B', deleted: false } })
    if (!farmerB) {
      farmerB = await prisma.farmer.create({
        data: {
          workspace: 'live',
          farmerId: `SMK${Date.now().toString().slice(-5)}B`,
          name: 'Batch Smoke B',
        },
      })
    }
    let buyer = await prisma.buyer.findFirst({ where: { name: 'Batch Smoke Buyer', deleted: false } })
    if (!buyer) {
      buyer = await prisma.buyer.create({
        data: {
          workspace: 'live',
          buyerId: `BYS${Date.now().toString().slice(-5)}`,
          name: 'Batch Smoke Buyer',
        },
      })
    }

    const b1 = await getOrCreateReceivingBatch()
    console.log('receiving batch', b1)

    const d1 = await createDheri({
      farmerId: Number(farmerA.id),
      productId: Number(product.id),
      numberOfBags: 10,
      weightPerBag: 40,
      partialBagWeight: 5,
      marketRate: 0,
    })
    const d2 = await createDheri({
      farmerId: Number(farmerB.id),
      productId: Number(product.id),
      numberOfBags: 8,
      weightPerBag: 40,
      partialBagWeight: 0,
      marketRate: 0,
    })
    console.log('batch1 dheris', d1.dheriId, d1.batchNumber, d2.dheriId, d2.batchNumber)

    const b2 = await openNextBatch()
    console.log('opened batch2', b2)

    // Same farmer returns with another dheri into batch 2
    const d3 = await createDheri({
      farmerId: Number(farmerA.id),
      productId: Number(product.id),
      numberOfBags: 5,
      weightPerBag: 40,
      marketRate: 0,
    })
    console.log('batch2 dheri (same farmer)', d3.dheriId, d3.batchNumber)

    // Selling batch2 first must fail
    try {
      await sellDheriAtAuctionRate({
        dheriId: d3.id,
        buyerId: Number(buyer.id),
        ratePer40Kg: 4300,
      })
      throw new Error('EXPECTED FAIL selling batch2 early')
    } catch (e) {
      console.log('blocked early batch2 sell OK:', (e as Error).message)
    }

    const s1 = await sellDheriAtAuctionRate({
      dheriId: d1.id,
      buyerId: Number(buyer.id),
      ratePer40Kg: 4300,
    })
    console.log('sold d1', s1.message)

    const s2 = await sellDheriAtAuctionRate({
      dheriId: d2.id,
      buyerId: Number(buyer.id),
      ratePer40Kg: 4200,
    })
    console.log('sold d2', s2.message, 'batchClosed', s2.batchClosed)

    const s3 = await sellDheriAtAuctionRate({
      dheriId: d3.id,
      buyerId: Number(buyer.id),
      ratePer40Kg: 4400,
    })
    console.log('sold d3', s3.message)

    console.log('final batches', await listDayBatches())
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
