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
  totals: { moneyIn: 0, receivingAmount: 0, givingAmount: 0, totalAmount: 0 },
  money: [],
  receivingParties: [],
  givingParties: [],
}

function apiMessage(err: unknown, fallback: string) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback
}

function productPreview(bags: string, ratePerBag: string, bagWeightKg = '40') {
  const bagsN = Number(bags)
  const rateN = Number(ratePerBag)
  const kgN = Number(bagWeightKg || 40)
  if (!Number.isInteger(bagsN) || bagsN <= 0 || !Number.isFinite(rateN) || rateN <= 0) {
    return null
  }
  const weight = Number.isFinite(kgN) && kgN > 0 ? bagsN * kgN : bagsN * 40
  return {
    bags: bagsN,
    ratePerBag: rateN,
    totalPrice: Math.round(bagsN * rateN),
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
  const [detailParty, setDetailParty] = useState<WheatKhataParty | null>(null)

  const [moneyForm, setMoneyForm] = useState({ amount: '', notes: '' })
  const [partyForm, setPartyForm] = useState({ name: '', address: '', notes: '' })
  const [productForm, setProductForm] = useState({
    partyId: '',
    bags: '',
    ratePerBag: '',
    bagWeightKg: '40',
    notes: '',
  })
  const [calculated, setCalculated] = useState<{
    bags: number
    ratePerBag: number
    totalPrice: number
    totalWeightKg: number
  } | null>(null)

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
  const selectedParty = useMemo(
    () => parties.find((p) => String(p.id) === productForm.partyId) || null,
    [parties, productForm.partyId],
  )
  const livePreview = productPreview(productForm.bags, productForm.ratePerBag, productForm.bagWeightKg)

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
    setProductForm({ partyId, bags: '', ratePerBag: '', bagWeightKg: '40', notes: '' })
    setCalculated(null)
    setProductOpen(true)
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
    },
    cancel: () => {
      setMoneyOpen(false)
      setPartyOpen(false)
      setProductOpen(false)
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
    const preview = productPreview(productForm.bags, productForm.ratePerBag, productForm.bagWeightKg)
    if (!preview) {
      toast.error('Enter bags and rate of one bag first')
      return
    }
    setCalculated(preview)
    toast.success(
      `${preview.bags} bags × ${formatCurrency(preview.ratePerBag)} = ${formatCurrency(preview.totalPrice)} · ${formatNumber(preview.totalWeightKg)} kg`,
    )
  }

  const saveProduct = async () => {
    if (!productForm.partyId) {
      toast.error('Choose a party name first')
      return
    }
    const preview = productPreview(productForm.bags, productForm.ratePerBag, productForm.bagWeightKg)
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
        notes: productForm.notes.trim() || undefined,
      })
      const kind = section === 'GIVING' ? 'GIVING' : 'RECEIVING'
      toast.success(
        kind === 'RECEIVING'
          ? 'Product received — amount deducted from total money'
          : 'Product given — amount added to total money',
      )
      setProductForm({ partyId: '', bags: '', ratePerBag: '', bagWeightKg: '40', notes: '' })
      setCalculated(null)
      setProductOpen(false)
      void load(true)
    } catch (err) {
      toast.error(apiMessage(err, 'Could not save product'))
    } finally {
      setSaving(false)
    }
  }

  const { totals } = book
  const partyKind: PartyKind = section === 'GIVING' ? 'GIVING' : 'RECEIVING'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wheat Khata"
        description="Add cash, receive wheat from parties (pay them), and sell wheat to parties (collect money)"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card-3d p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total amount</p>
          <p className="text-2xl font-bold text-primary mt-1">{formatCurrency(totals.totalAmount)}</p>
          <p className="text-[11px] text-slate-500 mt-1">
            Add money {formatCurrency(totals.moneyIn)} + selling {formatCurrency(totals.givingAmount)} − receiving {formatCurrency(totals.receivingAmount)}
          </p>
        </div>
        <div className="card-3d p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">Receiving amount</p>
          <p className="text-2xl font-bold text-rose-700 dark:text-rose-400 mt-1">{formatCurrency(totals.receivingAmount)}</p>
          <p className="text-[11px] text-slate-500 mt-1">Paid for wheat received from parties</p>
        </div>
        <div className="card-3d p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">Giving amount</p>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">{formatCurrency(totals.givingAmount)}</p>
          <p className="text-[11px] text-slate-500 mt-1">Collected for wheat given to selling parties</p>
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
              {item.id === 'RECEIVING' && 'Parties the owner receives wheat from'}
              {item.id === 'GIVING' && 'Parties the owner gives wheat to'}
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
          </div>
          <div className="px-1">
            <h3 className="text-sm font-semibold">
              {section === 'RECEIVING' ? 'Receiving parties' : 'Selling parties'}
            </h3>
            <p className="text-[11px] text-slate-500">
              {section === 'RECEIVING'
                ? 'Owner receives wheat from these parties and pays them. Each save deducts from total money. Tap a party for full product details.'
                : 'Owner gives wheat to these parties and collects money. Each save adds to total money. Tap a party for full product details.'}
            </p>
          </div>
          {loading ? (
            <div className="card-3d p-4"><TableSkeleton rows={3} /></div>
          ) : !parties.length ? (
            <p className="card-3d p-5 text-sm text-slate-500">
              {section === 'RECEIVING'
                ? 'Add a receiving party first, then receive product.'
                : 'Add a selling party first, then give product.'}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {parties.map((p) => (
                <div key={p.id} className="card-3d p-4 space-y-3">
                  <button
                    type="button"
                    onClick={() => setDetailParty(p)}
                    className="w-full text-left"
                  >
                    <p className="font-semibold truncate">{p.name}</p>
                    <p className="text-[11px] text-slate-500 truncate">{p.address || p.notes || 'No address'}</p>
                    <div className="grid grid-cols-3 gap-2 text-[11px] mt-3">
                      <div className="rounded-lg bg-slate-50 dark:bg-white/5 px-2 py-1.5">
                        <div className="text-slate-500">Bags</div>
                        <div className="font-semibold">{formatNumber(p.totalBags, 0)}</div>
                      </div>
                      <div className="rounded-lg bg-slate-50 dark:bg-white/5 px-2 py-1.5">
                        <div className="text-slate-500">Weight</div>
                        <div className="font-semibold">{formatNumber(p.totalWeightKg)} kg</div>
                      </div>
                      <div className={`rounded-lg px-2 py-1.5 ${
                        section === 'RECEIVING'
                          ? 'bg-rose-50 dark:bg-rose-500/10'
                          : 'bg-emerald-50 dark:bg-emerald-500/10'
                      }`}>
                        <div className="text-slate-500">Total</div>
                        <div className="font-semibold">{formatCurrency(p.totalPrice)}</div>
                      </div>
                    </div>
                  </button>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button size="sm" onClick={() => openProduct(partyKind, String(p.id))}>
                      {section === 'RECEIVING' ? 'Receive Product' : 'Give Product'}
                    </Button>
                    <button
                      type="button"
                      className="text-[11px] text-slate-500 underline-offset-2 hover:underline"
                      onClick={() => setDetailParty(p)}
                    >
                      {p.productCount} product{p.productCount === 1 ? '' : 's'} · tap for details
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
              ? 'Saved as a receiving party — owner receives wheat product from them.'
              : 'Saved as a selling party — owner gives wheat product and receives money from them.'}
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
            Type a few letters of the name (for example ahs) to autofill name and address. Total = bags × rate of one bag.
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
          {selectedParty && (
            <div className="rounded-lg bg-slate-50 dark:bg-white/5 px-3 py-2 text-[12px] text-slate-600 dark:text-slate-300">
              <div className="font-medium">{selectedParty.name}</div>
              <div>{selectedParty.address || 'No address'}</div>
              {selectedParty.notes ? <div className="text-slate-500">{selectedParty.notes}</div> : null}
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
          {(calculated || livePreview) && (
            <div className="rounded-lg bg-primary/10 px-3 py-2 text-sm">
              <div className="font-semibold">
                Total price: {formatCurrency((calculated || livePreview)!.totalPrice)}
              </div>
              <div className="text-[12px] text-slate-600 dark:text-slate-300">
                {(calculated || livePreview)!.bags} bags × {formatCurrency((calculated || livePreview)!.ratePerBag)}
                {' · '}
                {formatNumber((calculated || livePreview)!.totalWeightKg)} kg
              </div>
              {partyKind === 'RECEIVING'
                ? <div className="text-[11px] text-rose-700 dark:text-rose-300 mt-1">Saving deducts this from total money.</div>
                : <div className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-1">Saving adds this to total money.</div>}
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
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-slate-50 dark:bg-white/5 px-3 py-2">
                <div className="text-[11px] text-slate-500">Bags</div>
                <div className="font-semibold">{formatNumber(detailParty.totalBags, 0)}</div>
              </div>
              <div className="rounded-lg bg-slate-50 dark:bg-white/5 px-3 py-2">
                <div className="text-[11px] text-slate-500">Total weight</div>
                <div className="font-semibold">{formatNumber(detailParty.totalWeightKg)} kg</div>
              </div>
              <div className="rounded-lg bg-slate-50 dark:bg-white/5 px-3 py-2">
                <div className="text-[11px] text-slate-500">Total price</div>
                <div className="font-semibold">{formatCurrency(detailParty.totalPrice)}</div>
              </div>
            </div>
            {!detailParty.products?.length ? (
              <p className="text-sm text-slate-500">No product entries yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-100 dark:border-white/10">
                      <th className="px-3 py-2">Day</th>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Time</th>
                      <th className="px-3 py-2 text-right">Bags</th>
                      <th className="px-3 py-2 text-right">Rate</th>
                      <th className="px-3 py-2 text-right">Weight</th>
                      <th className="px-3 py-2 text-right">Price</th>
                      <th className="px-3 py-2">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailParty.products.map((row) => (
                      <tr key={row.id} className="border-b border-slate-100 dark:border-white/10">
                        <td className="px-3 py-2">{row.day}</td>
                        <td className="px-3 py-2">{row.date}</td>
                        <td className="px-3 py-2">{row.time}</td>
                        <td className="px-3 py-2 text-right">{formatNumber(row.bags, 0)}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(row.ratePerBag)}</td>
                        <td className="px-3 py-2 text-right">{formatNumber(row.totalWeightKg)} kg</td>
                        <td className="px-3 py-2 text-right font-semibold">{formatCurrency(row.totalPrice)}</td>
                        <td className="px-3 py-2 text-slate-500">{row.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDetailParty(null)}>Close</Button>
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
