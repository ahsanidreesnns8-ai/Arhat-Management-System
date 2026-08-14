import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeftRight, History, Package, RefreshCw, Scale, ShoppingCart, Warehouse,
} from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import { TableSkeleton } from '../components/ui/Skeleton'
import { useLiveReload } from '../context/SyncContext'
import { buyerApi, dailyTradeApi, settingsApi } from '../services/api'
import { formatCurrency, formatNumber } from '../utils/format'
import type { Buyer, Product } from '../types'

type BoardReceive = {
  id: number
  dheriId: string
  farmerId: number
  farmerName: string
  productId: number
  productName: string
  bags: number
  weightPerBag: number
  partialBagWeight: number
  weight: number
  rate: number
  amount: number
  date: string
  sellingStatus: string
}

type StockLotRow = {
  id: number
  productId: number
  productName?: string
  farmerName?: string | null
  dheriCode?: string | null
  remainingKg: number
  originalKg: number
  ratePer40Kg: number
  amountValue: number
  intakeDate: string
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
  stockLots: StockLotRow[]
  stockKgAvailable: number
  receives: BoardReceive[]
  sales: Array<{
    id: number
    invoiceNumber: string
    buyerName: string
    bags: number
    weight: number
    amount: number
  }>
}

type HistoryRow = {
  id: number
  sessionDate: string
  receivedBags: number
  soldBags: number
  stockInKg: number
  stockOutKg: number
  highestRate: number
  closedAt: string | null
  details?: unknown
}

