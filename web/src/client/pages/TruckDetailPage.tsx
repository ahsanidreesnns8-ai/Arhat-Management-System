import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { TableSkeleton } from '../components/ui/Skeleton'
import { truckApi } from '../services/api'
import type { Truck } from '../types'

export default function TruckDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [truck, setTruck] = useState<Truck | null>(null)
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    registrationNumber: '',
    driverName: '',
    driverPhone: '',
    capacity: '',
    notes: '',
  })

  useEffect(() => {
    truckApi.getById(Number(id))
      .then((res) => setTruck(res.data.data))
      .catch(() => toast.error('Truck not found'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <TableSkeleton rows={4} />
  if (!truck) return <p className="text-gray-500">Truck not found.</p>

  const openEdit = () => {
    setForm({
      registrationNumber: truck.registrationNumber || '',
      driverName: truck.driverName || '',
      driverPhone: truck.driverPhone || '',
      capacity: truck.capacity != null ? String(truck.capacity) : '',
      notes: truck.notes || '',
    })
    setEditOpen(true)
  }

  const saveEdit = async () => {
    setSaving(true)
    try {
      const res = await truckApi.update(truck.id, {
        registrationNumber: form.registrationNumber,
        driverName: form.driverName,
        driverPhone: form.driverPhone,
        farmerId: truck.farmerId,
        capacity: form.capacity ? parseFloat(form.capacity) : undefined,
        notes: form.notes,
      })
      setTruck(res.data.data)
      setEditOpen(false)
      toast.success('Truck updated')
    } catch {
      toast.error('Could not save')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    setSaving(true)
    try {
      await truckApi.delete(truck.id)
      toast.success('Deleted')
      navigate('/trucks')
    } catch {
      toast.error('Could not delete')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/trucks" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><ArrowLeft className="h-5 w-5" /></Link>
        <PageHeader
          title={truck.truckId}
          description={truck.registrationNumber}
          action={
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={openEdit}>
                <Pencil className="h-4 w-4" /> Edit
              </Button>
              <Button variant="danger" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </div>
          }
        />
      </div>
      <div className="card p-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <Field label="Farmer" value={<Link className="text-primary" to={`/farmers/${truck.farmerId}`}>{truck.farmerCode} — {truck.farmerName}</Link>} />
        <Field label="Driver" value={truck.driverName || '—'} />
        <Field label="Driver phone" value={truck.driverPhone || '—'} />
        <Field label="Capacity" value={truck.capacity != null ? String(truck.capacity) : '—'} />
        <Field label="Notes" value={truck.notes || '—'} />
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit truck">
        <div className="space-y-3">
          <Input label="Registration" value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} />
          <Input label="Driver" value={form.driverName} onChange={(e) => setForm({ ...form, driverName: e.target.value })} />
          <Input label="Driver phone" value={form.driverPhone} onChange={(e) => setForm({ ...form, driverPhone: e.target.value })} />
          <Input label="Capacity" type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
          <Input label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={() => void saveEdit()}>Save</Button>
          </div>
        </div>
      </Modal>
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => void confirmDelete()}
        title="Delete this truck?"
        message="The truck will be removed."
        confirmLabel="Delete"
        loading={saving}
      />
    </div>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-gray-500 mb-1">{label}</p>
      <div className="font-medium text-gray-900 dark:text-white">{value}</div>
    </div>
  )
}
