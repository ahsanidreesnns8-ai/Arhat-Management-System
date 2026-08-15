import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronDown, FileText, History, Layers, Package, Plus, RefreshCw, Scale, ShoppingCart, Trash2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import { TableSkeleton } from '../components/ui/Skeleton'
import { useLiveReload } from '../context/SyncContext'
import { buyerApi, dailyTradeApi, farmerApi, settingsApi, truckApi } from '../services/api'
import { billErrorMessage, openHtmlBill } from '../utils/bill'
import { formatCurrency, formatNumber } from '../utils/format'
import type { Buyer, Farmer, Product, Truck } from '../types'

type BoardReceive = {
  id: number
  dheriId: string
  farmerId: number
  farmerName: string
  productId: number
  productName: string
  dayBatchId: number | null
  batchNumber: number | null
  bags: number
  weightPerBag: number
  partialBagWeight: number
  weight: number
  rate: number
  amount: number
  date: string
  createdAt?: string
  sellingStatus: string
}

type DayBatchRow = {
  id: number
  batchNumber: number
  status: string
  createdAt?: string
  totalDheris: number
  soldDheris: number
  unsoldDheris: number
}

type SaleLine = {
  id: number
  saleId: number
  invoice: string
  buyerId: number
  buyerName: string
  productName: string
  bags: number
  weight: number
  rate: number
  amount: number
  sourceType: string
  farmerName?: string
  dheriId?: number | null
  dheriCode?: string
}

type Board = {
  session: {
    receivedBags: number
    soldBags: number
    receivedWeightKg: number
    soldWeightKg: number
    stockInKg: number
    stockOutKg: number
  }
  stockLots: Array<{
    id: number
    productName?: string
    farmerName?: string | null
    remainingKg: number
    ratePer40Kg: number
    intakeDate: string
  }>
  receives: BoardReceive[]
  sales: Array<{
    id: number
    invoiceNumber: string
    buyerId: number
    buyerName: string
    bags: number
    weight: number
    amount: number
    createdAt?: string
    items: Array<{
      id: number
      productName: string
      bags: number
      weight: number
      rate: number
      amount: number
      sourceType: string
      farmerName?: string
      dheriId?: number | null
      dheriCode?: string
    }>
  }>
  batches: DayBatchRow[]
}

type ReceiveRow = { productId: string; bags: string; bagKg: string; extraKg: string }

const emptyRow = (): ReceiveRow => ({ productId: '', bags: '', bagKg: '40', extraKg: '0' })

