/**
 * New farmer/buyer IDs on Arhat Register, stock bags × kg, bill credit.
 * Usage: cd web && npx tsx scripts/smoke-register-stock-branding.ts
 */
import { config } from 'dotenv'
config({ path: '.env' })

import { prisma } from '../src/server/db'
import { createFarmer } from '../src/server/services/farmers'
import { createBuyer } from '../src/server/services/buyers'
import { listParties } from '../src/server/services/register'
import { farmerBill } from '../src/server/services/bills'
import { consumeStockLotsToBags, intakeExtraKgToStock } from '../src/server/services/stock-lots'
import { runWithWorkspace } from '../src/server/workspace'

const stamp = `RSB${Date.now().toString().slice(-8)}`

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message)
}

async function main() {
  await runWithWorkspace('demo', async () => {
    const ids = {
      farmerId: undefined as bigint | undefined,
      buyerId: undefined as bigint | undefined,
      productId: undefined as bigint | undefined,
    }
    try {
      const farmer = await createFarmer({
        name: `Rana AllahWasya ${stamp}`,
        code: 'R 74.A',
      })
      ids.farmerId = BigInt(farmer.id)
      const buyer = await createBuyer({
        name: `Buyer ${stamp}`,
        code: `B${stamp.slice(-4)}.A`,
      })
      ids.buyerId = BigInt(buyer.id)

      const people = await listParties('GIVING')
      const farmerHit = people.find(
        (row) =>
          row.linkedFarmerId === farmer.id ||
          [row.ownerCode, row.farmerCode, row.notes, row.name].some(
            (value) => String(value || '').replace(/\s+/g, '').toUpperCase() === 'R74.A',
          ),
      )
      const buyerHit = people.find(
        (row) =>
          row.ownerCode === buyer.buyerId ||
          row.buyerCode === buyer.buyerId ||
          row.linkedBuyerId === buyer.id,
      )
      assert(farmerHit, `farmer ${farmer.farmerId} missing from Arhat Register`)
      assert(buyerHit, `buyer ${buyer.buyerId} missing from Arhat Register`)
      const farmerHay = [farmerHit.name, farmerHit.ownerCode, farmerHit.farmerCode].join(' ').toLowerCase()
      const buyerHay = [buyerHit.name, buyerHit.ownerCode, buyerHit.buyerCode].join(' ').toLowerCase()
      const farmerCompact = farmerHay.replace(/\s+/g, '')
      assert(farmerCompact.includes('r74.a'), 'search haystack missing R 74.A / R74.A')
      assert(buyerHay.includes(buyer.buyerId.toLowerCase()), 'search haystack missing buyer ID')

      const product = await prisma.product.findFirst({ where: { deleted: false, active: true } })
      assert(product, 'need a product')
      ids.productId = product.id
      await prisma.stockLot.deleteMany({ where: { productId: product.id } })
      await prisma.stock.updateMany({ where: { productId: product.id }, data: { quantity: 0 } })
      await intakeExtraKgToStock({
        productId: Number(product.id),
        extraKg: 99,
        ratePer40Kg: 400,
        bagWeightKg: 49.5,
        notes: `verify ${stamp}`,
      })
      const formed = await consumeStockLotsToBags({
        productId: Number(product.id),
        bagWeightKg: 49.5,
        maxBags: 2,
      })
      assert(formed.bagsFromStock === 2, `expected 2 bags from 99 kg, got ${formed.bagsFromStock}`)
      assert(Math.abs(formed.kgUsed - 99) < 0.02, `expected 99 kg used, got ${formed.kgUsed}`)

      const html = await farmerBill(farmer.id, 'en')
      assert(html.includes('Created by AI'), 'bill missing Created by AI')
      assert(html.includes('Ahsan Idrees'), 'bill missing Ahsan Idrees')
      assert(html.includes('+923224398646'), 'bill missing contact number')
      assert(html.includes('aria-label="AI"'), 'bill missing AI logo')
      console.log('register stock branding OK', farmer.farmerId, buyer.buyerId, formed.kgUsed)
    } finally {
      if (ids.productId) {
        await prisma.stockLot.deleteMany({
          where: { productId: ids.productId, notes: { contains: stamp } },
        })
      }
      if (ids.farmerId) {
        await prisma.registerParty.deleteMany({ where: { linkedFarmerId: ids.farmerId } })
        await prisma.farmer.deleteMany({ where: { id: ids.farmerId } })
      }
      if (ids.buyerId) {
        await prisma.registerParty.deleteMany({ where: { linkedBuyerId: ids.buyerId } })
        await prisma.buyer.deleteMany({ where: { id: ids.buyerId } })
      }
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
