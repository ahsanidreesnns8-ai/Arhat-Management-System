import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Trash2, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import Input from '../components/ui/Input'
import { TableSkeleton } from '../components/ui/Skeleton'
import PaymentModal from '../components/payments/PaymentModal'
import { useLiveReload } from '../context/SyncContext'
import { buyerApi, farmerApi, paymentApi } from '../services/api'
import { formatCurrency } from '../utils/format'
import type { Payment, Sale } from '../types'

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null)
  const [partyOutstanding, setPartyOutstanding] = useState(0)
  const [partySales, setPartySales] = useState<Sale[]>([])

  const load = useCallback((soft = false) => {
    if (!soft) setLoading(true)
    const req = dateFilter ? paymentApi.getByDate(dateFilter) : paymentApi.getAll()
    req
      .then((res) => setPayments(res.data.data || []))
      .catch(() => { if (!soft) toast.error('Failed to load payments') })
      .finally(() => { if (!soft) setLoading(false) })
  }, [dateFilter])

  useEffect(() => { load() }, [load])
  useLiveReload(() => load(true))

  const openEdit = async (p: Payment) => {
    try {
      if (p.paymentType === 'FARMER' && p.farmerId) {
        const f = await farmerApi.getById(p.farmerId)
        setPartyOutstanding(f.data.data.outstandingBalance || 0)
        setPartySales([])
      } else if (p.buyerId) {
        const [b, s] = await Promise.all([
          buyerApi.getById(p.buyerId),
          buyerApi.getSales(p.buyerId).catch(() => ({ data: { data: [] as Sale[] } })),
        ])
        setPartyOutstanding(b.data.data.outstandingBalance || 0)
        setPartySales(s.data.data || [])
      } else {
        toast.error('Payment has no linked farmer/buyer')
        return
      }
      setEditingPayment(p)
      setEditOpen(true)
    } catch {
      toast.error('Could not load party balance for update')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment Records"
        description="Pay farmers / receive from buyers — update any payment to re-settle remaining balances"
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
                  <th className="text-left p-4 font-semibold text-gray-600">Actions</th>
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
                    <td className="p-4">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-primary text-xs font-semibold hover:underline"
                          onClick={() => openEdit(p)}
                        >
                          <Pencil className="h-3.5 w-3.5" /> Update
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-red-600 text-xs font-semibold hover:underline"
                          onClick={async () => {
                            if (!confirm('Delete this payment and restore party balance?')) return
                            try {
                              await paymentApi.delete(p.id)
                              toast.success('Payment deleted — balance restored')
                              load()
                            } catch (err: unknown) {
                              const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
                              toast.error(msg || 'Failed to delete')
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingPayment && (
        <PaymentModal
          open={editOpen}
          onClose={() => { setEditOpen(false); setEditingPayment(null) }}
          onSuccess={load}
          type={editingPayment.paymentType}
          partyId={(editingPayment.paymentType === 'FARMER' ? editingPayment.farmerId : editingPayment.buyerId) || 0}
          partyName={(editingPayment.paymentType === 'FARMER' ? editingPayment.farmerName : editingPayment.buyerName) || 'Party'}
          outstanding={partyOutstanding}
          sales={partySales}
          editingPayment={editingPayment}
          dheriId={editingPayment.dheriId}
        />
      )}
    </div>
  )
}
