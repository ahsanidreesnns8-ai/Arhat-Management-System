import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeftRight, FileText, History, Layers, Package, Plus, RefreshCw, Scale, ShoppingCart, Warehouse,
} from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import { TableSkeleton } from '../components/ui/Skeleton'
import { useLiveReload } from '../context/SyncContext'
import { arhatApi, buyerApi, dailyTradeApi, farmerApi, settingsApi } from '../services/api'
import { billErrorMessage, openHtmlBill } from '../utils/bill'
import { formatCurrency, formatNumber } from '../utils/format'
import type { Buyer, Farmer, Product } from '../types'

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
  sellingStatus: string
}

type DayBatchRow = {
  id: number
  batchNumber: number
  status: string
  totalDheris: number
  soldDheris: number
  unsoldDheris: number
  canSell: boolean
}

type SaleItemRow = {
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
}

type Board = {
  session: {
    id: number
    sessionDate: string
    receivedBags: number
    soldBags: number
    receivedWeightKg: number
    soldWeightKg: number
    stockInKg: number
    stockOutKg: number
    highestRate: number
    balanced: boolean
    remainingBags: number
  }
  stockLots: Array<{
    id: number
    productId: number
    productName?: string
    farmerName?: string | null
    dheriCode?: string | null
    remainingKg: number
    ratePer40Kg: number
    amountValue: number
    intakeDate: string
  }>
  stockKgAvailable: number
  receives: BoardReceive[]
  sales: Array<{
    id: number
    invoiceNumber: string
    buyerId: number
    buyerName: string
    bags: number
    weight: number
    amount: number
    items: SaleItemRow[]
  }>
  batches: DayBatchRow[]
  receivingBatch: DayBatchRow | null
  activeSellBatch: DayBatchRow | null
}

