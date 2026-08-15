import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FileText, History, Layers, Package, Plus, RefreshCw, Scale, ShoppingCart, Trash2,
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
import {
  boardMatchesSelectedBatch,
  nextSelectedBatchId,
  pickSelectedBatch,
  receivesForBatch,
  salesForBatch,
} from './dailyTradeScope'

const SELECTED_BATCH_KEY = 'ams-daily-trade-batch-id'

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

type SaleItem = {
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
  dayBatchId?: number | null
  batchNumber?: number | null
}

type BoardSale = {
  id: number
  invoiceNumber: string
  buyerId: number
  buyerName: string
  bags: number
  weight: number
  amount: number
  createdAt?: string
  items: SaleItem[]
}

type Board = {
  scopedBatchId?: number | null
  session: {
    receivedBags: number
    soldBags: number
    receivedWeightKg: number
    soldWeightKg: number
    stockInKg: number
    stockOutKg: number
  }
  receives: BoardReceive[]
  sales: BoardSale[]
  batches: DayBatchRow[]
}

type ReceiveRow = { productId: string; bags: string; bagKg: string; extraKg: string }

type LastSale = {
  batchId: number
  buyerId: number
  itemIds: number[]
  note: string
  html: string | null
}

const emptyRow = (): ReceiveRow => ({ productId: '', bags: '', bagKg: '40', extraKg: '0' })

