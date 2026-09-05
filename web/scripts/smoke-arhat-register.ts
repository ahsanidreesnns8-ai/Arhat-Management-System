/**
 * Demo-only smoke for Arhat Register + farmer bill man/qty columns.
 * Usage: cd web && npx tsx scripts/smoke-arhat-register.ts
 */
import { config } from 'dotenv'
config({ path: '.env' })

import { prisma } from '../src/server/db'
import { formatMann, splitMann, farmerBill, registerPartyBill, registerBookBill, accountBalanceBillByFarmer } from '../src/server/services/bills'
import { createFarmer, getFarmer } from '../src/server/services/farmers'
import { createDheri } from '../src/server/services/dheris'
import { normalizeAccountKey } from '../src/server/ids'
import { getAccountStatement } from '../src/server/services/linked-account'
import { search as systemSearch } from '../src/server/services/search'
import {
  createParty,
  createEntry,
  addPersonAmounts,
  listEntries,
  listParties,
  getPartyLedger,
  zakatSummary,
  updateParty,
  updateEntry,
  deleteParty,
} from '../src/server/services/register'
import { runWithWorkspace } from '../src/server/workspace'

const stamp = `REG${Date.now().toString().slice(-8)}`

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message)
}

async function main() {
  assert(formatMann(400, 5) === '10.05', `mann format expected 10.05 got ${formatMann(400, 5)}`)
  assert(formatMann(5600, 34) === '140.34', `mann format expected 140.34 got ${formatMann(5600, 34)}`)
  const split405 = splitMann(405)
  assert(split405.man.toFixed(0) === '10' && split405.extraKg.toFixed(0) === '5', '405 kg should be 10 man and 5 kg')
  const split434 = splitMann(434)
  assert(split434.man.toFixed(0) === '10' && split434.extraKg.toFixed(0) === '34', '434 kg should be 10 man and 34 kg')

  await runWithWorkspace('demo', async () => {
    const ids = {
      farmerId: undefined as bigint | undefined,
      partyId: undefined as bigint | undefined,
      entryIds: [] as bigint[],
      linkedPartyId: undefined as bigint | undefined,
      linkedFarmerId: undefined as bigint | undefined,
      searchFarmerId: undefined as bigint | undefined,
      linkedDheriId: undefined as bigint | undefined,
      linkedDheriId2: undefined as bigint | undefined,
    }
    try {
      const person = await createParty({
        kind: 'GIVING',
        name: `Register Person ${stamp}`,
        address: 'Lahore',
        notes: '',
      })
      ids.partyId = BigInt(person.id)
      const given = await createEntry({
        kind: 'GIVING',
        partyId: person.id,
        amount: 1500,
        notes: 'shop help',
      })
      ids.entryIds.push(BigInt(given.id))
      assert(given.amount === 1500, 'giving amount not stored')
      assert(given.day && given.date && given.time, 'giving entry missing day/date/time')

      const receivedAgain = await createEntry({
        kind: 'RECEIVING',
        partyId: person.id,
        amount: 800,
        notes: 'first receive',
      })
      ids.entryIds.push(BigInt(receivedAgain.id))
      const receivedMore = await createEntry({
        kind: 'RECEIVING',
        partyId: person.id,
        amount: 200,
        notes: 'second receive',
      })
      ids.entryIds.push(BigInt(receivedMore.id))

      const reused = await createParty({
        kind: 'RECEIVING',
        name: `Register Person ${stamp}`,
        address: 'Lahore',
      })
      assert(reused.id === person.id, 'same person name must reuse the existing account')

      const ledger = await getPartyLedger(person.id)
      assert(ledger.givenTotal === 1500, `given total expected 1500 got ${ledger.givenTotal}`)
      assert(ledger.receivedTotal === 1000, `received total expected 1000 got ${ledger.receivedTotal}`)
      assert(ledger.balance === -500, `net expected -500 got ${ledger.balance}`)
      assert(ledger.receivedCount === 2, 'two receive lines should count')
      assert((ledger.entries || []).length === 3, 'ledger should include give and receive lines')

      const people = await listParties('RECEIVING')
      const card = people.find((row) => row.id === person.id)
      assert(card?.receivedTotal === 1000, 'person card received total should update')
      assert(card?.givenTotal === 1500, 'person card given total should update')

      const book = await registerBookBill('en')
      assert(book.includes(`Register Person ${stamp}`), 'book ledger missing person name')
      assert(book.includes('Giving amount'), 'book ledger missing giving column')
      assert(book.includes('Receiving amount'), 'book ledger missing receiving column')
      assert(book.includes('Total receiving amount'), 'book ledger missing receiving total')
      assert(book.includes('Total giving amount'), 'book ledger missing giving total')
      assert(book.includes('Remaining amount'), 'book ledger missing remaining')
      assert(book.includes('Total amount'), 'book ledger missing total amount')

      const statement = await registerPartyBill(person.id, 'en')
      assert(statement.includes('Register Person'), 'statement missing person name')
      assert(!statement.includes('first receive'), 'statement should not mix receive lines when given is larger')
      assert(!statement.includes('second receive'), 'statement should not mix receive lines when given is larger')
      assert(statement.includes('shop help'), 'statement missing given note')
      assert(statement.includes('Total given'), 'statement missing given total')
      assert(!statement.includes('Total received'), 'statement should not print received when given is larger')
      assert(!statement.includes('Received from them'), 'statement should not print received header when given is larger')
      assert(statement.includes('Given to them'), 'statement missing given header')
      assert(!statement.includes('Owner received more'), 'statement should not mix received wording')
      assert(!statement.includes('Arhat Register Statement'), 'register bill still has module title')
      assert(!statement.includes('Wheat Khata ·'), 'register bill should not stamp Wheat Khata labels')

      const extraGiven = await addPersonAmounts({
        partyId: person.id,
        givenAmount: 25,
        notes: 'extra given',
      })
      ids.entryIds.push(...extraGiven.entries.map((row) => BigInt(row.id)))
      assert(extraGiven.person.givenTotal === 1525, `extra give expected 1525 got ${extraGiven.person.givenTotal}`)
      assert(extraGiven.person.receivedTotal === 1000, `received should stay 1000 got ${extraGiven.person.receivedTotal}`)

      let bothRejected = false
      try {
        await addPersonAmounts({
          partyId: person.id,
          receivedAmount: 50,
          givenAmount: 25,
          notes: 'both',
        })
      } catch (error) {
        bothRejected = String(error).includes('not both')
      }
      assert(bothRejected, 'saving received and given together must be rejected')

      const receivedParty = await createParty({ kind: 'RECEIVING', name: `Recv ${stamp}` })
      const received = await createEntry({
        kind: 'RECEIVING',
        partyId: receivedParty.id,
        amount: 800,
      })
      ids.entryIds.push(BigInt(received.id))
      const recvStatement = await registerPartyBill(receivedParty.id, 'en')
      assert(recvStatement.includes('Received from them'), 'receive-only bill missing received header')
      assert(recvStatement.includes('Total received'), 'receive-only bill missing received total')
      assert(!recvStatement.includes('Given to them'), 'receive-only bill should not print given header')
      assert(!recvStatement.includes('Total given'), 'receive-only bill should not print given total')

      const renamed = await updateParty(receivedParty.id, { name: `Recv ${stamp} B` })
      assert(renamed.name === `Recv ${stamp} B`, 'person name should edit in place')
      const flipped = await updateEntry(received.id, { kind: 'GIVING', amount: 900 })
      assert(flipped.kind === 'GIVING', 'mistaken receive should move to given')
      assert(flipped.amount === 900, 'edited amount should save')
      const afterFlip = await getPartyLedger(receivedParty.id)
      assert(afterFlip.receivedTotal === 0, `flip should clear received, got ${afterFlip.receivedTotal}`)
      assert(afterFlip.givenTotal === 900, `flip should put 900 on given, got ${afterFlip.givenTotal}`)
      const peopleAfterFlip = await listParties('RECEIVING')
      const flippedCard = peopleAfterFlip.find((row) => row.id === receivedParty.id)
      assert(flippedCard?.givenTotal === 900, 'list totals should match the flipped amount')
      assert((flippedCard?.receivedTotal || 0) === 0, 'list received total should be zero after flip')

      await deleteParty(receivedParty.id)
      const peopleAfterDelete = await listParties('RECEIVING')
      assert(!peopleAfterDelete.some((row) => row.id === receivedParty.id), 'deleted person should leave the register list')
      const listedAfterDelete = await listEntries('GIVING')
      assert(!listedAfterDelete.some((row) => row.id === received.id), 'deleted person amounts should leave history')

      const zakat = await createEntry({ kind: 'ZAKAT', amount: 250 })
      ids.entryIds.push(BigInt(zakat.id))
      const summary = await zakatSummary()
      assert(summary.allTime >= 250, 'zakat total missing')
      assert(summary.last12Months >= 250, 'zakat year window missing')

      const farmer = await createFarmer({
        name: `Adv Farmer ${stamp}`,
        code: `AF-${stamp}`,
        city: 'Okara',
      })
      ids.farmerId = BigInt(farmer.id)
      const advance = await createEntry({
        kind: 'FARMER_ADVANCE',
        farmerId: farmer.id,
        amount: 1000,
        notes: 'seed advance',
      })
      ids.entryIds.push(BigInt(advance.id))
      const html = await farmerBill(farmer.id, 'en')
      assert(html.includes('seed advance'), 'advance note missing from farmer bill')
      assert(html.includes('Advance'), 'advance reference missing from farmer bill')
      assert(html.includes('aria-label="RTC"'), 'RTC logo missing on farmer bill')
      assert(html.includes('Created by AI'), 'farmer bill missing Created by AI credit')
      assert(html.includes('Ahsan Idrees'), 'farmer bill missing creator name')
      assert(html.includes('+923224398646'), 'farmer bill missing creator contact')

      assert(normalizeAccountKey('r74.1') === 'R74.1', 'farmer id case should match register id')
      assert(normalizeAccountKey('R 74.1') === 'R74.1', 'spaces in the same id should still match')

      const searchFarmer = await createFarmer({
        name: `RANA ALLAHWASYA ${stamp}`,
        code: `R${stamp.slice(-4)}.A`,
      })
      ids.searchFarmerId = BigInt(searchFarmer.id)
      const listedPeople = await listParties('GIVING')
      const foundById = listedPeople.find(
        (row) =>
          row.ownerCode === searchFarmer.farmerId ||
          row.farmerCode === searchFarmer.farmerId ||
          row.linkedFarmerId === searchFarmer.id,
      )
      assert(foundById, `new farmer ${searchFarmer.farmerId} must appear on Arhat Register`)
      const hay = [
        foundById.name,
        foundById.ownerCode,
        foundById.farmerCode,
        foundById.farmerName,
      ].join(' ').toLowerCase()
      assert(
        hay.includes(searchFarmer.farmerId.toLowerCase()),
        `Arhat Register search must find ${searchFarmer.farmerId}`,
      )

      const linkedCode = `R${stamp.slice(-6)}`
      const linkedParty = await createParty({ kind: 'GIVING', name: linkedCode })
      ids.linkedPartyId = BigInt(linkedParty.id)
      const givenToId = await createEntry({
        kind: 'GIVING',
        partyId: linkedParty.id,
        amount: 80000,
      })
      ids.entryIds.push(BigInt(givenToId.id))
      const linkedFarmer = await createFarmer({
        name: `Aw ${stamp}`,
        code: linkedCode.toLowerCase(),
      })
      ids.linkedFarmerId = BigInt(linkedFarmer.id)
      assert(linkedFarmer.registerPartyId === linkedParty.id, 'farmer page should find the register person by ID')
      assert(linkedFarmer.registerGiven === 80000, `farmer should see register given, got ${linkedFarmer.registerGiven}`)

      const product = await prisma.product.findFirst({ where: { deleted: false, active: true } })
      assert(product, 'need a product to record farmer product against the same ID')
      const dheri = await createDheri({
        farmerId: linkedFarmer.id,
        productId: Number(product.id),
        dheriCode: `L${stamp.slice(-6)}`,
        numberOfBags: 100,
        weightPerBag: 40,
        partialBagWeight: 0,
        marketRate: 1562.5,
      })
      ids.linkedDheriId = BigInt(dheri.id)
      assert(Math.abs(dheri.farmerReceivable - 150000) < 1, `example product should be 150000, got ${dheri.farmerReceivable}`)
      const afterProduct = await getPartyLedger(linkedParty.id)
      assert(afterProduct.linkedFarmerId === linkedFarmer.id, 'register search should link the farmer by ID')
      assert(afterProduct.cashGivenTotal === 80000, 'cash given should stay on the ID')
      assert(afterProduct.displayLabel === 'Remaining to give', `card should say remaining to give, got ${afterProduct.displayLabel}`)
      assert(Math.abs((afterProduct.givenTotal || 0) - 70000) < 1, `remaining to give should be 70000 got ${afterProduct.givenTotal}`)
      const farmerAfter = await getFarmer(linkedFarmer.id)
      assert(Math.abs((farmerAfter.accountBalance || 0) - 150000) < 1, 'farmer eye remaining is product only')
      const account = await getAccountStatement(linkedCode)
      assert(Math.abs(account.remainingToGive - 70000) < 1, `balance remaining to give 70000 got ${account.remainingToGive}`)
      const balanceHtml = await accountBalanceBillByFarmer(linkedFarmer.id, 'en')
      assert(balanceHtml.includes('70000') || balanceHtml.includes('70,000') || balanceHtml.includes('70000'), 'balance bill missing remaining 70000')
      assert(balanceHtml.includes('80000') || balanceHtml.includes('80,000'), 'balance bill missing register given')
      const found = await systemSearch(linkedCode)
      assert(
        found.some((row) => row.type === 'ACCOUNT' && /70,?000/.test(row.subtitle)),
        'system search by ID should show remaining',
      )

      const dheri2 = await createDheri({
        farmerId: linkedFarmer.id,
        productId: Number(product.id),
        dheriCode: `M${stamp.slice(-6)}`,
        numberOfBags: 3,
        weightPerBag: 40,
        partialBagWeight: 0,
        marketRate: 400,
      })
      ids.linkedDheriId2 = BigInt(dheri2.id)
      const afterSecond = await getPartyLedger(linkedParty.id)
      assert(afterSecond.productCount === 2, `each visit should keep its own product, got ${afterSecond.productCount}`)
      assert(
        Math.abs(afterSecond.productTotal - (dheri.farmerReceivable + dheri2.farmerReceivable)) < 0.05,
        'second product should add to the same ID without replacing the first',
      )
      const productLines = (afterSecond.entries || []).filter((row) => row.kind === 'PRODUCT')
      assert(productLines.length === 2, 'register details should list both products separately')
      const farmerAfterSecond = await getFarmer(linkedFarmer.id)
      assert(
        Math.abs((farmerAfterSecond.accountBalance || 0) - (dheri.farmerReceivable + dheri2.farmerReceivable)) < 1,
        'farmer eye remaining should stay product-only after the second dheri',
      )
      const afterSecondStatement = await getAccountStatement(linkedCode)
      const expectedGive = dheri.farmerReceivable + dheri2.farmerReceivable - 80000
      assert(Math.abs(afterSecondStatement.remainingToGive - expectedGive) < 1, 'second product should add to remaining')

      const listed = await listEntries('GIVING')
      assert(listed.some((row) => row.id === given.id), 'giving history missing')
      console.log('arhat register OK', given.id, received.id, zakat.id, advance.id)
    } finally {
      if (ids.entryIds.length) {
        await prisma.registerEntry.deleteMany({ where: { id: { in: ids.entryIds } } })
      }
      if (ids.linkedDheriId || ids.linkedDheriId2) {
        const dheriIds = [ids.linkedDheriId, ids.linkedDheriId2].filter((id): id is bigint => id != null)
        await prisma.queueEntry.deleteMany({ where: { dheriId: { in: dheriIds } } })
        await prisma.stockLot.deleteMany({ where: { dheriId: { in: dheriIds } } })
        await prisma.stockTransaction.deleteMany({ where: { dheriId: { in: dheriIds } } })
        await prisma.payment.deleteMany({ where: { dheriId: { in: dheriIds } } })
        await prisma.dheri.deleteMany({ where: { id: { in: dheriIds } } })
      }
      if (ids.partyId) {
        await prisma.registerParty.deleteMany({
          where: { OR: [{ id: ids.partyId }, { name: { contains: stamp } }] },
        })
      } else {
        await prisma.registerParty.deleteMany({ where: { name: { contains: stamp } } })
      }
      if (ids.linkedPartyId) {
        await prisma.registerParty.deleteMany({ where: { id: ids.linkedPartyId } })
      }
      if (ids.farmerId) {
        await prisma.payment.deleteMany({ where: { farmerId: ids.farmerId } })
        await prisma.farmer.deleteMany({ where: { id: ids.farmerId } })
      }
      if (ids.linkedFarmerId) {
        await prisma.payment.deleteMany({ where: { farmerId: ids.linkedFarmerId } })
        await prisma.farmer.deleteMany({ where: { id: ids.linkedFarmerId } })
      }
      if (ids.searchFarmerId) {
        await prisma.registerParty.deleteMany({ where: { linkedFarmerId: ids.searchFarmerId } })
        await prisma.farmer.deleteMany({ where: { id: ids.searchFarmerId } })
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
