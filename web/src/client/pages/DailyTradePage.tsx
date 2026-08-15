import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeftRight, FileText, History, Layers, Package, RefreshCw, Scale, ShoppingCart, Warehouse,
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

  // Receive into current batch
  const [recvFarmerId, setRecvFarmerId] = useState('')
  const [recvProductId, setRecvProductId] = useState('')
  const [recvBags, setRecvBags] = useState('')
  const [recvBagKg, setRecvBagKg] = useState('40')
  const [recvExtraKg, setRecvExtraKg] = useState('0')
  const [receiving, setReceiving] = useState(false)
  const [openingBatch, setOpeningBatch] = useState(false)

  // Auction sell one dheri
  const [sellDheriId, setSellDheriId] = useState('')
  const [sellBuyerId, setSellBuyerId] = useState('')
  const [sellRate, setSellRate] = useState('')
  const [sellPaid, setSellPaid] = useState('0')
  const [selling, setSelling] = useState(false)

  const [billItemIds, setBillItemIds] = useState<number[]>([])
  const [billBuyerId, setBillBuyerId] = useState<number | null>(null)

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

  const activeSell = board?.activeSellBatch ?? null
  const receivingBatch = board?.receivingBatch ?? null

  const sellableDheris = useMemo(() => {
    if (!board || !activeSell) return []
    return board.receives.filter(
      (r) => r.dayBatchId === activeSell.id && r.sellingStatus !== 'SOLD',
    )
  }, [board, activeSell])

  useEffect(() => {
    if (sellableDheris.length && !sellDheriId) {
      setSellDheriId(String(sellableDheris[0].id))
    }
    if (sellDheriId && !sellableDheris.some((d) => String(d.id) === sellDheriId)) {
      setSellDheriId(sellableDheris[0] ? String(sellableDheris[0].id) : '')
    }
  }, [sellableDheris, sellDheriId])

  const selectedSellDheri = sellableDheris.find((d) => String(d.id) === sellDheriId)

  const handleOpenNextBatch = async () => {
    setOpeningBatch(true)
    try {
      await dailyTradeApi.openNextBatch()
      toast.success('Next batch opened — receive new farmer dheris here')
      await load(true)
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
      toast.success(
        res.data.message ||
          `Received into Batch ${receivingBatch?.batchNumber ?? 1}`,
      )
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

  const handleAuctionSell = async () => {
    if (!sellDheriId) {
      toast.error('Select a dheri from the current batch')
      return
    }
    if (!sellBuyerId) {
      toast.error('Select the winning buyer')
      return
    }
    const rate = parseFloat(sellRate) || 0
    if (rate <= 0) {
      toast.error('Enter highest buyer rate per 40kg')
      return
    }
    setSelling(true)
    try {
      const res = await dailyTradeApi.sellDheri({
        dheriId: Number(sellDheriId),
        buyerId: Number(sellBuyerId),
        ratePer40Kg: rate,
        paidAmount: parseFloat(sellPaid) || 0,
      })
      toast.success(res.data.data.message || 'Sold')
      setBoard(res.data.data.board)
      setSellRate('')
      setSellPaid('0')
      const sale = res.data.data.sale as { id?: number; buyerId?: number; items?: Array<{ id: number }> }
      if (sale?.buyerId) setBillBuyerId(sale.buyerId)
      if (sale?.items?.length) {
        setBillItemIds(sale.items.map((i) => i.id).filter(Boolean))
      }
      await load(true)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Sell failed')
    } finally {
      setSelling(false)
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
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Refresh failed')
    }
  }

  if (loading && !board) return <TableSkeleton rows={10} />

  const session = board?.session
  const batches = board?.batches || []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily Trade — Day Batches"
        description="Receive dheris into Batch 1, 2, 3… · Sell each dheri to the buyer with the highest rate/40kg · Finish one batch before the next"
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
            Must sell now:{' '}
            <strong>
              {activeSell
                ? `Batch ${activeSell.batchNumber} (${activeSell.unsoldDheris} left)`
                : 'No unsold dheris'}
            </strong>
          </p>
        </div>
      </div>

      {/* Batches strip */}
      <div className="card-3d p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" /> Today’s batches
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
              const isActiveSell = activeSell?.id === b.id
              const isReceiving = receivingBatch?.id === b.id
              return (
                <div
                  key={b.id}
                  className={`rounded-xl border p-3 ${
                    isActiveSell
                      ? 'border-amber-400 bg-amber-50/80 dark:bg-amber-950/20'
                      : isReceiving
                        ? 'border-emerald-400 bg-emerald-50/80 dark:bg-emerald-950/20'
                        : 'border-slate-200 dark:border-white/10'
                  }`}
                >
                  <p className="font-semibold">Batch {b.batchNumber}</p>
                  <p className="text-xs text-slate-500 uppercase mt-0.5">{b.status}</p>
                  <p className="text-sm mt-2">
                    {b.soldDheris}/{b.totalDheris} sold · {b.unsoldDheris} left
                  </p>
                  {isActiveSell && (
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 mt-1">
                      Sell this batch first
                    </p>
                  )}
                  {isReceiving && (
                    <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200 mt-1">
                      Receiving here
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
        <p className="text-xs text-slate-500">
          Same farmer can return later — select the existing farmer and enter the new product/bags into the current receiving batch.
          New day starts new Batch 1.
        </p>
      </div>

      {/* Receive */}
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
          <Input
            label="Bags *"
            type="number"
            value={recvBags}
            onChange={(e) => setRecvBags(e.target.value)}
          />
          <Input
            label="Bag weight (kg)"
            type="number"
            step="0.01"
            value={recvBagKg}
            onChange={(e) => setRecvBagKg(e.target.value)}
          />
          <Input
            label="Extra KG"
            type="number"
            step="0.01"
            value={recvExtraKg}
            onChange={(e) => setRecvExtraKg(e.target.value)}
          />
        </div>
        <p className="text-xs text-slate-500">
          Winning rate / 40kg is entered when you sell this dheri to the highest bidder — not at receive time.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void handleReceive()} loading={receiving}>
            <Package className="h-4 w-4" /> Add to Batch {receivingBatch?.batchNumber ?? 1}
          </Button>
          <Link to="/farmers" className="text-sm text-primary underline self-center">
            Add new farmer first
          </Link>
        </div>
      </div>

      {/* Auction sell */}
      <div className="card-3d p-4 space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-primary" />
          Sell dheri — highest buyer rate
          {activeSell ? ` (Batch ${activeSell.batchNumber})` : ''}
        </h3>
        {!activeSell ? (
          <p className="text-sm text-slate-500">No unsold dheris waiting. Receive into a batch first.</p>
        ) : (
          <>
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Finish Batch {activeSell.batchNumber} before selling later batches.
              Enter the rate of the buyer who offered the highest price per 40kg.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Select
                label="Dheri from this batch *"
                value={sellDheriId}
                onChange={(e) => setSellDheriId(e.target.value)}
                options={[
                  { value: '', label: 'Select dheri' },
                  ...sellableDheris.map((r) => ({
                    value: String(r.id),
                    label: `${r.dheriId} · ${r.farmerName} · ${r.bags} bags · ${r.productName}`,
                  })),
                ]}
              />
              <Select
                label="Winning buyer *"
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
              <Input
                label="Highest rate / 40kg *"
                type="number"
                step="0.01"
                value={sellRate}
                onChange={(e) => setSellRate(e.target.value)}
                placeholder="e.g. 4300"
              />
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
                <strong>{selectedSellDheri.farmerName}</strong> —{' '}
                {selectedSellDheri.bags} bags ({formatNumber(selectedSellDheri.weight)} kg)
                {selectedSellDheri.partialBagWeight > 0
                  ? ` · Extra ${formatNumber(selectedSellDheri.partialBagWeight)} kg → stock`
                  : ''}
              </p>
            )}
            <Button onClick={() => void handleAuctionSell()} loading={selling}>
              <Scale className="h-4 w-4" /> Sell this dheri at winning rate
            </Button>
          </>
        )}
      </div>

      {/* All dheris table by batch */}
      <div className="card-3d overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 font-semibold">
          Today’s dheris by batch
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
                  const locked =
                    !!activeSell &&
                    r.dayBatchId !== activeSell.id &&
                    !sold
                  return (
                    <tr
                      key={r.id}
                      className={
                        locked ? 'opacity-60' : activeSell?.id === r.dayBatchId && !sold ? 'bg-amber-50/40 dark:bg-amber-950/10' : ''
                      }
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
                        ) : locked ? (
                          <span className="text-xs text-slate-500">Wait — finish earlier batch</span>
                        ) : (
                          <span className="text-xs font-semibold text-amber-700">READY TO SELL</span>
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

      {(board?.sales || []).length > 0 && (
        <div className="card-3d overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 font-semibold flex flex-wrap justify-between gap-2">
            <span>Today’s sales</span>
            <Button
              variant="secondary"
              disabled={!billBuyerId || billItemIds.length === 0}
              onClick={async () => {
                if (!billBuyerId || !billItemIds.length) return
                try {
                  const res = await buyerApi.getSelectedBillHtml(billBuyerId, billItemIds, 'en')
                  openHtmlBill(typeof res.data === 'string' ? res.data : String(res.data), 'Buyer bill')
                } catch (err) {
                  toast.error(billErrorMessage(err, 'Could not generate bill'))
                }
              }}
            >
              <FileText className="h-4 w-4" /> Bill last sale lines
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-left">
                <tr>
                  <th className="px-3 py-2">Invoice</th>
                  <th className="px-3 py-2">Buyer</th>
                  <th className="px-3 py-2">Dheri</th>
                  <th className="px-3 py-2">Farmer</th>
                  <th className="px-3 py-2">Bags</th>
                  <th className="px-3 py-2">Rate</th>
                  <th className="px-3 py-2">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {(board?.sales || []).flatMap((sale) =>
                  sale.items.map((item) => (
                    <tr key={`${sale.id}-${item.id}`}>
                      <td className="px-3 py-2">
                        <Link className="text-primary" to={`/sales/${sale.id}`}>{sale.invoiceNumber}</Link>
                      </td>
                      <td className="px-3 py-2">{sale.buyerName}</td>
                      <td className="px-3 py-2">{item.dheriCode || '—'}</td>
                      <td className="px-3 py-2">{item.farmerName || '—'}</td>
                      <td className="px-3 py-2">{item.bags}</td>
                      <td className="px-3 py-2">{formatCurrency(item.rate)}</td>
                      <td className="px-3 py-2">{formatCurrency(item.amount)}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
