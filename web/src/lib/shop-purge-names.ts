import { normalizeAccountKey } from '@/lib/account-key'

/** Mixed people to remove from the owner shop. */
export const SHOP_PURGE_NAMES = ['Rana Ghulam Mustafa', 'Rana Ghalam Mustafa', 'Rana Allahwasya']

/**
 * Same person even with extra spaces or shop spellings:
 * Ghulam / Ghalam, Allah wasya / Allahwasya / Allah Wasaya.
 * Names with digits (test copies) are left alone so they can be re-added later.
 */
export function isShopPurgePersonName(name: string | null | undefined) {
  const key = normalizeAccountKey(name)
  if (!key || /\d/.test(key) || !key.startsWith('RANA')) return false
  if (key.includes('MUSTAFA') && (key.includes('GHULAM') || key.includes('GHALAM') || key.includes('GHLAM'))) {
    return true
  }
  if (key.includes('ALLAHWASYA') || key.includes('ALLAHWASAYA')) return true
  return false
}
