import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookOpen, ClipboardList, Eye, HandCoins, Landmark, Pencil, Plus, Printer, Search, Sprout, Trash2, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { TableSkeleton } from '../components/ui/Skeleton'
import { farmerApi, registerApi, billApi } from '../services/api'
import { billErrorMessage, openHtmlBill } from '../utils/bill'
import { formatCurrency } from '../utils/format'
import { useAuth } from '../context/AuthContext'
import { isOwnerFinanceRole } from '../../lib/roles'
import { Navigate, Link, useSearchParams } from 'react-router-dom'
import type { Farmer, RegisterEntry, RegisterParty, ZakatSummary } from '../types'
import PartyCombobox from '../components/forms/PartyCombobox'

type Section = 'PEOPLE' | 'LEDGER' | 'ZAKAT' | 'ADVANCE'
type MoneyKind = 'GIVING' | 'RECEIVING'

type MoneySide = {
  kind: MoneyKind | null
  label: string
  amount: number
  count: number
}

type EditLine = {
  id: number
  amount: string
  kind: MoneyKind
  notes: string
  delete?: boolean
}

function moneySide(
  received: number,
  given: number,
  receivedCount = 0,
  givenCount = 0,
): MoneySide {
  const net = received - given
  if (net > 0) {
    return { kind: 'RECEIVING', label: 'Received', amount: net, count: receivedCount }
  }
  if (net < 0) {
    return { kind: 'GIVING', label: 'Given', amount: -net, count: givenCount }
  }
  return { kind: null, label: 'Settled', amount: 0, count: 0 }
}

function partyAccountCode(party: Pick<RegisterParty, 'ownerCode' | 'farmerCode' | 'buyerCode'>) {
  return party.ownerCode || party.farmerCode || party.buyerCode || ''
}

function matchesSearch(party: RegisterParty, query: string) {
  if (!query) return true
  const code = partyAccountCode(party)
  const blob = [
    party.name,
    party.address || '',
    party.notes || '',
    code,
    party.ownerCode || '',
    party.farmerCode || '',
    party.farmerName || '',
    party.buyerCode || '',
    party.buyerName || '',
  ].join(' ').toLowerCase()
  const compact = blob.replace(/\s+/g, '')
  const q = query.toLowerCase()
  const qCompact = q.replace(/\s+/g, '')
  return (
    blob.includes(q) ||
    compact.includes(qCompact) ||
    code.replace(/\s+/g, '').toLowerCase().includes(qCompact)
  )
}

function kindLabel(kind: string) {
  if (kind === 'RECEIVING') return 'Received'
  if (kind === 'GIVING') return 'Given'
  if (kind === 'PRODUCT') return 'Product'
  if (kind === 'SOLD') return 'Sold'
  if (kind === 'FARMER_PAID') return 'Paid to farmer'
  if (kind === 'BUYER_PAID') return 'Paid by buyer'
  return kind
}

function kindTone(kind: string) {
  if (kind === 'RECEIVING' || kind === 'PRODUCT' || kind === 'BUYER_PAID') {
    return 'text-emerald-700 dark:text-emerald-400'
  }
  if (kind === 'GIVING' || kind === 'SOLD' || kind === 'FARMER_PAID') {
    return 'text-rose-700 dark:text-rose-400'
  }
  return 'text-slate-600'
}

function isCashKind(kind: string) {
  return kind === 'RECEIVING' || kind === 'GIVING'
}

function sideNote(party: Pick<RegisterParty, 'receivedTotal' | 'givenTotal'>, kind?: MoneyKind) {
  const received = party.receivedTotal || 0
  const given = party.givenTotal || 0
  if (kind === 'RECEIVING') return `Received ${formatCurrency(received)}`
  if (kind === 'GIVING') return `Given ${formatCurrency(given)}`
  const side = moneySide(received, given)
  if (!side.kind) return side.label
  return `${side.label} ${formatCurrency(side.amount)}`
}

function apiError(err: unknown, fallback: string) {
  const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
  return msg || fallback
}

function partyFrame(party: Pick<RegisterParty, 'receivedTotal' | 'givenTotal' | 'receivedCount' | 'givenCount' | 'displayLabel'>): MoneySide {
  const side = moneySide(
    party.receivedTotal || 0,
    party.givenTotal || 0,
    party.receivedCount || 0,
    party.givenCount || 0,
  )
  if (party.displayLabel) return { ...side, label: party.displayLabel }
  return side
}

function byNameThenAmount(a: RegisterParty, b: RegisterParty) {
  const name = a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })
  if (name !== 0) return name
  return partyFrame(a).amount - partyFrame(b).amount
}

function isProductLinked(p: RegisterParty) {
  return Boolean(
    p.linkedFarmerId ||
    p.linkedBuyerId ||
    (p.productTotal || 0) > 0 ||
    (p.soldTotal || 0) > 0,
  )
}

