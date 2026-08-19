/**
 * Smoke: bill layout — no bag/stock amount columns, no notes, day + print time.
 * Demo workspace only. Usage: cd web && npx tsx scripts/smoke-bill-layout.ts
 */
import { config } from 'dotenv'
config({ path: '.env' })

import { writeFileSync } from 'node:fs'
import { prisma } from '../src/server/db'
import { farmerBill, buyerBill } from '../src/server/services/bills'
import { createFarmer } from '../src/server/services/farmers'
import { createBuyer } from '../src/server/services/buyers'
import { settle } from '../src/server/services/arhat'
import { runWithWorkspace } from '../src/server/workspace'

const stamp = `BIL${Date.now().toString().slice(-8)}`

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message)
}

async function main() {
  await runWithWorkspace('demo', async () => {
    const ids = {
      farmerId: undefined as bigint | undefined,
      buyerId: undefined as bigint | undefined,
      dheriIds: [] as bigint[],
    }
    let stockQtyBefore: Array<{ id: bigint; quantity: unknown }> = []
    try {
      const product = await prisma.product.findFirst({ where: { deleted: false, active: true } })
      assert(product, 'Need a product in demo workspace')

      const farmer = await createFarmer({
        name: `Bill Farmer ${stamp}`,
        fatherName: 'Ibrahim',
        code: `FB-${stamp}`,
        address: 'Gala Mandi',
        city: 'Nankana',
        notes: 'should not appear on bill',
      })
      ids.farmerId = BigInt(farmer.id)

      const buyer = await createBuyer({
        name: `Bill Buyer ${stamp}`,
        fatherName: 'Usman',
        code: `BB-${stamp}`,
        city: 'Lahore',
        notes: 'buyer note should not appear',
      })
      ids.buyerId = BigInt(buyer.id)

      stockQtyBefore = await prisma.stock.findMany({ select: { id: true, quantity: true } })
      const settled = await settle({
        settlementType: 'FARMER_PAYABLE',
        farmerId: farmer.id,
        productId: Number(product.id),
        dheriCode: `DB-${stamp}`,
        numberOfBags: 10,
        weightPerBag: 40,
        partialBagWeight: 5,
        marketRate: 400,
      })
      if (settled.dheriId != null) ids.dheriIds.push(BigInt(settled.dheriId))

      const html = await farmerBill(farmer.id, 'en')
      writeFileSync('/opt/cursor/artifacts/farmer_bill_layout.html', html)

      const urduHtml = await farmerBill(farmer.id, 'ur')
      writeFileSync('/opt/cursor/artifacts/farmer_bill_urdu_bori.html', urduHtml)
      assert(urduHtml.includes('بوریاں'), 'Urdu farmer bill must use بوریاں')
      assert(!urduHtml.includes('تھیلی'), 'Urdu farmer bill must not use تھیلی')

      const urduBuyer = await buyerBill(buyer.id, 'ur')
      assert(urduBuyer.includes('بوریاں'), 'Urdu buyer bill must use بوریاں')
      assert(!urduBuyer.includes('تھیلی'), 'Urdu buyer bill must not use تھیلی')

      assert(!html.includes('Bags amount'), 'farmer bill still has Bags amount column')
      assert(!html.includes('Extra KG amount'), 'farmer bill still has Extra KG amount column')
      assert(!html.includes('Stock amount'), 'farmer bill still has Stock amount')
      assert(!/>Note:</.test(html) && !html.includes('<strong>Note:'), 'farmer bill still has Note block')
      assert(!html.includes('should not appear on bill'), 'farmer notes leaked onto bill')
      assert(html.includes('>Day<') || html.includes('<strong>Day</strong>'), 'farmer bill missing Day')
      assert(html.includes('<strong>Date</strong>'), 'farmer bill missing Date')
      assert(html.includes('<strong>Time</strong>'), 'farmer bill missing Time')
      assert(!html.includes('Farmer Bill / Payment Receipt'), 'old farmer bill title still present')
      assert(!html.includes('Total Extra KG (sum of rows)'), 'summary Extra KG card still present')
      assert(!html.includes('>Total gross<') && !html.includes('Total gross</div>'), 'summary Total gross card still present')
      assert(html.includes('>Qt.<') || html.includes('Qt.'), 'farmer bill missing Qt. heading')
      assert(html.includes('>Bags<') || html.includes('<th>Bags</th>') || html.includes('>Bags</th>'), 'farmer bill missing Bags column')
      assert(!html.includes('>Ext<') && !html.includes('>Ext</th>'), 'farmer bill still uses Ext heading')
      assert(html.includes('>Man<') || html.includes('<th>Man</th>') || html.includes('>Man</th>'), 'farmer bill missing Man column')
      assert(html.includes('>KGs<') || html.includes('>KGs</th>'), 'farmer bill missing KGs heading')
      assert(html.includes('width:21%'), 'farmer bill Gross column should be wider')
      assert(html.includes('width:13%'), 'farmer bill Commission column should be shorter')
      assert(html.includes('width:19%'), 'farmer bill Payable column should be wider')
      assert(!html.includes('Qty of one bag'), 'old Qty of one bag heading still present')
      assert(!html.includes('Extra KG'), 'old Extra KG heading still present')
      assert(!html.includes('Total man'), 'old combined Total man column still present')
      assert(!html.includes('10.05'), 'farmer bill still shows dotted man.extra format')
      assert(!html.includes('Extra KG stock record'), 'farmer bill still has Extra KG stock record table')
      assert(!html.includes('اضافی کلو اسٹاک ریکارڈ'), 'farmer bill still has Extra KG stock record table (Urdu)')
      assert(!html.includes('<th>Dheri</th>'), 'farmer bill still has Dheri column')
      assert(html.includes('aria-label="RTC"'), 'farmer bill missing RTC logo')
      assert(html.includes('copyright'), 'farmer bill missing copyright')
      assert(html.includes('غلّہ منڈی') || html.includes('Ghalla Mandi'), 'farmer bill missing Ghalla Mandi')
      assert(html.includes('All rights reserved'), 'farmer bill missing all rights reserved')
      assert(html.includes('size:3.5in 6.5in') || html.includes('size: 3.5in 6.5in'), 'farmer bill missing 3.5x6.5 page size')
      assert(html.includes('class="slip"'), 'farmer bill missing slip layout')
      assert(html.includes('Signature') || html.includes('دستخط'), 'farmer bill missing signature line')
      assert(html.includes('Gross'), 'farmer bill should still show Gross')
      assert(html.includes('Commission'), 'farmer bill missing Commission heading')
      assert(html.includes('Payable'), 'farmer bill should still show Payable')
      assert(html.includes('class="num money"'), 'farmer bill amounts must stay on one line')
      assert(html.includes('class="farmer-grid"'), 'farmer bill missing compact grid')
      assert(html.includes('class="product-over-cell"'), 'farmer bill missing product above first two columns')
      assert(html.includes(`colspan="2">${product.name}<`) || html.includes(product.name), 'farmer bill missing full product name above Bags and Ext')
      assert(!html.includes('class="product-name"'), 'farmer bill still shows product beside Address')
      assert(!html.includes('>Product</th>'), 'farmer bill still has a Product table column')
      assert(!html.includes('class="name"'), 'farmer bill still uses a product table column')
      assert(!html.includes('class="mark"'), 'farmer bill still uses product letter marks')
      assert(!html.includes('W Wheat'), 'farmer bill still shows W/P product key')
      assert(!html.includes('Qty of<br>'), 'farmer bill headings must stay on one line')
      assert(html.includes('#64748b'), 'farmer bill table lines should be darker')
      assert(html.includes('overflow:hidden'), 'farmer bill cells must stay inside their columns')
      assert(html.includes('font-size:6.5px') || html.includes('font-size:6.2px'), 'farmer bill table font should be one size smaller')
      assert(!html.includes('overflow:visible'), 'farmer bill cells still overflow into other columns')
      assert(html.includes('010'), 'farmer bill bags should use 3 digits')
      assert(html.includes('0400'), 'farmer bill rate should use 4 digits')

      const buyerHtml = await buyerBill(buyer.id, 'en')
      writeFileSync('/opt/cursor/artifacts/buyer_bill_layout.html', buyerHtml)
      assert(!buyerHtml.includes('buyer note should not appear'), 'buyer notes leaked onto bill')
      assert(!buyerHtml.includes('<th>Dheri</th>'), 'buyer bill still has Dheri column')
      assert(!buyerHtml.includes('Dheri date'), 'buyer bill still has Dheri date')
      assert(buyerHtml.includes('Bags'), 'buyer bill missing Bags column')
      assert(buyerHtml.includes('>Qt.<') || buyerHtml.includes('Qt.'), 'buyer bill missing Qt. heading')
      assert(buyerHtml.includes('class="product-over-cell"'), 'buyer bill missing product above first two columns')
      assert(buyerHtml.includes(product.name), 'buyer bill missing full product name')
      assert(!buyerHtml.includes('Qty of one bag'), 'buyer bill still has Qty of one bag heading')
      assert(!buyerHtml.includes('>Product</th>'), 'buyer bill still has a Product table column')
      assert(buyerHtml.includes('aria-label="RTC"'), 'buyer bill missing RTC logo')
      assert(!buyerHtml.includes('Buyer Bill / Payment Receipt'), 'buyer bill still has module title')
      assert(!html.includes('Wheat Khata · Company'), 'farmer bill should not stamp Wheat Khata labels')
      assert(!buyerHtml.includes('Wheat Khata · Party'), 'buyer bill should not stamp Wheat Khata labels')

      console.log('farmer/buyer bill layout OK')
      console.log('printed header sample:', html.match(/<div class="dates">[\s\S]*?<\/div>/)?.[0])
    } finally {
      for (const row of stockQtyBefore) {
        await prisma.stock.update({
          where: { id: row.id },
          data: { quantity: row.quantity as never },
        })
      }
      if (ids.dheriIds.length) {
        await prisma.stockLot.deleteMany({ where: { dheriId: { in: ids.dheriIds } } })
        await prisma.stockTransaction.deleteMany({ where: { dheriId: { in: ids.dheriIds } } })
        await prisma.payment.deleteMany({ where: { dheriId: { in: ids.dheriIds } } })
        await prisma.dheri.deleteMany({ where: { id: { in: ids.dheriIds } } })
      }
      if (ids.buyerId) await prisma.buyer.deleteMany({ where: { id: ids.buyerId } })
      if (ids.farmerId) {
        await prisma.payment.deleteMany({ where: { farmerId: ids.farmerId } })
        await prisma.farmer.deleteMany({ where: { id: ids.farmerId } })
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
