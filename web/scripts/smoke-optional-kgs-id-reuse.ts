/**
 * Optional bags + KGs (buyer / farmer product) and reusable person IDs after delete.
 * Demo workspace only. Usage: cd web && npx tsx scripts/smoke-optional-kgs-id-reuse.ts
 */
import { config } from 'dotenv'
config({ path: '.env' })

import { prisma } from '../src/server/db'
import { settle } from '../src/server/services/arhat'
import { createBuyer, deleteBuyer } from '../src/server/services/buyers'
import { markDeskSold } from '../src/server/services/daily-trade'
import { createFarmer, deleteFarmer } from '../src/server/services/farmers'
import { createParty, deleteParty } from '../src/server/services/register'
import { runWithWorkspace } from '../src/server/workspace'

const stamp = `KG${Date.now().toString().slice(-8)}`

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message)
}

async function main() {
  await runWithWorkspace('demo', async () => {
    const ids = {
      farmerId: undefined as bigint | undefined,
      buyerId: undefined as bigint | undefined,
      productFarmerId: undefined as bigint | undefined,
      reuseFarmerId: undefined as bigint | undefined,
      reuseBuyerId: undefined as bigint | undefined,
      dheriIds: [] as bigint[],
      saleIds: [] as bigint[],
    }
    try {
      const product = await prisma.product.findFirst({ where: { deleted: false, active: true } })
      assert(product, 'Need a product')

      const farmer = await createFarmer({ name: `Kg Farmer ${stamp}`, code: `KF-${stamp}` })
      const buyer = await createBuyer({ name: `Kg Buyer ${stamp}`, code: `KB-${stamp}` })
      ids.farmerId = BigInt(farmer.id)
      ids.buyerId = BigInt(buyer.id)

      const sold = await markDeskSold({
        farmerId: farmer.id,
        productId: Number(product.id),
        dheriCode: `DK${stamp.slice(-6)}`,
        farmerBags: 0,
        extraKg: 0,
        farmerKgs: 40,
        farmerRatePer40: 2000,
        buyerId: buyer.id,
        buyerBags: 0,
        extraBags: 0,
        buyerKgs: 40,
        buyerRatePer40: 2200,
      })
      ids.dheriIds.push(BigInt(sold.dheriId))
      ids.saleIds.push(BigInt(sold.sale.id))
      assert(sold.totals.farmerGross === 2000, `farmer 40kg @ 2000 should be 2000, got ${sold.totals.farmerGross}`)
      assert(sold.totals.commission > 0, 'farmer commission should apply on KGs-only product')
      assert(sold.totals.buyerAmount === 2200, `buyer 40kg @ 2200 should be 2200, got ${sold.totals.buyerAmount}`)
      const saleItem = await prisma.saleItem.findFirst({
        where: { saleId: BigInt(sold.sale.id), sourceType: 'FARMER' },
      })
      assert(saleItem, 'buyer KGs sale line missing')
      assert(saleItem.numberOfBags === 0, 'buyer bags should stay optional / zero')
      assert(Number(saleItem.partialBagWeight) === 40, `buyer KGs should be 40, got ${saleItem.partialBagWeight}`)

      const productFarmer = await createFarmer({ name: `Product Kg ${stamp}`, code: `PK-${stamp}` })
      ids.productFarmerId = BigInt(productFarmer.id)
      const productRow = await settle({
        settlementType: 'FARMER_PAYABLE',
        farmerId: productFarmer.id,
        productId: Number(product.id),
        dheriCode: `DP${stamp.slice(-6)}`,
        numberOfBags: 0,
        weightPerBag: 40,
        partialBagWeight: 21,
        stockExtraKg: 21,
        marketRate: 2000,
        paymentNow: 0,
      })
      assert(productRow.dheriId != null, 'farmer product KGs-only should save a dheri')
      ids.dheriIds.push(BigInt(productRow.dheriId))
      assert(Number(productRow.totalAmount) === 1050, `21kg @ 2000/40kg should be 1050, got ${productRow.totalAmount}`)
      assert(Number(productRow.commission) > 0, 'farmer product commission should apply')
      const lot = await prisma.stockLot.findFirst({ where: { dheriId: BigInt(productRow.dheriId) } })
      assert(lot, 'farmer product KGs should follow Extra KG stock process')
      assert(Number(lot.remainingKg) === 21, `stock lot should be 21kg, got ${lot.remainingKg}`)

      const reuseCode = `RU-${stamp}`
      const first = await createFarmer({ name: `Reuse A ${stamp}`, code: reuseCode })
      await deleteFarmer(first.id)
      const second = await createFarmer({ name: `Reuse B ${stamp}`, code: reuseCode })
      ids.reuseFarmerId = BigInt(second.id)
      assert(second.farmerId === reuseCode, 'deleted farmer ID must be reusable')
      assert(second.id !== first.id, 'reused ID should create a new farmer row')

      const buyerCode = `RB-${stamp}`
      const firstBuyer = await createBuyer({ name: `Reuse Buyer A ${stamp}`, code: buyerCode })
      await deleteBuyer(firstBuyer.id)
      const secondBuyer = await createBuyer({ name: `Reuse Buyer B ${stamp}`, code: buyerCode })
      ids.reuseBuyerId = BigInt(secondBuyer.id)
      assert(secondBuyer.buyerId === buyerCode, 'deleted buyer ID must be reusable')

      const registerCode = `RR-${stamp}`
      const person = await createParty({ kind: 'RECEIVING', name: `Register ${stamp}`, code: registerCode })
      await deleteParty(person.id)
      const again = await createParty({ kind: 'RECEIVING', name: `Register Next ${stamp}`, code: registerCode })
      assert(again.ownerCode === registerCode || again.farmerCode === registerCode, 'deleted register ID must be reusable')

      console.log('optional KGs + ID reuse OK', {
        sale: sold.sale.invoiceNumber,
        farmerGross: sold.totals.farmerGross,
        buyerAmount: sold.totals.buyerAmount,
        productNet: productRow.farmerPayable,
      })
      console.log('SMOKE PASS')
    } finally {
      if (ids.saleIds.length) {
        await prisma.payment.deleteMany({ where: { saleId: { in: ids.saleIds } } })
        await prisma.saleItem.deleteMany({ where: { saleId: { in: ids.saleIds } } })
        await prisma.sale.deleteMany({ where: { id: { in: ids.saleIds } } })
      }
      if (ids.dheriIds.length) {
        await prisma.stockLot.deleteMany({ where: { dheriId: { in: ids.dheriIds } } })
        await prisma.stockTransaction.deleteMany({ where: { dheriId: { in: ids.dheriIds } } })
        await prisma.payment.deleteMany({ where: { dheriId: { in: ids.dheriIds } } })
        await prisma.dheri.deleteMany({ where: { id: { in: ids.dheriIds } } })
      }
      const farmerIds = [ids.farmerId, ids.productFarmerId, ids.reuseFarmerId].filter(Boolean) as bigint[]
      if (farmerIds.length) {
        await prisma.stockLot.deleteMany({ where: { farmerId: { in: farmerIds } } })
        await prisma.farmer.updateMany({ where: { id: { in: farmerIds } }, data: { deleted: true } })
      }
      const buyerIds = [ids.buyerId, ids.reuseBuyerId].filter(Boolean) as bigint[]
      if (buyerIds.length) {
        await prisma.buyer.updateMany({ where: { id: { in: buyerIds } }, data: { deleted: true } })
      }
    }
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
