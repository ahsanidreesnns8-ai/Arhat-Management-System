/**
 * Name matching for owner-shop Rana cleanup. No database required.
 * Usage: cd web && npx tsx scripts/smoke-purge-rana-names.ts
 */
import { isShopPurgePersonName } from '../src/lib/shop-purge-names'

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message)
}

assert(isShopPurgePersonName('Rana Ghulam Mustafa'), 'exact Ghulam Mustafa')
assert(isShopPurgePersonName('rana  ghulam  mustafa'), 'spaces and case')
assert(isShopPurgePersonName('Rana Allahwasya'), 'exact Allahwasya')
assert(isShopPurgePersonName('Rana Allah wasya'), 'Allah wasya with space')
assert(isShopPurgePersonName('Rana Allah Wasaya'), 'Allah Wasaya spelling')
assert(!isShopPurgePersonName('Rana Ghulam Mustafa REG123'), 'test copies with digits stay')
assert(!isShopPurgePersonName('Rana Ali'), 'other Ranas stay')
assert(!isShopPurgePersonName('Ali Ahmad'), 'unrelated names stay')
console.log('purge name match OK')