function storedBatchId(): number | null {
  try {
    const raw = sessionStorage.getItem(SELECTED_BATCH_KEY)
    if (!raw) return null
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

function persistBatchId(id: number | null) {
  try {
    if (id == null) sessionStorage.removeItem(SELECTED_BATCH_KEY)
    else sessionStorage.setItem(SELECTED_BATCH_KEY, String(id))
  } catch {
    /* ignore */
  }
}

function batchStatusLabel(status: string) {
  if (status === 'CLOSED') return 'Completed'
  if (status === 'SELLING') return 'Selling'
  return 'Receiving'
}

export default function DailyTradePage() {
  const [board, setBoard] = useState<Board | null>(null)
  const [buyers, setBuyers] = useState<Buyer[]>([])
  const [farmers, setFarmers] = useState<Farmer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [trucks, setTrucks] = useState<Truck[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(() => storedBatchId())
  const [openingBatch, setOpeningBatch] = useState(false)
  const selectedBatchIdRef = useRef<number | null>(selectedBatchId)
  const loadSeq = useRef(0)

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
  const [lastSale, setLastSale] = useState<LastSale | null>(null)
  const [billLang, setBillLang] = useState<'en' | 'ur'>('en')
  const [billLoading, setBillLoading] = useState(false)

  const rememberBatch = useCallback((id: number | null) => {
    selectedBatchIdRef.current = id
    persistBatchId(id)
    setSelectedBatchId(id)
  }, [])

  const load = useCallback(async (soft = false) => {
    const seq = ++loadSeq.current
    const wanted = selectedBatchIdRef.current
    if (!soft) setLoading(true)
    try {
      const [b, buy, prod, farm, truckRes] = await Promise.all([
        dailyTradeApi.getBoard(undefined, wanted),
        buyerApi.getAll(),
        settingsApi.getProducts(),
        farmerApi.getAll(),
        truckApi.getAll(),
      ])
      if (seq !== loadSeq.current) return
      let data = b.data.data as Board
      const nextId = nextSelectedBatchId(data.batches || [], selectedBatchIdRef.current ?? wanted)
      if (nextId && !boardMatchesSelectedBatch(data.scopedBatchId, nextId)) {
        const scoped = await dailyTradeApi.getBoard(undefined, nextId)
        if (seq !== loadSeq.current) return
        data = scoped.data.data as Board
      }
      if (!boardMatchesSelectedBatch(data.scopedBatchId, selectedBatchIdRef.current ?? nextId)) {
        return
      }
      setBoard(data)
      setBuyers(buy.data.data || [])
      setProducts(prod.data.data || [])
      setFarmers(farm.data.data || [])
      setTrucks(truckRes.data.data || [])
      rememberBatch(nextId)
    } catch {
      if (!soft && seq === loadSeq.current) toast.error('Failed to load Daily Trade')
    } finally {
      if (!soft && seq === loadSeq.current) setLoading(false)
    }
  }, [rememberBatch])

  const selectBatch = useCallback((id: number | null) => {
    rememberBatch(id)
    void load(true)
  }, [load, rememberBatch])

  useEffect(() => { void load() }, [load])
  const softLoad = useCallback(() => { void load(true) }, [load])
  useLiveReload(softLoad)

  useEffect(() => {
    if (products[0] && rows.length === 1 && !rows[0].productId) {
      setRows([{ ...emptyRow(), productId: String(products[0].id) }])
    }
    // Only seed the first empty row when products arrive
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products])

  const batches = board?.batches || []
  const selectedBatch = pickSelectedBatch(batches, selectedBatchId)

  const batchReceives = useMemo(
    () => receivesForBatch(board?.receives || [], selectedBatch?.id ?? selectedBatchId),
    [board, selectedBatch, selectedBatchId],
  )
  const batchSales = useMemo(
    () => salesForBatch(board?.sales || [], selectedBatch?.id ?? selectedBatchId, batchReceives.map((r) => r.id)),
    [board, selectedBatch, selectedBatchId, batchReceives],
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

  const saleLines = useMemo(
    () =>
      batchSales.flatMap((sale) =>
        sale.items.map((item) => ({
          ...item,
          saleId: sale.id,
          invoice: sale.invoiceNumber,
          buyerId: sale.buyerId,
          buyerName: sale.buyerName,
        })),
      ),
    [batchSales],
  )

  const selectedBuyer = buyers.find((b) => String(b.id) === sellBuyerId)
  const selectedFarmer = farmers.find((f) => String(f.id) === farmerId)

  const farmerTrucks = useMemo(
    () => trucks.filter((t) => !farmerId || String(t.farmerId) === farmerId),
    [trucks, farmerId],
  )

  const receivedBags = batchReceives.reduce((s, r) => s + r.bags, 0)
  const receivedKg = batchReceives.reduce((s, r) => s + r.weight, 0)
  const extraKg = batchReceives.reduce((s, r) => s + (r.partialBagWeight || 0), 0)
  const soldBags = batchReceives
    .filter((r) => r.sellingStatus === 'SOLD')
    .reduce((s, r) => s + r.bags, 0)
  const soldKg = batchSales.reduce(
    (s, sale) => s + sale.items.reduce((n, item) => n + item.weight, 0),
    0,
  )
  const soldAmount = batchSales.reduce(
    (s, sale) => s + sale.items.reduce((n, item) => n + item.amount, 0),
    0,
  )

  const historyItems = useMemo(() => {
    if (!selectedBatch) return []
    const created = selectedBatch.createdAt
      ? [{
          at: selectedBatch.createdAt,
          kind: 'BATCH' as const,
          text: `Batch ${selectedBatch.batchNumber} created — receiving, selling, bills, and this history are only this batch`,
        }]
      : []
    const receives = batchReceives.map((r) => ({
      at: r.createdAt || r.date,
      kind: 'RECEIVE' as const,
      text: `${r.dheriId} received from ${r.farmerName} · ${r.productName} · ${r.bags} bags (${formatNumber(r.weight)} kg)${r.partialBagWeight ? ` + Extra ${formatNumber(r.partialBagWeight)} kg` : ''}`,
    }))
    const sells = batchSales.flatMap((sale) =>
      sale.items.map((s) => ({
        at: sale.createdAt || sale.invoiceNumber,
        kind: 'SELL' as const,
        text: `${sale.invoiceNumber} · sold ${s.dheriCode || 'stock'} to ${sale.buyerName} · ${s.bags} bags @ ${formatCurrency(s.rate)}/40kg = ${formatCurrency(s.amount)} — seller balance updated`,
      })),
    )
    return [...created, ...receives, ...sells].sort((a, b) => a.at.localeCompare(b.at))
  }, [selectedBatch, batchReceives, batchSales])

  const createBatch = async () => {
    setOpeningBatch(true)
    try {
      const res = batches.length === 0
        ? await dailyTradeApi.ensureReceivingBatch()
        : await dailyTradeApi.openNextBatch()
      const created = res.data.data as { id?: number; batchNumber?: number }
      toast.success(`Batch ${created.batchNumber ?? ''} created`)
      if (created.id) rememberBatch(created.id)
      await load(true)
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
      toast.success(res.data.data.message || `Received into Batch ${selectedBatch.batchNumber}`)
      setRows([{ ...emptyRow(), productId: products[0] ? String(products[0].id) : '' }])
      setReceiveNotes('')
      rememberBatch(selectedBatch.id)
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

  const fetchBillHtml = async (buyerId: number, itemIds: number[], lang: 'en' | 'ur') => {
    const res = await buyerApi.getSelectedBillHtml(buyerId, itemIds, lang)
    return typeof res.data === 'string' ? res.data : String(res.data)
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
      const buyerId = sale.buyerId ?? Number(sellBuyerId)
      const itemIds = (sale.items || []).map((i) => i.id).filter(Boolean)
      const note =
        `Batch ${selectedBatch.batchNumber} · ${selectedDheri?.dheriId} → ${selectedBuyer?.name || 'seller'} @ ${formatCurrency(rateNum)}/40kg = ${formatCurrency(autoAmount)} (${sale.invoiceNumber || ''})`
      let html: string | null = null
      try {
        if (buyerId && itemIds.length) html = await fetchBillHtml(buyerId, itemIds, billLang)
      } catch {
        html = null
      }
      setLastSale({ batchId: selectedBatch.id, buyerId, itemIds, note, html })
      setSellRate('')
      setSellPaid('0')
      rememberBatch(selectedBatch.id)
      await load(true)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Sell failed')
    } finally {
      setSelling(false)
    }
  }

  const generateBill = async (openTab = false) => {
    const sale = lastSale
    if (!sale || !selectedBatch || sale.batchId !== selectedBatch.id || sale.itemIds.length === 0) {
      toast.error('Sell a dheri in this batch first, then generate its bill')
      return
    }
    setBillLoading(true)
    try {
      const html = await fetchBillHtml(sale.buyerId, sale.itemIds, billLang)
      setLastSale({ ...sale, html })
      if (openTab) {
        openHtmlBill(html, billLang === 'ur' ? 'Seller bill (Urdu)' : 'Seller bill')
      }
    } catch (err) {
      toast.error(billErrorMessage(err, 'Could not generate bill'))
    } finally {
      setBillLoading(false)
    }
  }

  useEffect(() => {
    if (!lastSale || !selectedBatch || lastSale.batchId !== selectedBatch.id) return
    if (!lastSale.itemIds.length) return
    void (async () => {
      try {
        const html = await fetchBillHtml(lastSale.buyerId, lastSale.itemIds, billLang)
        setLastSale((prev) => (prev && prev.batchId === lastSale.batchId ? { ...prev, html } : prev))
      } catch {
        /* keep previous html */
      }
    })()
    // Refresh preview when language changes for the current batch sale
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billLang])

  if (loading && !board) return <TableSkeleton rows={12} />

  const workingLabel = selectedBatch
    ? `Batch ${selectedBatch.batchNumber}`
    : 'no batch selected'
  const batchBill = lastSale && selectedBatch && lastSale.batchId === selectedBatch.id ? lastSale : null

  return (
    <div className="space-y-5">
      <PageHeader
        title="Daily Trade"
        description="Tap a batch. The two bag tables, add dheri, sell, bill, and history below are only for that batch. Same farmer can appear in Batch 1, 2, 3…"
        action={
          <Button variant="secondary" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" /> Reload
          </Button>
        }
      />

      <div className="card-3d p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" /> Batches — tap one, then work only on that batch
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
                  onClick={() => selectBatch(b.id)}
                  className={`rounded-xl border px-4 py-3 min-w-[8rem] text-left transition ${
                    on
                      ? 'bg-[#002D62] text-white border-[#C5A059]'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10'
                  }`}
                >
                  <p className="font-semibold">Batch {b.batchNumber}</p>
                  <p className={`text-xs mt-1 ${on ? 'text-white/80' : 'text-slate-500'}`}>
                    {batchStatusLabel(b.status)} · {b.soldDheris}/{b.totalDheris} sold · {b.unsoldDheris} left
                  </p>
                </button>
              )
            })}
          </div>
        )}
        {selectedBatch ? (
          <p className="text-sm text-[#002D62] dark:text-[#C5A059] font-medium">
            Working on Batch {selectedBatch.batchNumber} only — frames below will not show another batch.
            {selectedBatch.status === 'CLOSED' ? ' This batch is completed; you can still receive more dheris into it.' : ''}
            {' '}Same farmer can be used in any other batch too.
          </p>
        ) : (
          <p className="text-sm text-slate-500">Tap a batch above. Frames below stay empty until you do.</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card-3d p-5 border-2 border-emerald-500/70">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Receiving bags · {workingLabel}</p>
              <p className="text-3xl font-bold mt-1 tabular-nums">{receivedBags}</p>
              <p className="text-sm text-slate-500">{formatNumber(receivedKg)} kg</p>
              <p className="text-xs mt-2">Extra KG in this batch: {formatNumber(extraKg)}</p>
            </div>
            <Package className="h-7 w-7 text-emerald-600" />
          </div>
        </div>
        <div className="card-3d p-5 border-2 border-primary/70">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Selling bags · {workingLabel}</p>
              <p className="text-3xl font-bold mt-1 tabular-nums">{soldBags}</p>
              <p className="text-sm text-slate-500">{formatNumber(soldKg)} kg</p>
              <p className="text-xs mt-2">Sold amount: {formatCurrency(soldAmount)}</p>
            </div>
            <Scale className="h-7 w-7 text-primary" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="card-3d overflow-hidden">
          <div className="px-4 py-3 font-semibold border-b border-slate-100 dark:border-white/10 bg-emerald-50 dark:bg-emerald-950/20">
            Receiving table — {workingLabel} stock bags only
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="text-left">
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
                {batchReceives.map((r) => (
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
            {batchReceives.length === 0 && (
              <p className="p-4 text-sm text-slate-500">
                {selectedBatch ? `No bags received in Batch ${selectedBatch.batchNumber} yet.` : 'Tap a batch to see its stock bags.'}
              </p>
            )}
          </div>
        </div>

        <div className="card-3d overflow-hidden">
          <div className="px-4 py-3 font-semibold border-b border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-slate-800/50">
            Selling table — {workingLabel} invoices only
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="text-left">
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
                    <td className="px-3 py-2">{s.dheriCode || '—'}</td>
                    <td className="px-3 py-2">{s.farmerName || '—'}</td>
                    <td className="px-3 py-2">{s.bags}</td>
                    <td className="px-3 py-2">{formatCurrency(s.rate)}</td>
                    <td className="px-3 py-2">{formatCurrency(s.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {saleLines.length === 0 && (
              <p className="p-4 text-sm text-slate-500">
                {selectedBatch ? `No bags sold in Batch ${selectedBatch.batchNumber} yet.` : 'Tap a batch to see its sales.'}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border-2 border-emerald-200/80 dark:border-emerald-800/40 overflow-hidden">
        <div className="px-5 py-3 bg-emerald-700 text-white font-semibold">
          Add dheri(s) into {workingLabel}
        </div>
        <div className="p-5 space-y-4 bg-white dark:bg-slate-900">
          {!selectedBatch ? (
            <p className="text-sm text-slate-500">Tap a batch first. New receives go only into the tapped batch.</p>
          ) : (
            <>
              <Select
                label="Farmer (can be the same farmer in Batch 1, 2, 3…) *"
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
              {selectedFarmer && (
                <p className="text-sm">
                  Farmer record: <Link className="text-primary font-medium" to={`/farmers/${selectedFarmer.id}`}>{selectedFarmer.name}</Link>
                  {selectedFarmer.phone ? ` · ${selectedFarmer.phone}` : ''}
                  {selectedFarmer.city ? ` · ${selectedFarmer.city}` : ''}
                  {' · '}payable {formatCurrency(selectedFarmer.outstandingBalance)}
                </p>
              )}
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
                One farmer can send multiple dheris at once — add a row per dheri, then save all into Batch {selectedBatch.batchNumber}.
                {selectedBatch.status === 'CLOSED' ? ' This batch is completed; receiving still works and reopens it.' : ''}
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
                <Button onClick={() => void handleReceive()} loading={receiving}>
                  <Package className="h-4 w-4" /> Save into Batch {selectedBatch.batchNumber}
                </Button>
                <Link to="/farmers" className="text-sm text-primary underline self-center">Add farmer</Link>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="rounded-2xl border-2 border-[#002D62]/25 overflow-hidden">
        <div className="px-5 py-3 bg-[#002D62] text-white font-semibold flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-[#C5A059]" />
          Sell a dheri from {workingLabel}
        </div>
        <div className="p-5 space-y-4 bg-white dark:bg-slate-900">
          {!selectedBatch ? (
            <p className="text-sm text-slate-500">Tap a batch first. Only that batch’s unsold dheris appear here.</p>
          ) : unsold.length === 0 ? (
            <p className="text-sm text-slate-500">
              No unsold dheris in Batch {selectedBatch.batchNumber}. Receive into this batch (including a completed batch), or tap another batch.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Select
                  label={`Dheri to sell (Batch ${selectedBatch.batchNumber} only) *`}
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
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/40 p-3 text-sm space-y-1">
                  <p>
                    Seller record:{' '}
                    <Link className="text-primary font-medium" to={`/buyers/${selectedBuyer.id}`}>{selectedBuyer.name}</Link>
                    {' · '}{selectedBuyer.buyerId}
                  </p>
                  <p>
                    {selectedBuyer.phone || 'No phone'}
                    {selectedBuyer.city ? ` · ${selectedBuyer.city}` : ''}
                    {selectedBuyer.address ? ` · ${selectedBuyer.address}` : ''}
                  </p>
                  <p>
                    Outstanding {formatCurrency(selectedBuyer.outstandingBalance)}
                    {' · '}this sale updates Sellers and dashboard pending payments.
                  </p>
                </div>
              )}
              {selectedDheri && (
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Selling {selectedDheri.dheriId} from Batch {selectedBatch.batchNumber} only
                  {' · '}{selectedDheri.farmerName}
                  {' · '}{selectedDheri.productName}
                  {' · '}{selectedDheri.bags} bags + Extra {formatNumber(selectedDheri.partialBagWeight)} kg
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

      <div className="rounded-2xl border-2 border-[#C5A059]/60 overflow-hidden">
        <div className="px-5 py-3 bg-gradient-to-r from-[#002D62] to-[#0a3a75] text-white font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4 text-[#C5A059]" />
          Bill for the dheri sold above — {workingLabel}
        </div>
        <div className="p-5 space-y-3 bg-white dark:bg-slate-900">
          {batchBill ? (
            <>
              <p className="text-sm font-medium">{batchBill.note}</p>
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
                <Button loading={billLoading} onClick={() => void generateBill(true)}>
                  <FileText className="h-4 w-4" /> Open professional bill
                </Button>
                <Link to={`/buyers/${batchBill.buyerId}`} className="text-sm text-primary underline">
                  Open seller record
                </Link>
              </div>
              {batchBill.html ? (
                <iframe
                  title="Seller bill preview"
                  className="w-full min-h-[28rem] rounded-xl border border-slate-200 dark:border-white/10 bg-white"
                  srcDoc={batchBill.html}
                />
              ) : (
                <p className="text-sm text-slate-500">Bill preview will appear here after the sale is recorded.</p>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-500">
              Sell a dheri from {workingLabel} in the frame above — its professional bill appears here for this batch only.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
        <div className="px-5 py-3 bg-slate-100 dark:bg-slate-800 font-semibold flex items-center gap-2">
          <History className="h-4 w-4" /> Readme / history — {workingLabel} only
        </div>
        <div className="p-5 bg-white dark:bg-slate-900">
          {!selectedBatch ? (
            <p className="text-sm text-slate-500">Tap a batch to read its receive and sell history.</p>
          ) : historyItems.length === 0 ? (
            <p className="text-sm text-slate-500">No activity in Batch {selectedBatch.batchNumber} yet.</p>
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
