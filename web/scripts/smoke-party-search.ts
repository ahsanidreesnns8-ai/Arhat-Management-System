/**
 * Type-ahead: "ahs" matches Ahsan first.
 * Usage: cd web && npx tsx scripts/smoke-party-search.ts
 */
import { matchPartyQuery, partyDetailsLine } from '../src/client/lib/party-search'

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message)
}

const parties = [
  { id: '1', code: 'F-01', name: 'Ahsan Ali', fatherName: 'Idrees', address: 'Ghalla Mandi', city: 'Nankana' },
  { id: '2', code: 'F-02', name: 'Ahmed Khan', fatherName: 'Noor', city: 'Lahore' },
  { id: '3', code: 'F-03', name: 'Bilal', city: 'Faisalabad' },
]

const ahs = matchPartyQuery(parties, 'ahs')
assert(ahs.length === 1 && ahs[0].name === 'Ahsan Ali', `ahs should hit Ahsan, got ${ahs.map((p) => p.name).join(',')}`)
const ah = matchPartyQuery(parties, 'ah')
assert(ah[0]?.name === 'Ahsan Ali', 'Ahsan should rank first on ah (starts-with)')
assert(ah.some((p) => p.name === 'Ahmed Khan'), 'Ahmed should match ah')
const details = partyDetailsLine(parties[0])
assert(details.includes('F-01'), 'details missing code')
assert(details.includes('Idrees'), 'details missing father')
console.log('party search OK', ahs[0].name, details)
console.log('SMOKE PASS')
