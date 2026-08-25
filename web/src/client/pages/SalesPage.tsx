import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, Eye } from 'lucide-react'
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
import { buyerApi, dheriApi, farmerApi, saleApi, settingsApi, stockApi } from '../services/api'
import { formatCurrency, formatNumber } from '../utils/format'
import { useLanguage } from '../context/LanguageContext'
import type { Buyer, Dheri, Farmer, Product, Sale, SaleItem, StockItem } from '../types'
import PartyCombobox from '../components/forms/PartyCombobox'

const emptyItem = (): SaleItem => ({
  productId: 0,
  sourceType: 'BUSINESS_STOCK',
  numberOfBags: 0,
  weightPerBag: 40,
  partialBagWeight: 0,
  rate: 0,
})

export default function SalesPage() {
  const { t } = useLanguage()
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [buyers, setBuyers] = useState<Buyer[]>([])
  const [farmers, setFarmers] = useState<Farmer[]>([])
  const [dheris, setDheris] = useState<Dheri[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [stock, setStock] = useState<StockItem[]>([])
  const [buyerId, setBuyerId] = useState('')
  const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 10))
  const [paidAmount, setPaidAmount] = useState('0')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<SaleItem[]>([emptyItem()])

  const load = useCallback((soft = false) => {
    if (!soft) setLoading(true)
    saleApi.getAll()
      .then((res) => setSales(res.data.data || []))
      .catch(() => { if (!soft) toast.error('Failed to load sales') })
      .finally(() => { if (!soft) setLoading(false) })
  }, [])

  useEffect(() => {
    load()
    Promise.allSettled([
      buyerApi.getAll(),
      farmerApi.getAll(),
      dheriApi.getAll(),
      settingsApi.getProducts(),
      stockApi.getAll(),
    ]).then(([b, f, d, p, s]) => {
      if (b.status === 'fulfilled') setBuyers(b.value.data?.data ?? [])
      if (f.status === 'fulfilled') setFarmers(f.value.data?.data ?? [])
      if (d.status === 'fulfilled') setDheris(d.value.data?.data ?? [])
      if (p.status === 'fulfilled') setProducts(p.value.data?.data ?? [])
      if (s.status === 'fulfilled') setStock(s.value.data?.data ?? [])
    })
  }, [load])
  useLiveReload(() => load(true))

  const openCreate = () => {
    setBuyerId('')
    setSaleDate(new Date().toISOString().slice(0, 10))
    setPaidAmount('0')
    setNotes('')
    setItems([{ ...emptyItem(), productId: products[0]?.id || 0 }])
    setModalOpen(true)
  }

  const updateItem = (index: number, patch: Partial<SaleItem>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  const estimateAmount = (item: SaleItem) => {
    const weight = item.numberOfBags * item.weightPerBag + (item.partialBagWeight || 0)
    return (weight / 40) * (item.rate || 0)
  }

  const totalEstimate = items.reduce((sum, item) => sum + estimateAmount(item), 0)

  const handleSave = async () => {
    if (!buyerId) {
      toast.error('Select a buyer')
      return
    }
    if (items.some((i) => !i.productId || i.numberOfBags <= 0)) {
      toast.error('Each line needs a product and bags > 0')
      return
    }
    setSaving(true)
    try {
      await saleApi.create({
        buyerId: parseInt(buyerId),
        saleDate,
        paidAmount: parseFloat(paidAmount) || 0,
        notes,
        items: items.map((i) => ({
          productId: i.productId,
          sourceType: i.sourceType,
          farmerId: i.sourceType === 'FARMER' ? i.farmerId : null,
          dheriId: i.sourceType === 'FARMER' ? i.dheriId : null,
          numberOfBags: i.numberOfBags,
          weightPerBag: i.weightPerBag,
          partialBagWeight: i.partialBagWeight || 0,
          rate: i.rate,
        })),
      })
      toast.success('Sale created')
      setModalOpen(false)
      load()
      stockApi.getAll().then((res) => setStock(res.data.data))
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Failed to create sale')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await saleApi.delete(deleteId)
      toast.success('Sale deleted')
      setDeleteId(null)
      load()
    } catch {
      toast.error('Failed to delete sale')
    }
  }

  useVoicePageActions({
    openCreate,
    save: () => { void handleSave() },
    cancel: () => setModalOpen(false),
    refresh: () => load(),
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales"
        action={<Button onClick={openCreate}><Plus className="h-4 w-4" /> New Sale</Button>}
      />

      <div className="card overflow-hidden">
        {loading ? <TableSkeleton rows={6} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Invoice</th>
                  <th className="px-4 py-3 font-medium">Buyer</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">{t('bags')}</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Paid</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {sales.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                      No sales yet.
                    </td>
                  </tr>
                )}
                {sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40">
                    <td className="px-4 py-3 font-medium text-primary">
                      <Link to={`/sales/${sale.id}`}>{sale.invoiceNumber}</Link>
                    </td>
                    <td className="px-4 py-3">{sale.buyerName}</td>
                    <td className="px-4 py-3">{sale.saleDate}</td>
                    <td className="px-4 py-3">{sale.totalBags}</td>
                    <td className="px-4 py-3">{formatCurrency(sale.totalAmount)}</td>
                    <td className="px-4 py-3">{formatCurrency(sale.paidAmount)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        sale.paymentStatus === 'PAID' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                          : sale.paymentStatus === 'PARTIAL' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                      }`}>{sale.paymentStatus}</span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-1">
                      <Link to={`/sales/${sale.id}`} className="inline-flex p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <Link to={`/sales/${sale.id}`} className="inline-flex p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                        <Eye className="h-4 w-4" />
                      </Link>
                      <button onClick={() => setDeleteId(sale.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-500">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Sale" size="xl">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <PartyCombobox
              label="Buyer"
              required
              items={buyers.map((b) => ({
                id: String(b.id),
                code: b.buyerId,
                name: b.name,
                fatherName: b.fatherName,
                address: b.address,
                city: b.city,
                phone: b.phone,
              }))}
              value={buyerId}
              onChange={(id) => setBuyerId(id)}
              placeholder="Search"
            />
            <Input label="Sale date" type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
            <Input label="Paid now" type="number" min="0" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-gray-900 dark:text-white">Line items</h4>
              <Button size="sm" variant="secondary" onClick={() => setItems((p) => [...p, { ...emptyItem(), productId: products[0]?.id || 0 }])}>
                <Plus className="h-3 w-3" /> Add line
              </Button>
            </div>
            {items.map((item, index) => (
              <div key={index} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <Select label="Source" value={item.sourceType} onChange={(e) => updateItem(index, { sourceType: e.target.value as SaleItem['sourceType'] })}>
                    <option value="BUSINESS_STOCK">Business stock</option>
                    <option value="FARMER">Farmer / Dheri</option>
                  </Select>
                  <Select label="Product" value={String(item.productId || '')} onChange={(e) => updateItem(index, { productId: parseInt(e.target.value) })}>
                    <option value="">Select</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {stock.find((s) => s.productId === p.id) ? `(${formatNumber(stock.find((s) => s.productId === p.id)!.quantity)} in stock)` : ''}
                      </option>
                    ))}
                  </Select>
                  <Input label={t('bags')} type="number" min="1" value={String(item.numberOfBags)} onChange={(e) => updateItem(index, { numberOfBags: parseInt(e.target.value) || 0 })} />
                  <Input label="Rate / 40kg" type="number" min="0" value={String(item.rate)} onChange={(e) => updateItem(index, { rate: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <Input label="Weight/bag (kg)" type="number" value={String(item.weightPerBag)} onChange={(e) => updateItem(index, { weightPerBag: parseFloat(e.target.value) || 40 })} />
                  <Input label="Partial kg" type="number" value={String(item.partialBagWeight || 0)} onChange={(e) => updateItem(index, { partialBagWeight: parseFloat(e.target.value) || 0 })} />
                  {item.sourceType === 'FARMER' && (
                    <>
                      <PartyCombobox
                        label="Farmer"
                        items={farmers.map((f) => ({
                          id: String(f.id),
                          code: f.farmerId,
                          name: f.name,
                          fatherName: f.fatherName,
                          address: f.address,
                          city: f.city,
                          phone: f.phone,
                        }))}
                        value={String(item.farmerId || '')}
                        onChange={(id) => updateItem(index, { farmerId: parseInt(id) || undefined })}
                        placeholder="Search"
                      />
                      <Select label="Dheri" value={String(item.dheriId || '')} onChange={(e) => {
                        const d = dheris.find((x) => x.id === parseInt(e.target.value))
                        updateItem(index, {
                          dheriId: d?.id,
                          farmerId: d?.farmerId || item.farmerId,
                          productId: d?.productId || item.productId,
                          numberOfBags: d?.numberOfBags || item.numberOfBags,
                          weightPerBag: d?.weightPerBag || item.weightPerBag,
                          partialBagWeight: d?.partialBagWeight || 0,
                          rate: d?.marketRate || item.rate,
                        })
                      }}>
                        <option value="">Optional dheri</option>
                        {dheris.filter((d) => !item.farmerId || d.farmerId === item.farmerId).map((d) => (
                          <option key={d.id} value={d.id}>{d.dheriId} — {d.productName}</option>
                        ))}
                      </Select>
                    </>
                  )}
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Line estimate: {formatCurrency(estimateAmount(item))}</span>
                  {items.length > 1 && (
                    <button className="text-red-500 text-xs" onClick={() => setItems((p) => p.filter((_, i) => i !== index))}>Remove</button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-300">Estimated total: <strong>{formatCurrency(totalEstimate)}</strong></p>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Create sale'}</Button>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete sale?"
        message="This soft-deletes the sale record. Stock and balances should be reviewed."
      />
    </div>
  )
}
