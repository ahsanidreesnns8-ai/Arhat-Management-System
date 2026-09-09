/**
 * Demo-only smoke for Arhat Register + farmer bill man/qty columns.
 * Usage: cd web && npx tsx scripts/smoke-arhat-register.ts
 */
import { config } from 'dotenv'
config({ path: '.env' })

import { prisma } from '../src/server/db'
import { formatMann, splitMann, farmerBill, registerPartyBill, registerBookBill, accountBalanceBillByFarmer, accountBalanceBillByParty } from '../src/server/services/bills'
import { createFarmer, getFarmer, listFarmers, updateFarmer } from '../src/server/services/farmers'
import { createBuyer } from '../src/server/services/buyers'
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
      hideFarmerId: undefined as bigint | undefined,
      ranaMustafaId: undefined as bigint | undefined,
      ranaAllahId: undefined as bigint | undefined,
      partyId: undefined as bigint | undefined,
      entryIds: [] as bigint[],
      linkedPartyId: undefined as bigint | undefined,
      linkedFarmerId: undefined as bigint | undefined,
      searchFarmerId: undefined as bigint | undefined,
      linkedDheriId: undefined as bigint | undefined,
      linkedDheriId2: undefined as bigint | undefined,
      twinAId: undefined as bigint | undefined,
      twinBId: undefined as bigint | undefined,
      twinBuyerAId: undefined as bigint | undefined,
      twinBuyerBId: undefined as bigint | undefined,
      twinDheriAId: undefined as bigint | undefined,
      twinDheriBId: undefined as bigint | undefined,
      soloFarmerId: undefined as bigint | undefined,
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

      const addPersonName = `Add Person ${stamp}`
      const addCodeA = `RA${stamp.slice(-6)}`
      const addCodeB = `RB${stamp.slice(-6)}`
      const addA = await createParty({
        kind: 'RECEIVING',
        name: addPersonName,
        code: addCodeA,
      })
      const addB = await createParty({
        kind: 'RECEIVING',
        name: addPersonName,
        code: addCodeB,
      })
      assert(addA.id !== addB.id, 'Add Person with the same name and different IDs must create two people')
      assert(
        normalizeAccountKey(addA.ownerCode) === normalizeAccountKey(addCodeA),
        `first Add Person must keep ID ${addCodeA}`,
      )
      assert(
        normalizeAccountKey(addB.ownerCode) === normalizeAccountKey(addCodeB),
        `second Add Person must keep ID ${addCodeB}`,
      )
      const addAAgain = await createParty({
        kind: 'RECEIVING',
        name: addPersonName,
        code: addCodeA,
      })
      assert(addAAgain.id === addA.id, 'Add Person with the same ID must reopen that person')
      let idClash = ''
      try {
        await updateParty(addB.id, { name: addPersonName, code: addCodeA })
        idClash = 'ok'
      } catch (err) {
        idClash = err instanceof Error ? err.message : String(err)
      }
      assert(idClash !== 'ok', 'two people must not be allowed to share one ID')
      assert(/already has this ID/i.test(idClash), `expected ID clash, got ${idClash}`)
      const listedTwins = await listParties('RECEIVING')
      const listedA = listedTwins.find((row) => row.id === addA.id)
      const listedB = listedTwins.find((row) => row.id === addB.id)
      assert(listedA && listedB && listedA.id !== listedB.id, 'both Add Person IDs must stay on the register')
      const cashOnA = await createEntry({ kind: 'RECEIVING', partyId: addA.id, amount: 500, notes: 'id-a cash' })
      const cashOnB = await createEntry({ kind: 'GIVING', partyId: addB.id, amount: 120, notes: 'id-b cash' })
      ids.entryIds.push(BigInt(cashOnA.id), BigInt(cashOnB.id))
      const ledA = await getPartyLedger(addA.id)
      const ledB = await getPartyLedger(addB.id)
      assert(ledA.cashReceivedTotal === 500, 'received cash must stay on the first ID')
      assert((ledB.cashReceivedTotal || 0) === 0, 'second ID must not inherit received cash')
      assert(ledB.cashGivenTotal === 120, 'given cash must stay on the second ID')
      assert((ledA.cashGivenTotal || 0) === 0, 'first ID must not inherit given cash')
      assert((ledA.productTotal || 0) === 0 && (ledB.productTotal || 0) === 0, 'register-only IDs must not pick up another person product')
      const cardsAfterCash = await listParties('RECEIVING')
      const cardA = cardsAfterCash.find((row) => row.id === addA.id)
      const cardB = cardsAfterCash.find((row) => row.id === addB.id)
      assert(cardA?.cashReceivedTotal === 500, 'register card received total must follow the first ID')
      assert(cardB?.cashGivenTotal === 120, 'register card given total must follow the second ID')
      const stmtA = await getAccountStatement(addCodeA, addPersonName)
      const stmtB = await getAccountStatement(addCodeB, addPersonName)
      assert(stmtA.cashReceived === 500 && stmtA.cashGiven === 0, 'balance for the first ID must not include the second ID')
      assert(stmtB.cashGiven === 120 && stmtB.cashReceived === 0, 'balance for the second ID must not include the first ID')
      assert(stmtA.partyId === addA.id && stmtB.partyId === addB.id, 'statements must open the matching person ID')
      const billA = await accountBalanceBillByParty(addA.id, 'en')
      assert(billA.includes('500'), 'first ID balance bill must show its received amount')
      assert(!billA.includes('120'), 'first ID balance bill must not show the other ID given amount')
      const foundIdA = await systemSearch(addCodeA)
      assert(
        foundIdA.some((row) => row.type === 'ACCOUNT' && /500/.test(row.subtitle) && !/Given Rs 120/.test(row.subtitle)),
        'search by ID must show only that ID remaining/cash',
      )
      const sameNameFarmer = await createFarmer({ name: addPersonName, code: `SF${stamp.slice(-4)}` })
      ids.soloFarmerId = BigInt(sameNameFarmer.id)
      const extraCash = await createEntry({ kind: 'RECEIVING', partyId: addA.id, amount: 15, notes: 'still this ID' })
      ids.entryIds.push(BigInt(extraCash.id))
      assert(extraCash.farmerId == null, 'cash on a register ID must not attach a farmer just because the name matches')
      const ledAAfterFarmer = await getPartyLedger(addA.id)
      assert(ledAAfterFarmer.linkedFarmerId !== sameNameFarmer.id, 'same-name farmer must stay on their own ID')
      console.log('add person IDs OK', addA.ownerCode, addB.ownerCode)

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

      const hideFarmer = await createFarmer({
        name: `Hide ${stamp}`,
        code: `H${stamp.slice(-6)}`,
      })
      ids.hideFarmerId = BigInt(hideFarmer.id)
      const hideListed = await listParties('RECEIVING')
      const hideCard = hideListed.find((row) => row.linkedFarmerId === hideFarmer.id)
      assert(hideCard, 'farmer must appear on Arhat Register with a real person')
      assert(hideCard.id !== hideFarmer.id, 'register person id must not be the farmer row id')
      const hideLedger = await getPartyLedger(hideCard.id)
      assert(hideLedger.id === hideCard.id, 'details/edit must open the real register person')
      const hideCash = await createEntry({
        kind: 'RECEIVING',
        partyId: hideCard.id,
        amount: 40,
        notes: 'register cash on farmer card',
      })
      ids.entryIds.push(BigInt(hideCash.id))
      await deleteParty(hideCard.id)
      await listFarmers()
      const stillHidden = await listParties('RECEIVING')
      assert(
        !stillHidden.some((row) => row.id === hideCard.id || row.linkedFarmerId === hideFarmer.id),
        'loading farmers must not put a deleted register person back',
      )
      const farmersAfterHide = await listFarmers()
      assert(
        !farmersAfterHide.some((row) => row.id === hideFarmer.id),
        'register delete must also remove the farmer from the shop',
      )
      const freshPerson = await createParty({ kind: 'RECEIVING', name: hideFarmer.name })
      assert(freshPerson.id !== hideCard.id, 'adding the same name again must create a new person ID')
      ids.entryIds = ids.entryIds.filter((id) => id !== BigInt(hideCash.id))
      await deleteParty(freshPerson.id)

      const ranaMustafa = await createFarmer({
        name: `Rana Ghulam Mustafa ${stamp}`,
        code: `RG${stamp.slice(-4)}`,
      })
      const ranaAllah = await createFarmer({
        name: `Rana Allahwasya ${stamp}`,
        code: `RA${stamp.slice(-4)}`,
      })
      ids.ranaMustafaId = BigInt(ranaMustafa.id)
      ids.ranaAllahId = BigInt(ranaAllah.id)
      const ranaList = await listParties('RECEIVING')
      const mustafaCard = ranaList.find((row) => row.linkedFarmerId === ranaMustafa.id)
      const allahCard = ranaList.find((row) => row.linkedFarmerId === ranaAllah.id)
      assert(mustafaCard && allahCard, 'each Rana farmer must have their own register person')
      assert(mustafaCard.id !== allahCard.id, 'Rana names must not share one register person')
      const mustafaCash = await createEntry({ kind: 'RECEIVING', partyId: mustafaCard.id, amount: 100 })
      const allahCash = await createEntry({ kind: 'RECEIVING', partyId: allahCard.id, amount: 50 })
      ids.entryIds.push(BigInt(mustafaCash.id), BigInt(allahCash.id))
      const mustafaLedger = await getPartyLedger(mustafaCard.id)
      const allahLedger = await getPartyLedger(allahCard.id)
      assert(mustafaLedger.cashReceivedTotal === 100, 'Mustafa cash must stay on Mustafa')
      assert(allahLedger.cashReceivedTotal === 50, 'Allahwasya cash must stay on Allahwasya')
      assert(mustafaLedger.linkedFarmerId === ranaMustafa.id, 'Mustafa register must link to Mustafa farmer')
      assert(allahLedger.linkedFarmerId === ranaAllah.id, 'Allahwasya register must link to Allahwasya farmer')

      const sameName = `Ali Ahmad ${stamp}`
      const twinA = await createFarmer({ name: sameName, code: `TA${stamp.slice(-4)}` })
      const twinB = await createFarmer({ name: sameName, code: `TB${stamp.slice(-4)}` })
      ids.twinAId = BigInt(twinA.id)
      ids.twinBId = BigInt(twinB.id)
      const twinList = await listParties('RECEIVING')
      const twinACards = twinList.filter((row) => row.linkedFarmerId === twinA.id)
      const twinBCards = twinList.filter((row) => row.linkedFarmerId === twinB.id)
      assert(twinACards.length === 1 && twinBCards.length === 1, 'same name + different IDs must each have one register card')
      const twinACard = twinACards[0]
      const twinBCard = twinBCards[0]
      assert(twinACard.id !== twinBCard.id, 'identical names must not share one register person')
      assert(twinACard.ownerCode === twinA.farmerId, 'first Ali card must keep its own farmer ID')
      assert(twinBCard.ownerCode === twinB.farmerId, 'second Ali card must keep its own farmer ID')
      const twinACash = await createEntry({ kind: 'RECEIVING', partyId: twinACard.id, amount: 300, notes: 'ali-a cash' })
      const twinBCash = await createEntry({ kind: 'GIVING', partyId: twinBCard.id, amount: 80, notes: 'ali-b cash' })
      ids.entryIds.push(BigInt(twinACash.id), BigInt(twinBCash.id))
      const twinProduct = await prisma.product.findFirst({ where: { deleted: false, active: true } })
      assert(twinProduct, 'need a product to keep same-name farmer product on the matching ID')
      const twinDheriA = await createDheri({
        farmerId: twinA.id,
        productId: Number(twinProduct.id),
        dheriCode: `PA${stamp.slice(-6)}`,
        numberOfBags: 2,
        weightPerBag: 40,
        partialBagWeight: 0,
        marketRate: 400,
      })
      const twinDheriB = await createDheri({
        farmerId: twinB.id,
        productId: Number(twinProduct.id),
        dheriCode: `PB${stamp.slice(-6)}`,
        numberOfBags: 5,
        weightPerBag: 40,
        partialBagWeight: 0,
        marketRate: 400,
      })
      ids.twinDheriAId = BigInt(twinDheriA.id)
      ids.twinDheriBId = BigInt(twinDheriB.id)
      const twinALedger = await getPartyLedger(twinACard.id)
      const twinBLedger = await getPartyLedger(twinBCard.id)
      assert(twinALedger.cashReceivedTotal === 300, 'Ali A cash must stay on Ali A')
      assert((twinBLedger.cashReceivedTotal || 0) === 0, 'Ali B must not inherit Ali A received cash')
      assert(twinBLedger.cashGivenTotal === 80, 'Ali B cash must stay on Ali B')
      assert((twinALedger.cashGivenTotal || 0) === 0, 'Ali A must not inherit Ali B given cash')
      assert(Math.abs((twinALedger.productTotal || 0) - twinDheriA.farmerReceivable) < 1, 'Ali A product must stay on Ali A')
      assert(Math.abs((twinBLedger.productTotal || 0) - twinDheriB.farmerReceivable) < 1, 'Ali B product must stay on Ali B')
      const twinAStatement = await getAccountStatement(twinA.farmerId, sameName)
      const twinBStatement = await getAccountStatement(twinB.farmerId, sameName)
      assert(twinAStatement.cashReceived === 300, 'Ali A statement cash must follow Ali A ID')
      assert(twinBStatement.cashGiven === 80, 'Ali B statement cash must follow Ali B ID')
      assert(Math.abs(twinAStatement.productTotal - twinDheriA.farmerReceivable) < 1, 'Ali A statement product must follow Ali A ID')
      assert(Math.abs(twinBStatement.productTotal - twinDheriB.farmerReceivable) < 1, 'Ali B statement product must follow Ali B ID')
      const renamedTwin = await updateParty(twinACard.id, { name: sameName, address: 'Okara A' })
      assert(renamedTwin.id === twinACard.id, 'edit must update this ID in place')
      const twinBAfterEdit = await getPartyLedger(twinBCard.id)
      assert(twinBAfterEdit.cashGivenTotal === 80, 'editing Ali A must not change Ali B')
      assert(twinBAfterEdit.linkedFarmerId === twinB.id, 'Ali B must keep its own farmer link after Ali A edit')
      const updatedTwinFarmer = await updateFarmer(twinA.id, { name: sameName, code: twinA.farmerId, city: 'Nankana' })
      assert(updatedTwinFarmer.farmerId === twinA.farmerId, 'farmer update must keep this ID')
      const twinListAfterUpdate = await listParties('RECEIVING')
      const twinAAfterUpdate = twinListAfterUpdate.find((row) => row.linkedFarmerId === twinA.id)
      const twinBAfterUpdate = twinListAfterUpdate.find((row) => row.linkedFarmerId === twinB.id)
      assert(twinAAfterUpdate && twinBAfterUpdate && twinAAfterUpdate.id !== twinBAfterUpdate.id, 'farmer update must not merge same-name IDs')
      const foundTwinA = await systemSearch(twinA.farmerId)
      const foundTwinB = await systemSearch(twinB.farmerId)
      assert(
        foundTwinA.some((row) => row.type === 'FARMER' && row.id === twinA.farmerId),
        'search by Ali A ID must find Ali A',
      )
      assert(
        foundTwinB.some((row) => row.type === 'FARMER' && row.id === twinB.farmerId),
        'search by Ali B ID must find Ali B',
      )
      const twinBuyerA = await createBuyer({ name: sameName, code: `BA${stamp.slice(-4)}` })
      const twinBuyerB = await createBuyer({ name: sameName, code: `BB${stamp.slice(-4)}` })
      ids.twinBuyerAId = BigInt(twinBuyerA.id)
      ids.twinBuyerBId = BigInt(twinBuyerB.id)
      const twinBuyerList = await listParties('RECEIVING')
      const twinBuyerACard = twinBuyerList.find((row) => row.linkedBuyerId === twinBuyerA.id)
      const twinBuyerBCard = twinBuyerList.find((row) => row.linkedBuyerId === twinBuyerB.id)
      assert(twinBuyerACard && twinBuyerBCard, 'same-name buyers with different IDs must each have a register card')
      assert(twinBuyerACard.id !== twinBuyerBCard.id, 'same-name buyers must not share one register person')
      assert(twinBuyerACard.id !== twinACard.id && twinBuyerACard.id !== twinBCard.id, 'buyer ID must not attach to a farmer of the same name')
      console.log('same-name different IDs OK', twinA.farmerId, twinB.farmerId, twinBuyerA.buyerId, twinBuyerB.buyerId)

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
      const productAmt = dheri.farmerReceivable
      assert(Math.abs(productAmt - 150000) <= 1, `example product should be about 150000, got ${productAmt}`)
      const afterProduct = await getPartyLedger(linkedParty.id)
      assert(afterProduct.linkedFarmerId === linkedFarmer.id, 'register search should link the farmer by ID')
      assert(afterProduct.cashGivenTotal === 80000, 'cash given should stay on the ID')
      assert(afterProduct.displayLabel === 'Remaining to give', `card should say remaining to give, got ${afterProduct.displayLabel}`)
      const remainingGive = productAmt - 80000
      assert(Math.abs((afterProduct.givenTotal || 0) - remainingGive) < 1, `remaining to give should be ${remainingGive} got ${afterProduct.givenTotal}`)
      const farmerAfter = await getFarmer(linkedFarmer.id)
      assert(Math.abs((farmerAfter.accountBalance || 0) - productAmt) < 1, 'farmer eye remaining is product only')
      const account = await getAccountStatement(linkedCode)
      assert(Math.abs(account.remainingToGive - remainingGive) < 1, `balance remaining to give ${remainingGive} got ${account.remainingToGive}`)
      const balanceHtml = await accountBalanceBillByFarmer(linkedFarmer.id, 'en')
      const remainingShown = String(Math.round(remainingGive))
      assert(
        balanceHtml.includes(remainingShown) || balanceHtml.includes(Number(remainingShown).toLocaleString('en-US')),
        `balance bill missing remaining ${remainingShown}`,
      )
      assert(balanceHtml.includes('80000') || balanceHtml.includes('80,000'), 'balance bill missing register given')
      const found = await systemSearch(linkedCode)
      assert(
        found.some((row) => row.type === 'ACCOUNT' && row.subtitle.includes(remainingShown)),
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
      if (ids.linkedDheriId || ids.linkedDheriId2 || ids.twinDheriAId || ids.twinDheriBId) {
        const dheriIds = [ids.linkedDheriId, ids.linkedDheriId2, ids.twinDheriAId, ids.twinDheriBId].filter(
          (id): id is bigint => id != null,
        )
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
      if (ids.ranaMustafaId) {
        await prisma.registerEntry.deleteMany({
          where: { party: { linkedFarmerId: ids.ranaMustafaId } },
        })
        await prisma.registerParty.deleteMany({ where: { linkedFarmerId: ids.ranaMustafaId } })
        await prisma.payment.deleteMany({ where: { farmerId: ids.ranaMustafaId } })
        await prisma.farmer.deleteMany({ where: { id: ids.ranaMustafaId } })
      }
      if (ids.ranaAllahId) {
        await prisma.registerEntry.deleteMany({
          where: { party: { linkedFarmerId: ids.ranaAllahId } },
        })
        await prisma.registerParty.deleteMany({ where: { linkedFarmerId: ids.ranaAllahId } })
        await prisma.payment.deleteMany({ where: { farmerId: ids.ranaAllahId } })
        await prisma.farmer.deleteMany({ where: { id: ids.ranaAllahId } })
      }
      if (ids.hideFarmerId) {
        await prisma.registerParty.deleteMany({ where: { linkedFarmerId: ids.hideFarmerId } })
        await prisma.payment.deleteMany({ where: { farmerId: ids.hideFarmerId } })
        await prisma.farmer.deleteMany({ where: { id: ids.hideFarmerId } })
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
      for (const farmerId of [ids.twinAId, ids.twinBId, ids.soloFarmerId]) {
        if (!farmerId) continue
        await prisma.registerEntry.deleteMany({ where: { party: { linkedFarmerId: farmerId } } })
        await prisma.registerParty.deleteMany({ where: { linkedFarmerId: farmerId } })
        await prisma.payment.deleteMany({ where: { farmerId } })
        await prisma.farmer.deleteMany({ where: { id: farmerId } })
      }
      for (const buyerId of [ids.twinBuyerAId, ids.twinBuyerBId]) {
        if (!buyerId) continue
        await prisma.registerEntry.deleteMany({ where: { party: { linkedBuyerId: buyerId } } })
        await prisma.registerParty.deleteMany({ where: { linkedBuyerId: buyerId } })
        await prisma.payment.deleteMany({ where: { buyerId } })
        await prisma.buyer.deleteMany({ where: { id: buyerId } })
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
