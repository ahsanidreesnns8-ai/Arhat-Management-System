import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, Search, Eye, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import SettledBadge, { isPartySettled } from '../components/ui/SettledBadge'
import { TableSkeleton } from '../components/ui/Skeleton'
import PaymentModal from '../components/payments/PaymentModal'
import DuplicateSuggestions, { findPersonDuplicates } from '../components/forms/DuplicateSuggestions'
import { useLiveReload } from '../context/SyncContext'
import { useVoicePageActions } from '../context/VoiceControlContext'
import PartyFields, { emptyPartyForm, type PartyFormValues } from '../components/forms/PartyFields'
import { farmerApi } from '../services/api'
import { formatCurrency } from '../utils/format'
import type { Farmer } from '../types'

export default function FarmersPage() {
  const [farmers, setFarmers] = useState<Farmer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [editing, setEditing] = useState<Farmer | null>(null)
  const [form, setForm] = useState<PartyFormValues>(emptyPartyForm())
  const [saving, setSaving] = useState(false)
  const [payFarmer, setPayFarmer] = useState<Farmer | null>(null)

  const load = useCallback((soft = false) => {
    if (!soft) setLoading(true)
    farmerApi.getAll()
      .then((res) => setFarmers(res.data?.data ?? []))
      .catch(() => {
        if (!soft) {
          setFarmers([])
          toast.error('Failed to load farmers')
        }
      })
      .finally(() => { if (!soft) setLoading(false) })
  }, [])

  useEffect(() => { load() }, [load])
  useLiveReload(() => load(true))

  const filtered = farmers.filter((f) => {
    const q = search.toLowerCase()
    return (f.name || '').toLowerCase().includes(q)
      || (f.farmerId || '').toLowerCase().includes(q)
      || (f.fatherName || '').toLowerCase().includes(q)
      || (f.city || '').toLowerCase().includes(q)
  })

  const duplicates = useMemo(() => {
    const shaped = { name: form.name, phone: '', cnic: '' }
    if (editing) return findPersonDuplicates(farmers, shaped, (f) => ({
      id: f.id, code: f.farmerId, name: f.name, extra: f.fatherName || undefined, link: `/farmers/${f.id}`, reason: '',
    }), editing.id)
    return findPersonDuplicates(farmers, shaped, (f) => ({
      id: f.id, code: f.farmerId, name: f.name, extra: f.fatherName || undefined, link: `/farmers/${f.id}`, reason: '',
    }))
  }, [farmers, form, editing])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyPartyForm())
    setModalOpen(true)
  }

  const openEdit = (farmer: Farmer) => {
    setEditing(farmer)
    setForm({
      code: farmer.farmerId,
      name: farmer.name,
      fatherName: farmer.fatherName || '',
      address: farmer.address || '',
      city: farmer.city || '',
      notes: farmer.notes || '',
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Name is required')
      return
    }
    if (!form.code.trim()) {
      toast.error('Enter the farmer ID you assign')
      return
    }
    if (!editing && duplicates.some((d) => d.reason.includes('same'))) {
      const ok = window.confirm('A similar farmer already exists. Create anyway?')
      if (!ok) return
    }
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        fatherName: form.fatherName,
        code: form.code,
        farmerId: form.code,
        address: form.address,
        city: form.city,
        notes: form.notes,
      }
      if (editing) {
        await farmerApi.update(editing.id, payload)
        toast.success('Farmer updated')
      } else {
        await farmerApi.create(payload)
        toast.success('Farmer created')
      }
      setModalOpen(false)
      load()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Failed to save farmer')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await farmerApi.delete(deleteId)
      toast.success('Farmer deleted')
      setDeleteId(null)
      load()
    } catch {
      toast.error('Failed to delete farmer')
    }
  }

  useVoicePageActions({
    openCreate,
    save: () => { void handleSave() },
    cancel: () => setModalOpen(false),
    refresh: () => load(),
    setSearch,
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Farmer Management"
        description="Track farmer payables, product settlements, and payments made by the owner"
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Farmer
          </Button>
        }
      />

      <div className="card-3d p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            className="input-field pl-10"
            placeholder="Search by ID, name, father name, city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card-3d overflow-hidden">
        {loading ? (
          <div className="p-6"><TableSkeleton /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/50">
                  <th className="text-left p-4 font-semibold text-gray-600 dark:text-gray-400">Status</th>
                  <th className="text-left p-4 font-semibold text-gray-600 dark:text-gray-400">Farmer ID</th>
                  <th className="text-left p-4 font-semibold text-gray-600 dark:text-gray-400">Name</th>
                  <th className="text-left p-4 font-semibold text-gray-600 dark:text-gray-400">Father</th>
                  <th className="text-left p-4 font-semibold text-gray-600 dark:text-gray-400">City</th>
                  <th className="text-right p-4 font-semibold text-gray-600 dark:text-gray-400">Total payable</th>
                  <th className="text-right p-4 font-semibold text-gray-600 dark:text-gray-400">Paid</th>
                  <th className="text-right p-4 font-semibold text-gray-600 dark:text-gray-400">Remaining</th>
                  <th className="text-right p-4 font-semibold text-gray-600 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((farmer) => {
                  const settled = isPartySettled(farmer)
                  const hasBilling = (farmer.totalBilled || 0) > 0
                  return (
                  <tr key={farmer.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-primary/5 transition-colors">
                    <td className="p-4">
                      {settled ? (
                        <SettledBadge settled label="Paid" />
                      ) : hasBilling ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                          Due
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="p-4 font-mono text-primary">
                      <Link to={`/farmers/${farmer.id}`}>{farmer.farmerId}</Link>
                    </td>
                    <td className="p-4 font-medium text-gray-900 dark:text-white">
                      <Link to={`/farmers/${farmer.id}`} className="inline-flex items-center gap-2 hover:text-primary">
                        {farmer.name}
                        <SettledBadge settled={settled} />
                      </Link>
                    </td>
                    <td className="p-4 text-gray-600 dark:text-gray-400">{farmer.fatherName || '—'}</td>
                    <td className="p-4 text-gray-600 dark:text-gray-400">{farmer.city || '—'}</td>
                    <td className="p-4 text-right">{formatCurrency(farmer.totalBilled || 0)}</td>
                    <td className="p-4 text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(farmer.totalPaid || 0)}</td>
                    <td className={`p-4 text-right font-semibold ${settled ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-300'}`}>
                      {formatCurrency(farmer.outstandingBalance)}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setPayFarmer(farmer)}
                          disabled={(farmer.outstandingBalance || 0) <= 0}
                          className="p-2 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-gray-500 hover:text-emerald-600 disabled:opacity-30"
                          title={settled ? 'Fully paid — history kept' : 'Pay farmer'}
                        >
                          <Wallet className="h-4 w-4" />
                        </button>
                        <Link to={`/farmers/${farmer.id}`} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-primary">
                          <Eye className="h-4 w-4" />
                        </Link>
                        <button onClick={() => openEdit(farmer)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-primary">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => setDeleteId(farmer.id)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-500 hover:text-red-500">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  )
                })}
                {!filtered.length && (
                  <tr><td colSpan={9} className="p-8 text-center text-gray-500">No farmers found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Farmer' : 'Add Farmer'}>
        <div className="space-y-4">
          {!editing && <DuplicateSuggestions matches={duplicates} entityLabel="farmer" />}
          <PartyFields form={form} setForm={setForm} idLabel="Farmer ID" />
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
        title="Delete Farmer"
        message="Are you sure you want to delete this farmer?"
      />

      {payFarmer && (
        <PaymentModal
          open={!!payFarmer}
          onClose={() => setPayFarmer(null)}
          onSuccess={load}
          type="FARMER"
          partyId={payFarmer.id}
          partyName={payFarmer.name}
          outstanding={payFarmer.outstandingBalance || 0}
        />
      )}
    </div>
  )
}
