const DRAFT_KEY = 'rehmani_arhat_register_draft'

export type RegisterDraftSection = 'PEOPLE' | 'LEDGER' | 'ZAKAT' | 'ADVANCE'
export type RegisterDraftMoneyKind = 'GIVING' | 'RECEIVING'

export type RegisterDraft = {
  section?: RegisterDraftSection
  search?: string
  personOpen?: boolean
  giveOpen?: boolean
  zakatOpen?: boolean
  advanceOpen?: boolean
  editOpen?: boolean
  person?: { code: string; name: string; address: string; notes: string }
  money?: { partyId: string; amount: string; notes: string; kind: RegisterDraftMoneyKind }
  zakatForm?: { amount: string; notes: string }
  advance?: { farmerId: string; amount: string; notes: string }
  editForm?: {
    id: number
    code: string
    name: string
    address: string
    notes: string
    lines: Array<{ id: number; amount: string; kind: RegisterDraftMoneyKind; notes: string; delete?: boolean }>
  }
}

function storageKey(workspace?: string | null, username?: string | null) {
  return `${DRAFT_KEY}:${workspace || 'live'}:${username || 'owner'}`
}

export function loadRegisterDraft(workspace?: string | null, username?: string | null): RegisterDraft | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(storageKey(workspace, username))
    if (!raw) return null
    const parsed = JSON.parse(raw) as RegisterDraft
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

export function saveRegisterDraft(
  draft: RegisterDraft,
  workspace?: string | null,
  username?: string | null,
) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(storageKey(workspace, username), JSON.stringify(draft))
  } catch {
    /* quota / private mode — keep working without a draft */
  }
}

export function clearRegisterDraft(workspace?: string | null, username?: string | null) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(storageKey(workspace, username))
  } catch {
    /* ignore */
  }
}

export function draftHasTypedValues(draft: RegisterDraft | null) {
  if (!draft) return false
  const person = draft.person
  const money = draft.money
  const zakat = draft.zakatForm
  const advance = draft.advance
  const edit = draft.editForm
  return Boolean(
    person?.code?.trim()
    || person?.name?.trim()
    || person?.address?.trim()
    || person?.notes?.trim()
    || money?.amount?.trim()
    || money?.notes?.trim()
    || money?.partyId
    || zakat?.amount?.trim()
    || zakat?.notes?.trim()
    || advance?.farmerId
    || advance?.amount?.trim()
    || advance?.notes?.trim()
    || edit?.id
    || edit?.name?.trim()
    || edit?.code?.trim()
    || (edit?.lines || []).length
    || draft.personOpen
    || draft.giveOpen
    || draft.zakatOpen
    || draft.advanceOpen
    || draft.editOpen,
  )
}
