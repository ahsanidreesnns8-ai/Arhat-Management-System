/**
 * Smoke-test rebuilt Daily Trade: multi-dheri receive, same farmer across batches,
 * sell a clicked batch, seller (buyer) outstanding.
 * Uses the demo workspace so live owner data is not touched.
 * Usage: cd web && npx tsx scripts/smoke-daily-trade-rebuild.ts
 */
import { config } from 'dotenv'
config({ path: '.env' })

import { prisma } from '../src/server/db'
import { getDailyBoard, receiveManyIntoBatch } from '../src/server/services/daily-trade'
import {
  listDayBatches,
  openNextBatch,
  sellDheriAtAuctionRate,
} from '../src/server/services/day-batches'
import { runWithWorkspace } from '../src/server/workspace'
import {
  nextSelectedBatchId,
  pickSelectedBatch,
  receivesForBatch,
  salesForBatch,
} from '../src/client/pages/dailyTradeScope'

const stamp = `SMK${Date.now().toString().slice(-8)}`

async function cleanup(ids: {
  farmerId?: bigint
  buyerId?: bigint
  dheriIds: bigint[]
  saleIds: bigint[]
  batchIds: bigint[]
}) {
  if (ids.saleIds.length) {
    await prisma.payment.deleteMany({ where: { saleId: { in: ids.saleIds } } })
    await prisma.saleItem.deleteMany({ where: { saleId: { in: ids.saleIds } } })
    await prisma.sale.deleteMany({ where: { id: { in: ids.saleIds } } })
  }
  if (ids.dheriIds.length) {
    await prisma.queueEntry.deleteMany({ where: { dheriId: { in: ids.dheriIds } } })
    await prisma.stockLot.deleteMany({ where: { dheriId: { in: ids.dheriIds } } })
    await prisma.payment.deleteMany({ where: { dheriId: { in: ids.dheriIds } } })
    await prisma.dheri.deleteMany({ where: { id: { in: ids.dheriIds } } })
  }
  if (ids.batchIds.length) {
    await prisma.dayBatch.deleteMany({ where: { id: { in: ids.batchIds } } })
  }
  if (ids.buyerId) {
    await prisma.payment.deleteMany({ where: { buyerId: ids.buyerId } })
    await prisma.buyer.deleteMany({ where: { id: ids.buyerId } })
  }
  if (ids.farmerId) {
    await prisma.payment.deleteMany({ where: { farmerId: ids.farmerId } })
    await prisma.truck.deleteMany({ where: { farmerId: ids.farmerId } })
    await prisma.farmer.deleteMany({ where: { id: ids.farmerId } })
  }
}

