/**
 * Smoke: edit a Daily Trade sold row (bags/rate) and keep Extra KG stock consistent.
 * Demo workspace only. Usage: cd web && npx tsx scripts/smoke-desk-edit.ts
 */
import { config } from 'dotenv'
config({ path: '.env' })

import { prisma } from '../src/server/db'
import { createFarmer } from '../src/server/services/farmers'
import { createBuyer } from '../src/server/services/buyers'
import { markDeskSold, updateDeskSold } from '../src/server/services/daily-trade'
import { runWithWorkspace } from '../src/server/workspace'

const stamp = `EDT${Date.now().toString().slice(-8)}`

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message)
}

async function cleanup(ids: {
  farmerId?: bigint
  buyerId?: bigint
  dheriIds: bigint[]
  saleIds: bigint[]
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
    }
    try {
      const paddy = await prisma.product.findFirst({
        where: { productCode: 'RCE-001', deleted: false },
      })
      assert(paddy, 'Need RCE-001 product in demo workspace')
      const farmer = await createFarmer({
        name: `Edit Farmer ${stamp}`,
        fatherName: 'Ali',
        code: `F-${stamp}`,
      })
      ids.farmerId = BigInt(farmer.id)
      const buyer = await createBuyer({
        name: `Edit Buyer ${stamp}`,
        fatherName: 'Hassan',
        code: `B-${stamp}`,
      })
      ids.buyerId = BigInt(buyer.id)

      const sold = await markDeskSold({
        farmerId: farmer.id,
        productId: Number(paddy.id),
        dheriCode: `D-${stamp}`,
        farmerBags: 10,
        weightPerBag: 40,
        extraKg: 5,
        farmerRatePer40: 400,
        buyerId: buyer.id,
        buyerBags: 10,
        extraBags: 0,
        buyerRatePer40: 400,
        stockBags: 0,
      })
      ids.dheriIds.push(BigInt(sold.dheriId))
      ids.saleIds.push(BigInt(sold.sale.id))

      const edited = await updateDeskSold({
        saleId: sold.sale.id,
        farmerId: farmer.id,
        productId: Number(paddy.id),
        dheriCode: `D-${stamp}`,
        farmerBags: 12,
        weightPerBag: 40,
        extraKg: 5,
        farmerRatePer40: 400,
        buyerId: buyer.id,
        buyerBags: 12,
        extraBags: 0,
        buyerRatePer40: 420,
        stockBags: 0,
      })
      assert(edited.sale.totalBags === 12, `expected 12 bags after edit, got ${edited.sale.totalBags}`)
      assert(edited.totals.buyerAmount === 5040, `12*40kg @ 420/40 = 5040, got ${edited.totals.buyerAmount}`)
      const dheri = await prisma.dheri.findFirst({ where: { id: BigInt(sold.dheriId) } })
      assert(dheri?.numberOfBags === 12, `dheri bags should be 12, got ${dheri?.numberOfBags}`)
      const lot = await prisma.stockLot.findFirst({ where: { dheriId: BigInt(sold.dheriId) } })
      assert(lot && Number(lot.remainingKg) === 5, `extra kg lot should stay 5, got ${lot?.remainingKg}`)
      console.log('desk edit OK', edited.totals)
    } finally {
      await cleanup(ids)
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
