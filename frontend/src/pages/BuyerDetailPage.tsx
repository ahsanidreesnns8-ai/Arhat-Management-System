import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, FileText, Printer, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import { TableSkeleton } from '../components/ui/Skeleton'
import PaymentModal from '../components/payments/PaymentModal'
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
  const [payOpen, setPayOpen] = useState(false)

  const load = useCallback(() => {
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

  useEffect(() => { load() }, [load])

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

  const totalBilled = buyer.totalBilled ?? sales.reduce((s, x) => s + (x.totalAmount || 0), 0)
  const totalPaid = buyer.totalPaid ?? payments.reduce((s, x) => s + (x.amount || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/buyers" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><ArrowLeft className="h-5 w-5" /></Link>
        <PageHeader
          title={buyer.name}
          description={`${buyer.buyerId} · Buyer money & purchase ledger`}
          action={
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setPayOpen(true)} disabled={(buyer.outstandingBalance || 0) <= 0}>
                <Wallet className="h-4 w-4" /> Receive payment
              </Button>
              <Button variant="secondary" onClick={openBill}><FileText className="h-4 w-4" /> Generate Bill</Button>
              <Button variant="secondary" onClick={openBill}><Printer className="h-4 w-4" /> Print</Button>
            </div>
          }
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MoneyCard label="Total billed" value={totalBilled} tone="neutral" />
        <MoneyCard label="Total paid" value={totalPaid} tone="good" />
        <MoneyCard label="Remaining balance" value={buyer.outstandingBalance} tone="warn" />
        <div className="card-3d p-5">
          <p className="text-sm text-gray-500">Contact</p>
          <p className="mt-1 font-medium">{buyer.phone || '—'}</p>
          <p className="text-sm text-gray-500">{buyer.city || buyer.address || ''}</p>
        </div>
      </div>

      <div className="card-3d overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 font-semibold flex justify-between">
          <span>Purchase history (bills)</span>
          <button onClick={() => setPayOpen(true)} className="text-sm text-primary font-medium">Settle bill</button>
        </div>
        {sales.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">No purchases</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-left">
              <tr>
                <th className="px-4 py-2">Invoice</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Total</th>
                <th className="px-4 py-2">Paid</th>
                <th className="px-4 py-2">Remaining</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {sales.map((s) => {
                const remaining = (s.totalAmount || 0) - (s.paidAmount || 0)
                return (
                  <tr key={s.id}>
                    <td className="px-4 py-2"><Link className="text-primary" to={`/sales/${s.id}`}>{s.invoiceNumber}</Link></td>
                    <td className="px-4 py-2">{s.saleDate}</td>
                    <td className="px-4 py-2">{formatCurrency(s.totalAmount)}</td>
                    <td className="px-4 py-2 text-emerald-600 dark:text-emerald-400">{formatCurrency(s.paidAmount)}</td>
                    <td className="px-4 py-2 font-medium text-amber-700 dark:text-amber-300">{formatCurrency(remaining)}</td>
                    <td className="px-4 py-2">{s.paymentStatus}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card-3d overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 font-semibold">Payment history</div>
        {payments.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">No payments recorded yet</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-left">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Amount</th>
                <th className="px-4 py-2">Method</th>
                <th className="px-4 py-2">Invoice</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2">{p.paymentDate}</td>
                  <td className="px-4 py-2 font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(p.amount)}</td>
                  <td className="px-4 py-2">{p.paymentMethod}</td>
                  <td className="px-4 py-2">{p.saleInvoiceNumber || p.invoiceNumber || '—'}</td>
                  <td className="px-4 py-2">{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <PaymentModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        onSuccess={load}
        type="BUYER"
        partyId={buyer.id}
        partyName={buyer.name}
        outstanding={buyer.outstandingBalance || 0}
        sales={sales}
      />
    </div>
  )
}

function MoneyCard({ label, value, tone }: { label: string; value: number; tone: 'neutral' | 'good' | 'warn' }) {
  const toneClass = tone === 'good'
    ? 'text-emerald-600 dark:text-emerald-400'
    : tone === 'warn'
      ? 'text-amber-700 dark:text-amber-300'
      : 'text-gray-900 dark:text-white'
  return (
    <div className="card-3d p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${toneClass}`}>{formatCurrency(value)}</p>
    </div>
  )
}
