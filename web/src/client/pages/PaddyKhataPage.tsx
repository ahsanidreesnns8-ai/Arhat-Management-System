import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Archive, ArchiveRestore, ArrowLeft, Banknote, FileText, History, Leaf, Lock, Package, Plus, ShoppingBag, Trash2, Truck, Wallet,
} from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { TableSkeleton } from '../components/ui/Skeleton'
import { billApi, paddyKhataApi } from '../services/api'
import { billErrorMessage, openHtmlBill } from '../utils/bill'
import { formatCurrency, formatNumber } from '../utils/format'
import { useLiveReload } from '../context/SyncContext'
import KhataTreasuryPanel from '../components/khata/KhataTreasuryPanel'
import KhataPersonLedger from '../components/khata/KhataPersonLedger'
import type { PaddyKhataBook, PaddyKhataBookSummary, PaddyKhataParty } from '../types'

type Section =
  | 'HOME'
  | 'AMOUNTS'
  | 'PURCHASE'
  | 'VARIETY'
  | 'RICE'
  | 'SELL'

const emptyPurchase = {
  partyId: '',
  bags: '',
  bagWeightKg: '40',
  extraWeightKg: '',
  ratePer40Kg: '',
  variety: '',
  bagPrice: '',
  labourPrice: '',
  notes: '',
}

function apiMessage(err: unknown, fallback: string) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback
}

function secretKey(bookId: number) {
  return `paddy-khata-secret:${bookId}`
}

