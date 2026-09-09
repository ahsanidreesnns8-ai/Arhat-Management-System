import { normalizeAccountKey } from '@/lib/account-key'

/** Mixed people to remove from the owner shop. */
export const SHOP_PURGE_NAMES = ['Rana Ghulam Mustafa', 'Rana Allahwasya']

const EXACT = new Set([
  'RANAGHULAMMUSTAFA',
  'RANAALLAHWASYA',
  'RANAALLAHWASAYA',
])

/**
 * Same person even with extra spaces or Allah wasya / Allahwasya / Allah Wasaya.
 * Names with digits (test copies) are left alone so they can be re-added later.
 */
export function isShopPurgePersonName(name: string | null | undefined) {
  const key = normalizeAccountKey(name)
  if (!key || /\d/.test(key)) return false
  if (EXACT.has(key)) return true
  if (key.startsWith('RANAGHULAMMUSTAFA')) return true
  if (key.startsWith('RANAALLAHWASYA') || key.startsWith('RANAALLAHWASAYA')) return true
  return false
}
