/**
 * Client-side batch scoping helpers (no database).
 * Usage: cd web && npx tsx scripts/smoke-daily-trade-scope.ts
 */
import {
  boardMatchesSelectedBatch,
  nextSelectedBatchId,
  pickSelectedBatch,
  receivesForBatch,
  salesForBatch,
  sameId,
} from '../src/client/pages/dailyTradeScope'

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

const batches = [
  { id: 11, batchNumber: 1 },
  { id: 22, batchNumber: 2 },
  { id: 55, batchNumber: 5 },
]

assert(sameId('11', 11), 'sameId must treat string/number ids as equal')
assert(pickSelectedBatch(batches, 11)?.batchNumber === 1, 'pick batch 1')
assert(pickSelectedBatch(batches, '55')?.batchNumber === 5, 'pick batch 5 by string id')
assert(nextSelectedBatchId(batches, 11) === 11, 'keep tapped batch 1')
assert(nextSelectedBatchId(batches, 55) === 55, 'keep tapped batch 5')
assert(nextSelectedBatchId([{ id: 55, batchNumber: 5 }], 11) === 11, 'do not fall back to batch 5')
assert(nextSelectedBatchId(batches, null) === 11, 'default to first/lowest batch')
assert(boardMatchesSelectedBatch(11, 11), 'scoped board matches tap')
assert(!boardMatchesSelectedBatch(55, 11), 'batch 5 payload must not apply while batch 1 is tapped')
assert(!boardMatchesSelectedBatch(null, 11), 'unscoped payload must not apply while a batch is tapped')

const receives = [
  { id: 1, dayBatchId: 11, dheriId: 'A' },
  { id: 2, dayBatchId: 55, dheriId: 'B' },
  { id: 3, dayBatchId: '11', dheriId: 'C' },
]
const b1 = receivesForBatch(receives, 11)
assert(b1.length === 2 && b1.every((r) => Number(r.dayBatchId) === 11), 'receives for batch 1 only')
assert(receivesForBatch(receives, 55).every((r) => Number(r.dayBatchId) === 55), 'receives for batch 5 only')

const sales = [
  {
    id: 9,
    items: [
      { dayBatchId: 11, dheriId: 1 },
      { dayBatchId: 55, dheriId: 2 },
    ],
  },
]
const b1Sales = salesForBatch(sales, 11, [1, 3])
assert(b1Sales.length === 1 && b1Sales[0].items.length === 1, 'sale lines for batch 1 only')
assert(b1Sales[0].items[0].dayBatchId === 11, 'must drop batch 5 sale lines')

console.log('OK daily trade scope helpers')
