import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import { TableSkeleton } from '../components/ui/Skeleton'
import { dheriApi } from '../services/api'
import { formatCurrency, formatNumber } from '../utils/format'
import type { Dheri } from '../types'

export default function DheriDetailPage() {
  const { id } = useParams()
  const [dheri, setDheri] = useState<Dheri | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    dheriApi.getById(Number(id))
      .then((res) => setDheri(res.data.data))
      .catch(() => toast.error('Dheri not found'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <TableSkeleton rows={5} />
  if (!dheri) return <p className="text-gray-500">Dheri not found.</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/dheris" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><ArrowLeft className="h-5 w-5" /></Link>
        <PageHeader title={dheri.dheriId} description={`${dheri.productName} · ${dheri.sellingStatus}`} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Bags" value={String(dheri.numberOfBags)} />
        <Stat label="Total weight" value={`${formatNumber(dheri.totalWeight)} kg`} />
        <Stat label="Total price" value={formatCurrency(dheri.totalPrice)} />
        <Stat label="Farmer receivable" value={formatCurrency(dheri.farmerReceivable)} />
      </div>
      <div className="card p-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-gray-500">Farmer</p>
          <Link className="text-primary font-medium" to={`/farmers/${dheri.farmerId}`}>{dheri.farmerCode} — {dheri.farmerName}</Link>
        </div>
        <div>
          <p className="text-gray-500">Market rate / 40kg</p>
          <p className="font-medium">{formatCurrency(dheri.marketRate)}</p>
        </div>
        <div>
          <p className="text-gray-500">Commission</p>
          <p className="font-medium">{formatCurrency(dheri.commissionAmount)} ({dheri.commissionPercentage}%)</p>
        </div>
        <div>
          <p className="text-gray-500">Shares</p>
          <p className="font-medium">Arhat {formatCurrency(dheri.arhatShare)} · Supervisor {formatCurrency(dheri.supervisorShare)} · Labor {formatCurrency(dheri.laborShare)}</p>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-semibold mt-1">{value}</p>
    </div>
  )
}