export default function PaddyKhataPage() {
  const [books, setBooks] = useState<PaddyKhataBookSummary[]>([])
  const [archivedBooks, setArchivedBooks] = useState<PaddyKhataBookSummary[]>([])
  const [book, setBook] = useState<PaddyKhataBook | null>(null)
  const [secret, setSecret] = useState('')
  const [section, setSection] = useState<Section>('HOME')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [billing, setBilling] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [unlockOpen, setUnlockOpen] = useState<PaddyKhataBookSummary | null>(null)
  const [createForm, setCreateForm] = useState({ name: '', secret: '', keepInArchive: true })
  const [unlockSecret, setUnlockSecret] = useState('')
  const [deleteBookId, setDeleteBookId] = useState<PaddyKhataBookSummary | null>(null)
  const [purgeBookId, setPurgeBookId] = useState<PaddyKhataBookSummary | null>(null)
  const [completeOpen, setCompleteOpen] = useState<string | null>(null)

  const [amountOpen, setAmountOpen] = useState(false)
  const [partyOpen, setPartyOpen] = useState<'PURCHASE' | 'SALE' | null>(null)
  const [purchaseOpen, setPurchaseOpen] = useState(false)
  const [giveOpen, setGiveOpen] = useState(false)
  const [processOpen, setProcessOpen] = useState<string | null>(null)
  const [expenseOpen, setExpenseOpen] = useState<string | null>(null)
  const [sellOpen, setSellOpen] = useState(false)
  const [receiveOpen, setReceiveOpen] = useState(false)

  const [amountForm, setAmountForm] = useState({ amount: '', notes: '' })
  const [partyForm, setPartyForm] = useState({ name: '', address: '', notes: '' })
  const [purchaseForm, setPurchaseForm] = useState(emptyPurchase)
  const [giveForm, setGiveForm] = useState({ partyId: '', amount: '', notes: '' })
  const [processForm, setProcessForm] = useState({ riceVariety: '', bags: '', notes: '' })
  const [expenseForm, setExpenseForm] = useState({ amount: '', reason: '' })
  const [sellForm, setSellForm] = useState({ partyId: '', variety: '', bags: '', bagWeightKg: '40', ratePer40Kg: '', notes: '' })
  const [receiveForm, setReceiveForm] = useState({ partyId: '', amount: '', notes: '' })
  const [purchasePreview, setPurchasePreview] = useState<{
    bags: number
    totalWeightKg: number
    grainAmount: number
    bagAmount: number
    labourAmount: number
    totalPrice: number
  } | null>(null)

  const loadList = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      const [live, archived] = await Promise.all([
        paddyKhataApi.list(),
        paddyKhataApi.listArchived().catch(() => ({ data: { data: [] as PaddyKhataBookSummary[] } })),
      ])
      setBooks(live.data.data || [])
      setArchivedBooks(archived.data.data || [])
    } catch (err) {
      toast.error(apiMessage(err, 'Could not load Paddy Khata'))
    } finally {
      setLoading(false)
    }
  }, [])

  const loadBook = useCallback(async (id: number, code: string, quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      const res = await paddyKhataApi.get(id, code)
      setBook(res.data.data)
      setSecret(code)
      sessionStorage.setItem(secretKey(id), code)
    } catch (err) {
      toast.error(apiMessage(err, 'Could not open Paddy Khata ID'))
      setBook(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadList() }, [loadList])
  useLiveReload(() => {
    if (book) void loadBook(book.id, secret, true)
    else void loadList(true)
  })

  const selectedSellParty = useMemo(
    () => book?.saleParties.find((p) => String(p.id) === sellForm.partyId) || null,
    [book, sellForm.partyId],
  )
  const selectedReceiveParty = useMemo(
    () => book?.saleParties.find((p) => String(p.id) === receiveForm.partyId) || null,
    [book, receiveForm.partyId],
  )
  const selectedRiceStock = useMemo(
    () => book?.riceVarieties.find((item) => item.variety.toLowerCase() === sellForm.variety.trim().toLowerCase()) || null,
    [book, sellForm.variety],
  )
  const riceReady = selectedRiceStock ? selectedRiceStock.remainingBags : 0

  const refresh = () => {
    if (book) void loadBook(book.id, secret, true)
  }

  const saveCreate = async () => {
    if (createForm.secret.trim().length < 4) {
      toast.error('Secret code must be at least 4 characters')
      return
    }
    setSaving(true)
    try {
      const code = createForm.secret.trim()
      const res = await paddyKhataApi.create({
        name: createForm.name.trim() || undefined,
        secret: code,
        keepInArchive: createForm.keepInArchive,
      })
      toast.success(createForm.keepInArchive ? 'Paddy Khata ID created. Extra IDs are in archive.' : 'Paddy Khata ID created')
      setCreateOpen(false)
      setCreateForm({ name: '', secret: '', keepInArchive: true })
      const created = res.data.data
      if (created?.id) {
        await loadBook(created.id, code)
        setSection('HOME')
      } else {
        void loadList(true)
      }
    } catch (err) {
      toast.error(apiMessage(err, 'Could not create Paddy Khata ID'))
    } finally {
      setSaving(false)
    }
  }

  const saveUnlock = async () => {
    if (!unlockOpen) return
    setSaving(true)
    try {
      await loadBook(unlockOpen.id, unlockSecret.trim())
      setUnlockOpen(null)
      setUnlockSecret('')
      setSection('HOME')
    } finally {
      setSaving(false)
    }
  }

  const openBill = async (module?: string, partyId?: number) => {
    if (!book) return
    setBilling(true)
    try {
      const res = partyId
        ? await billApi.paddyKhataParty(book.id, partyId, secret)
        : module === 'all'
          ? await billApi.paddyKhataAll(book.id, secret)
          : await billApi.paddyKhata(book.id, secret, module)
      openHtmlBill(typeof res.data === 'string' ? res.data : String(res.data), 'Paddy Khata bill')
    } catch (err) {
      toast.error(billErrorMessage(err, 'Could not generate bill'))
    } finally {
      setBilling(false)
    }
  }

  const calculatePurchase = async () => {
    try {
      const res = await paddyKhataApi.previewPurchase({
        bags: Number(purchaseForm.bags),
        bagWeightKg: Number(purchaseForm.bagWeightKg || 40),
        extraWeightKg: purchaseForm.extraWeightKg ? Number(purchaseForm.extraWeightKg) : 0,
        ratePer40Kg: Number(purchaseForm.ratePer40Kg),
        bagPrice: purchaseForm.bagPrice ? Number(purchaseForm.bagPrice) : 0,
        labourPrice: purchaseForm.labourPrice ? Number(purchaseForm.labourPrice) : 0,
      })
      setPurchasePreview(res.data.data)
      toast.success(`Total ${formatCurrency(res.data.data.totalPrice)}`)
    } catch (err) {
      toast.error(apiMessage(err, 'Enter bags, weight, and rate per 40 KG'))
    }
  }

  const saveAmount = async () => {
    if (!book) return
    setSaving(true)
    try {
      await paddyKhataApi.addAmount(book.id, {
        secret,
        amount: Number(amountForm.amount),
        notes: amountForm.notes.trim() || undefined,
      })
      toast.success('Amount added to this Paddy Khata ID and Arhat Amount')
      setAmountOpen(false)
      setAmountForm({ amount: '', notes: '' })
      refresh()
    } catch (err) {
      toast.error(apiMessage(err, 'Could not add amount'))
    } finally {
      setSaving(false)
    }
  }

  const saveParty = async () => {
    if (!book || !partyOpen) return
    if (!partyForm.name.trim()) {
      toast.error('Party name is required')
      return
    }
    setSaving(true)
    try {
      await paddyKhataApi.addParty(book.id, {
        secret,
        kind: partyOpen,
        name: partyForm.name.trim(),
        address: partyForm.address.trim() || undefined,
        notes: partyForm.notes.trim() || undefined,
      })
      toast.success('Party saved')
      setPartyOpen(null)
      setPartyForm({ name: '', address: '', notes: '' })
      refresh()
    } catch (err) {
      toast.error(apiMessage(err, 'Could not save party'))
    } finally {
      setSaving(false)
    }
  }

  const savePurchase = async () => {
    if (!book) return
    setSaving(true)
    try {
      await paddyKhataApi.addPurchase(book.id, {
        secret,
        partyId: Number(purchaseForm.partyId),
        bags: Number(purchaseForm.bags),
        bagWeightKg: Number(purchaseForm.bagWeightKg || 40),
        extraWeightKg: purchaseForm.extraWeightKg ? Number(purchaseForm.extraWeightKg) : 0,
        ratePer40Kg: Number(purchaseForm.ratePer40Kg),
        variety: purchaseForm.variety.trim(),
        bagPrice: purchaseForm.bagPrice ? Number(purchaseForm.bagPrice) : 0,
        labourPrice: purchaseForm.labourPrice ? Number(purchaseForm.labourPrice) : 0,
        notes: purchaseForm.notes.trim() || undefined,
      })
      toast.success('Purchase saved to this party. Give Amount deducts from total.')
      setPurchaseOpen(false)
      setPurchaseForm(emptyPurchase)
      setPurchasePreview(null)
      refresh()
    } catch (err) {
      toast.error(apiMessage(err, 'Could not save purchase'))
    } finally {
      setSaving(false)
    }
  }

  const saveGive = async () => {
    if (!book) return
    setSaving(true)
    try {
      await paddyKhataApi.addCash(book.id, {
        secret,
        partyId: Number(giveForm.partyId),
        kind: 'GIVE',
        amount: Number(giveForm.amount),
        notes: giveForm.notes.trim() || undefined,
      })
      toast.success('Amount given and deducted from total')
      setGiveOpen(false)
      setGiveForm({ partyId: '', amount: '', notes: '' })
      refresh()
    } catch (err) {
      toast.error(apiMessage(err, 'Could not give amount'))
    } finally {
      setSaving(false)
    }
  }

  const saveProcess = async () => {
    if (!book || !processOpen) return
    setSaving(true)
    try {
      await paddyKhataApi.addProcess(book.id, {
        secret,
        variety: processOpen,
        riceVariety: processForm.riceVariety.trim() || processOpen,
        bags: Number(processForm.bags),
        notes: processForm.notes.trim() || undefined,
      })
      toast.success(`${processForm.bags} bags of ${processOpen} are now processing. Tap Processing complete to move them to Sell Rice.`)
      setProcessOpen(null)
      setProcessForm({ riceVariety: '', bags: '', notes: '' })
      refresh()
    } catch (err) {
      toast.error(apiMessage(err, 'Could not process'))
    } finally {
      setSaving(false)
    }
  }

  const saveComplete = async (variety: string) => {
    if (!book) return
    setSaving(true)
    try {
      const res = await paddyKhataApi.completeProcess(book.id, { secret, variety })
      const moved = res.data.data
      const bags = moved?.bags || 0
      toast.success(`${formatNumber(bags, 0)} bags moved to Sell Rice. You can sell only this ready stock.`)
      setCompleteOpen(null)
      setSection('SELL')
      refresh()
    } catch (err) {
      toast.error(apiMessage(err, 'Could not complete processing'))
    } finally {
      setSaving(false)
    }
  }

  const saveExpense = async () => {
    if (!book || !expenseOpen) return
    setSaving(true)
    try {
      await paddyKhataApi.addExpense(book.id, {
        secret,
        variety: expenseOpen,
        amount: Number(expenseForm.amount),
        reason: expenseForm.reason.trim(),
      })
      toast.success('Bill paid and added to this variety amount')
      setExpenseOpen(null)
      setExpenseForm({ amount: '', reason: '' })
      refresh()
    } catch (err) {
      toast.error(apiMessage(err, 'Could not pay bill'))
    } finally {
      setSaving(false)
    }
  }

  const openSell = (variety?: string) => {
    const ready = (book?.riceVarieties || []).filter((item) => item.remainingBags > 0)
    const picked = variety
      ? ready.find((item) => item.variety.toLowerCase() === variety.trim().toLowerCase()) || ready[0]
      : ready[0]
    setSellForm({
      partyId: '',
      variety: picked?.variety || variety || '',
      bags: '',
      bagWeightKg: '40',
      ratePer40Kg: '',
      notes: '',
    })
    setSellOpen(true)
  }

  const saveSell = async () => {
    if (!book) return
    const bags = Number(sellForm.bags)
    if (!sellForm.variety.trim()) {
      toast.error('Choose a rice variety first')
      return
    }
    if (!Number.isInteger(bags) || bags <= 0) {
      toast.error('Enter number of bags')
      return
    }
    if (bags > riceReady) {
      toast.error(`Only ${formatNumber(riceReady, 0)} bags of ${selectedRiceStock?.variety || sellForm.variety} are ready to sell`)
      return
    }
    setSaving(true)
    try {
      await paddyKhataApi.addSale(book.id, {
        secret,
        partyId: Number(sellForm.partyId),
        variety: sellForm.variety.trim(),
        bags: Number(sellForm.bags),
        bagWeightKg: Number(sellForm.bagWeightKg || 40),
        ratePer40Kg: Number(sellForm.ratePer40Kg),
        notes: sellForm.notes.trim() || undefined,
      })
      toast.success('Rice sold')
      setSellOpen(false)
      setSellForm({ partyId: '', variety: '', bags: '', bagWeightKg: '40', ratePer40Kg: '', notes: '' })
      refresh()
    } catch (err) {
      toast.error(apiMessage(err, 'Could not sell rice'))
    } finally {
      setSaving(false)
    }
  }

  const saveReceive = async () => {
    if (!book) return
    setSaving(true)
    try {
      await paddyKhataApi.addCash(book.id, {
        secret,
        partyId: Number(receiveForm.partyId),
        kind: 'RECEIVE',
        amount: Number(receiveForm.amount),
        notes: receiveForm.notes.trim() || undefined,
      })
      toast.success('Amount received and added to total')
      setReceiveOpen(false)
      setReceiveForm({ partyId: '', amount: '', notes: '' })
      refresh()
    } catch (err) {
      toast.error(apiMessage(err, 'Could not receive amount'))
    } finally {
      setSaving(false)
    }
  }

  if (!book) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Paddy Khata"
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> Paddy Khata ID
            </Button>
          }
        />
        {loading ? (
          <TableSkeleton rows={4} />
        ) : (
          <div className="space-y-8">
            {!books.length ? (
              <div className="card-3d p-8 text-center">
                <Leaf className="h-8 w-8 mx-auto text-[#C5A059] mb-3" />
                <p className="font-semibold">No live Paddy Khata ID</p>
                <p className="text-sm text-slate-500 mt-1">Create a new ID to start.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {books.map((item) => (
                  <div key={item.id} className="card-3d p-5 text-left space-y-3">
                    <button
                      type="button"
                      onClick={() => {
                        const stored = sessionStorage.getItem(secretKey(item.id))
                        if (stored) {
                          void loadBook(item.id, stored)
                          setSection('HOME')
                          return
                        }
                        setUnlockOpen(item)
                        setUnlockSecret('')
                      }}
                      className="w-full text-left"
                    >
                      <p className="text-xs uppercase tracking-wide text-slate-500">{item.publicId}</p>
                      <p className="text-lg font-semibold mt-1">{item.name}</p>
                      <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
                        <Lock className="h-3 w-3" /> Secret code required
                      </p>
                    </button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setDeleteBookId(item)}
                    >
                      <Archive className="h-3.5 w-3.5" /> Keep in archive
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Archive className="h-4 w-4 text-[#C5A059]" />
                <h2 className="font-semibold">Archive</h2>
              </div>
              {!archivedBooks.length ? (
                <p className="text-sm text-slate-500 card-3d p-4">Archive is empty.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {archivedBooks.map((item) => (
                    <div key={item.id} className="card-3d p-5 text-left space-y-3 border border-slate-200/80 dark:border-white/10">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">{item.publicId}</p>
                        <p className="text-lg font-semibold mt-1">{item.name}</p>
                        {item.archivedAt && (
                          <p className="text-[11px] text-slate-500 mt-1">Archived {new Date(item.archivedAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={saving}
                        onClick={async () => {
                          setSaving(true)
                          try {
                            await paddyKhataApi.restoreBook(item.id)
                            toast.success(`${item.name} restored`)
                            await loadList(true)
                          } catch (err) {
                            toast.error(apiMessage(err, 'Could not restore Paddy Khata ID'))
                          } finally {
                            setSaving(false)
                          }
                        }}
                      >
                        <ArchiveRestore className="h-3.5 w-3.5" /> Restore
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => setPurgeBookId(item)}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Paddy Khata ID">
          <div className="space-y-3">
            <Input label="Name" value={createForm.name} onChange={(e) => setCreateForm((s) => ({ ...s, name: e.target.value }))} placeholder="Paddy Khata" />
            <Input label="Secret code" type="password" value={createForm.secret} onChange={(e) => setCreateForm((s) => ({ ...s, secret: e.target.value }))} placeholder="At least 4 characters" />
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 dark:border-white/10 p-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-slate-300"
                checked={createForm.keepInArchive}
                onChange={(e) => setCreateForm((s) => ({ ...s, keepInArchive: e.target.checked }))}
              />
              <span>
                <span className="font-medium">Keep extra IDs in archive</span>
              </span>
            </label>
            <Button className="w-full" loading={saving} onClick={() => void saveCreate()}>Save ID</Button>
          </div>
        </Modal>
        <Modal open={!!unlockOpen} onClose={() => setUnlockOpen(null)} title={unlockOpen ? `Open ${unlockOpen.publicId}` : 'Open'}>
          <div className="space-y-3">
            <Input label="Secret code" type="password" value={unlockSecret} onChange={(e) => setUnlockSecret(e.target.value)} />
            <Button className="w-full" loading={saving} onClick={() => void saveUnlock()}>Open</Button>
          </div>
        </Modal>
        <ConfirmDialog
          open={!!deleteBookId}
          onClose={() => setDeleteBookId(null)}
          title="Keep this ID in archive?"
          message={`${deleteBookId?.name || ''} will leave the live list. Records stay stored in Archive and can be restored.`}
          confirmLabel="Keep in archive"
          loading={saving}
          onConfirm={async () => {
            if (!deleteBookId) return
            setSaving(true)
            try {
              await paddyKhataApi.deleteBook(deleteBookId.id)
              toast.success('Moved to archive')
              setDeleteBookId(null)
              await loadList(true)
            } catch (err) {
              toast.error(apiMessage(err, 'Could not archive Paddy Khata ID'))
            } finally {
              setSaving(false)
            }
          }}
        />
        <ConfirmDialog
          open={!!purgeBookId}
          onClose={() => setPurgeBookId(null)}
          title="Delete permanently?"
          message={`${purgeBookId?.name || ''} and all of its records will be removed. This cannot be undone.`}
          confirmLabel="Delete"
          loading={saving}
          onConfirm={async () => {
            if (!purgeBookId) return
            setSaving(true)
            try {
              await paddyKhataApi.purgeBook(purgeBookId.id)
              toast.success('Deleted')
              setPurgeBookId(null)
              await loadList(true)
            } catch (err) {
              toast.error(apiMessage(err, 'Could not delete Paddy Khata ID'))
            } finally {
              setSaving(false)
            }
          }}
        />
      </div>
    )
  }

  const { totals } = book

  return (
    <div className="space-y-6">
      <PageHeader
        title={book.name}
        description={book.publicId}
        action={
          <Button variant="secondary" onClick={() => { setBook(null); setSection('HOME'); void loadList() }}>
            <ArrowLeft className="h-4 w-4" /> All IDs
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button type="button" onClick={() => setSection('HOME')} className="card-3d p-5 text-left">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total amount</p>
          <p className="text-2xl font-bold text-primary mt-1">{formatCurrency(totals.totalAmount)}</p>
        </button>
        <button type="button" onClick={() => setSection('AMOUNTS')} className="card-3d p-5 text-left">
          <p className="text-xs uppercase tracking-wide text-slate-500">Amount in hand</p>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">{formatCurrency(totals.inHand || 0)}</p>
        </button>
        <button type="button" onClick={() => setSection('AMOUNTS')} className="card-3d p-5 text-left">
          <p className="text-xs uppercase tracking-wide text-slate-500">Amount in bank</p>
          <p className="text-2xl font-bold text-sky-800 dark:text-sky-300 mt-1">{formatCurrency(totals.bankTotal || 0)}</p>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button type="button" onClick={() => setSection('SELL')} className="card-3d p-5 text-left">
          <p className="text-xs uppercase tracking-wide text-slate-500">Receiving amount</p>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">{formatCurrency(totals.receivingAmount)}</p>
        </button>
        <button type="button" onClick={() => setSection('PURCHASE')} className="card-3d p-5 text-left">
          <p className="text-xs uppercase tracking-wide text-slate-500">Giving amount</p>
          <p className="text-2xl font-bold text-rose-700 dark:text-rose-400 mt-1">{formatCurrency(totals.givingAmount)}</p>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button type="button" onClick={() => setSection('AMOUNTS')} className="card-3d p-5 text-left">
          <p className="text-xs uppercase tracking-wide text-slate-500">Giving to person</p>
          <p className="text-2xl font-bold text-rose-700 dark:text-rose-400 mt-1">{formatCurrency(totals.givingToPerson || 0)}</p>
        </button>
        <button type="button" onClick={() => setSection('AMOUNTS')} className="card-3d p-5 text-left">
          <p className="text-xs uppercase tracking-wide text-slate-500">Receiving from person</p>
          <p className="text-2xl font-bold text-sky-800 dark:text-sky-300 mt-1">{formatCurrency(totals.receivingFromPerson || 0)}</p>
        </button>
      </div>

      <button
        type="button"
        onClick={() => setSection('SELL')}
        className={`card-3d p-5 text-left w-full ${section === 'SELL' || section === 'RICE' ? 'ring-2 ring-[#C5A059]' : ''}`}
      >
        <p className="text-xs uppercase tracking-wide text-slate-500">Rice</p>
        <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-300 mt-1">{formatNumber(totals.riceInStock, 0)} bags in Sell Rice</p>
      </button>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {([
          { id: 'AMOUNTS' as const, label: 'Add Amount', icon: Banknote },
          { id: 'PURCHASE' as const, label: 'Purchase Stock', icon: Truck },
          { id: 'VARIETY' as const, label: 'Variety', icon: Package },
          { id: 'SELL' as const, label: 'Sell Rice', icon: ShoppingBag },
        ]).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSection(item.id)}
            className={`card-3d p-4 text-left ${section === item.id ? 'ring-2 ring-[#C5A059]' : ''}`}
          >
            <item.icon className="h-5 w-5 text-primary mb-2" />
            <p className="font-semibold">{item.label}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" loading={billing} onClick={() => void openBill(section === 'HOME' ? 'all' : section.toLowerCase())}>
          <FileText className="h-4 w-4" /> Bill this module
        </Button>
        <Button variant="secondary" loading={billing} onClick={() => void openBill('all')}>
          <FileText className="h-4 w-4" /> All bills
        </Button>
      </div>

      {section === 'HOME' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card-3d p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Paddy bags</p>
            <p className="text-xl font-semibold mt-1">{formatNumber(totals.paddyBags, 0)}</p>
          </div>
          <div className="card-3d p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Processed</p>
            <p className="text-xl font-semibold mt-1">{formatNumber(totals.processedBags, 0)}</p>
          </div>
          <div className="card-3d p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">In mill</p>
            <p className="text-xl font-semibold mt-1">{formatNumber(totals.processingBags, 0)}</p>
          </div>
          <div className="card-3d p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Sell Rice</p>
            <p className="text-xl font-semibold mt-1">{formatNumber(totals.riceInStock, 0)}</p>
          </div>
          <div className="card-3d p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Sold rice</p>
            <p className="text-xl font-semibold mt-1">{formatNumber(totals.soldBags, 0)}</p>
          </div>
        </div>
      )}

      {section === 'AMOUNTS' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setAmountOpen(true)}><Plus className="h-4 w-4" /> Add Amount</Button>
          </div>
          <KhataTreasuryPanel
            inHand={totals.inHand || 0}
            banks={book.banks || []}
            bankGroups={book.bankGroups}
            expenses={book.otherExpenses}
            transfers={book.transfers || []}
            saving={saving}
            loadHeads={async () => {
              const res = await paddyKhataApi.heads(book.id, secret)
              return res.data.data || []
            }}
            onAddBank={async (input) => {
              setSaving(true)
              try {
                await paddyKhataApi.addBank(book.id, { secret, ...input })
                refresh()
              } finally {
                setSaving(false)
              }
            }}
            onReceiveBank={async (input) => {
              setSaving(true)
              try {
                await paddyKhataApi.receiveBank(book.id, { secret, ...input })
                refresh()
              } finally {
                setSaving(false)
              }
            }}
            onExpense={async (input) => {
              setSaving(true)
              try {
                await paddyKhataApi.addOtherExpense(book.id, { secret, ...input })
                refresh()
              } finally {
                setSaving(false)
              }
            }}
            onTransfer={async (input) => {
              setSaving(true)
              try {
                await paddyKhataApi.transferTo(book.id, { secret, ...input })
                refresh()
              } finally {
                setSaving(false)
              }
            }}
          />
          <KhataPersonLedger
            inHand={totals.inHand || 0}
            people={book.people || []}
            givingToPerson={totals.givingToPerson || 0}
            receivingFromPerson={totals.receivingFromPerson || 0}
            saving={saving}
            onGive={async (input) => {
              setSaving(true)
              try {
                await paddyKhataApi.addPersonCash(book.id, { secret, ...input, kind: 'GIVING' })
                refresh()
              } finally {
                setSaving(false)
              }
            }}
            onReceive={async (input) => {
              setSaving(true)
              try {
                await paddyKhataApi.addPersonCash(book.id, { secret, ...input, kind: 'RECEIVING' })
                refresh()
              } finally {
                setSaving(false)
              }
            }}
            onLoadPerson={async (id) => {
              const res = await paddyKhataApi.getPerson(book.id, id, secret)
              return res.data.data
            }}
            onUpdate={async (id, input) => {
              setSaving(true)
              try {
                await paddyKhataApi.updatePerson(book.id, id, { secret, ...input })
                refresh()
              } finally {
                setSaving(false)
              }
            }}
            onDelete={async (id) => {
              setSaving(true)
              try {
                await paddyKhataApi.deletePerson(book.id, id, secret)
                refresh()
              } finally {
                setSaving(false)
              }
            }}
          />
          <Panel title="Add Amount">
            <MoneyTable rows={book.amounts} empty="No amount added yet. Cash added here stays in this Paddy Khata ID and also updates Arhat Amount." />
          </Panel>
        </div>
      )}

      {section === 'PURCHASE' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => { setPartyForm({ name: '', address: '', notes: '' }); setPartyOpen('PURCHASE') }}><Plus className="h-4 w-4" /> Add Party</Button>
            <Button onClick={() => { setPurchaseForm(emptyPurchase); setPurchasePreview(null); setPurchaseOpen(true) }}><Package className="h-4 w-4" /> Purchase Product</Button>
            <Button variant="secondary" onClick={() => setGiveOpen(true)}><Banknote className="h-4 w-4" /> Give Amount</Button>
          </div>
          <PartyCards
            parties={book.purchaseParties}
            mode="PURCHASE"
            empty="Add a party, then purchase product. Each party keeps its own record."
            onBill={(p) => void openBill(undefined, p.id)}
            onCash={(p) => { setGiveForm({ partyId: String(p.id), amount: p.remaining > 0 ? String(p.remaining) : '', notes: '' }); setGiveOpen(true) }}
            cashLabel="Give Amount"
          />
          <Panel title="History">
            {!book.purchases.length && !book.payments.filter((p) => p.kind === 'GIVE').length ? (
              <p className="p-5 text-sm text-slate-500">Purchase history is empty.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-100 dark:border-white/10">
                      <th className="px-4 py-2">Day</th>
                      <th className="px-4 py-2">Party</th>
                      <th className="px-4 py-2">Detail</th>
                      <th className="px-4 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {book.purchases.map((row) => (
                      <tr key={`p-${row.id}`} className="border-b border-slate-50 dark:border-white/5">
                        <td className="px-4 py-2">{row.day} · {row.date}</td>
                        <td className="px-4 py-2">{row.partyName}</td>
                        <td className="px-4 py-2">{row.variety} · {formatNumber(row.bags, 0)} bags</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(row.totalPrice)}</td>
                      </tr>
                    ))}
                    {book.payments.filter((p) => p.kind === 'GIVE').map((row) => (
                      <tr key={`g-${row.id}`} className="border-b border-slate-50 dark:border-white/5">
                        <td className="px-4 py-2">{row.day} · {row.date}</td>
                        <td className="px-4 py-2">{row.partyName}</td>
                        <td className="px-4 py-2">Give amount</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(row.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      )}

      {section === 'VARIETY' && (
        <div className="space-y-3">
          {!book.varieties.length ? (
            <p className="text-sm text-slate-500">No varieties yet.</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {book.varieties.map((item) => {
                const milling = item.processingBags > 0
                const readyToMove = milling
                return (
                  <div key={item.variety} className="card-3d p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold">{item.variety}</p>
                      </div>
                      {milling ? (
                        <span className="shrink-0 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide">
                          Processing
                        </span>
                      ) : item.remainingBags > 0 ? (
                        <span className="shrink-0 rounded-full bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide">
                          In stock
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide">
                          In Sell Rice
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={item.remainingBags <= 0}
                        onClick={() => {
                          setProcessOpen(item.variety)
                          setProcessForm({ riceVariety: item.variety, bags: String(item.remainingBags || ''), notes: '' })
                        }}
                      >
                        Process
                      </Button>
                      {readyToMove && (
                        <Button size="sm" variant="secondary" onClick={() => setCompleteOpen(item.variety)}>
                          Processing complete
                        </Button>
                      )}
                      <Button size="sm" variant="secondary" onClick={() => { setExpenseOpen(item.variety); setExpenseForm({ amount: '', reason: '' }) }}>Pay Bill/Amount</Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <p>Total bags {formatNumber(item.bags, 0)}</p>
                      <p className={milling ? 'font-semibold text-amber-800 dark:text-amber-300' : ''}>Processing {formatNumber(item.processingBags, 0)}</p>
                      <p>Moved to Sell Rice {formatNumber(item.completedBags, 0)}</p>
                      <p>Left on variety {formatNumber(item.remainingBags, 0)}</p>
                      <p>Product {formatCurrency(item.totalPrice)}</p>
                      <p className="font-medium">Total amount {formatCurrency(item.runningAmount)}</p>
                    </div>
                    {item.lines.map((row) => (
                      <p key={row.id} className="text-xs text-slate-500">
                        {row.day} · {row.partyName} · {formatNumber(row.bags, 0)} bags · {formatNumber(row.bagWeightKg, 2)} kg/bag · rate {formatCurrency(row.ratePer40Kg)} / 40 kg · {formatCurrency(row.totalPrice)}
                      </p>
                    ))}
                    {book.processes.filter((row) => row.variety === item.variety).map((row) => (
                      <p key={row.id} className={`text-xs ${row.status === 'PROCESSING' ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                        {row.status === 'PROCESSING' ? 'In mill' : 'Moved to Sell Rice'} {formatNumber(row.bags, 0)} bags as {row.riceVariety} · {row.date}
                      </p>
                    ))}
                    {item.expenses.map((row) => (
                      <p key={row.id} className="text-xs text-rose-700 dark:text-rose-400">
                        Bill {formatCurrency(row.amount)} · {row.reason} · {row.date}
                      </p>
                    ))}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {section === 'RICE' && (
        <div className="space-y-3">
          {!book.riceVarieties.length ? (
            <p className="text-sm text-slate-500">No rice is ready yet.</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {book.riceVarieties.map((item) => (
                <RiceSellFrame
                  key={item.variety}
                  item={item}
                  onSell={() => openSell(item.variety)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {section === 'SELL' && (
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold mb-3">Sell Rice</h3>
            {!book.riceVarieties.length ? (
              <p className="text-sm text-slate-500 card-3d p-4">No rice is ready.</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {book.riceVarieties.map((item) => (
                  <RiceSellFrame
                    key={item.variety}
                    item={item}
                    onSell={() => openSell(item.variety)}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => { setPartyForm({ name: '', address: '', notes: '' }); setPartyOpen('SALE') }}><Plus className="h-4 w-4" /> Add Party</Button>
            <Button onClick={() => openSell()} disabled={!book.riceVarieties.some((item) => item.remainingBags > 0)}><ShoppingBag className="h-4 w-4" /> Sell Rice</Button>
            <Button variant="secondary" onClick={() => { setReceiveForm({ partyId: '', amount: '', notes: '' }); setReceiveOpen(true) }}><Wallet className="h-4 w-4" /> Receive Amount</Button>
          </div>
          <PartyCards
            parties={book.saleParties}
            mode="SALE"
            empty="Add a rice party, then sell rice from the frames above. Receive Amount is inside this screen, party by party."
            onBill={(p) => void openBill(undefined, p.id)}
            onCash={(p) => { setReceiveForm({ partyId: String(p.id), amount: p.remaining > 0 ? String(p.remaining) : '', notes: '' }); setReceiveOpen(true) }}
            cashLabel="Receive Amount"
          />
        </div>
      )}

      <Modal open={amountOpen} onClose={() => setAmountOpen(false)} title="Add Amount">
        <div className="space-y-3">
          <Input label="Amount" type="number" value={amountForm.amount} onChange={(e) => setAmountForm((s) => ({ ...s, amount: e.target.value }))} />
          <Input label="Note (optional)" value={amountForm.notes} onChange={(e) => setAmountForm((s) => ({ ...s, notes: e.target.value }))} />
          <Button className="w-full" loading={saving} onClick={() => void saveAmount()}>Save</Button>
        </div>
      </Modal>

      <Modal open={!!partyOpen} onClose={() => setPartyOpen(null)} title="Add Party">
        <div className="space-y-3">
          <Input label="Name" value={partyForm.name} onChange={(e) => setPartyForm((s) => ({ ...s, name: e.target.value }))} />
          <Input label="Address" value={partyForm.address} onChange={(e) => setPartyForm((s) => ({ ...s, address: e.target.value }))} />
          <Input label="Note (optional)" value={partyForm.notes} onChange={(e) => setPartyForm((s) => ({ ...s, notes: e.target.value }))} />
          <Button className="w-full" loading={saving} onClick={() => void saveParty()}>Save party</Button>
        </div>
      </Modal>

      <Modal open={purchaseOpen} onClose={() => setPurchaseOpen(false)} title="Purchase Product" size="lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="space-y-1.5 sm:col-span-2">
            <span className="block text-sm font-medium">Party</span>
            <select className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2.5" value={purchaseForm.partyId} onChange={(e) => setPurchaseForm((s) => ({ ...s, partyId: e.target.value }))}>
              <option value="">Choose party</option>
              {book.purchaseParties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <Input label="No. of bags" type="number" value={purchaseForm.bags} onChange={(e) => setPurchaseForm((s) => ({ ...s, bags: e.target.value }))} />
          <Input label="Weight of one bag" type="number" value={purchaseForm.bagWeightKg} onChange={(e) => setPurchaseForm((s) => ({ ...s, bagWeightKg: e.target.value }))} />
          <Input label="Rate per 40 KG" type="number" value={purchaseForm.ratePer40Kg} onChange={(e) => setPurchaseForm((s) => ({ ...s, ratePer40Kg: e.target.value }))} />
          <Input label="Variety of product" value={purchaseForm.variety} onChange={(e) => setPurchaseForm((s) => ({ ...s, variety: e.target.value }))} />
          <Input label="Extra weight" type="number" value={purchaseForm.extraWeightKg} onChange={(e) => setPurchaseForm((s) => ({ ...s, extraWeightKg: e.target.value }))} />
          <Input label="Bag price" type="number" value={purchaseForm.bagPrice} onChange={(e) => setPurchaseForm((s) => ({ ...s, bagPrice: e.target.value }))} />
          <Input label="Labour price" type="number" value={purchaseForm.labourPrice} onChange={(e) => setPurchaseForm((s) => ({ ...s, labourPrice: e.target.value }))} />
          <div className="sm:col-span-2">
            <Input label="Note (optional)" value={purchaseForm.notes} onChange={(e) => setPurchaseForm((s) => ({ ...s, notes: e.target.value }))} />
          </div>
        </div>
        {purchasePreview && (
          <p className="text-sm mt-3">
            {purchasePreview.bags} bags · {formatNumber(purchasePreview.totalWeightKg, 2)} kg · grain {formatCurrency(purchasePreview.grainAmount)} + bags {formatCurrency(purchasePreview.bagAmount)} + labour {formatCurrency(purchasePreview.labourAmount)} = <strong>{formatCurrency(purchasePreview.totalPrice)}</strong>
          </p>
        )}
        <div className="flex gap-2 mt-4">
          <Button variant="secondary" onClick={() => void calculatePurchase()}>Calculate</Button>
          <Button loading={saving} onClick={() => void savePurchase()}>Save</Button>
        </div>
      </Modal>

      <Modal open={giveOpen} onClose={() => setGiveOpen(false)} title="Give Amount">
        <div className="space-y-3">
          <select className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2.5" value={giveForm.partyId} onChange={(e) => setGiveForm((s) => ({ ...s, partyId: e.target.value }))}>
            <option value="">Choose party</option>
            {book.purchaseParties.map((p) => <option key={p.id} value={p.id}>{p.name} · remaining {formatCurrency(p.remaining)}</option>)}
          </select>
          <Input label="Amount" type="number" value={giveForm.amount} onChange={(e) => setGiveForm((s) => ({ ...s, amount: e.target.value }))} />
          <Input label="Note (optional)" value={giveForm.notes} onChange={(e) => setGiveForm((s) => ({ ...s, notes: e.target.value }))} />
          <Button className="w-full" loading={saving} onClick={() => void saveGive()}>Save</Button>
        </div>
      </Modal>

      <Modal open={!!processOpen} onClose={() => setProcessOpen(null)} title={`Process ${processOpen || ''}`}>
        <div className="space-y-3">
          <Input label="Variety of rice" value={processForm.riceVariety} onChange={(e) => setProcessForm((s) => ({ ...s, riceVariety: e.target.value }))} />
          <Input label="No. of bags" type="number" min="1" value={processForm.bags} onChange={(e) => setProcessForm((s) => ({ ...s, bags: e.target.value }))} />
          <Input label="Note (optional)" value={processForm.notes} onChange={(e) => setProcessForm((s) => ({ ...s, notes: e.target.value }))} />
          <Button className="w-full" loading={saving} onClick={() => void saveProcess()}>Start processing</Button>
        </div>
      </Modal>

      <Modal open={!!completeOpen} onClose={() => setCompleteOpen(null)} title="Processing complete">
        <div className="space-y-3">
          <Button className="w-full" loading={saving} onClick={() => completeOpen && void saveComplete(completeOpen)}>
            Move to Sell Rice
          </Button>
        </div>
      </Modal>

      <Modal open={!!expenseOpen} onClose={() => setExpenseOpen(null)} title={`Pay Bill/Amount · ${expenseOpen || ''}`}>
        <div className="space-y-3">
          <Input label="Amount" type="number" value={expenseForm.amount} onChange={(e) => setExpenseForm((s) => ({ ...s, amount: e.target.value }))} />
          <Input label="Bill reason" value={expenseForm.reason} onChange={(e) => setExpenseForm((s) => ({ ...s, reason: e.target.value }))} />
          <Button className="w-full" loading={saving} onClick={() => void saveExpense()}>Save</Button>
        </div>
      </Modal>

      <Modal open={sellOpen} onClose={() => setSellOpen(false)} title="Sell Rice">
        <div className="space-y-3">
          <select className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2.5" value={sellForm.partyId} onChange={(e) => setSellForm((s) => ({ ...s, partyId: e.target.value }))}>
            <option value="">Name of party</option>
            {book.saleParties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {selectedSellParty && (
            <p className="text-sm text-slate-500">Address: {selectedSellParty.address || '—'}</p>
          )}
          <label className="space-y-1.5">
            <span className="block text-sm font-medium">Variety of rice</span>
            <input
              className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2.5"
              list="ready-rice-varieties"
              value={sellForm.variety}
              onChange={(e) => setSellForm((s) => ({ ...s, variety: e.target.value }))}
          placeholder="Search"
            />
            <datalist id="ready-rice-varieties">
              {book.riceVarieties.filter((item) => item.remainingBags > 0).map((item) => (
                <option key={item.variety} value={item.variety}>{formatNumber(item.remainingBags, 0)} bags ready</option>
              ))}
            </datalist>
            {!!book.riceVarieties.filter((item) => item.remainingBags > 0).length && (
              <p className="text-xs text-slate-500">
                Ready now: {book.riceVarieties.filter((item) => item.remainingBags > 0).map((item) => `${item.variety} (${formatNumber(item.remainingBags, 0)})`).join(', ')}
              </p>
            )}
          </label>
          <Input
            label={selectedRiceStock ? `No. of bags (max ${formatNumber(riceReady, 0)})` : 'No. of bags'}
            type="number"
            min="1"
            max={riceReady || undefined}
            value={sellForm.bags}
            onChange={(e) => setSellForm((s) => ({ ...s, bags: e.target.value }))}
          />
          {selectedRiceStock && (
            <p className="text-sm text-slate-500">Ready to sell: {formatNumber(riceReady, 0)} bags of {selectedRiceStock.variety} in Sell Rice. You cannot sell more than this.</p>
          )}
          <Input label="Weight of one bag" type="number" value={sellForm.bagWeightKg} onChange={(e) => setSellForm((s) => ({ ...s, bagWeightKg: e.target.value }))} />
          <Input label="Rate per 40 KG" type="number" value={sellForm.ratePer40Kg} onChange={(e) => setSellForm((s) => ({ ...s, ratePer40Kg: e.target.value }))} />
          <Input label="Note (optional)" value={sellForm.notes} onChange={(e) => setSellForm((s) => ({ ...s, notes: e.target.value }))} />
          <Button className="w-full" loading={saving} onClick={() => void saveSell()}>Save</Button>
        </div>
      </Modal>

      <Modal open={receiveOpen} onClose={() => setReceiveOpen(false)} title="Receive Amount">
        <div className="space-y-3">
          <select className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2.5" value={receiveForm.partyId} onChange={(e) => setReceiveForm((s) => ({ ...s, partyId: e.target.value }))}>
            <option value="">Choose party</option>
            {book.saleParties.map((p) => <option key={p.id} value={p.id}>{p.name} · remaining {formatCurrency(p.remaining)}</option>)}
          </select>
          {selectedReceiveParty && (
            <p className="text-sm text-slate-500">Remaining {formatCurrency(selectedReceiveParty.remaining)}</p>
          )}
          <Input label="Amount" type="number" value={receiveForm.amount} onChange={(e) => setReceiveForm((s) => ({ ...s, amount: e.target.value }))} />
          <Input label="Note (optional)" value={receiveForm.notes} onChange={(e) => setReceiveForm((s) => ({ ...s, notes: e.target.value }))} />
          <Button className="w-full" loading={saving} onClick={() => void saveReceive()}>Save</Button>
        </div>
      </Modal>
    </div>
  )
}

function RiceSellFrame({
  item,
  onSell,
}: {
  item: PaddyKhataBook['riceVarieties'][number]
  onSell: () => void
}) {
  const ready = item.remainingBags > 0
  return (
    <div className="card-3d p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-[#C5A059]">Sell Rice</p>
          <p className="text-lg font-semibold mt-0.5">{item.variety}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${ready ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-white/10'}`}>
          {ready ? 'Ready' : 'Sold'}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Processed</p>
          <p className="font-semibold">{formatNumber(item.bags, 0)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Sold</p>
          <p className="font-semibold">{formatNumber(item.soldBags, 0)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Can sell</p>
          <p className="font-semibold text-emerald-700 dark:text-emerald-400">{formatNumber(item.remainingBags, 0)}</p>
        </div>
      </div>
      {item.lines.map((row) => (
        <p key={row.id} className="text-xs text-slate-500">{row.day} · {row.date} · {formatNumber(row.bags, 0)} bags{row.notes ? ` · ${row.notes}` : ''}</p>
      ))}
      <Button size="sm" disabled={!ready} onClick={onSell}>
        <ShoppingBag className="h-3.5 w-3.5" /> Sell {formatNumber(item.remainingBags, 0)} bags
      </Button>
    </div>
  )
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="card-3d overflow-hidden">
      <div className="px-5 py-3 bg-[#002D62] text-white font-semibold flex items-center justify-between gap-2">
        <span className="flex items-center gap-2"><History className="h-4 w-4 text-[#C5A059]" /> {title}</span>
        {action}
      </div>
      {children}
    </div>
  )
}

function MoneyTable({
  rows,
  empty,
  amountLabel = 'Amount',
}: {
  rows: Array<{ id: number; amount: number; notes?: string | null; day: string; date: string; time: string }>
  empty: string
  amountLabel?: string
}) {
  if (!rows.length) return <p className="p-5 text-sm text-slate-500">{empty}</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500 border-b border-slate-100 dark:border-white/10">
            <th className="px-4 py-2">Day</th>
            <th className="px-4 py-2">Time</th>
            <th className="px-4 py-2">{amountLabel}</th>
            <th className="px-4 py-2">Note</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-slate-50 dark:border-white/5">
              <td className="px-4 py-2">{row.day} · {row.date}</td>
              <td className="px-4 py-2">{row.time}</td>
              <td className="px-4 py-2">{amountLabel === 'Bags' ? formatNumber(row.amount, 0) : formatCurrency(row.amount)}</td>
              <td className="px-4 py-2">{row.notes || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PartyCards({
  parties,
  empty,
  mode,
  onBill,
  onCash,
  cashLabel,
}: {
  parties: PaddyKhataParty[]
  empty: string
  mode: 'PURCHASE' | 'SALE'
  onBill: (party: PaddyKhataParty) => void
  onCash?: (party: PaddyKhataParty) => void
  cashLabel?: string
}) {
  if (!parties.length) return empty ? <p className="text-sm text-slate-500">{empty}</p> : null
  const cashWord = mode === 'PURCHASE' ? 'Amount given' : 'Amount received'
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {parties.map((party) => {
        const lines = mode === 'PURCHASE' ? (party.purchases || []) : (party.sales || [])
        return (
          <div key={party.id} className="card-3d p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{party.name}</p>
                <p className="text-xs text-slate-500">{party.address || 'No address'}</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => onBill(party)}>Bill</Button>
            </div>
            {lines.length ? (
              <div className="space-y-1">
                {lines.map((row) => (
                  <p key={row.id} className="text-xs text-slate-500">
                    {row.date} · {row.variety} · {formatNumber(row.bags, 0)} bags · {formatCurrency(row.totalPrice)}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">No product yet</p>
            )}
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Total amount</p>
                <p className="font-semibold">{formatCurrency(party.productTotal)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">{cashWord}</p>
                <p className="font-semibold">{formatCurrency(party.cashTotal)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Remaining</p>
                <p className="font-semibold">{formatCurrency(party.remaining)}</p>
              </div>
            </div>
            {onCash && (
              <Button size="sm" onClick={() => onCash(party)}>{cashLabel || 'Amount'}</Button>
            )}
          </div>
        )
      })}
    </div>
  )
}
