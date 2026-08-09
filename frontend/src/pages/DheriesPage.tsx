import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { TableSkeleton } from '../components/ui/Skeleton'
import { dheriApi, farmerApi, settingsApi } from '../services/api'
import { formatCurrency } from '../utils/format'
import type { Dheri, Farmer, Product } from '../types'

export default function DheriesPage() {
  const [dheris, setDheris] = useState<Dheri[]>([])
  const [farmers, setFarmers] = useState<Farmer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [form, setForm] = useState({ farmerId: '', productId: '', numberOfBags: '0', weightPerBag: '40', marketRate: '0', notes: '' })
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    Promise.all([dheriApi.getAll(), farmerApi.getAll(), settingsApi.getProducts()])
      .then(([d, f, p]) => {
        setDheris(d.data.data)
        setFarmers(f.data.data)
        setProducts(p.data.data)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!form.farmerId || !form.productId) {
      toast.error('Farmer and product are required')
      return
    }
    setSaving(true)
    try {
      await dheriApi.create({
        farmerId: parseInt(form.farmerId),
        productId: parseInt(form.productId),
        numberOfBags: parseInt(form.numberOfBags) || 0,
        weightPerBag: parseFloat(form.weightPerBag) || 40,
        marketRate: parseFloat(form.marketRate) || 0,
        notes: form.notes,
      })
      toast.success('Dheri created')
      setModalOpen(false)
      load()
    } catch {
      toast.error('Failed to create dheri')
    } finally {
      setSaving(false)
    }
  }

  const statusColor = (status: string) => {
    const map: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-700',
      IN_QUEUE: 'bg-blue-100 text-blue-700',
      SELLING: 'bg-green-100 text-green-700',
      SOLD: 'bg-gray-100 text-gray-700',
      CANCELLED: 'bg-red-100 text-red-700',
    }
    return map[status] || 'bg-gray-100 text-gray-700'
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Dheri Management"
        description="Track dheris with queue numbers, weight details, and sale history"
        action={<Button onClick={() => setModalOpen(true)}><Plus className="h-4 w-4" />Add Dheri</Button>}
      />

      <div className="card overflow-hidden">
        {loading ? <div className="p-6"><TableSkeleton /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <th className="text-left p-4 font-semibold text-gray-600">Dheri ID</th>
                  <th className="text-left p-4 font-semibold text-gray-600">Farmer</th>
                  <th className="text-left p-4 font-semibold text-gray-600">Product</th>
                  <th className="text-right p-4 font-semibold text-gray-600">Bags</th>
                  <th className="text-left p-4 font-semibold text-gray-600">Status</th>
                  <th className="text-right p-4 font-semibold text-gray-600">Amount</th>
                  <th className="text-right p-4 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {dheris.map((d) => (
                  <tr key={d.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                    <td className="p-4 font-mono text-primary">{d.dheriId}</td>
                    <td className="p-4">{d.farmerName}</td>
                    <td className="p-4">{d.productName}</td>
                    <td className="p-4 text-right">{d.numberOfBags}</td>
                    <td className="p-4"><span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(d.sellingStatus)}`}>{d.sellingStatus.replace('_', ' ')}</span></td>
                    <td className="p-4 text-right">{formatCurrency(d.totalPrice)}</td>
                    <td className="p-4 text-right">
                      <button onClick={() => setDeleteId(d.id)} className="p-2 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-500">
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Dheri">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select label="Farmer *" value={form.farmerId} onChange={(e) => setForm({ ...form, farmerId: e.target.value })}
            options={[{ value: '', label: 'Select' }, ...farmers.map((f) => ({ value: f.id, label: `${f.farmerId} — ${f.name}` }))]} />
          <Select label="Product *" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}
            options={[{ value: '', label: 'Select' }, ...products.map((p) => ({ value: p.id, label: p.name }))]} />
          <Input label="Number of Bags" type="number" value={form.numberOfBags} onChange={(e) => setForm({ ...form, numberOfBags: e.target.value })} />
          <Input label="Weight per Bag (kg)" type="number" value={form.weightPerBag} onChange={(e) => setForm({ ...form, weightPerBag: e.target.value })} />
          <Input label="Market Rate (per Mann)" type="number" value={form.marketRate} onChange={(e) => setForm({ ...form, marketRate: e.target.value })} />
          <Input label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button onClick={handleCreate} loading={saving}>Create</Button>
        </div>
      </Modal>

      <ConfirmDialog open={deleteId !== null} onClose={() => setDeleteId(null)} onConfirm={async () => {
        if (deleteId) { await dheriApi.delete(deleteId); toast.success('Deleted'); setDeleteId(null); load() }
      }} title="Delete Dheri" message="Are you sure you want to delete this dheri?" />
    </div>
  )
}
