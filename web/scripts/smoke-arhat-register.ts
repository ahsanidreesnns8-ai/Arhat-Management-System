/**
 * Demo-only smoke for Arhat Register + farmer bill man/qty columns.
 * Usage: cd web && npx tsx scripts/smoke-arhat-register.ts
 */
import { config } from 'dotenv'
config({ path: '.env' })

import { prisma } from '../src/server/db'
import { formatMann, farmerBill, registerPartyBill } from '../src/server/services/bills'
import { createFarmer } from '../src/server/services/farmers'
import {
  createParty,
  createEntry,
  listEntries,
  listParties,
  getPartyLedger,
  zakatSummary,
} from '../src/server/services/register'
import { runWithWorkspace } from '../src/server/workspace'

const stamp = `REG${Date.now().toString().slice(-8)}`

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message)
}

async function main() {
  assert(formatMann(400, 5) === '10.05', `mann format expected 10.05 got ${formatMann(400, 5)}`)
  assert(formatMann(5600, 34) === '140.34', `mann format expected 140.34 got ${formatMann(5600, 34)}`)

  await runWithWorkspace('demo', async () => {
    const ids = {
      farmerId: undefined as bigint | undefined,
      partyId: undefined as bigint | undefined,
      entryIds: [] as bigint[],
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

      const statement = await registerPartyBill(person.id, 'en')
      assert(statement.includes('Register Person'), 'statement missing person name')
      assert(statement.includes('first receive'), 'statement missing first receive note')
      assert(statement.includes('second receive'), 'statement missing second receive note')
      assert(statement.includes('shop help'), 'statement missing given note')
      assert(statement.includes('Total received'), 'statement missing received total')
      assert(statement.includes('Total given'), 'statement missing given total')
      assert(statement.includes('Owner gave more'), 'statement missing net label')

      const receivedParty = await createParty({ kind: 'RECEIVING', name: `Recv ${stamp}` })
      const received = await createEntry({
        kind: 'RECEIVING',
        partyId: receivedParty.id,
        amount: 800,
      })
      ids.entryIds.push(BigInt(received.id))

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

      const listed = await listEntries('GIVING')
      assert(listed.some((row) => row.id === given.id), 'giving history missing')
      console.log('arhat register OK', given.id, received.id, zakat.id, advance.id)
    } finally {
      if (ids.entryIds.length) {
        await prisma.registerEntry.deleteMany({ where: { id: { in: ids.entryIds } } })
      }
      if (ids.partyId) {
        await prisma.registerParty.deleteMany({
          where: { OR: [{ id: ids.partyId }, { name: { contains: stamp } }] },
        })
      } else {
        await prisma.registerParty.deleteMany({ where: { name: { contains: stamp } } })
      }
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