export default function DailyTradePage() {
  const [board, setBoard] = useState<Board | null>(null)
  const [buyers, setBuyers] = useState<Buyer[]>([])
  const [farmers, setFarmers] = useState<Farmer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [trucks, setTrucks] = useState<Truck[]>([])
  const [loading, setLoading] = useState(true)
  const [openPane, setOpenPane] = useState<'receive' | 'sell' | null>('receive')
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null)
  const [openingBatch, setOpeningBatch] = useState(false)

  const [farmerId, setFarmerId] = useState('')
  const [truckId, setTruckId] = useState('')
  const [receiveNotes, setReceiveNotes] = useState('')
  const [rows, setRows] = useState<ReceiveRow[]>([emptyRow()])
  const [receiving, setReceiving] = useState(false)

  const [sellDheriId, setSellDheriId] = useState('')
  const [sellBuyerId, setSellBuyerId] = useState('')
  const [newBuyer, setNewBuyer] = useState({ name: '', phone: '', city: '' })
  const [addingBuyer, setAddingBuyer] = useState(false)
  const [sellRate, setSellRate] = useState('')
  const [sellPaid, setSellPaid] = useState('0')
  const [selling, setSelling] = useState(false)
  const [lastSaleItemIds, setLastSaleItemIds] = useState<number[]>([])
  const [lastSaleBuyerId, setLastSaleBuyerId] = useState<number | null>(null)
  const [lastSaleNote, setLastSaleNote] = useState<string | null>(null)
  const [billLang, setBillLang] = useState<'en' | 'ur'>('en')

  const load = useCallback(async (soft = false) => {
    if (!soft) setLoading(true)
    try {
      const [b, buy, prod, farm, truckRes] = await Promise.all([
        dailyTradeApi.getBoard(),
        buyerApi.getAll(),
        settingsApi.getProducts(),
        farmerApi.getAll(),
        truckApi.getAll(),
      ])
      setBoard(b.data.data)
      setBuyers(buy.data.data || [])
      setProducts(prod.data.data || [])
      setFarmers(farm.data.data || [])
      setTrucks(truckRes.data.data || [])
    } catch {
      if (!soft) toast.error('Failed to load Daily Trade')
    } finally {
      if (!soft) setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])
  useLiveReload(() => { void load(true) })

  useEffect(() => {
    if (products[0] && rows.length === 1 && !rows[0].productId) {
      setRows([{ ...emptyRow(), productId: String(products[0].id) }])
    }
  }, [products, rows])

  const batches = board?.batches || []
  const selectedBatch =
    batches.find((b) => b.id === selectedBatchId) ??
    batches[batches.length - 1] ??
    null

  useEffect(() => {
    if (selectedBatchId == null && selectedBatch) setSelectedBatchId(selectedBatch.id)
  }, [selectedBatch, selectedBatchId])

  const batchReceives = useMemo(
    () => (board?.receives || []).filter((r) => !selectedBatch || r.dayBatchId === selectedBatch.id),
    [board, selectedBatch],
  )
  const unsold = batchReceives.filter((r) => r.sellingStatus !== 'SOLD')

  useEffect(() => {
    if (unsold.length && !unsold.some((d) => String(d.id) === sellDheriId)) {
      setSellDheriId(String(unsold[0].id))
    }
    if (!unsold.length) setSellDheriId('')
  }, [unsold, sellDheriId])

  const selectedDheri = unsold.find((d) => String(d.id) === sellDheriId)
  const rateNum = parseFloat(sellRate) || 0
  const autoWeight = selectedDheri
    ? selectedDheri.bags * selectedDheri.weightPerBag + (selectedDheri.partialBagWeight || 0)
    : 0
  const autoAmount = autoWeight > 0 && rateNum > 0 ? (autoWeight / 40) * rateNum : 0

  const saleLines: SaleLine[] = useMemo(
    () =>
      (board?.sales || []).flatMap((sale) =>
        sale.items.map((item) => ({
          ...item,
          saleId: sale.id,
          invoice: sale.invoiceNumber,
          buyerId: sale.buyerId,
          buyerName: sale.buyerName,
        })),
      ),
    [board],
  )

  const selectedBuyer = buyers.find((b) => String(b.id) === sellBuyerId)

  const farmerTrucks = useMemo(
    () => trucks.filter((t) => !farmerId || String(t.farmerId) === farmerId),
    [trucks, farmerId],
  )

  const historyItems = useMemo(() => {
    const batchEv = (board?.batches || []).map((b) => ({
      at: b.createdAt || '',
      kind: 'BATCH' as const,
      text: `Batch ${b.batchNumber} created — tap it to receive or sell against that batch`,
    }))
    const receives = (board?.receives || []).map((r) => ({
      at: r.createdAt || r.date,
      kind: 'RECEIVE' as const,
      text: `Batch ${r.batchNumber ?? '—'} · ${r.dheriId} received from ${r.farmerName} · ${r.productName} · ${r.bags} bags (${formatNumber(r.weight)} kg)${r.partialBagWeight ? ` + Extra ${formatNumber(r.partialBagWeight)} kg` : ''}`,
    }))
    const sells = (board?.sales || []).flatMap((sale) =>
      sale.items.map((s) => ({
        at: sale.createdAt || sale.invoiceNumber,
        kind: 'SELL' as const,
        text: `${sale.invoiceNumber} · sold ${s.dheriCode || 'stock'} to ${sale.buyerName} · ${s.bags} bags @ ${formatCurrency(s.rate)}/40kg = ${formatCurrency(s.amount)} — seller balance updated`,
      })),
    )
    return [...batchEv, ...receives, ...sells].sort((a, b) => a.at.localeCompare(b.at))
  }, [board])

  const createBatch = async () => {
    setOpeningBatch(true)
    try {
      if (batches.length === 0) {
        const res = await dailyTradeApi.ensureReceivingBatch()
        toast.success('Batch 1 created')
        await load(true)
        const id = (res.data.data as { id?: number })?.id
        if (id) setSelectedBatchId(id)
      } else {
        const res = await dailyTradeApi.openNextBatch()
        toast.success(`Batch ${(res.data.data as { batchNumber?: number })?.batchNumber ?? ''} created`)
        await load(true)
        const id = (res.data.data as { id?: number })?.id
        if (id) setSelectedBatchId(id)
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Could not create batch')
    } finally {
      setOpeningBatch(false)
    }
  }

  const handleReceive = async () => {
    if (!selectedBatch) {
      toast.error('Create or tap a batch first')
      return
    }
    if (!farmerId) {
      toast.error('Select farmer')
      return
    }
    const lines = rows
      .map((r) => ({
        productId: Number(r.productId),
        numberOfBags: parseInt(r.bags, 10) || 0,
        weightPerBag: parseFloat(r.bagKg) || 40,
        extraKg: parseFloat(r.extraKg) || 0,
      }))
      .filter((l) => l.productId && l.numberOfBags > 0)
    if (!lines.length) {
      toast.error('Add at least one dheri with product and bags')
      return
    }
    setReceiving(true)
    try {
      const res = await dailyTradeApi.receiveMany({
        farmerId: Number(farmerId),
        dayBatchId: selectedBatch.id,
        truckId: truckId ? Number(truckId) : null,
        notes: receiveNotes.trim() || null,
        lines,
      })
      toast.success(res.data.data.message || 'Received')
      setRows([{ ...emptyRow(), productId: products[0] ? String(products[0].id) : '' }])
      setReceiveNotes('')
      await load(true)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Receive failed')
    } finally {
      setReceiving(false)
    }
  }

  const handleAddBuyer = async () => {
    if (!newBuyer.name.trim()) {
      toast.error('Enter seller / buyer name')
      return
    }
    setAddingBuyer(true)
    try {
      const res = await buyerApi.create({
        name: newBuyer.name.trim(),
        phone: newBuyer.phone,
        city: newBuyer.city,
      })
      const created = res.data.data
      setBuyers((prev) => [created, ...prev])
      setSellBuyerId(String(created.id))
      setNewBuyer({ name: '', phone: '', city: '' })
      toast.success(`${created.name} saved in Sellers`)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Could not add seller')
    } finally {
      setAddingBuyer(false)
    }
  }

  const handleSell = async () => {
    if (!selectedBatch) {
      toast.error('Tap a batch first')
      return
    }
    if (!sellDheriId) {
      toast.error('Select the dheri to sell')
      return
    }
    if (!sellBuyerId) {
      toast.error('Select or add the seller / buyer')
      return
    }
    if (rateNum <= 0) {
      toast.error('Enter rate per 40kg')
      return
    }
    setSelling(true)
    try {
      const res = await dailyTradeApi.sellDheri({
        dheriId: Number(sellDheriId),
        buyerId: Number(sellBuyerId),
        dayBatchId: selectedBatch.id,
        ratePer40Kg: rateNum,
        paidAmount: parseFloat(sellPaid) || 0,
      })
      toast.success(res.data.data.message || 'Sold — seller balance updated')
      const sale = res.data.data.sale as {
        buyerId?: number
        invoiceNumber?: string
        items?: Array<{ id: number }>
      }
      setLastSaleBuyerId(sale.buyerId ?? Number(sellBuyerId))
      setLastSaleItemIds((sale.items || []).map((i) => i.id).filter(Boolean))
      setLastSaleNote(
        `${selectedDheri?.dheriId} → ${selectedBuyer?.name || 'seller'} @ ${formatCurrency(rateNum)}/40kg = ${formatCurrency(autoAmount)} (${sale.invoiceNumber || ''})`,
      )
      setSellRate('')
      setSellPaid('0')
      await load(true)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Sell failed')
    } finally {
      setSelling(false)
    }
  }

  const generateBill = async () => {
    if (!lastSaleBuyerId || lastSaleItemIds.length === 0) {
      toast.error('Sell a dheri first, then generate its bill')
      return
    }
    try {
      const res = await buyerApi.getSelectedBillHtml(lastSaleBuyerId, lastSaleItemIds, billLang)
      openHtmlBill(
        typeof res.data === 'string' ? res.data : String(res.data),
        billLang === 'ur' ? 'Seller bill (Urdu)' : 'Seller bill',
      )
    } catch (err) {
      toast.error(billErrorMessage(err, 'Could not generate bill'))
    }
  }

  if (loading && !board) return <TableSkeleton rows={12} />

  const session = board?.session
  const stockKg = (board?.stockLots || []).reduce((s, l) => s + l.remainingKg, 0)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Daily Trade"
        description="Create a batch, receive one or more dheris from a farmer, sell a dheri to a seller, print the bill. Same farmer can appear in any batch."
        action={
          <Button variant="secondary" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" /> Reload
          </Button>
        }
      />

      {/* 1. Two clickable tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => setOpenPane((p) => (p === 'receive' ? null : 'receive'))}
          className={`card-3d p-5 text-left border-2 transition ${
            openPane === 'receive' ? 'border-emerald-500' : 'border-transparent'
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Receiving bags</p>
              <p className="text-3xl font-bold mt-1 tabular-nums">{session?.receivedBags || 0}</p>
              <p className="text-sm text-slate-500">{formatNumber(session?.receivedWeightKg || 0)} kg</p>
              <p className="text-xs mt-2">Extra / stock kg: {formatNumber(session?.stockInKg || stockKg)}</p>
            </div>
            <Package className="h-7 w-7 text-emerald-600" />
          </div>
          <p className="text-xs text-primary mt-3 flex items-center gap-1">
            Tap to {openPane === 'receive' ? 'hide' : 'see'} receive details <ChevronDown className="h-3 w-3" />
          </p>
        </button>
        <button
          type="button"
          onClick={() => setOpenPane((p) => (p === 'sell' ? null : 'sell'))}
          className={`card-3d p-5 text-left border-2 transition ${
            openPane === 'sell' ? 'border-primary' : 'border-transparent'
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Selling bags</p>
              <p className="text-3xl font-bold mt-1 tabular-nums">{session?.soldBags || 0}</p>
              <p className="text-sm text-slate-500">{formatNumber(session?.soldWeightKg || 0)} kg</p>
              <p className="text-xs mt-2">Stock out: {formatNumber(session?.stockOutKg || 0)} kg</p>
            </div>
            <Scale className="h-7 w-7 text-primary" />
          </div>
          <p className="text-xs text-primary mt-3 flex items-center gap-1">
            Tap to {openPane === 'sell' ? 'hide' : 'see'} sell details <ChevronDown className="h-3 w-3" />
          </p>
        </button>
      </div>

      {openPane === 'receive' && (
        <div className="card-3d overflow-hidden">
          <div className="px-4 py-3 font-semibold border-b border-slate-100 dark:border-white/10">
            Receiving details — stock bags & Extra KG
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-emerald-50 dark:bg-emerald-950/20 text-left">
                <tr>
                  <th className="px-3 py-2">Batch</th>
                  <th className="px-3 py-2">Dheri</th>
                  <th className="px-3 py-2">Farmer</th>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">Bags</th>
                  <th className="px-3 py-2">Weight</th>
                  <th className="px-3 py-2">Extra KG</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                {(board?.receives || []).map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2">B{r.batchNumber ?? '—'}</td>
                    <td className="px-3 py-2 font-medium">{r.dheriId}</td>
                    <td className="px-3 py-2">{r.farmerName}</td>
                    <td className="px-3 py-2">{r.productName}</td>
                    <td className="px-3 py-2">{r.bags}</td>
                    <td className="px-3 py-2">{formatNumber(r.weight)} kg</td>
                    <td className="px-3 py-2">{formatNumber(r.partialBagWeight)}</td>
                    <td className="px-3 py-2">{r.sellingStatus === 'SOLD' ? 'SOLD' : 'IN STOCK'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(board?.receives || []).length === 0 && (
              <p className="p-4 text-sm text-slate-500">No bags received today.</p>
            )}
          </div>
          {(board?.stockLots || []).length > 0 && (
            <div className="px-4 py-3 border-t border-slate-100 dark:border-white/10 text-sm">
              <p className="font-semibold mb-2">Extra KG stock lots</p>
              {(board?.stockLots || []).map((lot) => (
                <p key={lot.id} className="text-slate-600 dark:text-slate-300">
                  {lot.intakeDate} · {lot.productName} · {lot.farmerName || '—'} · {formatNumber(lot.remainingKg)} kg @ {formatCurrency(lot.ratePer40Kg)}/40kg
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {openPane === 'sell' && (
        <div className="card-3d overflow-hidden">
          <div className="px-4 py-3 font-semibold border-b border-slate-100 dark:border-white/10">
            Selling details — invoices, sellers, stock bags
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-left">
                <tr>
                  <th className="px-3 py-2">Invoice</th>
                  <th className="px-3 py-2">Seller</th>
                  <th className="px-3 py-2">Dheri</th>
                  <th className="px-3 py-2">Farmer</th>
                  <th className="px-3 py-2">Bags</th>
                  <th className="px-3 py-2">Rate/40kg</th>
                  <th className="px-3 py-2">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                {saleLines.map((s) => (
                  <tr key={s.id}>
                    <td className="px-3 py-2">
                      <Link className="text-primary" to={`/sales/${s.saleId}`}>{s.invoice}</Link>
                    </td>
                    <td className="px-3 py-2">
                      <Link className="text-primary" to={`/buyers/${s.buyerId}`}>{s.buyerName}</Link>
                    </td>
                    <td className="px-3 py-2">{s.dheriCode || (s.sourceType === 'BUSINESS_STOCK' ? 'STOCK BAGS' : '—')}</td>
                    <td className="px-3 py-2">{s.farmerName || '—'}</td>
                    <td className="px-3 py-2">{s.bags}</td>
                    <td className="px-3 py-2">{formatCurrency(s.rate)}</td>
                    <td className="px-3 py-2">{formatCurrency(s.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {saleLines.length === 0 && <p className="p-4 text-sm text-slate-500">No bags sold today.</p>}
          </div>
        </div>
      )}

      {/* 2. Batches */}
      <div className="card-3d p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" /> Batches — tap one to work below
          </h3>
          <Button loading={openingBatch} onClick={() => void createBatch()}>
            <Plus className="h-4 w-4" /> Create new batch
          </Button>
        </div>
        {batches.length === 0 ? (
          <p className="text-sm text-slate-500">No batch yet. Tap Create new batch to start Batch 1.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {batches.map((b) => {
              const on = selectedBatch?.id === b.id
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelectedBatchId(b.id)}
                  className={`rounded-xl border px-4 py-3 min-w-[8rem] text-left transition ${
                    on
                      ? 'bg-[#002D62] text-white border-[#C5A059]'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10'
                  }`}
                >
                  <p className="font-semibold">Batch {b.batchNumber}</p>
                  <p className={`text-xs mt-1 ${on ? 'text-white/80' : 'text-slate-500'}`}>
                    {b.soldDheris}/{b.totalDheris} sold · {b.unsoldDheris} left
                  </p>
                </button>
              )
            })}
          </div>
        )}
        {selectedBatch && (
          <p className="text-sm text-[#002D62] dark:text-[#C5A059] font-medium">
            Working on Batch {selectedBatch.batchNumber}. Same farmer can be used in Batch 1, 2, 3…
          </p>
        )}
      </div>

      {/* 3. Add dheri(s) */}
      <div className="rounded-2xl border-2 border-emerald-200/80 dark:border-emerald-800/40 overflow-hidden">
        <div className="px-5 py-3 bg-emerald-700 text-white font-semibold">
          Add dheri(s) into Batch {selectedBatch?.batchNumber ?? '—'}
        </div>
        <div className="p-5 space-y-4 bg-white dark:bg-slate-900">
          <Select
            label="Farmer (existing — can be the same farmer in every batch) *"
            value={farmerId}
            onChange={(e) => {
              setFarmerId(e.target.value)
              setTruckId('')
            }}
            options={[
              { value: '', label: 'Select farmer' },
              ...farmers.map((f) => ({ value: String(f.id), label: `${f.name} (${f.farmerId})` })),
            ]}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Truck (optional)"
              value={truckId}
              onChange={(e) => setTruckId(e.target.value)}
              options={[
                { value: '', label: farmerId ? 'No truck' : 'Select farmer first' },
                ...farmerTrucks.map((t) => ({
                  value: String(t.id),
                  label: `${t.registrationNumber}${t.driverName ? ` · ${t.driverName}` : ''}`,
                })),
              ]}
            />
            <Input
              label="Notes (optional)"
              value={receiveNotes}
              onChange={(e) => setReceiveNotes(e.target.value)}
              placeholder="e.g. morning load, two products"
            />
          </div>
          <p className="text-xs text-slate-500">
            One farmer can send multiple dheris at once — add a row per dheri below, then save all into this batch.
          </p>
          {rows.map((row, i) => {
            const previewKg =
              (parseInt(row.bags, 10) || 0) * (parseFloat(row.bagKg) || 40) + (parseFloat(row.extraKg) || 0)
            return (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-5 gap-3 rounded-xl border border-slate-200 dark:border-white/10 p-3">
              <Select
                label={`Dheri ${i + 1} product *`}
                value={row.productId}
                onChange={(e) =>
                  setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, productId: e.target.value } : r)))
                }
                options={[
                  { value: '', label: 'Product' },
                  ...products.map((p) => ({ value: String(p.id), label: p.name })),
                ]}
              />
              <Input
                label="Bags *"
                type="number"
                value={row.bags}
                onChange={(e) =>
                  setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, bags: e.target.value } : r)))
                }
              />
              <Input
                label="Bag weight (kg)"
                type="number"
                step="0.01"
                value={row.bagKg}
                onChange={(e) =>
                  setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, bagKg: e.target.value } : r)))
                }
              />
              <Input
                label="Extra KG"
                type="number"
                step="0.01"
                value={row.extraKg}
                onChange={(e) =>
                  setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, extraKg: e.target.value } : r)))
                }
              />
              <div className="flex items-end gap-2">
                <div className="flex-1 text-xs text-slate-500 pb-2">
                  Weight {previewKg ? `${formatNumber(previewKg)} kg` : '—'}
                </div>
                {rows.length > 1 && (
                  <Button
                    variant="secondary"
                    onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            )
          })}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() =>
                setRows((prev) => [
                  ...prev,
                  { ...emptyRow(), productId: products[0] ? String(products[0].id) : '' },
                ])
              }
            >
              <Plus className="h-4 w-4" /> Add another dheri (same farmer)
            </Button>
            <Button onClick={() => void handleReceive()} loading={receiving} disabled={!selectedBatch}>
              <Package className="h-4 w-4" /> Save into Batch {selectedBatch?.batchNumber ?? '—'}
            </Button>
            <Link to="/farmers" className="text-sm text-primary underline self-center">Add farmer</Link>
          </div>
        </div>
      </div>

      {/* 4. Sell specific dheri */}
      <div className="rounded-2xl border-2 border-[#002D62]/25 overflow-hidden">
        <div className="px-5 py-3 bg-[#002D62] text-white font-semibold flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-[#C5A059]" />
          Sell a dheri from Batch {selectedBatch?.batchNumber ?? '—'}
        </div>
        <div className="p-5 space-y-4 bg-white dark:bg-slate-900">
          {!selectedBatch ? (
            <p className="text-sm text-slate-500">Tap a batch first.</p>
          ) : unsold.length === 0 ? (
            <p className="text-sm text-slate-500">No unsold dheris in this batch. Receive first, or tap another batch.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Select
                  label="Dheri to sell *"
                  value={sellDheriId}
                  onChange={(e) => setSellDheriId(e.target.value)}
                  options={unsold.map((r) => ({
                    value: String(r.id),
                    label: `${r.dheriId} · ${r.farmerName} · ${r.productName} · ${r.bags} bags`,
                  }))}
                />
                <Select
                  label="Seller (buyer) *"
                  value={sellBuyerId}
                  onChange={(e) => setSellBuyerId(e.target.value)}
                  options={[
                    { value: '', label: 'Select seller' },
                    ...buyers.map((b) => ({
                      value: String(b.id),
                      label: `${b.name} (${b.buyerId}) · due ${formatCurrency(b.outstandingBalance)}`,
                    })),
                  ]}
                />
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-white/10 p-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input label="New seller name" value={newBuyer.name} onChange={(e) => setNewBuyer({ ...newBuyer, name: e.target.value })} />
                <Input label="Phone" value={newBuyer.phone} onChange={(e) => setNewBuyer({ ...newBuyer, phone: e.target.value })} />
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Input label="City" value={newBuyer.city} onChange={(e) => setNewBuyer({ ...newBuyer, city: e.target.value })} />
                  </div>
                  <Button variant="secondary" loading={addingBuyer} onClick={() => void handleAddBuyer()}>
                    Add seller
                  </Button>
                </div>
              </div>
              {selectedBuyer && (
                <p className="text-sm">
                  Seller record: <Link className="text-primary font-medium" to={`/buyers/${selectedBuyer.id}`}>{selectedBuyer.name}</Link>
                  {' · '}due {formatCurrency(selectedBuyer.outstandingBalance)}
                  {' · '}this sale will update Sellers / dashboard pending payments.
                </p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Input label="Bags" value={selectedDheri ? String(selectedDheri.bags) : ''} readOnly />
                <Input
                  label="Rate / 40kg *"
                  type="number"
                  step="0.01"
                  value={sellRate}
                  onChange={(e) => setSellRate(e.target.value)}
                />
                <Input label="Total weight (auto)" value={autoWeight ? `${formatNumber(autoWeight)} kg` : '—'} readOnly />
                <Input label="Amount (auto)" value={autoAmount ? formatCurrency(autoAmount) : '—'} readOnly />
              </div>
              <Input
                label="Cash received now"
                type="number"
                step="0.01"
                value={sellPaid}
                onChange={(e) => setSellPaid(e.target.value)}
              />
              <Button onClick={() => void handleSell()} loading={selling}>
                <Scale className="h-4 w-4" /> Sell this dheri — update seller balance
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 5. Bill for the sale above */}
      <div className="rounded-2xl border-2 border-[#C5A059]/60 overflow-hidden">
        <div className="px-5 py-3 bg-gradient-to-r from-[#002D62] to-[#0a3a75] text-white font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4 text-[#C5A059]" />
          Bill for the dheri sold above
        </div>
        <div className="p-5 space-y-3 bg-white dark:bg-slate-900">
          {lastSaleNote ? (
            <>
              <p className="text-sm font-medium">{lastSaleNote}</p>
              <div className="flex flex-wrap gap-2 items-center">
                {(['en', 'ur'] as const).map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setBillLang(code)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                      billLang === code ? 'bg-[#002D62] text-white border-[#002D62]' : 'border-slate-200'
                    }`}
                  >
                    {code === 'en' ? 'English' : 'اردو'}
                  </button>
                ))}
                <Button onClick={() => void generateBill()}>
                  <FileText className="h-4 w-4" /> Generate professional bill
                </Button>
                {lastSaleBuyerId && (
                  <Link to={`/buyers/${lastSaleBuyerId}`} className="text-sm text-primary underline">
                    Open seller record
                  </Link>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">Sell a dheri in the frame above — its bill will appear here.</p>
          )}
        </div>
      </div>

      {/* 6. History / readme */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
        <div className="px-5 py-3 bg-slate-100 dark:bg-slate-800 font-semibold flex items-center gap-2">
          <History className="h-4 w-4" /> History — receive, sell, and batch work today
        </div>
        <div className="p-5 bg-white dark:bg-slate-900">
          {historyItems.length === 0 ? (
            <p className="text-sm text-slate-500">No activity yet today.</p>
          ) : (
            <ol className="space-y-2 text-sm">
              {historyItems.map((h, i) => (
                <li key={`${h.kind}-${i}`} className="flex gap-2">
                  <span
                    className={`shrink-0 mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      h.kind === 'RECEIVE'
                        ? 'bg-emerald-100 text-emerald-800'
                        : h.kind === 'SELL'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-slate-200 text-slate-800'
                    }`}
                  >
                    {h.kind}
                  </span>
                  <span>{h.text}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  )
}
