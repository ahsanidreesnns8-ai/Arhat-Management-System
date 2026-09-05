/**
 * Stock sell check: bags × bag weight vs Extra KG.
 * Usage: cd web && npx tsx scripts/smoke-stock-weight.ts
 */
import { d, round2, stockCoversRequestedKg, totalWeight } from '../src/server/money'

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message)
}

const needed = totalWeight(2, 49.5, 0)
assert(needed.toFixed(2) === '99.00', `2 × 49.5 should be 99.00 kg, got ${needed.toFixed(2)}`)
assert(round2(d(99)).add(d('0.01')).gte(needed), '99 kg + 0.01 slack must cover 2 × 49.5')

const exact = stockCoversRequestedKg(99, 2, 49.5)
assert(exact.covers, '99 kg must be enough for 2 bags of 49.5 kg')
assert(exact.neededKg === 99, `needed kg expected 99 got ${exact.neededKg}`)
assert(exact.bagsPossible === 2, `possible bags expected 2 got ${exact.bagsPossible}`)

const short = stockCoversRequestedKg(98.9, 2, 49.5)
assert(!short.covers, '98.9 kg must not cover 99 kg')
assert(short.bagsPossible === 1, `98.9 kg should form 1 bag of 49.5, got ${short.bagsPossible}`)

const slack = stockCoversRequestedKg(98.995, 2, 49.5)
assert(slack.covers, '0.01 kg rounding slack should allow 98.995 kg to cover 99 kg')

console.log('stock weight OK', exact)
console.log('SMOKE PASS')
