/**
 * Daily Trade Add to stock: bags optional, Extra KG at rate / 40kg.
 * Demo workspace only. Usage: cd web && npx tsx scripts/smoke-add-to-stock.ts
 */
import { config } from 'dotenv'
config({ path: '.env' })

import { prisma } from '../src/server/db'
import { farmerBill } from '../src/server/services/bills'
import { addFarmerKgToStock } from '../src/server/services/daily-trade'
import { createFarmer } from '../src/server/services/farmers'
import { runWithWorkspace } from '../src/server/workspace'

const stamp = `STK${Date.now().toString().slice(-8)}`

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message)
}

async function main() {
  await runWithWorkspace('demo', async () => {
    const ids = {
      farmerId: undefined as bigint | undefined,
      dheriId: undefined as bigint | undefined,
    }
    try {
      const product = await prisma.product.findFirst({ where: { deleted: false, active: true } })
      assert(product, 'Need a product')
      const farmer = await createFarmer({
        name: `Stock Kg Farmer ${stamp}`,
        code: `SK-${stamp}`,
      })
      ids.farmerId = BigInt(farmer.id)

      const added = await addFarmerKgToStock({
        farmerId: farmer.id,
        productId: Number(product.id),
        extraKg: 40,
        farmerRatePer40: 2000,
        farmerBags: 0,
      })
      ids.dheriId = BigInt(added.dheriId)
      assert(added.extraKg === 40, `expected 40 kg, got ${added.extraKg}`)
      assert(added.farmerGross === 2000, `40 kg @ 2000/40kg should be 2000, got ${added.farmerGross}`)
      assert(added.commission > 0, 'farmer commission should apply')
      assert(added.farmerNet === added.farmerGross - added.commission, 'net should be gross minus commission')

      const lot = await prisma.stockLot.findFirst({ where: { dheriId: BigInt(added.dheriId) } })
      assert(lot, 'Add to stock should create Extra KG lot')
      assert(Number(lot.remainingKg) === 40, `lot remaining should be 40, got ${lot.remainingKg}`)
      assert(Number(lot.ratePer40Kg) === 2000, `lot rate should be 2000, got ${lot.ratePer40Kg}`)

      const html = await farmerBill(farmer.id, 'en', added.dheriId)
      assert(html.includes('40'), 'farmer bill should show 40 kg')
      assert(html.includes('2000') || html.includes('2,000'), 'farmer bill should show rate/amount')
      assert(!html.includes('This bill includes stock'), 'farmer bill should not use the stock footer')

      console.log('add to stock OK', {
        dheriId: added.dheriId,
        gross: added.farmerGross,
        commission: added.commission,
        net: added.farmerNet,
      })
      console.log('SMOKE PASS')
    } finally {
      if (ids.dheriId) {
        const { deleteStockLot } = await import('../src/server/services/stock-lots')
        const lots = await prisma.stockLot.findMany({ where: { dheriId: ids.dheriId } })
        for (const lot of lots) {
          await deleteStockLot(Number(lot.id))
        }
        await prisma.stockTransaction.deleteMany({ where: { dheriId: ids.dheriId } })
        await prisma.payment.deleteMany({ where: { dheriId: ids.dheriId } })
        await prisma.dheri.deleteMany({ where: { id: ids.dheriId } })
      }
      if (ids.farmerId) {
        await prisma.farmer.updateMany({ where: { id: ids.farmerId }, data: { deleted: true } })
      }
    }
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
