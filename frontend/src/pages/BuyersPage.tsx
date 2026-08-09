import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, Search, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { TableSkeleton } from '../components/ui/Skeleton'
import { buyerApi } from '../services/api'
import { formatCurrency } from '../utils/format'
import type { Buyer } from '../types'

const emptyForm = { name: '', cnic: '', phone: '', address: '', city: '', notes: '' }

export default function BuyersPage() {
  const [buyers, setBuyers] = useState<Buyer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [editing, setEditing] = useState<Buyer | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    buyerApi.getAll()
      .then((res) => setBuyers(res.data.data))
      .catch(() => toast.error('Failed to load buyers'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filtered = buyers.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.buyerId.toLowerCase().includes(search.toLowerCase()) ||
    b.phone?.includes(search) ||
    b.cnic?.includes(search)
  )

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  const openEdit = (buyer: Buyer) => {
    setEditing(buyer)
    setForm({
      name: buyer.name,
      cnic: buyer.cnic || '',
      phone: buyer.phone || '',
      address: buyer.address || '',
      city: buyer.city || '',
      notes: buyer.notes || '',
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Name is required')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await buyerApi.update(editing.id, form)
        toast.success('Buyer updated')
      } else {
        await buyerApi.create(form)
        toast.success('Buyer created')
      }
      setModalOpen(false)
      load()
    } catch {
      toast.error('Failed to save buyer')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await buyerApi.delete(deleteId)
      toast.success('Buyer deleted')
      setDeleteId(null)
      load()
    } catch {
      toast.error('Failed to delete buyer')
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Buyer Management"
        description="Manage buyer records, purchase history, and outstanding balances"
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Buyer
          </Button>
        }
      />

      <div className="card p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            className="input-field pl-10"
            placeholder="Search by ID, name, CNIC, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6"><TableSkeleton /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <th className="text-left p-4 font-semibold text-gray-600 dark:text-gray-400">Buyer ID</th>
                  <th className="text-left p-4 font-semibold text-gray-600 dark:text-gray-400">Name</th>
                  <th className="text-left p-4 font-semibold text-gray-600 dark:text-gray-400">Phone</th>
                  <th className="text-left p-4 font-semibold text-gray-600 dark:text-gray-400">City</th>
                  <th className="text-right p-4 font-semibold text-gray-600 dark:text-gray-400">Outstanding</th>
                  <th className="text-right p-4 font-semibold text-gray-600 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((buyer) => (
                  <tr key={buyer.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="p-4 font-mono text-primary">
                      <Link to={`/buyers/${buyer.id}`}>{buyer.buyerId}</Link>
                    </td>
                    <td className="p-4 font-medium text-gray-900 dark:text-white">
                      <Link to={`/buyers/${buyer.id}`} className="hover:text-primary">{buyer.name}</Link>
                    </td>
                    <td className="p-4 text-gray-600 dark:text-gray-400">{buyer.phone || '—'}</td>
                    <td className="p-4 text-gray-600 dark:text-gray-400">{buyer.city || '—'}</td>
                    <td className="p-4 text-right font-medium">{formatCurrency(buyer.outstandingBalance)}</td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Link to={`/buyers/${buyer.id}`} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-primary transition-colors">
                          <Eye className="h-4 w-4" />
                        </Link>
                        <button onClick={() => openEdit(buyer)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-primary transition-colors">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => setDeleteId(buyer.id)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-500 hover:text-red-500 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr><td colSpan={6} className="p-8 text-center text-gray-500">No buyers found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Buyer' : 'Add Buyer'}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="CNIC" value={form.cnic} onChange={(e) => setForm({ ...form, cnic: e.target.value })} />
          <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          <div className="sm:col-span-2">
            <Input label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Input label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>{editing ? 'Update' : 'Create'}</Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Buyer"
        message="Are you sure you want to delete this buyer?"
      />
    </div>
  )
}
