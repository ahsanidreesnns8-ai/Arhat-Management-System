import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Package, Plus, Scale, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
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
  const [deleteTarget, setDeleteTarget] = useState<
    | { kind: 'item'; id: number; label: string }
    | { kind: 'lot'; id: number; label: string }
    | { kind: 'history'; id: number; label: string }
    | null
  >(null)
  const [deleting, setDeleting] = useState(false)

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

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      if (deleteTarget.kind === 'item') await stockApi.deleteItem(deleteTarget.id)
      else if (deleteTarget.kind === 'lot') await stockApi.deleteLot(deleteTarget.id)
      else await stockApi.deleteHistory(deleteTarget.id)
      toast.success('Stock entry deleted')
      setDeleteTarget(null)
      load(true)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Could not delete stock entry')
    } finally {
      setDeleting(false)
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
              const farmers = new Map<string, {
                code: string
                name: string
                fatherName: string
                city: string
                phone: string
                kg: number
                dheris: string[]
              }>()
              for (const lot of productLots) {
                const key = lot.farmerCode || lot.farmerName || 'top-up'
                const current = farmers.get(key) || {
                  code: lot.farmerCode || '',
                  name: lot.farmerName || 'Top-up',
                  fatherName: lot.farmerFatherName || '',
                  city: lot.farmerCity || '',
                  phone: lot.farmerPhone || '',
                  kg: 0,
                  dheris: [],
                }
                current.kg += lot.remainingKg
                if (lot.dheriCode && !current.dheris.includes(lot.dheriCode)) current.dheris.push(lot.dheriCode)
                farmers.set(key, current)
              }
              return (
                <div key={item.id} className="flex flex-col gap-2">
                  <div className={`stat-card ${item.lowStockAlert ? 'ring-2 ring-red-400' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 w-full">
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
                        {[...farmers.values()].length ? (
                          <div className="mt-3 space-y-2 border-t border-slate-200/80 dark:border-white/10 pt-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Farmer stock</p>
                            {[...farmers.values()].map((farmer) => (
                              <div key={`${farmer.code}-${farmer.name}`} className="rounded-lg bg-slate-50 dark:bg-white/5 px-2.5 py-2">
                                <p className="text-xs font-semibold text-[#1F4D32] dark:text-[#C5A059]">
                                  {farmer.code ? `ID ${farmer.code}` : 'Top-up'}
                                  {farmer.name ? ` · ${farmer.name}` : ''}
                                </p>
                                {farmer.fatherName ? (
                                  <p className="text-[11px] text-slate-500">s/o {farmer.fatherName}</p>
                                ) : null}
                                {farmer.city || farmer.phone ? (
                                  <p className="text-[11px] text-slate-500 truncate">
                                    {[farmer.city, farmer.phone].filter(Boolean).join(' · ')}
                                  </p>
                                ) : null}
                                <p className="text-[11px] text-slate-700 dark:text-slate-200 mt-0.5">
                                  {formatNumber(farmer.kg)} kg
                                  {farmer.dheris.length ? ` · ${farmer.dheris.join(', ')}` : ''}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      {item.lowStockAlert && (
                        <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="danger"
                    className="w-full"
                    data-testid={`stock-delete-item-${item.id}`}
                    aria-label={`Delete ${item.productName} stock entry`}
                    onClick={() =>
                      setDeleteTarget({
                        kind: 'item',
                        id: item.id,
                        label: `${item.productName} (${formatNumber(item.quantity)} kg)`,
                      })
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete entry
                  </Button>
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
                  Each farmer Extra KG stays on its own batch with farmer ID, name, date, rate, and dheri.
                </p>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                {lots.length} open batch{lots.length === 1 ? '' : 'es'}
              </span>
            </div>
            {lots.length === 0 ? (
              <p className="p-6 text-sm text-gray-500">
                No Extra KG batches yet. Save farmer product or Daily Trade with Extra KG — it goes to stock automatically.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[920px]">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-left">
                      <th className="p-3 font-semibold text-gray-600">Batch #</th>
                      <th className="p-3 font-semibold text-gray-600">Date</th>
                      <th className="p-3 font-semibold text-gray-600">Product</th>
                      <th className="p-3 font-semibold text-gray-600">Farmer ID</th>
                      <th className="p-3 font-semibold text-gray-600">Farmer</th>
                      <th className="p-3 font-semibold text-gray-600">Father / place</th>
                      <th className="p-3 font-semibold text-gray-600">Dheri</th>
                      <th className="p-3 font-semibold text-gray-600">Original kg</th>
                      <th className="p-3 font-semibold text-gray-600">Remaining kg</th>
                      <th className="p-3 font-semibold text-gray-600">Rate/40kg</th>
                      <th className="p-3 font-semibold text-gray-600">Value</th>
                      <th className="p-3 font-semibold text-gray-600">Note</th>
                      <th className="p-3 font-semibold text-gray-600"></th>
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
                        <td className="p-3 font-semibold text-[#1F4D32] dark:text-[#C5A059] whitespace-nowrap">
                          {lot.farmerCode || '—'}
                        </td>
                        <td className="p-3">{lot.farmerName || 'Top-up'}</td>
                        <td className="p-3 text-slate-500">
                          {[lot.farmerFatherName ? `s/o ${lot.farmerFatherName}` : '', lot.farmerCity].filter(Boolean).join(' · ') || '—'}
                        </td>
                        <td className="p-3">{lot.dheriCode || '—'}</td>
                        <td className="p-3">{formatNumber(lot.originalKg)}</td>
                        <td className="p-3 font-semibold text-amber-700 dark:text-amber-300">{formatNumber(lot.remainingKg)}</td>
                        <td className="p-3">{formatCurrency(lot.ratePer40Kg)}</td>
                        <td className="p-3">{formatCurrency(lot.amountValue)}</td>
                        <td className="p-3 text-xs text-gray-500 max-w-[12rem] truncate" title={lot.notes || ''}>{lot.notes || '—'}</td>
                        <td className="p-3">
                          <Button
                            size="sm"
                            variant="danger"
                            data-testid={`stock-delete-lot-${lot.id}`}
                            aria-label={`Delete Extra KG batch ${lot.productName || ''}`}
                            onClick={() =>
                              setDeleteTarget({
                                kind: 'lot',
                                id: lot.id,
                                label: `${lot.productName || 'Batch'} · ${formatNumber(lot.remainingKg)} kg remaining`,
                              })
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </Button>
                        </td>
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
                    <th className="text-left p-4 font-semibold text-gray-600"></th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-gray-500">No stock movements yet</td>
                    </tr>
                  ) : history.slice(0, 20).map((tx) => (
                    <tr key={tx.id} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="p-4">{tx.productName}</td>
                      <td className="p-4"><span className="px-2 py-1 rounded text-xs bg-gray-100 dark:bg-gray-800">{tx.transactionType}</span></td>
                      <td className="p-4 text-right">{formatNumber(tx.quantity)}</td>
                      <td className="p-4 text-right">{formatNumber(tx.previousQuantity)}</td>
                      <td className="p-4 text-right font-medium">{formatNumber(tx.newQuantity)}</td>
                      <td className="p-4 text-gray-500">{formatDateTime(tx.createdAt)}</td>
                      <td className="p-4">
                        <Button
                          size="sm"
                          variant="danger"
                          data-testid={`stock-delete-history-${tx.id}`}
                          aria-label={`Delete stock history ${tx.productName} ${tx.transactionType}`}
                          onClick={() =>
                            setDeleteTarget({
                              kind: 'history',
                              id: tx.id,
                              label: `${tx.productName} · ${tx.transactionType} · ${formatNumber(tx.quantity)} kg`,
                            })
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </Button>
                      </td>
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

      <ConfirmDialog
        open={deleteTarget != null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
        title="Delete stock entry"
        message={
          deleteTarget?.kind === 'item'
            ? `Remove ${deleteTarget.label} from stock? Remaining Extra KG batches for this product will also leave stock.`
            : deleteTarget?.kind === 'history'
              ? `Delete ${deleteTarget.label}? This movement is removed and stock kg is reversed.`
              : `Delete ${deleteTarget?.label || 'this Extra KG batch'}? Remaining kg will be deducted from stock.`
        }
        loading={deleting}
      />
    </div>
  )
}
