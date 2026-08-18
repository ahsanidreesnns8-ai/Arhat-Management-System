/**
 * Smoke-test Refresh: save today to Records and start Daily Trade from zero.
 * Uses the demo workspace so live owner data is not touched.
 * Usage: cd web && npx tsx scripts/smoke-daily-trade-refresh.ts
 */
import { config } from 'dotenv'
config({ path: '.env' })

import { prisma } from '../src/server/db'
import { createFarmer } from '../src/server/services/farmers'
import { createBuyer } from '../src/server/services/buyers'
import {
  getDailyBoard,
  listDailyHistory,
  markDeskSold,
  refreshDailyBoard,
} from '../src/server/services/daily-trade'
import { runWithWorkspace } from '../src/server/workspace'

const stamp = `RFH${Date.now().toString().slice(-8)}`

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message)
}

async function cleanup(ids: {
  farmerId?: bigint
  buyerId?: bigint
  dheriIds: bigint[]
  saleIds: bigint[]
  batchIds: bigint[]
  sessionIds: bigint[]
}) {
  if (ids.saleIds.length) {
    await prisma.payment.deleteMany({ where: { saleId: { in: ids.saleIds } } })
    await prisma.saleItem.deleteMany({ where: { saleId: { in: ids.saleIds } } })
    await prisma.sale.deleteMany({ where: { id: { in: ids.saleIds } } })
  }
  if (ids.dheriIds.length) {
    await prisma.queueEntry.deleteMany({ where: { dheriId: { in: ids.dheriIds } } })
    await prisma.stockLot.deleteMany({ where: { dheriId: { in: ids.dheriIds } } })
    await prisma.stockTransaction.deleteMany({ where: { dheriId: { in: ids.dheriIds } } })
    await prisma.payment.deleteMany({ where: { dheriId: { in: ids.dheriIds } } })
    await prisma.dheri.deleteMany({ where: { id: { in: ids.dheriIds } } })
  }
  if (ids.batchIds.length) {
    await prisma.dayBatch.deleteMany({ where: { id: { in: ids.batchIds } } })
  }
  if (ids.sessionIds.length) {
    await prisma.dailyTradeSession.deleteMany({ where: { id: { in: ids.sessionIds } } })
  }
  if (ids.buyerId) {
    await prisma.payment.deleteMany({ where: { buyerId: ids.buyerId } })
    await prisma.buyer.deleteMany({ where: { id: ids.buyerId } })
  }
  if (ids.farmerId) {
    await prisma.payment.deleteMany({ where: { farmerId: ids.farmerId } })
    await prisma.stockLot.deleteMany({ where: { farmerId: ids.farmerId } })
    await prisma.stockTransaction.deleteMany({ where: { farmerId: ids.farmerId } })
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
      sessionIds: [] as bigint[],
    }
    let stockQtyBefore: Array<{ id: bigint; quantity: unknown }> = []
    try {
      const paddy = await prisma.product.findFirst({
        where: { productCode: 'RCE-001', deleted: false },
      })
      assert(paddy, 'Need RCE-001 product in demo workspace')

      const farmer = await createFarmer({
        name: `Refresh Farmer ${stamp}`,
        fatherName: 'Ali',
        code: `F-${stamp}`,
        address: 'Gala Mandi',
        city: 'Lahore',
      })
      ids.farmerId = BigInt(farmer.id)

      const buyer = await createBuyer({
        name: `Refresh Buyer ${stamp}`,
        fatherName: 'Hassan',
        code: `B-${stamp}`,
        address: 'Main Bazaar',
        city: 'Okara',
      })
      ids.buyerId = BigInt(buyer.id)

      stockQtyBefore = await prisma.stock.findMany({ select: { id: true, quantity: true } })

      const firstCode = `D-${stamp}-1`
      const sold1 = await markDeskSold({
        farmerId: farmer.id,
        productId: Number(paddy.id),
        dheriCode: firstCode,
        farmerBags: 8,
        weightPerBag: 40,
        extraKg: 4,
        farmerRatePer40: 400,
        buyerId: buyer.id,
        buyerBags: 8,
        extraBags: 0,
        buyerRatePer40: 400,
        stockBags: 0,
      })
      ids.dheriIds.push(BigInt(sold1.dheriId))
      ids.saleIds.push(BigInt(sold1.sale.id))
      const dheri1 = await prisma.dheri.findFirst({ where: { id: BigInt(sold1.dheriId) } })
      if (dheri1?.dayBatchId) ids.batchIds.push(dheri1.dayBatchId)

      assert(
        sold1.board.receives.some((r: { dheriId: string }) => r.dheriId === firstCode),
        'board should show the first receive before refresh',
      )
      assert(
        sold1.board.sales.some((s: { id: number }) => s.id === sold1.sale.id),
        'board should show the first sale before refresh',
      )
      assert(sold1.board.session.receivedBags > 0, 'received bags should not be zero before refresh')
      console.log('before refresh', {
        receives: sold1.board.receives.length,
        sales: sold1.board.sales.length,
        bags: sold1.board.session.receivedBags,
      })

      const extraBefore = await prisma.stockLot.findFirst({
        where: { dheriId: BigInt(sold1.dheriId) },
      })
      assert(extraBefore, 'Extra KG lot should exist before refresh')

      const afterRefresh = await refreshDailyBoard()
      assert(afterRefresh.receives.length === 0, 'receiving table must be empty after refresh')
      assert(afterRefresh.sales.length === 0, 'selling table must be empty after refresh')
      assert(afterRefresh.session.receivedBags === 0, 'received bags must be 0 after refresh')
      assert(afterRefresh.session.soldBags === 0, 'sold bags must be 0 after refresh')
      assert(
        afterRefresh.session.status === 'OPEN',
        `fresh session should be OPEN, got ${afterRefresh.session.status}`,
      )
      assert(
        afterRefresh.session.id !== sold1.board.session.id,
        'refresh must open a new session, not keep the archived one',
      )
      console.log('after refresh board is empty', {
        receives: afterRefresh.receives.length,
        sales: afterRefresh.sales.length,
        sessionId: afterRefresh.session.id,
      })

      const history = await listDailyHistory()
      const saved = history.find((day) =>
        (day.receives as Array<{ dheriId?: string }>).some((r) => r.dheriId === firstCode),
      )
      assert(saved, 'Records history must contain the archived day with the first dheri')
      ids.sessionIds.push(BigInt(saved.id))
      assert(
        (saved.sales as Array<{ id?: number }>).some((s) => Number(s.id) === sold1.sale.id),
        'archived selling table must include the first sale',
      )
      console.log('saved to Records', {
        date: saved.sessionDate,
        receiveCount: saved.receiveCount,
        saleCount: saved.saleCount,
      })

      const extraAfter = await prisma.stockLot.findFirst({
        where: { dheriId: BigInt(sold1.dheriId) },
      })
      assert(extraAfter, 'Refresh must not delete Extra KG stock')
      assert(Number(extraAfter.remainingKg) === 4, 'Extra KG remaining should stay 4')

      const secondCode = `D-${stamp}-2`
      const sold2 = await markDeskSold({
        farmerId: farmer.id,
        productId: Number(paddy.id),
        dheriCode: secondCode,
        farmerBags: 5,
        weightPerBag: 40,
        extraKg: 0,
        farmerRatePer40: 400,
        buyerId: buyer.id,
        buyerBags: 5,
        extraBags: 0,
        buyerRatePer40: 400,
        stockBags: 0,
      })
      ids.dheriIds.push(BigInt(sold2.dheriId))
      ids.saleIds.push(BigInt(sold2.sale.id))
      const dheri2 = await prisma.dheri.findFirst({ where: { id: BigInt(sold2.dheriId) } })
      if (dheri2?.dayBatchId) ids.batchIds.push(dheri2.dayBatchId)

      assert(
        sold2.board.receives.some((r: { dheriId: string }) => r.dheriId === secondCode),
        'new receive should appear on the empty board',
      )
      assert(
        !sold2.board.receives.some((r: { dheriId: string }) => r.dheriId === firstCode),
        'archived dheri must not come back onto the live board',
      )
      assert(
        !sold2.board.sales.some((s: { id: number }) => s.id === sold1.sale.id),
        'archived sale must not come back onto the live board',
      )
      assert(sold2.board.session.receivedBags === 5, `expected 5 bags on new day, got ${sold2.board.session.receivedBags}`)
      console.log('new day after refresh OK', {
        receives: sold2.board.receives.map((r: { dheriId: string }) => r.dheriId),
        bags: sold2.board.session.receivedBags,
      })
    } finally {
      for (const row of stockQtyBefore) {
        await prisma.stock.update({
          where: { id: row.id },
          data: { quantity: row.quantity as never },
        })
      }
      await cleanup(ids)
      console.log('demo workspace cleanup done')
    }
  })
}

main()
  .then(async () => {
    await prisma.$disconnect()
    console.log('SMOKE PASS')
  })
  .catch(async (error) => {
    console.error('SMOKE FAIL', error)
    await prisma.$disconnect()
    process.exit(1)
  })