export default function DailyTradePage() {
  const [board, setBoard] = useState<Board | null>(null)
  const [history, setHistory] = useState<Array<Record<string, unknown>>>([])
  const [buyers, setBuyers] = useState<Buyer[]>([])
  const [farmers, setFarmers] = useState<Farmer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showHistory, setShowHistory] = useState(false)

  const [recvFarmerId, setRecvFarmerId] = useState('')
  const [recvProductId, setRecvProductId] = useState('')
  const [recvBags, setRecvBags] = useState('')
  const [recvBagKg, setRecvBagKg] = useState('40')
  const [recvExtraKg, setRecvExtraKg] = useState('0')
  const [receiving, setReceiving] = useState(false)
  const [openingBatch, setOpeningBatch] = useState(false)

  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null)
  const [sellDheriId, setSellDheriId] = useState('')
  const [sellBuyerId, setSellBuyerId] = useState('')
  const [sellRate, setSellRate] = useState('')
  const [sellPaid, setSellPaid] = useState('0')
  const [selling, setSelling] = useState(false)
  const [newBuyerName, setNewBuyerName] = useState('')
  const [addingBuyer, setAddingBuyer] = useState(false)

  const [billItemIds, setBillItemIds] = useState<number[]>([])
  const [billBuyerId, setBillBuyerId] = useState<number | null>(null)
  const [billLang, setBillLang] = useState<'en' | 'ur'>('en')
  const [lastSaleSummary, setLastSaleSummary] = useState<string | null>(null)

  const load = useCallback(async (soft = false) => {
    if (!soft) setLoading(true)
    try {
      const [b, h, buy, prod, farm] = await Promise.all([
        dailyTradeApi.getBoard(),
        dailyTradeApi.getHistory(),
        buyerApi.getAll(),
        settingsApi.getProducts(),
        farmerApi.getAll(),
      ])
      setBoard(b.data.data)
      setHistory(h.data.data || [])
      setBuyers(buy.data.data || [])
      setProducts(prod.data.data || [])
      setFarmers(farm.data.data || [])
    } catch {
      if (!soft) toast.error('Failed to load daily trade board')
    } finally {
      if (!soft) setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])
  useLiveReload(() => { void load(true) })

  useEffect(() => {
    if (!recvProductId && products[0]) setRecvProductId(String(products[0].id))
  }, [products, recvProductId])

  const receivingBatch = board?.receivingBatch ?? null
  const batches = board?.batches || []
  const selectedBatch =
    batches.find((b) => b.id === selectedBatchId) ??
    board?.activeSellBatch ??
    batches.find((b) => b.unsoldDheris > 0) ??
    null

  useEffect(() => {
    if (selectedBatchId == null && selectedBatch) setSelectedBatchId(selectedBatch.id)
  }, [selectedBatch, selectedBatchId])

  const batchDheris = useMemo(() => {
    if (!board || !selectedBatch) return []
    return board.receives.filter((r) => r.dayBatchId === selectedBatch.id)
  }, [board, selectedBatch])

  const sellableDheris = batchDheris.filter((r) => r.sellingStatus !== 'SOLD')

  useEffect(() => {
    if (sellableDheris.length && !sellableDheris.some((d) => String(d.id) === sellDheriId)) {
      setSellDheriId(String(sellableDheris[0].id))
    }
    if (!sellableDheris.length) setSellDheriId('')
  }, [sellableDheris, sellDheriId])

  const selectedSellDheri = sellableDheris.find((d) => String(d.id) === sellDheriId)
  const rateNum = parseFloat(sellRate) || 0
  const autoWeight = selectedSellDheri
    ? selectedSellDheri.bags * selectedSellDheri.weightPerBag + (selectedSellDheri.partialBagWeight || 0)
    : 0
  const autoAmount = autoWeight > 0 && rateNum > 0 ? (autoWeight / 40) * rateNum : 0

  const saleLines = useMemo(
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

  const handleOpenNextBatch = async () => {
    setOpeningBatch(true)
    try {
      const res = await dailyTradeApi.openNextBatch()
      toast.success('Next batch opened — receive new farmer dheris here')
      await load(true)
      const created = res.data.data as { id?: number }
      if (created?.id) setSelectedBatchId(created.id)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Could not open next batch')
    } finally {
      setOpeningBatch(false)
    }
  }

  const handleReceive = async () => {
    if (!recvFarmerId) {
      toast.error('Select farmer (already registered)')
      return
    }
    if (!recvProductId) {
      toast.error('Select product')
      return
    }
    const bags = parseInt(recvBags, 10) || 0
    if (bags <= 0) {
      toast.error('Enter number of bags')
      return
    }
    setReceiving(true)
    try {
      await dailyTradeApi.ensureReceivingBatch()
      const res = await arhatApi.settle({
        settlementType: 'FARMER_PAYABLE',
        farmerId: Number(recvFarmerId),
        productId: Number(recvProductId),
        numberOfBags: bags,
        weightPerBag: parseFloat(recvBagKg) || 40,
        partialBagWeight: parseFloat(recvExtraKg) || 0,
        marketRate: 0,
        paymentNow: 0,
      })
      toast.success(res.data.message || `Received into Batch ${receivingBatch?.batchNumber ?? 1}`)
      setRecvBags('')
      setRecvExtraKg('0')
      await load(true)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Receive failed')
    } finally {
      setReceiving(false)
    }
  }

  const handleAddBuyer = async () => {
    const name = newBuyerName.trim()
    if (!name) {
      toast.error('Enter buyer / seller name')
      return
    }
    setAddingBuyer(true)
    try {
      const res = await buyerApi.create({ name })
      const created = res.data.data
      toast.success(`Buyer ${created.name} added`)
      setBuyers((prev) => [created, ...prev])
      setSellBuyerId(String(created.id))
      setNewBuyerName('')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Could not add buyer')
    } finally {
      setAddingBuyer(false)
    }
  }

  const handleAuctionSell = async () => {
    if (!selectedBatch) {
      toast.error('Click a batch first')
      return
    }
    if (!sellDheriId) {
      toast.error('Select a dheri from this batch')
      return
    }
    if (!sellBuyerId) {
      toast.error('Select or add the buyer')
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
      toast.success(res.data.data.message || 'Sold')
      setBoard(res.data.data.board)
      setSellRate('')
      setSellPaid('0')
      const sale = res.data.data.sale as {
        id?: number
        buyerId?: number
        invoiceNumber?: string
        items?: Array<{ id: number }>
      }
      if (sale?.buyerId) setBillBuyerId(sale.buyerId)
      if (sale?.items?.length) {
        setBillItemIds(sale.items.map((i) => i.id).filter(Boolean))
      }
      const dheriCode = selectedSellDheri?.dheriId || ''
      setLastSaleSummary(
        `${dheriCode} · Batch ${selectedBatch.batchNumber} · ${formatCurrency(rateNum)}/40kg · ${formatCurrency(autoAmount)} · ${sale?.invoiceNumber || ''}`,
      )
      await load(true)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Sell failed')
    } finally {
      setSelling(false)
    }
  }

  const openSelectedBill = async (lang: 'en' | 'ur') => {
    if (!billBuyerId || billItemIds.length === 0) {
      toast.error('Tick sold lines in the bill table first')
      return
    }
    try {
      const res = await buyerApi.getSelectedBillHtml(billBuyerId, billItemIds, lang)
      openHtmlBill(
        typeof res.data === 'string' ? res.data : String(res.data),
        lang === 'ur' ? 'Buyer bill (Urdu)' : 'Buyer bill',
      )
    } catch (err) {
      toast.error(billErrorMessage(err, 'Could not generate bill'))
    }
  }

  const handleRefresh = async () => {
    if (!window.confirm('Archive today’s board to history and start a fresh board?')) return
    try {
      const res = await dailyTradeApi.refresh()
      setBoard(res.data.data)
      toast.success('Board refreshed — previous day archived')
      const h = await dailyTradeApi.getHistory()
      setHistory(h.data.data || [])
      setSelectedBatchId(null)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Refresh failed')
    }
  }

  if (loading && !board) return <TableSkeleton rows={10} />

  const session = board?.session
  const selectedBuyer = buyers.find((b) => String(b.id) === sellBuyerId)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily Trade — Day Batches"
        description="Click a batch to sell its dheris · Enter buyer, bags, and rate / 40kg · Weight and amount calculate automatically · Print a professional bill"
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setShowHistory((v) => !v)}>
              <History className="h-4 w-4" /> History
            </Button>
            <Button variant="secondary" onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" /> Reload
            </Button>
            <Button variant="secondary" onClick={() => void handleRefresh()}>
              <ArrowLeftRight className="h-4 w-4" /> End day / archive
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card-3d p-5 border border-emerald-200/60 dark:border-emerald-800/40">
          <p className="text-xs uppercase tracking-wide text-slate-500">Receiving today</p>
          <p className="text-3xl font-bold mt-1 tabular-nums">{session?.receivedBags || 0}</p>
          <p className="text-sm text-slate-500">bags · {formatNumber(session?.receivedWeightKg || 0)} kg</p>
          <p className="text-sm mt-2">
            Current receive batch:{' '}
            <strong>Batch {receivingBatch?.batchNumber ?? '—'}</strong>
          </p>
        </div>
        <div className="card-3d p-5 border border-primary/30">
          <p className="text-xs uppercase tracking-wide text-slate-500">Selling today</p>
          <p className="text-3xl font-bold mt-1 tabular-nums">{session?.soldBags || 0}</p>
          <p className="text-sm text-slate-500">bags · {formatNumber(session?.soldWeightKg || 0)} kg</p>
          <p className="text-sm mt-2">
            Selected batch:{' '}
            <strong>
              {selectedBatch
                ? `Batch ${selectedBatch.batchNumber} (${selectedBatch.unsoldDheris} left)`
                : 'Click a batch below'}
            </strong>
          </p>
        </div>
      </div>

      <div className="card-3d p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" /> Today’s batches — click one to sell
          </h3>
          <Button variant="secondary" loading={openingBatch} onClick={() => void handleOpenNextBatch()}>
            Open next batch
          </Button>
        </div>
        {batches.length === 0 ? (
          <p className="text-sm text-slate-500">
            No batches yet — receive the first farmer dheri below to start Batch 1.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {batches.map((b) => {
              const isSelected = selectedBatch?.id === b.id
              const isReceiving = receivingBatch?.id === b.id
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    setSelectedBatchId(b.id)
                    setSellDheriId('')
                  }}
                  className={`rounded-xl border p-3 text-left transition shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                    isSelected
                      ? 'border-[#C5A059] bg-[#002D62] text-white'
                      : isReceiving
                        ? 'border-emerald-400 bg-emerald-50/80 dark:bg-emerald-950/20'
                        : 'border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900'
                  }`}
                >
                  <p className="font-semibold">Batch {b.batchNumber}</p>
                  <p className={`text-xs uppercase mt-0.5 ${isSelected ? 'text-white/80' : 'text-slate-500'}`}>
                    {b.status}
                  </p>
                  <p className="text-sm mt-2">
                    {b.soldDheris}/{b.totalDheris} sold · {b.unsoldDheris} left
                  </p>
                  {isSelected && (
                    <p className="text-xs font-semibold text-[#C5A059] mt-1">Selected — sell below</p>
                  )}
                  {!isSelected && isReceiving && (
                    <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200 mt-1">
                      Receiving here
                    </p>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="card-3d p-4 space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Package className="h-4 w-4 text-emerald-600" />
          Receive dheri into Batch {receivingBatch?.batchNumber ?? 1}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Select
            label="Farmer (existing) *"
            value={recvFarmerId}
            onChange={(e) => setRecvFarmerId(e.target.value)}
            options={[
              { value: '', label: 'Select farmer' },
              ...farmers.map((f) => ({
                value: String(f.id),
                label: `${f.name} (${f.farmerId})`,
              })),
            ]}
          />
          <Select
            label="Product *"
            value={recvProductId}
            onChange={(e) => setRecvProductId(e.target.value)}
            options={[
              { value: '', label: 'Select product' },
              ...products.map((p) => ({ value: String(p.id), label: p.name })),
            ]}
          />
          <Input label="Bags *" type="number" value={recvBags} onChange={(e) => setRecvBags(e.target.value)} />
          <Input label="Bag weight (kg)" type="number" step="0.01" value={recvBagKg} onChange={(e) => setRecvBagKg(e.target.value)} />
          <Input label="Extra KG" type="number" step="0.01" value={recvExtraKg} onChange={(e) => setRecvExtraKg(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void handleReceive()} loading={receiving}>
            <Package className="h-4 w-4" /> Add to Batch {receivingBatch?.batchNumber ?? 1}
          </Button>
          <Link to="/farmers" className="text-sm text-primary underline self-center">
            Add new farmer first
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border-2 border-[#002D62]/20 overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
        <div className="px-5 py-3 bg-[#002D62] text-white flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-[#C5A059]" />
            Sell dheri from Batch {selectedBatch?.batchNumber ?? '—'}
          </h3>
          <span className="text-xs text-white/80">Buyer · bags · rate / 40kg · auto weight</span>
        </div>
        <div className="p-5 space-y-4">
          {!selectedBatch ? (
            <p className="text-sm text-slate-500">Click a batch card above to sell its dheris.</p>
          ) : sellableDheris.length === 0 ? (
            <p className="text-sm text-slate-500">
              Batch {selectedBatch.batchNumber} has no unsold dheris. Click another batch or receive more.
            </p>
          ) : (
            <>
              <div className="rounded-xl border border-slate-200 dark:border-white/10 p-4 space-y-3 bg-slate-50/80 dark:bg-slate-800/40">
                <p className="text-sm font-semibold text-[#002D62] dark:text-[#C5A059]">1. Buyer (seller of cash / buyer of grain)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Select
                    label="Buyer *"
                    value={sellBuyerId}
                    onChange={(e) => setSellBuyerId(e.target.value)}
                    options={[
                      { value: '', label: 'Select buyer' },
                      ...buyers.map((b) => ({
                        value: String(b.id),
                        label: `${b.name} (${b.buyerId})`,
                      })),
                    ]}
                  />
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Input
                        label="Or add new buyer"
                        value={newBuyerName}
                        onChange={(e) => setNewBuyerName(e.target.value)}
                        placeholder="Buyer name"
                      />
                    </div>
                    <Button variant="secondary" loading={addingBuyer} onClick={() => void handleAddBuyer()}>
                      <Plus className="h-4 w-4" /> Add
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-white/10 p-4 space-y-3">
                <p className="text-sm font-semibold text-[#002D62] dark:text-[#C5A059]">
                  2. Dheri of Batch {selectedBatch.batchNumber}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <Select
                    label="Dheri *"
                    value={sellDheriId}
                    onChange={(e) => setSellDheriId(e.target.value)}
                    options={[
                      { value: '', label: 'Select dheri' },
                      ...sellableDheris.map((r) => ({
                        value: String(r.id),
                        label: `${r.dheriId} · ${r.farmerName} · ${r.productName}`,
                      })),
                    ]}
                  />
                  <Input label="Bags" value={selectedSellDheri ? String(selectedSellDheri.bags) : ''} readOnly />
                  <Input
                    label="Bag weight (kg)"
                    value={selectedSellDheri ? String(selectedSellDheri.weightPerBag) : ''}
                    readOnly
                  />
                  <Input
                    label="Extra KG"
                    value={selectedSellDheri ? String(selectedSellDheri.partialBagWeight) : '0'}
                    readOnly
                  />
                </div>
              </div>

              <div className="rounded-xl border border-[#C5A059]/40 p-4 space-y-3 bg-[#C5A059]/5">
                <p className="text-sm font-semibold text-[#002D62] dark:text-[#C5A059]">3. Rate and auto totals</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <Input
                    label="Rate / 40kg *"
                    type="number"
                    step="0.01"
                    value={sellRate}
                    onChange={(e) => setSellRate(e.target.value)}
                    placeholder="e.g. 4300"
                  />
                  <Input label="Total weight (auto)" value={autoWeight ? formatNumber(autoWeight) : '—'} readOnly />
                  <Input label="Amount (auto)" value={autoAmount ? formatCurrency(autoAmount) : '—'} readOnly />
                  <Input
                    label="Cash received now"
                    type="number"
                    step="0.01"
                    value={sellPaid}
                    onChange={(e) => setSellPaid(e.target.value)}
                  />
                </div>
                {selectedSellDheri && (
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Selling <strong>{selectedSellDheri.dheriId}</strong> from{' '}
                    <strong>{selectedSellDheri.farmerName}</strong>
                    {selectedBuyer ? <> to <strong>{selectedBuyer.name}</strong></> : ''}
                    {' '}— {selectedSellDheri.bags} bags × {formatNumber(selectedSellDheri.weightPerBag)} kg
                    {selectedSellDheri.partialBagWeight > 0
                      ? ` + Extra ${formatNumber(selectedSellDheri.partialBagWeight)} kg`
                      : ''}
                    {' = '}
                    <strong>{formatNumber(autoWeight)} kg</strong>
                    {rateNum > 0 ? <> · {formatCurrency(autoAmount)}</> : ''}
                  </p>
                )}
              </div>

              <Button onClick={() => void handleAuctionSell()} loading={selling}>
                <Scale className="h-4 w-4" /> Sell this dheri to buyer
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="rounded-2xl border-2 border-[#C5A059]/50 overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
        <div className="px-5 py-3 bg-gradient-to-r from-[#002D62] to-[#0a3a75] text-white flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#C5A059]" />
            Generate professional bills
          </h3>
          <span className="text-xs text-white/80">Tick lines from the sales above, then print EN or UR</span>
        </div>
        <div className="p-5 space-y-4">
          {lastSaleSummary && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 dark:bg-emerald-950/20 px-4 py-3 text-sm">
              <p className="text-xs uppercase tracking-wide text-emerald-800 dark:text-emerald-200">Last sale</p>
              <p className="font-semibold mt-1">{lastSaleSummary}</p>
            </div>
          )}
          {saleLines.length === 0 ? (
            <p className="text-sm text-slate-500">No sales yet today — sell a dheri above, then generate its bill here.</p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
                <table className="w-full text-sm min-w-[720px]">
                  <thead className="bg-[#002D62] text-white text-left">
                    <tr>
                      <th className="px-3 py-2">Bill</th>
                      <th className="px-3 py-2">Invoice</th>
                      <th className="px-3 py-2">Buyer</th>
                      <th className="px-3 py-2">Dheri</th>
                      <th className="px-3 py-2">Farmer</th>
                      <th className="px-3 py-2">Bags</th>
                      <th className="px-3 py-2">Rate/40kg</th>
                      <th className="px-3 py-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {saleLines.map((item) => (
                      <tr key={item.id} className={billItemIds.includes(item.id) ? 'bg-[#C5A059]/10' : ''}>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={billItemIds.includes(item.id)}
                            onChange={() => {
                              setBillBuyerId(item.buyerId)
                              setBillItemIds((prev) =>
                                prev.includes(item.id) ? prev.filter((x) => x !== item.id) : [...prev, item.id],
                              )
                            }}
                            aria-label={`Bill ${item.dheriCode || item.invoice}`}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Link className="text-primary" to={`/sales/${item.saleId}`}>{item.invoice}</Link>
                        </td>
                        <td className="px-3 py-2">{item.buyerName}</td>
                        <td className="px-3 py-2 font-medium">{item.dheriCode || '—'}</td>
                        <td className="px-3 py-2">{item.farmerName || '—'}</td>
                        <td className="px-3 py-2">{item.bags}</td>
                        <td className="px-3 py-2">{formatCurrency(item.rate)}</td>
                        <td className="px-3 py-2">{formatCurrency(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm">
                  {billItemIds.length} line{billItemIds.length === 1 ? '' : 's'} selected
                </span>
                <div className="inline-flex rounded-lg border border-slate-200 dark:border-white/10 overflow-hidden">
                  {(['en', 'ur'] as const).map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setBillLang(code)}
                      className={`px-3 py-1.5 text-xs font-semibold ${
                        billLang === code ? 'bg-[#002D62] text-white' : 'bg-transparent'
                      }`}
                    >
                      {code === 'en' ? 'English' : 'اردو'}
                    </button>
                  ))}
                </div>
                <Button
                  onClick={() => void openSelectedBill(billLang)}
                  disabled={!billBuyerId || billItemIds.length === 0}
                >
                  <FileText className="h-4 w-4" /> Generate bill
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (!saleLines.length) return
                    setBillItemIds(saleLines.map((x) => x.id))
                    setBillBuyerId(saleLines[0].buyerId)
                  }}
                >
                  Tick all today
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="card-3d overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 font-semibold">
          Today’s dheris {selectedBatch ? `· Batch ${selectedBatch.batchNumber} highlighted` : ''}
        </div>
        {(board?.receives || []).length === 0 ? (
          <p className="p-6 text-sm text-gray-500">No dheris received today.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-left">
                <tr>
                  <th className="px-3 py-2">Batch</th>
                  <th className="px-3 py-2">Dheri</th>
                  <th className="px-3 py-2">Farmer</th>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">Bags</th>
                  <th className="px-3 py-2">Extra kg</th>
                  <th className="px-3 py-2">Rate/40kg</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {(board?.receives || []).map((r) => {
                  const sold = r.sellingStatus === 'SOLD'
                  const inSelected = selectedBatch?.id === r.dayBatchId
                  return (
                    <tr
                      key={r.id}
                      className={inSelected && !sold ? 'bg-amber-50/50 dark:bg-amber-950/10' : ''}
                    >
                      <td className="px-3 py-2 font-medium">
                        {r.batchNumber != null ? `B${r.batchNumber}` : '—'}
                      </td>
                      <td className="px-3 py-2">{r.dheriId}</td>
                      <td className="px-3 py-2">{r.farmerName}</td>
                      <td className="px-3 py-2">{r.productName}</td>
                      <td className="px-3 py-2">{r.bags}</td>
                      <td className="px-3 py-2">{formatNumber(r.partialBagWeight)}</td>
                      <td className="px-3 py-2">
                        {r.rate > 0 ? formatCurrency(r.rate) : <span className="text-slate-400">at sell</span>}
                      </td>
                      <td className="px-3 py-2">
                        {r.amount > 0 ? formatCurrency(r.amount) : '—'}
                      </td>
                      <td className="px-3 py-2">
                        {sold ? (
                          <span className="text-xs font-semibold text-emerald-700">SOLD</span>
                        ) : inSelected ? (
                          <span className="text-xs font-semibold text-amber-700">IN THIS BATCH</span>
                        ) : (
                          <span className="text-xs text-slate-500">UNSOLD</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card-3d overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 font-semibold flex items-center gap-2">
          <Warehouse className="h-4 w-4" /> Extra KG stock lots
        </div>
        {(board?.stockLots || []).length === 0 ? (
          <p className="p-6 text-sm text-gray-500">No Extra KG in stock yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-left">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">Farmer</th>
                  <th className="px-3 py-2">Remaining</th>
                  <th className="px-3 py-2">Rate/40kg</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {(board?.stockLots || []).map((lot) => (
                  <tr key={lot.id}>
                    <td className="px-3 py-2">{lot.intakeDate}</td>
                    <td className="px-3 py-2">{lot.productName}</td>
                    <td className="px-3 py-2">{lot.farmerName || '—'}</td>
                    <td className="px-3 py-2">{formatNumber(lot.remainingKg)} kg</td>
                    <td className="px-3 py-2">{formatCurrency(lot.ratePer40Kg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showHistory && (
        <div className="card-3d overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 font-semibold">
            Archived daily boards
          </div>
          {history.length === 0 ? (
            <p className="p-6 text-sm text-gray-500">No archived days yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {history.map((h) => (
                <li key={String(h.id)} className="px-4 py-3 text-sm">
                  <strong>{String(h.sessionDate)}</strong>
                  {' · '}received {String(h.receivedBags)} · sold {String(h.soldBags)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
