import { useCallback, useEffect, useMemo, useState } from 'react'
import { Banknote, HandCoins, PackagePlus, Plus, Truck, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import { TableSkeleton } from '../components/ui/Skeleton'
import PartyCombobox from '../components/forms/PartyCombobox'
import { wheatKhataApi } from '../services/api'
import { formatCurrency, formatNumber } from '../utils/format'
import { useLiveReload } from '../context/SyncContext'
import { useVoicePageActions } from '../context/VoiceControlContext'
import type { WheatKhataBook, WheatKhataParty } from '../types'

type Section = 'MONEY' | 'RECEIVING' | 'GIVING'
type PartyKind = 'RECEIVING' | 'GIVING'

const emptyBook: WheatKhataBook = {
  totals: {
    moneyIn: 0,
    receivingAmount: 0,
    givingAmount: 0,
    cashGiven: 0,
    cashReceived: 0,
    totalAmount: 0,
  },
  money: [],
  receivingParties: [],
  givingParties: [],
}

const emptyProductForm = {
  partyId: '',
  bags: '',
  ratePerBag: '',
  bagWeightKg: '40',
  bagPricePerBag: '',
  labourPerBag: '',
  notes: '',
}

function apiMessage(err: unknown, fallback: string) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback
}

function moneyOrZero(value: string) {
  if (!value.trim()) return 0
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function productPreview(
  bags: string,
  ratePerBag: string,
  bagWeightKg = '40',
  bagPricePerBag = '',
  labourPerBag = '',
) {
  const bagsN = Number(bags)
  const rateN = Number(ratePerBag)
  const kgN = Number(bagWeightKg || 40)
  if (!Number.isInteger(bagsN) || bagsN <= 0 || !Number.isFinite(rateN) || rateN <= 0) {
    return null
  }
  const bagPrice = moneyOrZero(bagPricePerBag)
  const labour = moneyOrZero(labourPerBag)
  const wheatAmount = Math.round(bagsN * rateN)
  const bagAmount = Math.round(bagsN * bagPrice)
  const labourAmount = Math.round(bagsN * labour)
  const weight = Number.isFinite(kgN) && kgN > 0 ? bagsN * kgN : bagsN * 40
  return {
    bags: bagsN,
    ratePerBag: rateN,
    bagPricePerBag: bagPrice,
    labourPerBag: labour,
    wheatAmount,
    bagAmount,
    labourAmount,
    totalPrice: wheatAmount + bagAmount + labourAmount,
    totalWeightKg: Math.round(weight * 100) / 100,
  }
}

export default function WheatKhataPage() {
  const [section, setSection] = useState<Section>('MONEY')
  const [book, setBook] = useState<WheatKhataBook>(emptyBook)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [moneyOpen, setMoneyOpen] = useState(false)
  const [partyOpen, setPartyOpen] = useState(false)
  const [productOpen, setProductOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [detailParty, setDetailParty] = useState<WheatKhataParty | null>(null)

  const [moneyForm, setMoneyForm] = useState({ amount: '', notes: '' })
  const [partyForm, setPartyForm] = useState({ name: '', address: '', notes: '' })
  const [productForm, setProductForm] = useState(emptyProductForm)
  const [paymentForm, setPaymentForm] = useState({ partyId: '', amount: '', notes: '' })
  const [calculated, setCalculated] = useState<ReturnType<typeof productPreview>>(null)

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      const res = await wheatKhataApi.book()
      setBook(res.data.data || emptyBook)
    } catch (err) {
      toast.error(apiMessage(err, 'Could not load Wheat Khata'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])
  useLiveReload(() => { void load(true) })

  const parties = section === 'GIVING' ? book.givingParties : book.receivingParties
  const selectedProductParty = useMemo(
    () => parties.find((p) => String(p.id) === productForm.partyId) || null,
    [parties, productForm.partyId],
  )
  const selectedPaymentParty = useMemo(
    () => parties.find((p) => String(p.id) === paymentForm.partyId) || null,
    [parties, paymentForm.partyId],
  )
  const livePreview = productPreview(
    productForm.bags,
    productForm.ratePerBag,
    productForm.bagWeightKg,
    productForm.bagPricePerBag,
    productForm.labourPerBag,
  )

  const openMoney = () => {
    setSection('MONEY')
    setMoneyForm({ amount: '', notes: '' })
    setMoneyOpen(true)
  }

  const openParty = (kind: PartyKind) => {
    setSection(kind)
    setPartyForm({ name: '', address: '', notes: '' })
    setPartyOpen(true)
  }

  const openProduct = (kind: PartyKind, partyId = '') => {
    setSection(kind)
    setProductForm({ ...emptyProductForm, partyId })
    setCalculated(null)
    setProductOpen(true)
  }

  const openPayment = (kind: PartyKind, partyId = '') => {
    setSection(kind)
    setPaymentForm({ partyId, amount: '', notes: '' })
    setPaymentOpen(true)
  }

  useVoicePageActions({
    openCreate: () => {
      if (section === 'MONEY') openMoney()
      else if (section === 'RECEIVING') openParty('RECEIVING')
      else openParty('GIVING')
    },
    refresh: () => { void load() },
    save: () => {
      if (moneyOpen) void saveMoney()
      else if (partyOpen) void saveParty()
      else if (productOpen) void saveProduct()
      else if (paymentOpen) void savePayment()
    },
    cancel: () => {
      setMoneyOpen(false)
      setPartyOpen(false)
      setProductOpen(false)
      setPaymentOpen(false)
      setDetailParty(null)
    },
  })

  const saveMoney = async () => {
    const amount = Number(moneyForm.amount)
    if (!amount || amount <= 0) {
      toast.error('Enter the amount')
      return
    }
    setSaving(true)
    try {
      await wheatKhataApi.addMoney({
        amount,
        notes: moneyForm.notes.trim() || undefined,
      })
      toast.success('Money added to Wheat Khata')
      setMoneyForm({ amount: '', notes: '' })
      setMoneyOpen(false)
      void load(true)
    } catch (err) {
      toast.error(apiMessage(err, 'Could not add money'))
    } finally {
      setSaving(false)
    }
  }

  const saveParty = async () => {
    if (!partyForm.name.trim()) {
      toast.error('Party name is required')
      return
    }
    const kind: PartyKind = section === 'GIVING' ? 'GIVING' : 'RECEIVING'
    setSaving(true)
    try {
      await wheatKhataApi.addParty({
        kind,
        name: partyForm.name.trim(),
        address: partyForm.address.trim() || undefined,
        notes: partyForm.notes.trim() || undefined,
      })
      toast.success(kind === 'RECEIVING' ? 'Receiving party saved' : 'Selling party saved')
      setPartyForm({ name: '', address: '', notes: '' })
      setPartyOpen(false)
      void load(true)
    } catch (err) {
      toast.error(apiMessage(err, 'Could not save party'))
    } finally {
      setSaving(false)
    }
  }

  const calculateProduct = () => {
    const preview = productPreview(
      productForm.bags,
      productForm.ratePerBag,
      productForm.bagWeightKg,
      productForm.bagPricePerBag,
      productForm.labourPerBag,
    )
    if (!preview) {
      toast.error('Enter bags and rate of one bag first')
      return
    }
    setCalculated(preview)
    toast.success(
      `Wheat ${formatCurrency(preview.wheatAmount)} + bags ${formatCurrency(preview.bagAmount)} + labour ${formatCurrency(preview.labourAmount)} = ${formatCurrency(preview.totalPrice)}`,
    )
  }

  const saveProduct = async () => {
    if (!productForm.partyId) {
      toast.error('Choose a party name first')
      return
    }
    const preview = productPreview(
      productForm.bags,
      productForm.ratePerBag,
      productForm.bagWeightKg,
      productForm.bagPricePerBag,
      productForm.labourPerBag,
    )
    if (!preview) {
      toast.error('Enter bags and rate of one bag')
      return
    }
    setSaving(true)
    try {
      await wheatKhataApi.addProduct({
        partyId: Number(productForm.partyId),
        bags: preview.bags,
        ratePerBag: preview.ratePerBag,
        bagWeightKg: Number(productForm.bagWeightKg || 40),
        bagPricePerBag: preview.bagPricePerBag,
        labourPerBag: preview.labourPerBag,
        notes: productForm.notes.trim() || undefined,
      })
      toast.success(
        section === 'GIVING'
          ? 'Product given — wheat, bag price, and labour added to giving amount'
          : 'Product received — wheat, bag price, and labour added to receiving amount',
      )
      setProductForm(emptyProductForm)
      setCalculated(null)
      setProductOpen(false)
      void load(true)
    } catch (err) {
      toast.error(apiMessage(err, 'Could not save product'))
    } finally {
      setSaving(false)
    }
  }

  const savePayment = async () => {
    if (!paymentForm.partyId) {
      toast.error('Choose a party name first')
      return
    }
    const amount = Number(paymentForm.amount)
    if (!amount || amount <= 0) {
      toast.error('Enter the amount')
      return
    }
    setSaving(true)
    try {
      await wheatKhataApi.addPayment({
        partyId: Number(paymentForm.partyId),
        amount,
        notes: paymentForm.notes.trim() || undefined,
      })
      toast.success(
        section === 'GIVING'
          ? 'Amount received — added to total money'
          : 'Amount given — deducted from total money',
      )
      setPaymentForm({ partyId: '', amount: '', notes: '' })
      setPaymentOpen(false)
      void load(true)
    } catch (err) {
      toast.error(apiMessage(err, 'Could not save amount'))
    } finally {
      setSaving(false)
    }
  }

  const { totals } = book
  const partyKind: PartyKind = section === 'GIVING' ? 'GIVING' : 'RECEIVING'
  const preview = calculated || livePreview

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wheat Khata"
        description="Receive wheat and give cash to receiving parties. Give wheat and receive cash from selling parties."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card-3d p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total amount</p>
          <p className="text-2xl font-bold text-primary mt-1">{formatCurrency(totals.totalAmount)}</p>
          <p className="text-[11px] text-slate-500 mt-1">
            Add money {formatCurrency(totals.moneyIn)} + received {formatCurrency(totals.cashReceived)} − given {formatCurrency(totals.cashGiven)}
          </p>
        </div>
        <div className="card-3d p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">Receiving amount</p>
          <p className="text-2xl font-bold text-rose-700 dark:text-rose-400 mt-1">{formatCurrency(totals.receivingAmount)}</p>
          <p className="text-[11px] text-slate-500 mt-1">Wheat + bag price + labour from receiving parties</p>
        </div>
        <div className="card-3d p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">Giving amount</p>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">{formatCurrency(totals.givingAmount)}</p>
          <p className="text-[11px] text-slate-500 mt-1">Wheat + bag price + labour to selling parties</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {([
          { id: 'MONEY' as const, label: 'Add Money', icon: Banknote },
          { id: 'RECEIVING' as const, label: 'Add Receiving Party', icon: Truck },
          { id: 'GIVING' as const, label: 'Add Selling Party', icon: HandCoins },
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
            <p className="text-[11px] text-slate-500 mt-1">
              {item.id === 'MONEY' && 'Cash added to this khata'}
              {item.id === 'RECEIVING' && 'Receive wheat, then give amount'}
              {item.id === 'GIVING' && 'Give wheat, then receive amount'}
            </p>
          </button>
        ))}
      </div>

      {section === 'MONEY' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button onClick={openMoney}>
              <Plus className="h-4 w-4" /> Add Money
            </Button>
          </div>
          <div className="card-3d overflow-hidden">
            <div className="px-5 py-3 bg-[#002D62] text-white font-semibold flex items-center gap-2">
              <Wallet className="h-4 w-4 text-[#C5A059]" />
              Money added
            </div>
            {loading ? (
              <div className="p-4"><TableSkeleton rows={4} /></div>
            ) : !book.money.length ? (
              <p className="p-5 text-sm text-slate-500">No money added yet. Tap Add Money to deposit cash into this khata.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-100 dark:border-white/10">
                      <th className="px-4 py-2">Day</th>
                      <th className="px-4 py-2">Date</th>
                      <th className="px-4 py-2">Time</th>
                      <th className="px-4 py-2 text-right">Amount</th>
                      <th className="px-4 py-2">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {book.money.map((row) => (
                      <tr key={row.id} className="border-b border-slate-100 dark:border-white/10">
                        <td className="px-4 py-2">{row.day}</td>
                        <td className="px-4 py-2">{row.date}</td>
                        <td className="px-4 py-2">{row.time}</td>
                        <td className="px-4 py-2 text-right font-semibold">{formatCurrency(row.amount)}</td>
                        <td className="px-4 py-2 text-slate-500">{row.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {(section === 'RECEIVING' || section === 'GIVING') && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => openParty(partyKind)}>
              <Plus className="h-4 w-4" />
              {section === 'RECEIVING' ? 'Add Receiving Party' : 'Add Selling Party'}
            </Button>
            <Button variant="secondary" onClick={() => openProduct(partyKind)}>
              <PackagePlus className="h-4 w-4" />
              {section === 'RECEIVING' ? 'Receive Product' : 'Give Product'}
            </Button>
            <Button variant="secondary" onClick={() => openPayment(partyKind)}>
              <Wallet className="h-4 w-4" />
              {section === 'RECEIVING' ? 'Give Amount' : 'Receive Amount'}
            </Button>
          </div>
          <div className="px-1">
            <h3 className="text-sm font-semibold">
              {section === 'RECEIVING' ? 'Receiving parties' : 'Selling parties'}
            </h3>
            <p className="text-[11px] text-slate-500">
              {section === 'RECEIVING'
                ? 'You receive wheat here, not money. Give Amount pays the party and deducts from total money. Tap a party for full details.'
                : 'You give wheat here, not money. Receive Amount collects cash and adds to total money. Tap a party for full details.'}
            </p>
          </div>
          {loading ? (
            <div className="card-3d p-4"><TableSkeleton rows={3} /></div>
          ) : !parties.length ? (
            <p className="card-3d p-5 text-sm text-slate-500">
              {section === 'RECEIVING'
                ? 'Add a receiving party first, then receive product or give amount.'
                : 'Add a selling party first, then give product or receive amount.'}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {parties.map((p) => (
                <div key={p.id} className="card-3d p-4 space-y-3">
                  <button type="button" onClick={() => setDetailParty(p)} className="w-full text-left">
                    <p className="font-semibold truncate">{p.name}</p>
                    <p className="text-[11px] text-slate-500 truncate">{p.address || p.notes || 'No address'}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] mt-3">
                      <div className="rounded-lg bg-slate-50 dark:bg-white/5 px-2 py-1.5">
                        <div className="text-slate-500">Bags / kg</div>
                        <div className="font-semibold">{formatNumber(p.totalBags, 0)} · {formatNumber(p.totalWeightKg)} kg</div>
                      </div>
                      <div className="rounded-lg bg-slate-50 dark:bg-white/5 px-2 py-1.5">
                        <div className="text-slate-500">Product</div>
                        <div className="font-semibold">{formatCurrency(p.productTotal)}</div>
                      </div>
                      <div className={`rounded-lg px-2 py-1.5 ${
                        section === 'RECEIVING'
                          ? 'bg-rose-50 dark:bg-rose-500/10'
                          : 'bg-emerald-50 dark:bg-emerald-500/10'
                      }`}>
                        <div className="text-slate-500">{section === 'RECEIVING' ? 'Given' : 'Received'}</div>
                        <div className="font-semibold">{formatCurrency(p.cashTotal)}</div>
                      </div>
                      <div className="rounded-lg bg-slate-50 dark:bg-white/5 px-2 py-1.5">
                        <div className="text-slate-500">Balance</div>
                        <div className="font-semibold">{formatCurrency(Math.abs(p.remaining))}</div>
                      </div>
                    </div>
                  </button>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button size="sm" onClick={() => openProduct(partyKind, String(p.id))}>
                      {section === 'RECEIVING' ? 'Receive Product' : 'Give Product'}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => openPayment(partyKind, String(p.id))}>
                      {section === 'RECEIVING' ? 'Give Amount' : 'Receive Amount'}
                    </Button>
                    <button
                      type="button"
                      className="text-[11px] text-slate-500 underline-offset-2 hover:underline"
                      onClick={() => setDetailParty(p)}
                    >
                      Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Modal open={moneyOpen} onClose={() => setMoneyOpen(false)} title="Add Money">
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Cash deposited here increases the Wheat Khata total amount.</p>
          <Input
            label="Amount (PKR) *"
            type="number"
            min="0"
            value={moneyForm.amount}
            onChange={(e) => setMoneyForm({ ...moneyForm, amount: e.target.value })}
          />
          <Input
            label="Note (optional)"
            value={moneyForm.notes}
            onChange={(e) => setMoneyForm({ ...moneyForm, notes: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setMoneyOpen(false)}>Cancel</Button>
            <Button onClick={() => void saveMoney()} loading={saving}>Save</Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={partyOpen}
        onClose={() => setPartyOpen(false)}
        title={partyKind === 'RECEIVING' ? 'Add Receiving Party' : 'Add Selling Party'}
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            {partyKind === 'RECEIVING'
              ? 'Saved as a receiving party — owner receives wheat product from them, then gives amount.'
              : 'Saved as a selling party — owner gives wheat product, then receives amount from them.'}
          </p>
          <Input
            label="Name *"
            value={partyForm.name}
            onChange={(e) => setPartyForm({ ...partyForm, name: e.target.value })}
            placeholder="Type the party name"
          />
          <Input
            label="Address (optional)"
            value={partyForm.address}
            onChange={(e) => setPartyForm({ ...partyForm, address: e.target.value })}
          />
          <Input
            label="Note (optional)"
            value={partyForm.notes}
            onChange={(e) => setPartyForm({ ...partyForm, notes: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setPartyOpen(false)}>Cancel</Button>
            <Button onClick={() => void saveParty()} loading={saving}>Save</Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={productOpen}
        onClose={() => { setProductOpen(false); setCalculated(null) }}
        title={partyKind === 'RECEIVING' ? 'Receive Product' : 'Give Product'}
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            Type a few letters of the name (for example ahs) to autofill name and address. Total = (rate + bag price + labour) × bags.
          </p>
          <PartyCombobox
            label="Name"
            required
            items={parties.map((p) => ({
              id: String(p.id),
              name: p.name,
              address: p.address,
              notes: p.notes,
            }))}
            value={productForm.partyId}
            onChange={(id) => setProductForm({ ...productForm, partyId: id })}
            placeholder="Type ahs… then pick the name"
            emptyLabel={partyKind === 'RECEIVING' ? 'Add a receiving party first' : 'Add a selling party first'}
          />
          {selectedProductParty && (
            <div className="rounded-lg bg-slate-50 dark:bg-white/5 px-3 py-2 text-[12px] text-slate-600 dark:text-slate-300">
              <div className="font-medium">{selectedProductParty.name}</div>
              <div>{selectedProductParty.address || 'No address'}</div>
            </div>
          )}
          <Input
            label="Bags *"
            type="number"
            min="1"
            step="1"
            value={productForm.bags}
            onChange={(e) => { setProductForm({ ...productForm, bags: e.target.value }); setCalculated(null) }}
          />
          <Input
            label="Rate of one bag (PKR) *"
            type="number"
            min="0"
            value={productForm.ratePerBag}
            onChange={(e) => { setProductForm({ ...productForm, ratePerBag: e.target.value }); setCalculated(null) }}
          />
          <Input
            label="Bag price (per bag, PKR)"
            type="number"
            min="0"
            value={productForm.bagPricePerBag}
            onChange={(e) => { setProductForm({ ...productForm, bagPricePerBag: e.target.value }); setCalculated(null) }}
          />
          <Input
            label="Labour per bag (PKR)"
            type="number"
            min="0"
            value={productForm.labourPerBag}
            onChange={(e) => { setProductForm({ ...productForm, labourPerBag: e.target.value }); setCalculated(null) }}
          />
          <Input
            label="Weight of one bag (kg)"
            type="number"
            min="0"
            value={productForm.bagWeightKg}
            onChange={(e) => { setProductForm({ ...productForm, bagWeightKg: e.target.value }); setCalculated(null) }}
          />
          <Input
            label="Note (optional)"
            value={productForm.notes}
            onChange={(e) => setProductForm({ ...productForm, notes: e.target.value })}
          />
          {preview && (
            <div className="rounded-lg bg-primary/10 px-3 py-2 text-sm space-y-0.5">
              <div>Wheat: {preview.bags} × {formatCurrency(preview.ratePerBag)} = {formatCurrency(preview.wheatAmount)}</div>
              <div>Bag price: {preview.bags} × {formatCurrency(preview.bagPricePerBag)} = {formatCurrency(preview.bagAmount)}</div>
              <div>Labour: {preview.bags} × {formatCurrency(preview.labourPerBag)} = {formatCurrency(preview.labourAmount)}</div>
              <div className="font-semibold pt-1">
                Total: {formatCurrency(preview.totalPrice)} · {formatNumber(preview.totalWeightKg)} kg
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-300">
                {partyKind === 'RECEIVING'
                  ? 'Adds to receiving amount. Use Give Amount to pay cash.'
                  : 'Adds to giving amount. Use Receive Amount to collect cash.'}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => { setProductOpen(false); setCalculated(null) }}>Cancel</Button>
            <Button variant="secondary" onClick={calculateProduct}>Calculate</Button>
            <Button onClick={() => void saveProduct()} loading={saving} disabled={!parties.length}>Save</Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        title={partyKind === 'RECEIVING' ? 'Give Amount' : 'Receive Amount'}
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            {partyKind === 'RECEIVING'
              ? 'You received product from this party, not money. Give Amount pays them and deducts from total money.'
              : 'You gave product to this party, not money. Receive Amount collects cash and adds to total money.'}
          </p>
          <PartyCombobox
            label="Name"
            required
            items={parties.map((p) => ({
              id: String(p.id),
              name: p.name,
              address: p.address,
              notes: `Product ${formatCurrency(p.productTotal)} · ${partyKind === 'RECEIVING' ? 'Given' : 'Received'} ${formatCurrency(p.cashTotal)}`,
            }))}
            value={paymentForm.partyId}
            onChange={(id) => setPaymentForm({ ...paymentForm, partyId: id })}
            placeholder="Type ahs… then pick the name"
            emptyLabel={partyKind === 'RECEIVING' ? 'Add a receiving party first' : 'Add a selling party first'}
          />
          {selectedPaymentParty && (
            <div className="rounded-lg bg-slate-50 dark:bg-white/5 px-3 py-2 text-[12px] text-slate-600 dark:text-slate-300">
              <div className="font-medium">{selectedPaymentParty.name}</div>
              <div>{selectedPaymentParty.address || 'No address'}</div>
              <div>
                Product {formatCurrency(selectedPaymentParty.productTotal)} ·
                {' '}{partyKind === 'RECEIVING' ? 'Given' : 'Received'} {formatCurrency(selectedPaymentParty.cashTotal)} ·
                {' '}Balance {formatCurrency(Math.abs(selectedPaymentParty.remaining))}
              </div>
            </div>
          )}
          <Input
            label="Amount (PKR) *"
            type="number"
            min="0"
            value={paymentForm.amount}
            onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
          />
          <Input
            label="Note (optional)"
            value={paymentForm.notes}
            onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setPaymentOpen(false)}>Cancel</Button>
            <Button onClick={() => void savePayment()} loading={saving} disabled={!parties.length}>Save</Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!detailParty}
        onClose={() => setDetailParty(null)}
        title={detailParty ? detailParty.name : 'Party details'}
        size="lg"
      >
        {detailParty && (
          <div className="space-y-4">
            <div className="text-sm text-slate-600 dark:text-slate-300">
              <div>{detailParty.address || 'No address'}</div>
              {detailParty.notes ? <div className="text-slate-500">{detailParty.notes}</div> : null}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-lg bg-slate-50 dark:bg-white/5 px-3 py-2">
                <div className="text-[11px] text-slate-500">Product</div>
                <div className="font-semibold">{formatCurrency(detailParty.productTotal)}</div>
                <div className="text-[11px] text-slate-500">
                  Wheat {formatCurrency(detailParty.wheatAmount)} · Bags {formatCurrency(detailParty.bagAmount)} · Labour {formatCurrency(detailParty.labourAmount)}
                </div>
              </div>
              <div className="rounded-lg bg-slate-50 dark:bg-white/5 px-3 py-2">
                <div className="text-[11px] text-slate-500">{detailParty.kind === 'GIVING' ? 'Received' : 'Given'}</div>
                <div className="font-semibold">{formatCurrency(detailParty.cashTotal)}</div>
              </div>
              <div className="rounded-lg bg-slate-50 dark:bg-white/5 px-3 py-2">
                <div className="text-[11px] text-slate-500">Balance</div>
                <div className="font-semibold">{formatCurrency(Math.abs(detailParty.remaining))}</div>
              </div>
              <div className="rounded-lg bg-slate-50 dark:bg-white/5 px-3 py-2">
                <div className="text-[11px] text-slate-500">Weight</div>
                <div className="font-semibold">{formatNumber(detailParty.totalWeightKg)} kg</div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2">Product</h4>
              {!detailParty.products?.length ? (
                <p className="text-sm text-slate-500">No product entries yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500 border-b border-slate-100 dark:border-white/10">
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2 text-right">Bags</th>
                        <th className="px-3 py-2 text-right">Rate</th>
                        <th className="px-3 py-2 text-right">Bag price</th>
                        <th className="px-3 py-2 text-right">Labour</th>
                        <th className="px-3 py-2 text-right">Weight</th>
                        <th className="px-3 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailParty.products.map((row) => (
                        <tr key={row.id} className="border-b border-slate-100 dark:border-white/10">
                          <td className="px-3 py-2">{row.date} · {row.time}</td>
                          <td className="px-3 py-2 text-right">{formatNumber(row.bags, 0)}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(row.ratePerBag)}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(row.bagAmount)}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(row.labourAmount)}</td>
                          <td className="px-3 py-2 text-right">{formatNumber(row.totalWeightKg)} kg</td>
                          <td className="px-3 py-2 text-right font-semibold">{formatCurrency(row.totalPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2">{detailParty.kind === 'GIVING' ? 'Amounts received' : 'Amounts given'}</h4>
              {!detailParty.payments?.length ? (
                <p className="text-sm text-slate-500">No cash entries yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500 border-b border-slate-100 dark:border-white/10">
                        <th className="px-3 py-2">Day</th>
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Time</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                        <th className="px-3 py-2">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailParty.payments.map((row) => (
                        <tr key={row.id} className="border-b border-slate-100 dark:border-white/10">
                          <td className="px-3 py-2">{row.day}</td>
                          <td className="px-3 py-2">{row.date}</td>
                          <td className="px-3 py-2">{row.time}</td>
                          <td className="px-3 py-2 text-right font-semibold">{formatCurrency(row.amount)}</td>
                          <td className="px-3 py-2 text-slate-500">{row.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDetailParty(null)}>Close</Button>
              <Button variant="secondary" onClick={() => {
                const kind = detailParty.kind === 'GIVING' ? 'GIVING' : 'RECEIVING'
                setDetailParty(null)
                openPayment(kind, String(detailParty.id))
              }}>
                {detailParty.kind === 'GIVING' ? 'Receive Amount' : 'Give Amount'}
              </Button>
              <Button onClick={() => {
                const kind = detailParty.kind === 'GIVING' ? 'GIVING' : 'RECEIVING'
                setDetailParty(null)
                openProduct(kind, String(detailParty.id))
              }}>
                {detailParty.kind === 'GIVING' ? 'Give Product' : 'Receive Product'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
