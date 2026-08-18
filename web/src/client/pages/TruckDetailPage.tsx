import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import { TableSkeleton } from '../components/ui/Skeleton'
import { truckApi } from '../services/api'
import type { Truck } from '../types'

export default function TruckDetailPage() {
  const { id } = useParams()
  const [truck, setTruck] = useState<Truck | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    truckApi.getById(Number(id))
      .then((res) => setTruck(res.data.data))
      .catch(() => toast.error('Truck not found'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <TableSkeleton rows={4} />
  if (!truck) return <p className="text-gray-500">Truck not found.</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/trucks" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><ArrowLeft className="h-5 w-5" /></Link>
        <PageHeader title={truck.truckId} description={truck.registrationNumber} />
      </div>
      <div className="card p-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <Field label="Farmer" value={<Link className="text-primary" to={`/farmers/${truck.farmerId}`}>{truck.farmerCode} — {truck.farmerName}</Link>} />
        <Field label="Driver" value={truck.driverName || '—'} />
        <Field label="Driver phone" value={truck.driverPhone || '—'} />
        <Field label="Capacity" value={truck.capacity != null ? String(truck.capacity) : '—'} />
        <Field label="Notes" value={truck.notes || '—'} />
      </div>
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
