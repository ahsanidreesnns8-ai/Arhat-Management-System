import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Package, Plus, Scale } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Modal from '../components/ui/Modal'
import { TableSkeleton } from '../components/ui/Skeleton'
import { useLiveReload } from '../context/SyncContext'
import { useVoicePageActions } from '../context/VoiceControlContext'
import { stockApi, settingsApi } from '../services/api'
import { formatCurrency, formatNumber, formatDateTime } from '../utils/format'
import type { Product, StockItem, StockLot, StockTransaction } from '../types'

export default function StockPage() {
  const [stock, setStock] = useState<StockItem[]>([])
  const [lots, setLots] = useState<StockLot[]>([])
  const [history, setHistory] = useState<StockTransaction[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ productId: '', quantity: '', type: 'INCOMING', notes: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback((soft = false) => {
    if (!soft) setLoading(true)
    Promise.allSettled([
      stockApi.getAll(),
      stockApi.getLots(undefined, false),
      stockApi.getHistory(),
      settingsApi.getProducts(),
    ])
      .then(([s, lotsRes, h, p]) => {
        if (s.status === 'fulfilled') setStock(s.value.data?.data ?? [])
        if (lotsRes.status === 'fulfilled') setLots(lotsRes.value.data?.data ?? [])
        if (h.status === 'fulfilled') setHistory(h.value.data?.data ?? [])
        if (p.status === 'fulfilled') setProducts(p.value.data?.data ?? [])
        const failed = [s, lotsRes, h, p].filter((r) => r.status === 'rejected').length
        if (failed === 4 && !soft) toast.error('Failed to load stock — is the backend running?')
        else if (failed > 0 && !soft) toast.error('Some stock data could not be loaded')
      })
      .finally(() => { if (!soft) setLoading(false) })
  }, [])

  useEffect(() => { load() }, [load])
  useLiveReload(() => load(true))

  const lotsByProduct = useMemo(() => {
    const map = new Map<number, StockLot[]>()
    for (const lot of lots) {
      const list = map.get(lot.productId) || []
      list.push(lot)
      map.set(lot.productId, list)
    }
    return map
  }, [lots])

  const handleAdjust = async () => {
    if (!form.productId || !form.quantity) {
      toast.error('Product and quantity are required')
      return
    }
    setSaving(true)
    try {
      await stockApi.adjust({
        productId: parseInt(form.productId),
        quantity: parseFloat(form.quantity),
        type: form.type,
        notes: form.notes,
      })
      toast.success('Stock updated')
      setModalOpen(false)
      setForm({ productId: '', quantity: '', type: 'INCOMING', notes: '' })
      load()
    } catch {
      toast.error('Failed to update stock')
    } finally {
      setSaving(false)
    }
  }

  useVoicePageActions({
    openCreate: () => setModalOpen(true),
    save: () => { void handleAdjust() },
    cancel: () => setModalOpen(false),
    refresh: () => load(),
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Management"
        description="Product totals + Extra KG batches kept separate per farmer/dheri"
        action={
          <div className="flex flex-wrap gap-2">
            <Link to="/daily-trade">
              <Button variant="secondary"><Scale className="h-4 w-4" /> Daily Trade</Button>
            </Link>
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4" />
              Adjust Stock
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="card p-6"><TableSkeleton /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stock.length === 0 ? (
              <div className="card-3d p-6 sm:col-span-2 lg:col-span-4 text-sm text-gray-500">
                No product stock yet. Extra KG from farmers appears in batches below.
              </div>
            ) : stock.map((item) => {
              const productLots = lotsByProduct.get(item.productId) || []
              const extraKg = productLots.reduce((s, l) => s + l.remainingKg, 0)
              return (
                <div key={item.id} className={`stat-card ${item.lowStockAlert ? 'ring-2 ring-red-400' : ''}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-gray-500">{item.productName}</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                        {formatNumber(item.quantity)} kg
                      </p>
                      <p className="text-xs text-gray-400 mt-1">{item.productCode}</p>
                      {extraKg > 0 && (
                        <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
                          Extra KG batches: {formatNumber(extraKg)} kg · {productLots.length} batch{productLots.length === 1 ? '' : 'es'}
                        </p>
                      )}
                    </div>
                    {item.lowStockAlert && (
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="card-3d overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" /> Extra KG batches (separate)
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Each farmer Extra KG stays in its own batch with date, rate, and dheri — not mixed into one pile.
                </p>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                {lots.length} open batch{lots.length === 1 ? '' : 'es'}
              </span>
            </div>
            {lots.length === 0 ? (
              <p className="p-6 text-sm text-gray-500">
                No Extra KG batches yet. Save farmer product with Extra KG → Stock on Arhat Sale.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[800px]">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-left">
                      <th className="p-3 font-semibold text-gray-600">Batch #</th>
                      <th className="p-3 font-semibold text-gray-600">Date</th>
                      <th className="p-3 font-semibold text-gray-600">Product</th>
                      <th className="p-3 font-semibold text-gray-600">Farmer</th>
                      <th className="p-3 font-semibold text-gray-600">Dheri</th>
                      <th className="p-3 font-semibold text-gray-600">Original kg</th>
                      <th className="p-3 font-semibold text-gray-600">Remaining kg</th>
                      <th className="p-3 font-semibold text-gray-600">Rate/40kg</th>
                      <th className="p-3 font-semibold text-gray-600">Value</th>
                      <th className="p-3 font-semibold text-gray-600">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lots.map((lot, idx) => (
                      <tr key={lot.id} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="p-3">
                          <span className="inline-flex items-center rounded-md bg-primary/10 text-primary px-2 py-0.5 text-xs font-semibold">
                            B{lots.length - idx}
                          </span>
                        </td>
                        <td className="p-3 whitespace-nowrap">{lot.intakeDate}</td>
                        <td className="p-3 font-medium">{lot.productName}</td>
                        <td className="p-3">{lot.farmerName || 'Top-up'}</td>
                        <td className="p-3">{lot.dheriCode || '—'}</td>
                        <td className="p-3">{formatNumber(lot.originalKg)}</td>
                        <td className="p-3 font-semibold text-amber-700 dark:text-amber-300">{formatNumber(lot.remainingKg)}</td>
                        <td className="p-3">{formatCurrency(lot.ratePer40Kg)}</td>
                        <td className="p-3">{formatCurrency(lot.amountValue)}</td>
                        <td className="p-3 text-xs text-gray-500 max-w-[12rem] truncate" title={lot.notes || ''}>{lot.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">Stock History</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <th className="text-left p-4 font-semibold text-gray-600">Product</th>
                    <th className="text-left p-4 font-semibold text-gray-600">Type</th>
                    <th className="text-right p-4 font-semibold text-gray-600">Qty</th>
                    <th className="text-right p-4 font-semibold text-gray-600">Previous</th>
                    <th className="text-right p-4 font-semibold text-gray-600">New</th>
                    <th className="text-left p-4 font-semibold text-gray-600">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-gray-500">No stock movements yet</td>
                    </tr>
                  ) : history.slice(0, 20).map((tx) => (
                    <tr key={tx.id} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="p-4">{tx.productName}</td>
                      <td className="p-4"><span className="px-2 py-1 rounded text-xs bg-gray-100 dark:bg-gray-800">{tx.transactionType}</span></td>
                      <td className="p-4 text-right">{formatNumber(tx.quantity)}</td>
                      <td className="p-4 text-right">{formatNumber(tx.previousQuantity)}</td>
                      <td className="p-4 text-right font-medium">{formatNumber(tx.newQuantity)}</td>
                      <td className="p-4 text-gray-500">{formatDateTime(tx.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Adjust Stock">
        <div className="space-y-4">
          <Select
            label="Product"
            value={form.productId}
            onChange={(e) => setForm({ ...form, productId: e.target.value })}
            options={[
              { value: '', label: 'Select product' },
              ...products.map((p) => ({ value: String(p.id), label: p.name })),
            ]}
          />
          <Select
            label="Transaction Type"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            options={[
              { value: 'INCOMING', label: 'Incoming' },
              { value: 'OUTGOING', label: 'Outgoing' },
              { value: 'ADJUSTMENT', label: 'Manual Adjustment' },
              { value: 'TRANSFER', label: 'Transfer' },
            ]}
          />
          <Input label="Quantity (kg)" type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          <Input label="Reason / Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button onClick={handleAdjust} loading={saving}>Save Adjustment</Button>
        </div>
      </Modal>
    </div>
  )
}
