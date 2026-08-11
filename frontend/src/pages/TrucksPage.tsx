import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Modal from '../components/ui/Modal'
import { TableSkeleton } from '../components/ui/Skeleton'
import DuplicateSuggestions from '../components/forms/DuplicateSuggestions'
import { useLiveReload } from '../context/SyncContext'
import { useVoicePageActions } from '../context/VoiceControlContext'
import { truckApi, farmerApi } from '../services/api'
import type { Farmer, Truck } from '../types'

export default function TrucksPage() {
  const [trucks, setTrucks] = useState<Truck[]>([])
  const [farmers, setFarmers] = useState<Farmer[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ registrationNumber: '', driverName: '', driverPhone: '', farmerId: '', capacity: '', notes: '' })
  const [saving, setSaving] = useState(false)

  const duplicates = useMemo(() => {
    const reg = form.registrationNumber.trim().toLowerCase()
    if (reg.length < 3) return []
    return trucks
      .filter((t) => t.registrationNumber?.toLowerCase() === reg || t.registrationNumber?.toLowerCase().includes(reg))
      .map((t) => ({
        id: t.id,
        code: t.truckId,
        name: t.registrationNumber,
        phone: t.driverPhone,
        extra: t.farmerName,
        link: `/trucks/${t.id}`,
        reason: 'registration already used',
      }))
  }, [form.registrationNumber, trucks])

  const load = useCallback((soft = false) => {
    if (!soft) setLoading(true)
    Promise.allSettled([truckApi.getAll(), farmerApi.getAll()])
      .then(([t, f]) => {
        if (t.status === 'fulfilled') setTrucks(t.value.data?.data ?? [])
        if (f.status === 'fulfilled') setFarmers(f.value.data?.data ?? [])
        if (t.status === 'rejected' && f.status === 'rejected' && !soft) toast.error('Failed to load trucks')
      })
      .finally(() => { if (!soft) setLoading(false) })
  }, [])

  useEffect(() => { load() }, [load])
  useLiveReload(() => load(true))

  const handleCreate = async () => {
    if (!form.registrationNumber || !form.farmerId) {
      toast.error('Registration number and farmer are required')
      return
    }
    if (duplicates.some((d) => d.reason.includes('already'))) {
      toast.error('This truck registration already exists — open the existing record instead')
      return
    }
    setSaving(true)
    try {
      await truckApi.create({
        registrationNumber: form.registrationNumber,
        driverName: form.driverName,
        driverPhone: form.driverPhone,
        farmerId: parseInt(form.farmerId),
        capacity: form.capacity ? parseFloat(form.capacity) : undefined,
        notes: form.notes,
      })
      toast.success('Truck created')
      setModalOpen(false)
      load()
    } catch {
      toast.error('Failed to create truck')
    } finally {
      setSaving(false)
    }
  }

  useVoicePageActions({
    openCreate: () => setModalOpen(true),
    save: () => { void handleCreate() },
    cancel: () => setModalOpen(false),
    refresh: () => load(),
  })


  return (
    <div className="space-y-6">
      <PageHeader title="Truck Management" description="Each truck is linked to exactly one farmer"
        action={<Button onClick={() => setModalOpen(true)}><Plus className="h-4 w-4" />Add Truck</Button>} />

      <div className="card-3d overflow-hidden">
        {loading ? <div className="p-6"><TableSkeleton /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <th className="text-left p-4 font-semibold text-gray-600">Truck ID</th>
                  <th className="text-left p-4 font-semibold text-gray-600">Registration</th>
                  <th className="text-left p-4 font-semibold text-gray-600">Driver</th>
                  <th className="text-left p-4 font-semibold text-gray-600">Farmer</th>
                  <th className="text-left p-4 font-semibold text-gray-600">Phone</th>
                </tr>
              </thead>
              <tbody>
                {trucks.map((t) => (
                  <tr key={t.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-primary/5">
                    <td className="p-4 font-mono text-primary"><Link to={`/trucks/${t.id}`}>{t.truckId}</Link></td>
                    <td className="p-4 font-medium">{t.registrationNumber}</td>
                    <td className="p-4">{t.driverName || '—'}</td>
                    <td className="p-4">{t.farmerName} <span className="text-gray-400 text-xs">({t.farmerCode})</span></td>
                    <td className="p-4">{t.driverPhone || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Truck">
        <div className="space-y-4">
          <DuplicateSuggestions matches={duplicates} entityLabel="truck" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Registration Number *" value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} />
          <Select label="Farmer *" value={form.farmerId} onChange={(e) => setForm({ ...form, farmerId: e.target.value })}
            options={[{ value: '', label: 'Select' }, ...farmers.map((f) => ({ value: f.id, label: f.name }))]} />
          <Input label="Driver Name" value={form.driverName} onChange={(e) => setForm({ ...form, driverName: e.target.value })} />
          <Input label="Driver Phone" value={form.driverPhone} onChange={(e) => setForm({ ...form, driverPhone: e.target.value })} />
          <Input label="Capacity" type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
          <Input label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button onClick={handleCreate} loading={saving}>Create</Button>
        </div>
      </Modal>
    </div>
  )
}