async function main() {
  await runWithWorkspace('demo', async () => {
    const ids = {
      farmerId: undefined as bigint | undefined,
      buyerId: undefined as bigint | undefined,
      dheriIds: [] as bigint[],
      saleIds: [] as bigint[],
      batchIds: [] as bigint[],
    }
    try {
      const product = await prisma.product.findFirst({
        where: { deleted: false, active: true },
      })
      if (!product) throw new Error('Need a product in demo workspace')

      const farmer = await prisma.farmer.create({
        data: { farmerId: `${stamp}F`, name: `Rebuild Farmer ${stamp}` },
      })
      ids.farmerId = farmer.id

      const buyer = await prisma.buyer.create({
        data: { buyerId: `${stamp}B`, name: `Rebuild Seller ${stamp}` },
      })
      ids.buyerId = buyer.id
      const dueBefore = buyer.outstandingBalance.toNumber()

      const b1 = await openNextBatch(null, `${stamp}-batch1`)
      const b2 = await openNextBatch(null, `${stamp}-batch2`)
      ids.batchIds.push(BigInt(b1.id), BigInt(b2.id))
      console.log('batches', b1.batchNumber, b2.batchNumber)

      const many = await receiveManyIntoBatch({
        farmerId: Number(farmer.id),
        dayBatchId: b1.id,
        notes: 'two dheris at once',
        lines: [
          { productId: Number(product.id), numberOfBags: 10, weightPerBag: 40, extraKg: 5 },
          { productId: Number(product.id), numberOfBags: 8, weightPerBag: 40, extraKg: 0 },
        ],
      })
      if (many.created.length !== 2) throw new Error('expected 2 dheris from one farmer')
      const d1 = many.created[0]
      const d2 = many.created[1]
      ids.dheriIds.push(BigInt(d1.id), BigInt(d2.id))
      console.log('received two dheris into batch', b1.batchNumber, d1.dheriCode, d2.dheriCode)

      const sameFarmer = await receiveManyIntoBatch({
        farmerId: Number(farmer.id),
        dayBatchId: b2.id,
        lines: [{ productId: Number(product.id), numberOfBags: 6, weightPerBag: 40 }],
      })
      if (sameFarmer.created.length !== 1) throw new Error('expected 1 dheri in batch 2')
      const d3 = sameFarmer.created[0]
      ids.dheriIds.push(BigInt(d3.id))
      console.log('same farmer into later batch', b2.batchNumber, d3.dheriCode)

      const listed = await listDayBatches()
      const row1 = listed.batches.find((b) => b.id === b1.id)
      const row2 = listed.batches.find((b) => b.id === b2.id)
      if (!row1 || row1.totalDheris < 2) throw new Error('batch 1 should hold 2 dheris')
      if (!row2 || row2.totalDheris < 1) throw new Error('batch 2 should hold 1 dheri')

      const sell2 = await sellDheriAtAuctionRate({
        dheriId: d3.id,
        buyerId: Number(buyer.id),
        dayBatchId: b2.id,
        ratePer40Kg: 4000,
        paidAmount: 0,
      })
      ids.saleIds.push(BigInt(sell2.sale.id))
      console.log('sold clicked batch first', sell2.message)

      const sell1 = await sellDheriAtAuctionRate({
        dheriId: d1.id,
        buyerId: Number(buyer.id),
        dayBatchId: b1.id,
        ratePer40Kg: 4200,
        paidAmount: 0,
      })
      ids.saleIds.push(BigInt(sell1.sale.id))
      console.log('sold from other batch', sell1.message)

      const buyerAfter = await prisma.buyer.findFirst({ where: { id: buyer.id } })
      const dueAfter = buyerAfter?.outstandingBalance.toNumber() ?? 0
      if (dueAfter <= dueBefore) {
        throw new Error(`seller outstanding should increase (${dueBefore} -> ${dueAfter})`)
      }
      console.log('seller outstanding', dueBefore, '->', dueAfter)

      const board = many.board
      if (!board.batches.some((b: { id: number }) => b.id === b1.id)) {
        throw new Error('board missing created batches')
      }

      const fakeBatches = [
        { id: 11, batchNumber: 1 },
        { id: 55, batchNumber: 5 },
      ]
      const picked = pickSelectedBatch(fakeBatches, 11)
      if (picked?.batchNumber !== 1) throw new Error('tap batch 1 must not fall back to batch 5')
      if (nextSelectedBatchId(fakeBatches, 11) !== 11) {
        throw new Error('selected batch 1 must stay batch 1 after reload')
      }
      if (nextSelectedBatchId(fakeBatches, null) !== 11) {
        throw new Error('default selection must be first batch, not last')
      }

      const sellRemaining = await sellDheriAtAuctionRate({
        dheriId: d2.id,
        buyerId: Number(buyer.id),
        dayBatchId: b1.id,
        ratePer40Kg: 4100,
        paidAmount: 0,
      })
      ids.saleIds.push(BigInt(sellRemaining.sale.id))
      const afterClose = await listDayBatches()
      const closed = afterClose.batches.find((b) => b.id === b1.id)
      if (!closed || closed.status !== 'CLOSED') {
        throw new Error(`batch 1 should be completed after selling all, got ${closed?.status}`)
      }

      const intoClosed = await receiveManyIntoBatch({
        farmerId: Number(farmer.id),
        dayBatchId: b1.id,
        notes: 'receive into completed batch',
        lines: [{ productId: Number(product.id), numberOfBags: 4, weightPerBag: 40 }],
      })
      if (intoClosed.created.length !== 1) throw new Error('should receive into completed batch')
      ids.dheriIds.push(BigInt(intoClosed.created[0].id))
      const reopened = await listDayBatches()
      const row1b = reopened.batches.find((b) => b.id === b1.id)
      if (!row1b || row1b.totalDheris < 3) {
        throw new Error('completed batch should accept another dheri')
      }
      console.log('received into completed batch', row1b.status, intoClosed.created[0].dheriCode)

      const liveBoard = await getDailyBoard()
      const b1Receives = receivesForBatch(liveBoard.receives, b1.id)
      const b2Receives = receivesForBatch(liveBoard.receives, b2.id)
      if (b1Receives.some((r) => r.dayBatchId === b2.id)) {
        throw new Error('batch 1 receive list leaked batch 2')
      }
      if (b2Receives.some((r) => r.dayBatchId === b1.id)) {
        throw new Error('batch 2 receive list leaked batch 1')
      }
      if (b1Receives.length < 3) throw new Error('batch 1 should show only its own dheris (3+)')
      if (b2Receives.length !== 1) throw new Error('batch 2 should show only its 1 dheri')
      const b1Sales = salesForBatch(liveBoard.sales, b1.id, b1Receives.map((r) => r.id))
      const b2Sales = salesForBatch(liveBoard.sales, b2.id, b2Receives.map((r) => r.id))
      if (b1Sales.some((s) => s.items.some((i) => i.dayBatchId === b2.id))) {
        throw new Error('batch 1 sales leaked batch 2')
      }
      if (b2Sales.length < 1) throw new Error('batch 2 should still show its sale')
      console.log('scoped board', { b1: b1Receives.length, b2: b2Receives.length })
      console.log('OK daily trade rebuild smoke')
    } finally {
      await cleanup(ids)
      console.log('cleaned smoke records')
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
