import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ArrowLeft, Banknote, FileText, History, Leaf, Lock, Package, Plus, ShoppingBag, Truck, Wallet,
} from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import { TableSkeleton } from '../components/ui/Skeleton'
import { billApi, paddyKhataApi } from '../services/api'
import { billErrorMessage, openHtmlBill } from '../utils/bill'
import { formatCurrency, formatNumber } from '../utils/format'
import { useLiveReload } from '../context/SyncContext'
import type { PaddyKhataBook, PaddyKhataBookSummary, PaddyKhataParty } from '../types'

type Section =
  | 'HOME'
  | 'AMOUNTS'
  | 'PURCHASE'
  | 'VARIETY'
  | 'RICE'
  | 'SELL'
  | 'RECEIVE'

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
  const [book, setBook] = useState<PaddyKhataBook | null>(null)
  const [secret, setSecret] = useState('')
  const [section, setSection] = useState<Section>('HOME')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [billing, setBilling] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [unlockOpen, setUnlockOpen] = useState<PaddyKhataBookSummary | null>(null)
  const [createForm, setCreateForm] = useState({ name: '', secret: '' })
  const [unlockSecret, setUnlockSecret] = useState('')

  const [amountOpen, setAmountOpen] = useState(false)
  const [partyOpen, setPartyOpen] = useState<'PURCHASE' | 'SALE' | null>(null)
  const [purchaseOpen, setPurchaseOpen] = useState(false)
  const [giveOpen, setGiveOpen] = useState(false)
  const [processOpen, setProcessOpen] = useState<string | null>(null)
  const [riceOpen, setRiceOpen] = useState(false)
  const [sellOpen, setSellOpen] = useState(false)
  const [receiveOpen, setReceiveOpen] = useState(false)

  const [amountForm, setAmountForm] = useState({ amount: '', notes: '' })
  const [partyForm, setPartyForm] = useState({ name: '', address: '', notes: '' })
  const [purchaseForm, setPurchaseForm] = useState(emptyPurchase)
  const [giveForm, setGiveForm] = useState({ partyId: '', amount: '', notes: '' })
  const [processForm, setProcessForm] = useState({ partyName: '', bags: '', notes: '' })
  const [riceForm, setRiceForm] = useState({ bags: '', notes: '' })
  const [sellForm, setSellForm] = useState({ partyId: '', bags: '', bagWeightKg: '40', ratePer40Kg: '', notes: '' })
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
      const res = await paddyKhataApi.list()
      setBooks(res.data.data || [])
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
      })
      toast.success('Paddy Khata ID created')
      setCreateOpen(false)
      setCreateForm({ name: '', secret: '' })
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
      toast.success('Amount added to this Paddy Khata ID only')
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
      toast.success('Purchase saved to this party and deducted from total amount')
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
        partyName: processForm.partyName.trim(),
        bags: Number(processForm.bags),
        notes: processForm.notes.trim() || undefined,
      })
      toast.success('Variety row sent to processing')
      setProcessOpen(null)
      setProcessForm({ partyName: '', bags: '', notes: '' })
      refresh()
    } catch (err) {
      toast.error(apiMessage(err, 'Could not process'))
    } finally {
      setSaving(false)
    }
  }

  const saveRice = async () => {
    if (!book) return
    setSaving(true)
    try {
      await paddyKhataApi.addRice(book.id, {
        secret,
        bags: Number(riceForm.bags),
        notes: riceForm.notes.trim() || undefined,
      })
      toast.success('Rice bags added from processed stock')
      setRiceOpen(false)
      setRiceForm({ bags: '', notes: '' })
      refresh()
    } catch (err) {
      toast.error(apiMessage(err, 'Could not add rice'))
    } finally {
      setSaving(false)
    }
  }

  const saveSell = async () => {
    if (!book) return
    setSaving(true)
    try {
      await paddyKhataApi.addSale(book.id, {
        secret,
        partyId: Number(sellForm.partyId),
        bags: Number(sellForm.bags),
        bagWeightKg: Number(sellForm.bagWeightKg || 40),
        ratePer40Kg: Number(sellForm.ratePer40Kg),
        notes: sellForm.notes.trim() || undefined,
      })
      toast.success('Rice sold')
      setSellOpen(false)
      setSellForm({ partyId: '', bags: '', bagWeightKg: '40', ratePer40Kg: '', notes: '' })
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
          description="Separate paddy books. Each Paddy Khata ID has its own secret code and stays out of the main shop cash."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> Paddy Khata ID
            </Button>
          }
        />
        {loading ? (
          <TableSkeleton rows={4} />
        ) : !books.length ? (
          <div className="card-3d p-8 text-center">
            <Leaf className="h-8 w-8 mx-auto text-[#C5A059] mb-3" />
            <p className="font-semibold">No Paddy Khata ID yet</p>
            <p className="text-sm text-slate-500 mt-1">Tap the plus button to create one and set a secret code.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {books.map((item) => (
              <button
                key={item.id}
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
                className="card-3d p-5 text-left hover:bg-slate-50 dark:hover:bg-white/5"
              >
                <p className="text-xs uppercase tracking-wide text-slate-500">{item.publicId}</p>
                <p className="text-lg font-semibold mt-1">{item.name}</p>
                <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Secret code required
                </p>
              </button>
            ))}
          </div>
        )}

        <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Paddy Khata ID">
          <div className="space-y-3">
            <Input label="Name" value={createForm.name} onChange={(e) => setCreateForm((s) => ({ ...s, name: e.target.value }))} placeholder="Paddy Khata" />
            <Input label="Secret code" type="password" value={createForm.secret} onChange={(e) => setCreateForm((s) => ({ ...s, secret: e.target.value }))} placeholder="At least 4 characters" />
            <Button className="w-full" loading={saving} onClick={() => void saveCreate()}>Save ID</Button>
          </div>
        </Modal>
        <Modal open={!!unlockOpen} onClose={() => setUnlockOpen(null)} title={unlockOpen ? `Open ${unlockOpen.publicId}` : 'Open'}>
          <div className="space-y-3">
            <Input label="Secret code" type="password" value={unlockSecret} onChange={(e) => setUnlockSecret(e.target.value)} />
            <Button className="w-full" loading={saving} onClick={() => void saveUnlock()}>Open</Button>
          </div>
        </Modal>
      </div>
    )
  }

  const { totals } = book

  return (
    <div className="space-y-6">
      <PageHeader
        title={book.name}
        description={`${book.publicId} · separate from shop cash until you print a bill`}
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
        <button type="button" onClick={() => setSection('RECEIVE')} className="card-3d p-5 text-left">
          <p className="text-xs uppercase tracking-wide text-slate-500">Receiving amount</p>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">{formatCurrency(totals.receivingAmount)}</p>
        </button>
        <button type="button" onClick={() => setSection('PURCHASE')} className="card-3d p-5 text-left">
          <p className="text-xs uppercase tracking-wide text-slate-500">Giving amount</p>
          <p className="text-2xl font-bold text-rose-700 dark:text-rose-400 mt-1">{formatCurrency(totals.givingAmount)}</p>
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {([
          { id: 'AMOUNTS' as const, label: 'Add Amount', icon: Banknote },
          { id: 'PURCHASE' as const, label: 'Purchase Stock', icon: Truck },
          { id: 'VARIETY' as const, label: 'Variety', icon: Package },
          { id: 'RICE' as const, label: 'Add Rice', icon: Leaf },
          { id: 'SELL' as const, label: 'Sell Rice', icon: ShoppingBag },
          { id: 'RECEIVE' as const, label: 'Receive Amount', icon: Wallet },
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
            <p className="text-xs uppercase tracking-wide text-slate-500">Rice in stock</p>
            <p className="text-xl font-semibold mt-1">{formatNumber(totals.riceInStock, 0)}</p>
          </div>
          <div className="card-3d p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Sold rice</p>
            <p className="text-xl font-semibold mt-1">{formatNumber(totals.soldBags, 0)}</p>
          </div>
        </div>
      )}

      {section === 'AMOUNTS' && (
        <Panel title="Add Amount" action={<Button onClick={() => setAmountOpen(true)}><Plus className="h-4 w-4" /> Add Amount</Button>}>
          <MoneyTable rows={book.amounts} empty="No amount added yet. This cash stays in this Paddy Khata ID and is not mixed with shop cash." />
        </Panel>
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
            empty=""
            onBill={(p) => void openBill(undefined, p.id)}
            onCash={(p) => { setGiveForm({ partyId: String(p.id), amount: '', notes: '' }); setGiveOpen(true) }}
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
            <p className="text-sm text-slate-500">Varieties appear here after Purchase Product. Each variety gets its own frame.</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {book.varieties.map((item) => (
                <div key={item.variety} className="card-3d p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold">{item.variety}</p>
                      <p className="text-xs text-slate-500">Rate and bags come from Purchase Product</p>
                    </div>
                    <Button size="sm" onClick={() => { setProcessOpen(item.variety); setProcessForm({ partyName: '', bags: String(item.remainingBags || ''), notes: '' }) }}>Process</Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <p>Bags {formatNumber(item.bags, 0)}</p>
                    <p>Extra {formatNumber(item.extraWeightKg, 2)} kg</p>
                    <p>Weight {formatNumber(item.totalWeightKg, 2)} kg</p>
                    <p>Amount {formatCurrency(item.totalPrice)}</p>
                    <p>Processed {formatNumber(item.processedBags, 0)}</p>
                    <p className="font-medium">Left {formatNumber(item.remainingBags, 0)}</p>
                  </div>
                  {item.lines.map((row) => (
                    <p key={row.id} className="text-xs text-slate-500">
                      {row.day} · {row.partyName} · {formatNumber(row.bags, 0)} bags · {formatNumber(row.bagWeightKg, 2)} kg/bag · rate {formatCurrency(row.ratePer40Kg)} / 40 kg · {formatCurrency(row.totalPrice)}
                    </p>
                  ))}
                  {book.processes.filter((row) => row.variety === item.variety).map((row) => (
                    <p key={row.id} className="text-xs text-emerald-700 dark:text-emerald-400">
                      Processed {formatNumber(row.bags, 0)} bags to {row.partyName} · {row.date}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {section === 'RICE' && (
        <Panel title="Add Rice" action={<Button onClick={() => setRiceOpen(true)}><Plus className="h-4 w-4" /> Add Rice bags</Button>}>
          <p className="px-5 pt-3 text-xs text-slate-500">Processed {formatNumber(totals.processedBags, 0)} · rice {formatNumber(totals.riceBags, 0)} · in stock {formatNumber(totals.riceInStock, 0)}</p>
          <MoneyTable
            rows={book.riceLots.map((row) => ({ ...row, amount: row.bags }))}
            empty="Process a variety first, then add rice bags."
            amountLabel="Bags"
          />
        </Panel>
      )}

      {section === 'SELL' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => { setPartyForm({ name: '', address: '', notes: '' }); setPartyOpen('SALE') }}><Plus className="h-4 w-4" /> Add Party</Button>
            <Button onClick={() => setSellOpen(true)}><ShoppingBag className="h-4 w-4" /> Sell Rice</Button>
          </div>
          <PartyCards parties={book.saleParties} onBill={(p) => void openBill(undefined, p.id)} empty="Add a rice party, then sell rice." />
        </div>
      )}

      {section === 'RECEIVE' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Receive party by party. You can take less now and the rest later. Received cash is added to this Paddy Khata total.</p>
          <PartyCards
            parties={book.saleParties}
            onBill={(p) => void openBill(undefined, p.id)}
            onCash={(p) => { setReceiveForm({ partyId: String(p.id), amount: p.remaining > 0 ? String(p.remaining) : '', notes: '' }); setReceiveOpen(true) }}
            cashLabel="Receive Amount"
            empty="Sell rice first, then receive party by party."
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
          <p className="text-sm text-slate-500">Purchase Product already deducts from total amount. Use this for extra cash given to a purchase party.</p>
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
          <Input label="Name of party" value={processForm.partyName} onChange={(e) => setProcessForm((s) => ({ ...s, partyName: e.target.value }))} />
          <Input label="No. of bags" type="number" value={processForm.bags} onChange={(e) => setProcessForm((s) => ({ ...s, bags: e.target.value }))} />
          <Input label="Note (optional)" value={processForm.notes} onChange={(e) => setProcessForm((s) => ({ ...s, notes: e.target.value }))} />
          <Button className="w-full" loading={saving} onClick={() => void saveProcess()}>Process</Button>
        </div>
      </Modal>

      <Modal open={riceOpen} onClose={() => setRiceOpen(false)} title="Add Rice bags">
        <div className="space-y-3">
          <Input label="Add Rice bags" type="number" value={riceForm.bags} onChange={(e) => setRiceForm((s) => ({ ...s, bags: e.target.value }))} />
          <Input label="Note (optional)" value={riceForm.notes} onChange={(e) => setRiceForm((s) => ({ ...s, notes: e.target.value }))} />
          <Button className="w-full" loading={saving} onClick={() => void saveRice()}>Save</Button>
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
          <Input label="No. of bags" type="number" value={sellForm.bags} onChange={(e) => setSellForm((s) => ({ ...s, bags: e.target.value }))} />
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
            <p className="text-sm text-slate-500">You can receive less now and the rest later. Remaining {formatCurrency(selectedReceiveParty.remaining)}</p>
          )}
          <Input label="Amount" type="number" value={receiveForm.amount} onChange={(e) => setReceiveForm((s) => ({ ...s, amount: e.target.value }))} />
          <Input label="Note (optional)" value={receiveForm.notes} onChange={(e) => setReceiveForm((s) => ({ ...s, notes: e.target.value }))} />
          <Button className="w-full" loading={saving} onClick={() => void saveReceive()}>Save</Button>
        </div>
      </Modal>
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
  onBill,
  onCash,
  cashLabel,
}: {
  parties: PaddyKhataParty[]
  empty: string
  onBill: (party: PaddyKhataParty) => void
  onCash?: (party: PaddyKhataParty) => void
  cashLabel?: string
}) {
  if (!parties.length) return empty ? <p className="text-sm text-slate-500">{empty}</p> : null
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {parties.map((party) => (
        <div key={party.id} className="card-3d p-5 space-y-1">
          <p className="font-semibold">{party.name}</p>
          <p className="text-xs text-slate-500">{party.address || 'No address'}</p>
          <p className="text-sm">Product {formatCurrency(party.productTotal)} · cash {formatCurrency(party.cashTotal)}</p>
          <p className="text-sm font-medium">Remaining {formatCurrency(party.remaining)}</p>
          <div className="flex flex-wrap gap-2 pt-2">
            {onCash && (
              <Button size="sm" onClick={() => onCash(party)}>{cashLabel || 'Amount'}</Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => onBill(party)}>Bill</Button>
          </div>
        </div>
      ))}
    </div>
  )
}