export default function DailyTradePage() {
  const [board, setBoard] = useState<Board | null>(null)
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [buyers, setBuyers] = useState<Buyer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [buyerId, setBuyerId] = useState('')
  const [productId, setProductId] = useState('')
  const [bagWeight, setBagWeight] = useState('65')
  const [paidAmount, setPaidAmount] = useState('0')
  const [selectedDheris, setSelectedDheris] = useState<number[]>([])
  const [includeStockBags, setIncludeStockBags] = useState(true)
  const [selling, setSelling] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [historyDetail, setHistoryDetail] = useState<HistoryRow | null>(null)

  const load = useCallback(async (soft = false) => {
    if (!soft) setLoading(true)
    try {
      const [b, h, buy, prod] = await Promise.all([
        dailyTradeApi.getBoard(),
        dailyTradeApi.getHistory(),
        buyerApi.getAll(),
        settingsApi.getProducts(),
      ])
      setBoard(b.data.data)
      setHistory(h.data.data || [])
      setBuyers(buy.data.data || [])
      const productsList = prod.data.data || []
      setProducts(productsList)
      if (!productId && productsList[0]) setProductId(String(productsList[0].id))
    } catch {
      if (!soft) toast.error('Failed to load daily trade board')
    } finally {
      if (!soft) setLoading(false)
    }
  }, [productId])

  useEffect(() => { void load() }, [load])
  useLiveReload(() => { void load(true) })

  const receivesForProduct = useMemo(() => {
    if (!board) return []
    const pid = Number(productId)
    return board.receives.filter((r) => !pid || r.productId === pid)
  }, [board, productId])

  const unsold = useMemo(
    () => receivesForProduct.filter((r) => r.sellingStatus !== 'SOLD'),
    [receivesForProduct],
  )

  const preview = useMemo(() => {
    const chosen = selectedDheris.length
      ? unsold.filter((r) => selectedDheris.includes(r.id))
      : unsold
    const farmerBags = chosen.reduce((s, x) => s + x.bags, 0)
    const farmerAmount = chosen.reduce((s, x) => s + x.amount, 0)
    const bw = parseFloat(bagWeight) || 65
    const pid = Number(productId)
    const stockKg = (board?.stockLots || [])
      .filter((l) => !pid || l.productId === pid)
      .reduce((s, l) => s + l.remainingKg, 0)
    const stockBags = includeStockBags ? Math.floor(stockKg / bw) : 0
    const highest = Math.max(
      board?.session.highestRate || 0,
      ...chosen.map((x) => x.rate),
      ...(board?.stockLots || []).filter((l) => !pid || l.productId === pid).map((l) => l.ratePer40Kg),
      0,
    )
    const stockKgUsed = stockBags * bw
    const stockAmount = stockKgUsed > 0 ? (stockKgUsed / 40) * highest : 0
    return {
      farmerBags,
      stockBags,
      totalBags: farmerBags + stockBags,
      farmerAmount,
      stockAmount,
      totalAmount: farmerAmount + stockAmount,
      stockKg,
      stockKgUsed,
      leftoverKg: stockKg - stockKgUsed,
      highest,
    }
  }, [unsold, selectedDheris, bagWeight, includeStockBags, board, productId])

  const toggleDheri = (id: number) => {
    setSelectedDheris((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const handleRefresh = async () => {
    if (!window.confirm('Archive today’s board to history and start a fresh board?')) return
    try {
      const res = await dailyTradeApi.refresh()
      setBoard(res.data.data)
      toast.success('Board refreshed — previous day archived')
      const h = await dailyTradeApi.getHistory()
      setHistory(h.data.data || [])
      setSelectedDheris([])
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Refresh failed')
    }
  }

  const handleSell = async () => {
    if (!buyerId) {
      toast.error('Select a buyer')
      return
    }
    if (!productId) {
      toast.error('Select a product')
      return
    }
    if (preview.totalBags <= 0) {
      toast.error('Nothing to sell')
      return
    }
    setSelling(true)
    try {
      const res = await dailyTradeApi.batchSell({
        buyerId: Number(buyerId),
        productId: Number(productId),
        dheriIds: selectedDheris.length ? selectedDheris : undefined,
        bagWeightKg: parseFloat(bagWeight) || 65,
        paidAmount: parseFloat(paidAmount) || 0,
        includeStockBags,
      })
      toast.success(res.data.data.message || 'Sold')
      setBoard(res.data.data.board)
      setSelectedDheris([])
      setPaidAmount('0')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Batch sell failed')
    } finally {
      setSelling(false)
    }
  }

  if (loading && !board) return <TableSkeleton rows={10} />

  const session = board?.session
  const balanced = (session?.receivedBags || 0) === (session?.soldBags || 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily Trade & Stock"
        description="Receive from farmers → Extra KG to stock → Sell equal bags to one buyer"
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setShowHistory((v) => !v)}>
              <History className="h-4 w-4" /> History
            </Button>
            <Button variant="secondary" onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" /> Reload
            </Button>
            <Button variant="secondary" onClick={() => void handleRefresh()}>
              <ArrowLeftRight className="h-4 w-4" /> Refresh board
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DiagramCard
          title="Receiving today"
          tone="receive"
          bags={session?.receivedBags || 0}
          weight={session?.receivedWeightKg || 0}
          stockKg={session?.stockInKg || board?.stockKgAvailable || 0}
          extra={
            <Link to="/arhat-sale" className="text-sm text-primary underline">
              Add farmer / Extra KG
            </Link>
          }
          onRefresh={() => void handleRefresh()}
        />
        <DiagramCard
          title="Selling today"
          tone="sell"
          bags={session?.soldBags || 0}
          weight={session?.soldWeightKg || 0}
          stockKg={session?.stockOutKg || 0}
          balanced={balanced}
          remaining={session?.remainingBags || 0}
          extra={
            <span className="text-sm text-slate-500">
              Highest rate: {formatCurrency(session?.highestRate || 0)} / 40kg
            </span>
          }
          onRefresh={() => void handleRefresh()}
        />
      </div>

      {!balanced && (
        <p className="text-sm text-amber-700 dark:text-amber-300">
          Bags not equal yet — receive {(session?.receivedBags || 0)} vs sold {(session?.soldBags || 0)}.
          Leftover Extra KG stays in stock until it forms whole bags.
        </p>
      )}

      <div className="card-3d p-4 space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-primary" /> Batch sell to one buyer
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Select
            label="Buyer *"
            value={buyerId}
            onChange={(e) => setBuyerId(e.target.value)}
            options={[
              { value: '', label: 'Select buyer' },
              ...buyers.map((b) => ({ value: String(b.id), label: `${b.name} (${b.buyerId})` })),
            ]}
          />
          <Select
            label="Product *"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            options={[
              { value: '', label: 'Select product' },
              ...products.map((p) => ({ value: String(p.id), label: p.name })),
            ]}
          />
          <Input
            label="Bag weight (kg)"
            type="number"
            step="0.01"
            value={bagWeight}
            onChange={(e) => setBagWeight(e.target.value)}
          />
          <Input
            label="Cash received now"
            type="number"
            step="0.01"
            value={paidAmount}
            onChange={(e) => setPaidAmount(e.target.value)}
          />
        </div>
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeStockBags}
            onChange={(e) => setIncludeStockBags(e.target.checked)}
          />
          Form bags from Extra KG stock (highest rate / 40kg)
        </label>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <Stat label="Farmer bags" value={String(preview.farmerBags)} />
          <Stat label="Stock bags" value={String(preview.stockBags)} />
          <Stat label="Total bags" value={String(preview.totalBags)} />
          <Stat label="Stock leftover" value={`${formatNumber(preview.leftoverKg)} kg`} />
          <Stat label="Farmer amount" value={formatCurrency(preview.farmerAmount)} />
          <Stat label="Stock bags amount" value={formatCurrency(preview.stockAmount)} />
          <Stat label="Total amount" value={formatCurrency(preview.totalAmount)} />
          <Stat label="Bill rate (stock)" value={formatCurrency(preview.highest)} />
        </div>

        <Button onClick={() => void handleSell()} loading={selling}>
          <ShoppingCart className="h-4 w-4" /> Sell {preview.totalBags} bags to buyer
        </Button>
      </div>

      <div className="card-3d overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 font-semibold flex justify-between">
          <span>Today’s receives (tick to sell selected)</span>
          <button
            type="button"
            className="text-sm text-primary"
            onClick={() => setSelectedDheris(unsold.map((x) => x.id))}
          >
            Select all unsold
          </button>
        </div>
        {receivesForProduct.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">No farmer receives today — use Arhat Sale / Farmer Product.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-left">
                <tr>
                  <th className="px-3 py-2">Sell</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Dheri</th>
                  <th className="px-3 py-2">Farmer</th>
                  <th className="px-3 py-2">Bags</th>
                  <th className="px-3 py-2">Extra kg</th>
                  <th className="px-3 py-2">Rate</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {receivesForProduct.map((r) => {
                  const sold = r.sellingStatus === 'SOLD'
                  return (
                    <tr key={r.id} className={sold ? 'opacity-60' : ''}>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          disabled={sold}
                          checked={selectedDheris.includes(r.id)}
                          onChange={() => toggleDheri(r.id)}
                        />
                      </td>
                      <td className="px-3 py-2">{r.date}</td>
                      <td className="px-3 py-2">{r.dheriId}</td>
                      <td className="px-3 py-2">{r.farmerName}</td>
                      <td className="px-3 py-2">{r.bags}</td>
                      <td className="px-3 py-2">{formatNumber(r.partialBagWeight)}</td>
                      <td className="px-3 py-2">{formatCurrency(r.rate)}</td>
                      <td className="px-3 py-2">{formatCurrency(r.amount)}</td>
                      <td className="px-3 py-2">{r.sellingStatus}</td>
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
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-left">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">Farmer</th>
                  <th className="px-3 py-2">Dheri</th>
                  <th className="px-3 py-2">Remaining kg</th>
                  <th className="px-3 py-2">Rate/40kg</th>
                  <th className="px-3 py-2">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {(board?.stockLots || []).map((lot) => (
                  <tr key={lot.id}>
                    <td className="px-3 py-2">{lot.intakeDate}</td>
                    <td className="px-3 py-2">{lot.productName}</td>
                    <td className="px-3 py-2">{lot.farmerName || '—'}</td>
                    <td className="px-3 py-2">{lot.dheriCode || '—'}</td>
                    <td className="px-3 py-2">{formatNumber(lot.remainingKg)}</td>
                    <td className="px-3 py-2">{formatCurrency(lot.ratePer40Kg)}</td>
                    <td className="px-3 py-2">{formatCurrency(lot.amountValue)}</td>
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
            <p className="p-6 text-sm text-gray-500">No archived days yet. Use Refresh board to archive.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {history.map((h) => (
                <li key={h.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{h.sessionDate}</p>
                    <p className="text-xs text-slate-500">
                      Received {h.receivedBags} · Sold {h.soldBags} · Stock in {formatNumber(h.stockInKg)} kg
                    </p>
                  </div>
                  <Button variant="secondary" onClick={() => setHistoryDetail(h)}>
                    Details
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {historyDetail && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-3" onClick={() => setHistoryDetail(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full max-h-[80vh] overflow-auto p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-lg mb-2">History — {historyDetail.sessionDate}</h3>
            <pre className="text-xs whitespace-pre-wrap break-words bg-slate-50 dark:bg-slate-800 p-3 rounded-xl">
              {JSON.stringify(historyDetail.details ?? historyDetail, null, 2)}
            </pre>
            <Button className="mt-3" variant="secondary" onClick={() => setHistoryDetail(null)}>Close</Button>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200/70 dark:border-white/10 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="font-semibold mt-0.5">{value}</p>
    </div>
  )
}

function DiagramCard({
  title,
  tone,
  bags,
  weight,
  stockKg,
  balanced,
  remaining,
  extra,
  onRefresh,
}: {
  title: string
  tone: 'receive' | 'sell'
  bags: number
  weight: number
  stockKg: number
  balanced?: boolean
  remaining?: number
  extra?: React.ReactNode
  onRefresh: () => void
}) {
  return (
    <div
      className={`card-3d p-5 border ${
        tone === 'receive'
          ? 'border-emerald-200/60 dark:border-emerald-800/40'
          : balanced
            ? 'border-emerald-200/60 dark:border-emerald-800/40'
            : 'border-amber-200/60 dark:border-amber-800/40'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
          <p className="text-3xl font-bold mt-1 tabular-nums">{bags}</p>
          <p className="text-sm text-slate-500">bags · {formatNumber(weight)} kg</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {tone === 'receive' ? (
            <Package className="h-8 w-8 text-emerald-600" />
          ) : (
            <Scale className="h-8 w-8 text-primary" />
          )}
          <button type="button" onClick={onRefresh} className="text-xs text-primary underline">
            Refresh
          </button>
        </div>
      </div>
      <p className="text-sm">
        Extra / stock kg: <strong>{formatNumber(stockKg)}</strong>
      </p>
      {remaining != null && remaining !== 0 && (
        <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
          Remaining to sell: {remaining} bags
        </p>
      )}
      {balanced && <p className="text-sm text-emerald-600 mt-1">Balanced with receiving</p>}
      <div className="mt-3">{extra}</div>
    </div>
  )
}
