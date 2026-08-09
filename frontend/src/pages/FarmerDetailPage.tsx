import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, FileText, Printer } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { TableSkeleton } from '../components/ui/Skeleton'
import { farmerApi } from '../services/api'
import { formatCurrency } from '../utils/format'
import type { Dheri, Farmer, Payment, Truck } from '../types'

export default function FarmerDetailPage() {
  const { id } = useParams()
  const farmerId = Number(id)
  const [farmer, setFarmer] = useState<Farmer | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [dheris, setDheris] = useState<Dheri[]>([])
  const [trucks, setTrucks] = useState<Truck[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!farmerId) return
    setLoading(true)
    Promise.all([
      farmerApi.getById(farmerId),
      farmerApi.getPayments(farmerId).catch(() => ({ data: { data: [] } })),
      farmerApi.getDheris(farmerId).catch(() => ({ data: { data: [] } })),
      farmerApi.getTrucks(farmerId).catch(() => ({ data: { data: [] } })),
    ])
      .then(([f, p, d, t]) => {
        setFarmer(f.data.data)
        setPayments(p.data.data || [])
        setDheris(d.data.data || [])
        setTrucks(t.data.data || [])
      })
      .catch(() => toast.error('Failed to load farmer'))
      .finally(() => setLoading(false))
  }, [farmerId])

  const openBill = async () => {
    try {
      const res = await farmerApi.getBillHtml(farmerId)
      const html = typeof res.data === 'string' ? res.data : String(res.data)
      const win = window.open('', '_blank')
      if (win) {
        win.document.write(html)
        win.document.close()
      }
    } catch {
      toast.error('Could not generate farmer bill')
    }
  }

  if (loading) return <TableSkeleton rows={8} />
  if (!farmer) {
    return (
      <div className="space-y-4">
        <Link to="/farmers" className="text-primary text-sm inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" /> Back</Link>
        <p className="text-gray-500">Farmer not found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link to="/farmers" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><ArrowLeft className="h-5 w-5" /></Link>
        <PageHeader
          title={`${farmer.name}`}
          description={`${farmer.farmerId} · ${farmer.city || farmer.phone || 'Farmer profile'}`}
          action={
            <div className="flex gap-2">
              <Button variant="secondary" onClick={openBill}><FileText className="h-4 w-4" /> Generate Bill</Button>
              <Button onClick={openBill}><Printer className="h-4 w-4" /> Print</Button>
            </div>
          }
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-sm text-gray-500">Outstanding balance</p>
          <p className="text-2xl font-bold text-primary mt-1">{formatCurrency(farmer.outstandingBalance)}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Contact</p>
          <p className="mt-1 font-medium">{farmer.phone || '—'}</p>
          <p className="text-sm text-gray-500">{farmer.cnic || ''}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Address</p>
          <p className="mt-1 text-sm">{farmer.address || '—'}</p>
        </div>
      </div>

      <Section title="Dheri history" empty="No dheris">
        {dheris.map((d) => (
          <tr key={d.id}>
            <td className="px-4 py-2"><Link className="text-primary" to={`/dheris/${d.id}`}>{d.dheriId}</Link></td>
            <td className="px-4 py-2">{d.productName}</td>
            <td className="px-4 py-2">{d.numberOfBags}</td>
            <td className="px-4 py-2">{formatCurrency(d.farmerReceivable)}</td>
            <td className="px-4 py-2">{d.sellingStatus}</td>
          </tr>
        ))}
      </Section>

      <Section title="Truck history" empty="No trucks" headers={['Truck', 'Registration', 'Driver']}>
        {trucks.map((t) => (
          <tr key={t.id}>
            <td className="px-4 py-2"><Link className="text-primary" to={`/trucks/${t.id}`}>{t.truckId}</Link></td>
            <td className="px-4 py-2">{t.registrationNumber}</td>
            <td className="px-4 py-2">{t.driverName || '—'}</td>
          </tr>
        ))}
      </Section>

      <Section title="Payment history" empty="No payments" headers={['Date', 'Amount', 'Method', 'Status']}>
        {payments.map((p) => (
          <tr key={p.id}>
            <td className="px-4 py-2">{p.paymentDate}</td>
            <td className="px-4 py-2">{formatCurrency(p.amount)}</td>
            <td className="px-4 py-2">{p.paymentMethod}</td>
            <td className="px-4 py-2">{p.status}</td>
          </tr>
        ))}
      </Section>
    </div>
  )
}

function Section({
  title, empty, headers = ['ID', 'Product', 'Bags', 'Amount', 'Status'], children,
}: {
  title: string
  empty: string
  headers?: string[]
  children: React.ReactNode
}) {
  const rows = Array.isArray(children) ? children : [children]
  const hasRows = rows.filter(Boolean).length > 0
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 font-semibold">{title}</div>
      {!hasRows ? (
        <p className="p-6 text-sm text-gray-500">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-left">
              <tr>{headers.map((h) => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">{children}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}