function AccountBreakdown({ party }: { party: RegisterParty }) {
  const side = partyFrame(party)
  const tradeLines = (party.entries || []).filter((row) => !isCashKind(row.kind))
  return (
    <div className="rounded-xl border border-slate-200 dark:border-white/10 p-3 text-sm space-y-1">
      <p className="font-semibold">{side.kind ? `${side.label} ${formatCurrency(side.amount)}` : 'Settled'}</p>
      {(party.remainingToGive || 0) > 0 ? (
        <p className="text-rose-700 dark:text-rose-400">Remaining to give {formatCurrency(party.remainingToGive || 0)}</p>
      ) : null}
      {(party.remainingToReceive || 0) > 0 ? (
        <p className="text-emerald-700 dark:text-emerald-400">Remaining to receive {formatCurrency(party.remainingToReceive || 0)}</p>
      ) : null}
      <p className="text-slate-500">
        Cash received {formatCurrency(party.cashReceivedTotal || 0)} · Cash given {formatCurrency(party.cashGivenTotal || 0)}
      </p>
      {(party.productTotal || 0) > 0 ? (
        <p className="text-slate-500">
          Product in {formatCurrency(party.productTotal || 0)}
          {party.productCount ? ` · ${party.productCount} dheri${party.productCount === 1 ? '' : 's'}` : ''}
        </p>
      ) : null}
      {(party.soldTotal || 0) > 0 ? <p className="text-slate-500">Sold {formatCurrency(party.soldTotal || 0)}</p> : null}
      {(party.farmerPaid || 0) > 0 ? <p className="text-slate-500">Paid to farmer {formatCurrency(party.farmerPaid || 0)}</p> : null}
      {(party.buyerPaid || 0) > 0 ? <p className="text-slate-500">Paid by buyer {formatCurrency(party.buyerPaid || 0)}</p> : null}
      {party.linkedFarmerId ? (
        <Link className="text-primary text-xs font-semibold inline-block" to={`/farmers/${party.linkedFarmerId}`}>
          Farmer product (eye) for {party.farmerName} ({party.farmerCode})
        </Link>
      ) : null}
      {party.linkedBuyerId ? (
        <Link className="text-primary text-xs font-semibold inline-block" to={`/buyers/${party.linkedBuyerId}`}>
          Buyer sales for {party.buyerName} ({party.buyerCode})
        </Link>
      ) : null}
      {tradeLines.length ? (
        <div className="pt-2 space-y-1">
          {tradeLines.map((row) => (
            <p key={`${row.kind}-${row.id}`} className="text-[12px] text-slate-500">
              {kindLabel(row.kind)} · {formatCurrency(row.amount)} · {row.notes || '—'}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default function ArhatRegisterPage() {
  const { user } = useAuth()
  const isOwner = isOwnerFinanceRole(user?.role)
  const [searchParams] = useSearchParams()
  const [section, setSection] = useState<Section>('PEOPLE')
  const [parties, setParties] = useState<RegisterParty[]>([])
  const [entries, setEntries] = useState<RegisterEntry[]>([])
  const [zakat, setZakat] = useState<ZakatSummary | null>(null)
  const [farmers, setFarmers] = useState<Farmer[]>([])
  const [loading, setLoading] = useState(true)

  const [personOpen, setPersonOpen] = useState(false)
  const [giveOpen, setGiveOpen] = useState(false)
  const [zakatOpen, setZakatOpen] = useState(false)
  const [advanceOpen, setAdvanceOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [person, setPerson] = useState({ name: '', address: '', notes: '' })
  const [money, setMoney] = useState({ partyId: '', amount: '', notes: '', kind: 'GIVING' as MoneyKind })
  const [zakatForm, setZakatForm] = useState({ amount: '', notes: '' })
  const [advance, setAdvance] = useState({ farmerId: '', amount: '', notes: '' })
  const [search, setSearch] = useState(() => searchParams.get('q') || '')
  const [editOpen, setEditOpen] = useState(false)
  const [editLedger, setEditLedger] = useState<RegisterParty | null>(null)
  const [editForm, setEditForm] = useState({
    id: 0,
    name: '',
    address: '',
    notes: '',
    lines: [] as EditLine[],
  })
  const [deletePartyId, setDeletePartyId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (section === 'ZAKAT') {
        const res = await registerApi.zakat()
        setZakat(res.data.data || null)
        setEntries(res.data.data?.entries || [])
      } else if (section === 'ADVANCE') {
        const [e, f] = await Promise.all([registerApi.entries('FARMER_ADVANCE'), farmerApi.getAll()])
        setEntries(e.data.data || [])
        setFarmers(f.data.data || [])
      } else if (section === 'LEDGER') {
        const p = await registerApi.parties('RECEIVING')
        setParties(p.data.data || [])
        setEntries([])
      } else {
        const [p] = await Promise.all([
          registerApi.parties('RECEIVING'),
        ])
        setParties(p.data.data || [])
        const merged = (p.data.data || [])
          .flatMap((row) => (row.entries || []).filter((line) => isCashKind(line.kind)))
          .sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          )
        setEntries(merged)
      }
    } catch (err: unknown) {
      toast.error(apiError(err, 'Could not load register'))
    } finally {
      setLoading(false)
    }
  }, [section])

  useEffect(() => { void load() }, [load])

  const selectedParty = useMemo(
    () => parties.find((p) => String(p.id) === money.partyId) || null,
    [parties, money.partyId],
  )

  const query = search.trim().toLowerCase()
  const visibleParties = useMemo(
    () => [...parties].filter((p) => matchesSearch(p, query)).sort(byNameThenAmount),
    [parties, query],
  )
  const ledgerPeople = useMemo(
    () => [...parties].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })),
    [parties],
  )
  const receivedPeople = visibleParties.filter((p) => partyFrame(p).kind === 'RECEIVING')
  const givenPeople = visibleParties.filter((p) => partyFrame(p).kind === 'GIVING')
  const settledPeople = visibleParties.filter((p) => partyFrame(p).kind == null)
  const receivedTotal = receivedPeople.reduce((sum, p) => sum + partyFrame(p).amount, 0)
  const givenTotal = givenPeople.reduce((sum, p) => sum + partyFrame(p).amount, 0)
  const searchHits = query ? visibleParties : []
  const ledgerGiven = ledgerPeople.reduce((sum, p) => sum + (p.givenTotal || 0), 0)
  const ledgerReceived = ledgerPeople.reduce((sum, p) => sum + (p.receivedTotal || 0), 0)
  const ledgerRemaining = Math.abs(ledgerReceived - ledgerGiven)
  const ledgerTotal = ledgerReceived + ledgerGiven
  const historyRows = section === 'PEOPLE' && query
    ? visibleParties
        .flatMap((p) => p.entries || [])
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    : entries

  if (!isOwner) return <Navigate to="/dashboard" replace />

  const openMoney = (kind: MoneyKind, partyId = '') => {
    setMoney({ partyId, amount: '', notes: '', kind })
    setGiveOpen(true)
  }

  const openEdit = async (party: RegisterParty) => {
    try {
      const res = await registerApi.getParty(party.id)
      const ledger = res.data.data || party
      const lines = (ledger.entries || []).filter((row) => row.kind === 'RECEIVING' || row.kind === 'GIVING')
      setEditLedger(ledger)
      setEditForm({
        id: ledger.id,
        name: ledger.name,
        address: ledger.address || '',
        notes: ledger.notes || '',
        lines: lines.map((row) => ({
          id: row.id,
          amount: String(row.amount),
          kind: row.kind === 'GIVING' ? 'GIVING' : 'RECEIVING',
          notes: row.notes || '',
        })),
      })
      setEditOpen(true)
    } catch (err: unknown) {
      toast.error(apiError(err, 'Could not open this person'))
    }
  }

  const savePerson = async () => {
    if (!person.name.trim()) {
      toast.error('Name is required')
      return
    }
    setSaving(true)
    try {
      await registerApi.addParty({
        kind: 'RECEIVING',
        name: person.name.trim(),
        address: person.address.trim() || undefined,
        notes: person.notes.trim() || undefined,
      })
      toast.success('Person saved')
      setPerson({ name: '', address: '', notes: '' })
      setPersonOpen(false)
      void load()
    } catch (err: unknown) {
      toast.error(apiError(err, 'Could not add person'))
    } finally {
      setSaving(false)
    }
  }

  const saveMoney = async () => {
    const amount = Number(money.amount)
    if (!money.partyId) {
      toast.error('Choose a name first')
      return
    }
    if (!amount || amount <= 0) {
      toast.error('Enter the amount')
      return
    }
    setSaving(true)
    try {
      await registerApi.addEntry({
        kind: money.kind,
        partyId: Number(money.partyId),
        amount,
        notes: money.notes.trim() || undefined,
      })
      toast.success(money.kind === 'RECEIVING' ? 'Received amount saved' : 'Given amount saved')
      setMoney({ partyId: '', amount: '', notes: '', kind: money.kind })
      setGiveOpen(false)
      void load()
    } catch (err: unknown) {
      toast.error(apiError(err, 'Could not save amount'))
    } finally {
      setSaving(false)
    }
  }

  const saveEdit = async () => {
    if (!editForm.name.trim()) {
      toast.error('Name is required')
      return
    }
    const liveLines = editForm.lines.filter((line) => !line.delete)
    for (const line of liveLines) {
      const amount = Number(line.amount)
      if (!amount || amount <= 0) {
        toast.error('Each amount must be greater than zero')
        return
      }
    }
    setSaving(true)
    try {
      await registerApi.updateParty(editForm.id, {
        name: editForm.name.trim(),
        address: editForm.address.trim(),
        notes: editForm.notes.trim(),
        entries: editForm.lines.map((line) => ({
          id: line.id,
          amount: Number(line.amount),
          kind: line.kind,
          notes: line.notes.trim() || null,
          delete: line.delete || undefined,
        })),
      })
      toast.success('Person updated — totals recalculated')
      setEditOpen(false)
      void load()
    } catch (err: unknown) {
      toast.error(apiError(err, 'Could not save changes'))
    } finally {
      setSaving(false)
    }
  }

  const confirmDeleteParty = async () => {
    if (deletePartyId == null) return
    setSaving(true)
    try {
      await registerApi.deleteParty(deletePartyId)
      toast.success('Person removed from the register')
      setDeletePartyId(null)
      setEditOpen(false)
      void load()
    } catch (err: unknown) {
      toast.error(apiError(err, 'Could not delete person'))
    } finally {
      setSaving(false)
    }
  }

  const saveZakat = async () => {
    const amount = Number(zakatForm.amount)
    if (!amount || amount <= 0) {
      toast.error('Enter zakat amount')
      return
    }
    setSaving(true)
    try {
      await registerApi.addEntry({
        kind: 'ZAKAT',
        amount,
        notes: zakatForm.notes.trim() || undefined,
      })
      toast.success('Zakat recorded')
      setZakatForm({ amount: '', notes: '' })
      setZakatOpen(false)
      void load()
    } catch (err: unknown) {
      toast.error(apiError(err, 'Could not save zakat'))
    } finally {
      setSaving(false)
    }
  }

  const saveAdvance = async () => {
    const amount = Number(advance.amount)
    if (!advance.farmerId) {
      toast.error('Choose a farmer')
      return
    }
    if (!amount || amount <= 0) {
      toast.error('Enter the advance amount')
      return
    }
    setSaving(true)
    try {
      await registerApi.addEntry({
        kind: 'FARMER_ADVANCE',
        farmerId: Number(advance.farmerId),
        amount,
        notes: advance.notes.trim() || 'Advance payment',
      })
      toast.success('Advance saved — it will appear on the farmer bill')
      setAdvance({ farmerId: '', amount: '', notes: '' })
      setAdvanceOpen(false)
      void load()
    } catch (err: unknown) {
      toast.error(apiError(err, 'Could not save advance'))
    } finally {
      setSaving(false)
    }
  }

  const openEntryBill = async (row: RegisterEntry) => {
    try {
      if (row.partyId) {
        const res = await billApi.registerParty(row.partyId, 'en')
        openHtmlBill(typeof res.data === 'string' ? res.data : String(res.data), 'Bill')
        return
      }
      const res = await billApi.register(row.id, 'en')
      openHtmlBill(typeof res.data === 'string' ? res.data : String(res.data), 'Bill')
    } catch (err) {
      toast.error(billErrorMessage(err, 'Could not generate bill'))
    }
  }

  const openPartyBill = async (id: number) => {
    try {
      const res = await billApi.registerParty(id, 'en')
      openHtmlBill(typeof res.data === 'string' ? res.data : String(res.data), 'Bill')
    } catch (err) {
      toast.error(billErrorMessage(err, 'Could not generate bill'))
    }
  }

  const openBalanceBill = async (id: number) => {
    try {
      const res = await billApi.registerBalance(id, 'en')
      openHtmlBill(typeof res.data === 'string' ? res.data : String(res.data), 'Balance')
    } catch (err) {
      toast.error(billErrorMessage(err, 'Could not generate balance'))
    }
  }

  const openLedgerBill = async () => {
    try {
      const res = await billApi.registerBook('en')
      openHtmlBill(typeof res.data === 'string' ? res.data : String(res.data), 'Ledger')
    } catch (err) {
      toast.error(billErrorMessage(err, 'Could not generate ledger'))
    }
  }

  const historyTotal = entries.reduce((sum, row) => sum + (row.amount || 0), 0)

  const renderFrame = (p: RegisterParty) => {
    const side = partyFrame(p)
    return (
      <div key={p.id} className="card-3d p-4 space-y-3">
        <div>
          <p className="font-semibold truncate">{p.name}</p>
          {partyAccountCode(p) ? (
            <p className="text-[11px] font-medium text-[#002D62] dark:text-[#C5A059] truncate">ID {partyAccountCode(p)}</p>
          ) : null}
          <p className="text-[11px] text-slate-500 truncate">{p.address || p.notes || 'No address'}</p>
          {p.farmerName ? (
            <p className="text-[11px] text-slate-500 truncate">Farmer {p.farmerName}</p>
          ) : null}
          {p.buyerName ? (
            <p className="text-[11px] text-slate-500 truncate">Buyer {p.buyerName}</p>
          ) : null}
        </div>
        <div className={`rounded-lg px-3 py-2 text-[11px] ${
          side.kind === 'RECEIVING'
            ? 'bg-emerald-50 dark:bg-emerald-500/10'
            : side.kind === 'GIVING'
              ? 'bg-rose-50 dark:bg-rose-500/10'
              : 'bg-slate-50 dark:bg-white/5'
        }`}>
          <div className="text-slate-500">{side.label}</div>
          <div className={`font-semibold ${
            side.kind === 'RECEIVING'
              ? 'text-emerald-800 dark:text-emerald-300'
              : side.kind === 'GIVING'
                ? 'text-rose-800 dark:text-rose-300'
                : ''
          }`}>
            {formatCurrency(side.kind ? side.amount : 0)}
          </div>
          {side.kind ? (
            <div className="text-slate-500">{side.count} time{side.count === 1 ? '' : 's'}</div>
          ) : null}
          {(p.productTotal || 0) > 0 ? (
            <div className="text-slate-500 mt-1">Product {formatCurrency(p.productTotal || 0)}</div>
          ) : null}
          {(p.soldTotal || 0) > 0 ? (
            <div className="text-slate-500">Sold {formatCurrency(p.soldTotal || 0)}</div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {!isProductLinked(p) && (
            <>
              <Button size="sm" variant="secondary" onClick={() => openMoney('RECEIVING', String(p.id))}>
                <Wallet className="h-3.5 w-3.5" /> Receive
              </Button>
              <Button size="sm" variant="secondary" onClick={() => openMoney('GIVING', String(p.id))}>
                <HandCoins className="h-3.5 w-3.5" /> Give
              </Button>
            </>
          )}
          <Button size="sm" variant="ghost" onClick={() => void openEdit(p)}>
            <Eye className="h-3.5 w-3.5" /> Details
          </Button>
          {p.linkedFarmerId ? (
            <Link to={`/farmers/${p.linkedFarmerId}`} className="inline-flex">
              <Button size="sm" variant="secondary">
                Farmer
              </Button>
            </Link>
          ) : null}
          <Button size="sm" onClick={() => void openEdit(p)}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
          <Button size="sm" variant="danger" onClick={() => setDeletePartyId(p.id)}>
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
          <Button size="sm" variant="secondary" onClick={() => void openPartyBill(p.id)}>
            <Printer className="h-3.5 w-3.5" /> Bill
          </Button>
          <Button size="sm" variant="secondary" onClick={() => void openBalanceBill(p.id)}>
            Balance
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Arhat Register"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {([
          { id: 'PEOPLE' as const, label: 'People', icon: BookOpen },
          { id: 'LEDGER' as const, label: 'Ledger', icon: ClipboardList },
          { id: 'ZAKAT' as const, label: 'Zakat Amount', icon: Landmark },
          { id: 'ADVANCE' as const, label: 'Advance Payment To Farmer', icon: Sprout },
        ]).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSection(item.id)}
            className={`card-3d p-4 text-left transition ${
              section === item.id ? 'ring-2 ring-[#C5A059]' : 'hover:bg-slate-50 dark:hover:bg-white/5'
            }`}
          >
            <item.icon className="h-5 w-5 text-primary mb-2" />
            <p className="font-semibold">{item.label}</p>
          </button>
        ))}
      </div>

      {section === 'PEOPLE' && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => { setPerson({ name: '', address: '', notes: '' }); setPersonOpen(true) }}>
            <Plus className="h-4 w-4" /> Add Person
          </Button>
          <Button variant="secondary" onClick={() => openMoney('RECEIVING')}>
            <Wallet className="h-4 w-4" /> Receive amount
          </Button>
          <Button variant="secondary" onClick={() => openMoney('GIVING')}>
            <HandCoins className="h-4 w-4" /> Give amount
          </Button>
        </div>
      )}

      {section === 'LEDGER' && (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void openLedgerBill()} disabled={!parties.length}>
            <Printer className="h-4 w-4" /> Print ledger
          </Button>
        </div>
      )}

      {section === 'ZAKAT' && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => { setZakatForm({ amount: '', notes: '' }); setZakatOpen(true) }}>
            <Landmark className="h-4 w-4" /> Give Zakat
          </Button>
        </div>
      )}

      {section === 'ADVANCE' && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => { setAdvance({ farmerId: '', amount: '', notes: '' }); setAdvanceOpen(true) }}>
            <Sprout className="h-4 w-4" /> Give advance
          </Button>
        </div>
      )}

      {section === 'ZAKAT' && zakat && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="card-3d p-5">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total given (all time)</p>
            <p className="text-2xl font-bold text-primary mt-1">{formatCurrency(zakat.allTime)}</p>
          </div>
          <div className="card-3d p-5">
            <p className="text-xs uppercase tracking-wide text-slate-500">Last 12 months</p>
            <p className="text-2xl font-bold text-primary mt-1">{formatCurrency(zakat.last12Months)}</p>
            <p className="text-xs text-slate-500 mt-1">Resets on a rolling one-year window</p>
          </div>
        </div>
      )}

      {section === 'PEOPLE' && (
        <div className="card-3d p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 pl-10 pr-3 py-2.5 text-sm"
            />
          </div>
          {query ? (
            <div className="space-y-1">
              <p className="text-[11px] text-slate-500">
                {searchHits.length ? 'Tap a name to see details, edit, or delete.' : 'No name matches this search.'}
              </p>
              {searchHits.map((p) => {
                const side = partyFrame(p)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => void openEdit(p)}
                    className="w-full text-left rounded-lg px-3 py-2 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center justify-between gap-2"
                  >
                    <span className="min-w-0">
                      <span className="font-medium truncate block">{p.name}</span>
                      {partyAccountCode(p) ? (
                        <span className="text-[11px] font-medium text-[#002D62] dark:text-[#C5A059] truncate block">ID {partyAccountCode(p)}</span>
                      ) : null}
                      {p.farmerName ? (
                        <span className="text-[11px] text-slate-500 truncate block">Farmer {p.farmerName}</span>
                      ) : null}
                      {p.buyerName ? (
                        <span className="text-[11px] text-slate-500 truncate block">Buyer {p.buyerName}</span>
                      ) : null}
                    </span>
                    <span className="text-[11px] text-slate-500 shrink-0 text-right">
                      <span className="block">{side.kind ? `${side.label} ${formatCurrency(side.amount)}` : 'Settled'}</span>
                      {(p.productTotal || 0) > 0 ? (
                        <span className="block">Product {formatCurrency(p.productTotal || 0)}</span>
                      ) : null}
                      {(p.soldTotal || 0) > 0 ? (
                        <span className="block">Sold {formatCurrency(p.soldTotal || 0)}</span>
                      ) : null}
                    </span>
                  </button>
                )
              })}
              {searchHits.length === 1 ? (
                <AccountBreakdown party={searchHits[0]} />
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      {section === 'ADVANCE' && (
        <div className="card-3d p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total in this book</p>
          <p className="text-2xl font-bold text-primary mt-1">{formatCurrency(historyTotal)}</p>
        </div>
      )}

      {section === 'PEOPLE' && (
        loading ? (
          <div className="card-3d p-4"><TableSkeleton rows={3} /></div>
        ) : !parties.length ? (
          <p className="card-3d p-5 text-sm text-slate-500">Add a person first, then save an amount.</p>
        ) : !visibleParties.length ? (
          <p className="card-3d p-5 text-sm text-slate-500">No person matches this search.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="px-1 flex items-end justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Received</h3>
                    <p className="text-[11px] text-slate-500">Left side · names A to Z</p>
                  </div>
                  <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">{formatCurrency(receivedTotal)}</p>
                </div>
                {receivedPeople.length ? receivedPeople.map(renderFrame) : (
                  <p className="card-3d p-4 text-sm text-slate-500">No received names on this side.</p>
                )}
              </div>
              <div className="space-y-3">
                <div className="px-1 flex items-end justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-rose-800 dark:text-rose-300">Given</h3>
                    <p className="text-[11px] text-slate-500">Right side · names A to Z</p>
                  </div>
                  <p className="text-sm font-semibold text-rose-800 dark:text-rose-300">{formatCurrency(givenTotal)}</p>
                </div>
                {givenPeople.length ? givenPeople.map(renderFrame) : (
                  <p className="card-3d p-4 text-sm text-slate-500">No given names on this side.</p>
                )}
              </div>
            </div>
            {settledPeople.length ? (
              <div className="space-y-3">
                <div className="px-1">
                  <h3 className="text-sm font-semibold">Settled</h3>
                  <p className="text-[11px] text-slate-500">These names are even, so neither word is shown.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {settledPeople.map(renderFrame)}
                </div>
              </div>
            ) : null}
          </div>
        )
      )}

      {section === 'LEDGER' && (
        loading ? (
          <div className="card-3d p-4"><TableSkeleton rows={6} /></div>
        ) : !ledgerPeople.length ? (
          <p className="card-3d p-5 text-sm text-slate-500">No people in this ledger.</p>
        ) : (
          <div className="card-3d overflow-hidden">
            <div className="px-5 py-3 bg-[#002D62] text-white font-semibold flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-[#C5A059]" />
              Ledger
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-100 dark:border-white/10">
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">ID</th>
                    <th className="px-4 py-2 text-right">Giving amount</th>
                    <th className="px-4 py-2 text-right">Receiving amount</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerPeople.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100 dark:border-white/10">
                      <td className="px-4 py-2 font-medium">{p.name}</td>
                      <td className="px-4 py-2 text-slate-500">{partyAccountCode(p) || '—'}</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(p.givenTotal || 0)}</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(p.receivedTotal || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 p-4 border-t border-slate-100 dark:border-white/10 text-[12px]">
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-500/10 px-3 py-2">
                <div className="text-slate-500">Total receiving amount</div>
                <div className="font-semibold">{formatCurrency(ledgerReceived)}</div>
              </div>
              <div className="rounded-lg bg-rose-50 dark:bg-rose-500/10 px-3 py-2">
                <div className="text-slate-500">Total giving amount</div>
                <div className="font-semibold">{formatCurrency(ledgerGiven)}</div>
              </div>
              <div className="rounded-lg bg-slate-50 dark:bg-white/5 px-3 py-2">
                <div className="text-slate-500">Remaining amount</div>
                <div className="font-semibold">{formatCurrency(ledgerRemaining)}</div>
              </div>
              <div className="rounded-lg bg-slate-50 dark:bg-white/5 px-3 py-2">
                <div className="text-slate-500">Total amount</div>
                <div className="font-semibold">{formatCurrency(ledgerTotal)}</div>
              </div>
            </div>
          </div>
        )
      )}

      {section !== 'LEDGER' && (
      <div className="card-3d overflow-hidden">
        <div className="px-5 py-3 bg-[#002D62] text-white font-semibold flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-[#C5A059]" />
          History
        </div>
        {loading ? (
          <div className="p-4"><TableSkeleton rows={4} /></div>
        ) : !historyRows.length ? (
          <p className="p-5 text-sm text-slate-500">No entries yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100 dark:border-white/10">
                  <th className="px-4 py-2">Day</th>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Time</th>
                  <th className="px-4 py-2">Name</th>
                  {section === 'PEOPLE' && (
                    <th className="px-4 py-2">Type</th>
                  )}
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="px-4 py-2">Note</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {historyRows.map((row) => (
                  <tr key={`${row.kind}-${row.id}`} className="border-b border-slate-100 dark:border-white/10">
                    <td className="px-4 py-2">{row.day}</td>
                    <td className="px-4 py-2">{row.date}</td>
                    <td className="px-4 py-2">{row.time}</td>
                    <td className="px-4 py-2 font-medium">{row.partyName || (row.kind === 'ZAKAT' ? 'Zakat' : '—')}</td>
                    {section === 'PEOPLE' && (
                      <td className="px-4 py-2">
                        <span className={kindTone(row.kind)}>
                          {kindLabel(row.kind)}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-2 text-right font-semibold">{formatCurrency(row.amount)}</td>
                    <td className="px-4 py-2 text-slate-500">{row.notes || '—'}</td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        {section === 'PEOPLE' && row.partyId && isCashKind(row.kind) ? (
                          <Button
                            variant="ghost"
                            className="!py-1.5 !px-2"
                            onClick={() => {
                              const party = parties.find((p) => p.id === row.partyId)
                              if (party) void openEdit(party)
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </Button>
                        ) : null}
                        {isCashKind(row.kind) || row.kind === 'ZAKAT' || row.kind === 'FARMER_ADVANCE' ? (
                          <Button variant="secondary" className="!py-1.5 !px-2" onClick={() => void openEntryBill(row)}>
                            <Printer className="h-3.5 w-3.5" /> Bill
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      <Modal open={personOpen} onClose={() => setPersonOpen(false)} title="Add person">
        <div className="space-y-3">
          <Input label="Name *" value={person.name} onChange={(e) => setPerson({ ...person, name: e.target.value })} />
          <Input label="Address (optional)" value={person.address} onChange={(e) => setPerson({ ...person, address: e.target.value })} />
          <Input label="Note (optional)" value={person.notes} onChange={(e) => setPerson({ ...person, notes: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setPersonOpen(false)}>Cancel</Button>
            <Button onClick={() => void savePerson()} loading={saving}>Save person</Button>
          </div>
        </div>
      </Modal>

      <Modal open={giveOpen} onClose={() => setGiveOpen(false)} title={money.kind === 'RECEIVING' ? 'Receive amount' : 'Give amount'}>
        <div className="space-y-3">
          <PartyCombobox
            label="Name"
            required
            items={parties.map((p) => ({
              id: String(p.id),
              code: partyAccountCode(p) || undefined,
              name: partyAccountCode(p)
                ? `${p.name} · ${partyAccountCode(p)}`
                : p.name,
              address: p.address,
              notes: sideNote(p, money.kind),
            }))}
            value={money.partyId}
            onChange={(id) => setMoney({ ...money, partyId: id })}
            placeholder="Search"
            emptyLabel="Add a person first"
          />
          {selectedParty && (
            <div className="rounded-lg bg-slate-50 dark:bg-white/5 px-3 py-2 text-[12px] text-slate-600 dark:text-slate-300 space-y-1">
              <p>
                {selectedParty.farmerCode
                  ? `ID ${selectedParty.farmerCode}${selectedParty.farmerName ? ` · ${selectedParty.farmerName}` : ''}`
                  : selectedParty.name}
              </p>
              <p>
                Current {money.kind === 'RECEIVING' ? 'received' : 'given'} cash: {formatCurrency(
                  money.kind === 'RECEIVING'
                    ? (selectedParty.cashReceivedTotal ?? selectedParty.receivedTotal ?? 0)
                    : (selectedParty.cashGivenTotal ?? selectedParty.givenTotal ?? 0),
                )}
              </p>
              {(selectedParty.remainingToGive || 0) > 0 ? (
                <p>Remaining to give {formatCurrency(selectedParty.remainingToGive || 0)}</p>
              ) : null}
              {(selectedParty.remainingToReceive || 0) > 0 ? (
                <p>Remaining to receive {formatCurrency(selectedParty.remainingToReceive || 0)}</p>
              ) : null}
            </div>
          )}
          <Input
            label="Amount (PKR) *"
            type="number"
            min="0"
            value={money.amount}
            onChange={(e) => setMoney({ ...money, amount: e.target.value })}
          />
          <Input label="Note (optional)" value={money.notes} onChange={(e) => setMoney({ ...money, notes: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setGiveOpen(false)}>Cancel</Button>
            <Button onClick={() => void saveMoney()} loading={saving} disabled={!parties.length}>Save</Button>
          </div>
        </div>
      </Modal>

      <Modal open={editOpen} onClose={() => { setEditOpen(false); setEditLedger(null) }} title="Person details" size="lg">
        <div className="space-y-3">
          {editLedger ? <AccountBreakdown party={editLedger} /> : null}
          {editForm.id ? (
            <Button variant="secondary" onClick={() => void openBalanceBill(editForm.id)}>
              Print balance
            </Button>
          ) : null}
          <Input
            label="Name *"
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
          />
          <Input
            label="Address (optional)"
            value={editForm.address}
            onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
          />
          <Input
            label="Note (optional)"
            value={editForm.notes}
            onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
          />
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Amounts</h4>
            {!editForm.lines.length ? (
              <p className="text-sm text-slate-500">No amounts yet.</p>
            ) : editForm.lines.map((line, index) => (
              <div
                key={line.id}
                className={`rounded-xl border border-slate-200 dark:border-white/10 p-3 space-y-2 ${line.delete ? 'opacity-50' : ''}`}
              >
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={line.kind === 'RECEIVING' ? 'primary' : 'secondary'}
                    onClick={() => {
                      const lines = [...editForm.lines]
                      lines[index] = { ...line, kind: 'RECEIVING', delete: false }
                      setEditForm({ ...editForm, lines })
                    }}
                    disabled={line.delete}
                  >
                    Received
                  </Button>
                  <Button
                    size="sm"
                    variant={line.kind === 'GIVING' ? 'primary' : 'secondary'}
                    onClick={() => {
                      const lines = [...editForm.lines]
                      lines[index] = { ...line, kind: 'GIVING', delete: false }
                      setEditForm({ ...editForm, lines })
                    }}
                    disabled={line.delete}
                  >
                    Given
                  </Button>
                  <Button
                    size="sm"
                    variant={line.delete ? 'secondary' : 'danger'}
                    onClick={() => {
                      const lines = [...editForm.lines]
                      lines[index] = { ...line, delete: !line.delete }
                      setEditForm({ ...editForm, lines })
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> {line.delete ? 'Undo delete' : 'Delete amount'}
                  </Button>
                </div>
                <Input
                  label="Amount (PKR) *"
                  type="number"
                  min="0"
                  value={line.amount}
                  onChange={(e) => {
                    const lines = [...editForm.lines]
                    lines[index] = { ...line, amount: e.target.value }
                    setEditForm({ ...editForm, lines })
                  }}
                  disabled={line.delete}
                />
                <Input
                  label="Note (optional)"
                  value={line.notes}
                  onChange={(e) => {
                    const lines = [...editForm.lines]
                    lines[index] = { ...line, notes: e.target.value }
                    setEditForm({ ...editForm, lines })
                  }}
                  disabled={line.delete}
                />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap justify-between gap-2 pt-2">
            <Button variant="danger" onClick={() => setDeletePartyId(editForm.id)}>
              <Trash2 className="h-4 w-4" /> Delete person
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => { setEditOpen(false); setEditLedger(null) }}>Cancel</Button>
              <Button onClick={() => void saveEdit()} loading={saving}>Save changes</Button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal open={zakatOpen} onClose={() => setZakatOpen(false)} title="Give Zakat">
        <div className="space-y-3">
          <Input
            label="Amount (PKR) *"
            type="number"
            min="0"
            value={zakatForm.amount}
            onChange={(e) => setZakatForm({ ...zakatForm, amount: e.target.value })}
          />
          <Input label="Note (optional)" value={zakatForm.notes} onChange={(e) => setZakatForm({ ...zakatForm, notes: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setZakatOpen(false)}>Cancel</Button>
            <Button onClick={() => void saveZakat()} loading={saving}>Save zakat</Button>
          </div>
        </div>
      </Modal>

      <Modal open={advanceOpen} onClose={() => setAdvanceOpen(false)} title="Advance payment to farmer">
        <div className="space-y-3">
          <PartyCombobox
            label="Farmer"
            required
            items={farmers.map((f) => ({
              id: String(f.id),
              code: f.farmerId,
              name: f.name,
              fatherName: f.fatherName,
              address: f.address,
              city: f.city,
              phone: f.phone,
            }))}
            value={advance.farmerId}
            onChange={(id) => setAdvance({ ...advance, farmerId: id })}
            placeholder="Search"
          />
          <Input
            label="Amount (PKR) *"
            type="number"
            min="0"
            value={advance.amount}
            onChange={(e) => setAdvance({ ...advance, amount: e.target.value })}
          />
          <Input label="Note" value={advance.notes} onChange={(e) => setAdvance({ ...advance, notes: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setAdvanceOpen(false)}>Cancel</Button>
            <Button onClick={() => void saveAdvance()} loading={saving}>Save advance</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deletePartyId != null}
        onClose={() => setDeletePartyId(null)}
        onConfirm={() => void confirmDeleteParty()}
        title="Delete this person?"
        message="They will leave the register and their amounts will leave the totals. This does not change other people you already saved."
        confirmLabel="Delete"
        loading={saving}
      />
    </div>
  )
}
