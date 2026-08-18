/**
 * Smoke-test Daily Trade desk: owner IDs, Extra KG → stock, round-off,
 * buyer price without commission, Paddy rename, dashboard stock + date.
 * Uses the demo workspace so live owner data is not touched.
 * Usage: cd web && npx tsx scripts/smoke-daily-trade-desk.ts
 */
import { config } from 'dotenv'
config({ path: '.env' })

import { prisma } from '../src/server/db'
import { roundRupee } from '../src/server/money'
import { calculatePrice } from '../src/server/services/calculator'
import { createFarmer } from '../src/server/services/farmers'
import { createBuyer } from '../src/server/services/buyers'
import { getDashboardStats } from '../src/server/services/dashboard'
import { markDeskSold } from '../src/server/services/daily-trade'
import { runWithWorkspace } from '../src/server/workspace'

const stamp = `DSK${Date.now().toString().slice(-8)}`

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
  assert(roundRupee(10.5).toNumber() === 11, '10.5 should round up to 11')
  assert(roundRupee(10.49).toNumber() === 10, '10.49 should round down to 10')
  assert(roundRupee(10.5).toNumber() === 11, 'half-up failed')
  console.log('roundRupee OK (10.5 → 11, 10.49 → 10)')

  await runWithWorkspace('demo', async () => {
    const ids = {
      farmerId: undefined as bigint | undefined,
      buyerId: undefined as bigint | undefined,
      dheriIds: [] as bigint[],
      saleIds: [] as bigint[],
    }
    let stockQtyBefore: Array<{ id: bigint; quantity: unknown }> = []
    try {
      const paddy = await prisma.product.findFirst({
        where: { productCode: 'RCE-001', deleted: false },
      })
      assert(paddy, 'Need RCE-001 product in demo workspace')
      assert(paddy.name === 'Paddy', `Expected Paddy, got ${paddy.name}`)
      console.log('catalog rename OK', paddy.productCode, paddy.name)

      const farmer = await createFarmer({
        name: `Desk Farmer ${stamp}`,
        fatherName: 'Ali',
        code: `F-${stamp}`,
        address: 'Gala Mandi',
        city: 'Lahore',
        notes: 'desk smoke',
      })
      ids.farmerId = BigInt(farmer.id)
      assert(farmer.farmerId === `F-${stamp}`, 'owner farmer ID not stored')
      assert(farmer.fatherName === 'Ali', 'father name not stored on farmer')

      const buyer = await createBuyer({
        name: `Desk Buyer ${stamp}`,
        fatherName: 'Hassan',
        code: `B-${stamp}`,
        address: 'Main Bazaar',
        city: 'Okara',
        notes: 'desk smoke buyer',
      })
      ids.buyerId = BigInt(buyer.id)
      assert(buyer.buyerId === `B-${stamp}`, 'owner buyer ID not stored')
      assert(buyer.fatherName === 'Hassan', 'father name not stored on buyer')
      console.log('party IDs OK', farmer.farmerId, buyer.buyerId)

      const priced = await calculatePrice({
        numberOfBags: 10,
        weightPerBag: 40,
        partialBagWeight: 5,
        marketRate: 400,
      })
      const withoutExtra = await calculatePrice({
        numberOfBags: 10,
        weightPerBag: 40,
        partialBagWeight: 0,
        marketRate: 400,
      })
      assert(priced.totalWeight === 405, `expected 405 kg, got ${priced.totalWeight}`)
      assert(priced.totalAmount > withoutExtra.totalAmount, 'Extra KG must be priced into farmer total')
      assert(priced.totalAmount === 4050, `expected 4050, got ${priced.totalAmount}`)
      const half = await calculatePrice({
        numberOfBags: 0,
        weightPerBag: 40,
        partialBagWeight: 21,
        marketRate: 41,
      })
      assert(half.totalAmount === 22, `21kg @ 41/40kg = 21.525 → 22, got ${half.totalAmount}`)
      console.log('pricing + extra KG + round-off OK', priced.totalAmount, half.totalAmount)

      const statsBefore = await getDashboardStats()
      const extraBefore = statsBefore.extraKgStock || 0
      stockQtyBefore = await prisma.stock.findMany({ select: { id: true, quantity: true } })

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

      assert(sold.dheriCode === `D-${stamp}`, 'dheri number not kept')
      assert(sold.totals.farmerGross === 4050, `farmer gross should include extra KG, got ${sold.totals.farmerGross}`)
      assert(
        sold.totals.buyerAmount === 4000,
        `buyer amount is bags only (no commission, no extra KG), got ${sold.totals.buyerAmount}`,
      )
      assert(sold.totals.commission > 0, 'farmer commission should be deducted on farmer side')
      assert(
        sold.totals.farmerNet === sold.totals.farmerGross - sold.totals.commission,
        'farmer net should be gross minus commission',
      )
      assert(sold.board.receives.some((r: { dheriId: string }) => r.dheriId === `D-${stamp}`), 'receive table missing dheri')
      assert(sold.board.sales.some((s: { id: number }) => s.id === sold.sale.id), 'sell table missing sale')
      console.log('mark sold OK', sold.totals)

      const lot = await prisma.stockLot.findFirst({
        where: { dheriId: BigInt(sold.dheriId) },
      })
      assert(lot, 'Extra KG should create a stock lot')
      assert(Number(lot.remainingKg) === 5, `expected 5 kg remaining, got ${lot.remainingKg}`)
      assert(Number(lot.amountValue) === 50, `extra 5kg @ 400/40 = 50, got ${lot.amountValue}`)

      const statsAfter = await getDashboardStats()
      assert(
        (statsAfter.extraKgStock || 0) >= extraBefore + 5 - 0.01,
        `dashboard extra KG should rise (before ${extraBefore}, after ${statsAfter.extraKgStock})`,
      )
      assert(statsAfter.stockAsOf, 'dashboard stockAsOf date missing')
      assert(
        (statsAfter.stockLots || []).some((l) => l.remainingKg >= 5 && l.intakeDate),
        'dashboard stock lots should include extra KG + date',
      )
      console.log('dashboard stock OK', {
        extraKgStock: statsAfter.extraKgStock,
        stockAsOf: statsAfter.stockAsOf,
        lots: statsAfter.stockLots?.length,
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
