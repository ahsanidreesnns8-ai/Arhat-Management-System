import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, FileText, Printer } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { TableSkeleton } from '../components/ui/Skeleton'
import { buyerApi } from '../services/api'
import { formatCurrency } from '../utils/format'
import type { Buyer, Payment, Sale } from '../types'

export default function BuyerDetailPage() {
  const { id } = useParams()
  const buyerId = Number(id)
  const [buyer, setBuyer] = useState<Buyer | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!buyerId) return
    setLoading(true)
    Promise.all([
      buyerApi.getById(buyerId),
      buyerApi.getPayments(buyerId).catch(() => ({ data: { data: [] } })),
      buyerApi.getSales(buyerId).catch(() => ({ data: { data: [] } })),
    ])
      .then(([b, p, s]) => {
        setBuyer(b.data.data)
        setPayments(p.data.data || [])
        setSales(s.data.data || [])
      })
      .catch(() => toast.error('Failed to load buyer'))
      .finally(() => setLoading(false))
  }, [buyerId])

  const openBill = async () => {
    try {
      const res = await buyerApi.getBillHtml(buyerId)
      const html = typeof res.data === 'string' ? res.data : String(res.data)
      const win = window.open('', '_blank')
      if (win) {
        win.document.write(html)
        win.document.close()
      }
    } catch {
      toast.error('Could not generate buyer bill')
    }
  }

  if (loading) return <TableSkeleton rows={8} />
  if (!buyer) {
    return (
      <div className="space-y-4">
        <Link to="/buyers" className="text-primary text-sm inline-flex items-center gap-1"><ArrowLeft className="h-4 w-4" /> Back</Link>
        <p className="text-gray-500">Buyer not found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/buyers" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><ArrowLeft className="h-5 w-5" /></Link>
        <PageHeader
          title={buyer.name}
          description={`${buyer.buyerId} · Buyer profile`}
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
          <p className="text-2xl font-bold text-primary mt-1">{formatCurrency(buyer.outstandingBalance)}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Contact</p>
          <p className="mt-1 font-medium">{buyer.phone || '—'}</p>
          <p className="text-sm text-gray-500">{buyer.cnic || ''}</p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-gray-500">Address</p>
          <p className="mt-1 text-sm">{buyer.address || '—'}</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 font-semibold">Purchase history</div>
        {sales.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">No purchases</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-left">
              <tr>
                <th className="px-4 py-2">Invoice</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Amount</th>
                <th className="px-4 py-2">Paid</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {sales.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2"><Link className="text-primary" to={`/sales/${s.id}`}>{s.invoiceNumber}</Link></td>
                  <td className="px-4 py-2">{s.saleDate}</td>
                  <td className="px-4 py-2">{formatCurrency(s.totalAmount)}</td>
                  <td className="px-4 py-2">{formatCurrency(s.paidAmount)}</td>
                  <td className="px-4 py-2">{s.paymentStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 font-semibold">Payment history</div>
        {payments.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">No payments</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-left">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Amount</th>
                <th className="px-4 py-2">Method</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2">{p.paymentDate}</td>
                  <td className="px-4 py-2">{formatCurrency(p.amount)}</td>
                  <td className="px-4 py-2">{p.paymentMethod}</td>
                  <td className="px-4 py-2">{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
