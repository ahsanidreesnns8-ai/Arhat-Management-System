import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import Input from '../components/ui/Input'
import { TableSkeleton } from '../components/ui/Skeleton'
import { paymentApi } from '../services/api'
import { formatCurrency } from '../utils/format'
import type { Payment } from '../types'

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState('')

  const load = () => {
    setLoading(true)
    const req = dateFilter ? paymentApi.getByDate(dateFilter) : paymentApi.getAll()
    req
      .then((res) => setPayments(res.data.data || []))
      .catch(() => toast.error('Failed to load payments'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [dateFilter])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment Records"
        description="All money paid to farmers and received from buyers — filter by date for day-wise settlement"
      />

      <div className="card-3d p-4 flex flex-wrap items-end gap-3">
        <div className="w-56">
          <Input
            label="Filter by payment date"
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
        </div>
        {dateFilter && (
          <button type="button" className="text-sm text-primary mb-2" onClick={() => setDateFilter('')}>
            Show all dates
          </button>
        )}
      </div>

      <div className="card-3d overflow-hidden">
        {loading ? (
          <div className="p-6"><TableSkeleton /></div>
        ) : payments.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            <Wallet className="h-8 w-8 mx-auto mb-3 opacity-40" />
            {dateFilter
              ? `No payments recorded on ${dateFilter}.`
              : 'No payments recorded yet. Use Arhat Sale, farmer/buyer Pay buttons, or dheri payment.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/50">
                  <th className="text-left p-4 font-semibold text-gray-600">Date</th>
                  <th className="text-left p-4 font-semibold text-gray-600">Type</th>
                  <th className="text-left p-4 font-semibold text-gray-600">Party</th>
                  <th className="text-left p-4 font-semibold text-gray-600">Dheri</th>
                  <th className="text-right p-4 font-semibold text-gray-600">Amount</th>
                  <th className="text-left p-4 font-semibold text-gray-600">Method</th>
                  <th className="text-left p-4 font-semibold text-gray-600">Invoice</th>
                  <th className="text-left p-4 font-semibold text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-primary/5">
                    <td className="p-4 font-medium">{p.paymentDate}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                        p.paymentType === 'FARMER'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                      }`}>
                        {p.paymentType === 'FARMER' ? 'Paid to farmer' : 'Received from buyer'}
                      </span>
                    </td>
                    <td className="p-4 font-medium">
                      {p.paymentType === 'FARMER' && p.farmerId ? (
                        <Link className="text-primary" to={`/farmers/${p.farmerId}`}>{p.farmerName}</Link>
                      ) : p.buyerId ? (
                        <Link className="text-primary" to={`/buyers/${p.buyerId}`}>{p.buyerName}</Link>
                      ) : '—'}
                    </td>
                    <td className="p-4">
                      {p.dheriId ? (
                        <Link className="text-primary font-mono" to={`/dheris/${p.dheriId}`}>{p.dheriCode || `#${p.dheriId}`}</Link>
                      ) : '—'}
                    </td>
                    <td className="p-4 text-right font-semibold">{formatCurrency(p.amount)}</td>
                    <td className="p-4">{p.paymentMethod}</td>
                    <td className="p-4">
                      {p.saleId ? (
                        <Link className="text-primary" to={`/sales/${p.saleId}`}>{p.saleInvoiceNumber || p.invoiceNumber || `#${p.saleId}`}</Link>
                      ) : '—'}
                    </td>
                    <td className="p-4">{p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
