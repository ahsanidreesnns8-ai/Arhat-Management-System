import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, FileText, Pencil, Printer, Trash2, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import SettledBadge, { isPartySettled } from '../components/ui/SettledBadge'
import { TableSkeleton } from '../components/ui/Skeleton'
import PaymentModal from '../components/payments/PaymentModal'
import { buyerApi, paymentApi } from '../services/api'
import { billErrorMessage, openHtmlBill } from '../utils/bill'
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
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null)
  const [selectedItems, setSelectedItems] = useState<number[]>([])
  const [groupSize, setGroupSize] = useState('')

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

  const openBill = async (lang: 'en' | 'ur' = 'en') => {
    try {
      const res = await buyerApi.getBillHtml(buyerId, lang)
      openHtmlBill(typeof res.data === 'string' ? res.data : String(res.data), `Buyer Bill ${buyer?.buyerId || buyerId}`)
    } catch (err) {
      toast.error(billErrorMessage(err, 'Could not generate buyer bill'))
    }
  }

  const openSelectedBill = async (lang: 'en' | 'ur' = 'en') => {
    if (!selectedItems.length) {
      toast.error('Tick at least one purchase line')
      return
    }
    try {
      const gs = groupSize ? Number(groupSize) : undefined
      const res = await buyerApi.getSelectedBillHtml(buyerId, selectedItems, lang, gs)
      openHtmlBill(typeof res.data === 'string' ? res.data : String(res.data), `Buyer Bill selected`)
    } catch (err) {
      toast.error(billErrorMessage(err, 'Could not generate selected bill'))
    }
  }

  const toggleItem = (itemId: number) => {
    setSelectedItems((prev) =>
      prev.includes(itemId) ? prev.filter((x) => x !== itemId) : [...prev, itemId],
    )
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
  const settled = isPartySettled({
    outstandingBalance: buyer.outstandingBalance,
    totalBilled,
    totalPaid,
  })
  const productRows = sales.flatMap((sale) =>
    (sale.items || []).map((item, idx) => ({
      key: `${sale.id}-${item.id ?? idx}`,
      itemId: item.id,
      invoice: sale.invoiceNumber,
      saleId: sale.id,
      saleDate: sale.saleDate,
      product: item.productName || `Product #${item.productId}`,
      dheri: item.dheriCode || (item.sourceType === 'BUSINESS_STOCK' ? 'STOCK' : '—'),
      farmer: item.farmerName || '—',
      bags: item.numberOfBags,
      weight: item.totalWeight ?? (item.numberOfBags * item.weightPerBag + (item.partialBagWeight || 0)),
      rate: item.rate,
      amount: item.amount ?? 0,
      status: sale.paymentStatus,
    })),
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/buyers" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><ArrowLeft className="h-5 w-5" /></Link>
        <PageHeader
          title={buyer.name}
          description={`${buyer.buyerId}${settled ? ' · Fully paid — record kept' : ''}`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <SettledBadge settled={settled} label="Paid in full" />
              <Button
                onClick={() => { setEditingPayment(null); setPayOpen(true) }}
                disabled={(buyer.outstandingBalance || 0) <= 0}
                title={settled ? 'Already paid — history is kept' : 'Receive payment'}
              >
                {settled ? <CheckCircle2 className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
                {settled ? 'Paid' : 'Receive / Settle remaining'}
              </Button>
              <Button variant="secondary" onClick={() => openBill('en')}><FileText className="h-4 w-4" /> Bill (EN)</Button>
              <Button variant="secondary" onClick={() => openBill('ur')}><FileText className="h-4 w-4" /> بل (UR)</Button>
              <Button variant="secondary" onClick={() => openBill('en')}><Printer className="h-4 w-4" /> Print</Button>
            </div>
          }
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MoneyCard label="Total billed" value={totalBilled} tone="neutral" />
        <MoneyCard label="Total paid" value={totalPaid} tone="good" />
        <MoneyCard
          label="Remaining balance"
          value={buyer.outstandingBalance}
          tone={settled ? 'good' : 'warn'}
        />
        <div className="card-3d p-5">
          <p className="text-sm text-gray-500">Contact</p>
          <p className="mt-1 font-medium">{buyer.phone || '—'}</p>
          <p className="text-sm text-gray-500">{buyer.city || buyer.address || ''}</p>
          {settled && (
            <p className="mt-3 text-xs text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Settled — kept in records
            </p>
          )}
        </div>
      </div>

      <div className="card-3d overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 font-semibold flex justify-between items-center">
          <span>Purchase history (bills)</span>
          {settled ? (
            <SettledBadge settled label="All bills paid" />
          ) : (
            <button
              onClick={() => { setEditingPayment(null); setPayOpen(true) }}
              className="text-sm text-primary font-medium"
            >
              Settle bill
            </button>
          )}
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
                const paid = s.paymentStatus === 'PAID' || remaining <= 0
                return (
                  <tr key={s.id}>
                    <td className="px-4 py-2"><Link className="text-primary" to={`/sales/${s.id}`}>{s.invoiceNumber}</Link></td>
                    <td className="px-4 py-2">{s.saleDate}</td>
                    <td className="px-4 py-2">{formatCurrency(s.totalAmount)}</td>
                    <td className="px-4 py-2 text-emerald-600 dark:text-emerald-400">{formatCurrency(s.paidAmount)}</td>
                    <td className={`px-4 py-2 font-medium ${paid ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-300'}`}>
                      {formatCurrency(Math.max(0, remaining))}
                    </td>
                    <td className="px-4 py-2">
                      <PaymentStatusBadge status={paid ? 'PAID' : s.paymentStatus} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card-3d overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 font-semibold flex flex-wrap items-center justify-between gap-2">
          <span>
            Dheri purchase lines — tick which bills to print ({selectedItems.length} selected)
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={1}
              placeholder="Split size (e.g. 3)"
              value={groupSize}
              onChange={(e) => setGroupSize(e.target.value)}
              className="w-36 rounded-lg border border-slate-200 dark:border-white/10 bg-transparent px-2 py-1 text-sm"
              title="Optional: e.g. 3 = bill of 3 dheris, then another bill for the rest"
            />
            <Button variant="secondary" onClick={() => void openSelectedBill('en')}>
              <FileText className="h-4 w-4" /> Bill selected ({selectedItems.length})
            </Button>
            <Button variant="secondary" onClick={() => void openSelectedBill('ur')}>
              <FileText className="h-4 w-4" /> بل منتخب
            </Button>
            <button
              type="button"
              className="text-sm text-primary"
              onClick={() =>
                setSelectedItems(
                  productRows.map((r) => r.itemId).filter((x): x is number => typeof x === 'number'),
                )
              }
            >
              Tick all
            </button>
            <button
              type="button"
              className="text-sm text-slate-500"
              onClick={() => setSelectedItems([])}
            >
              Clear
            </button>
          </div>
        </div>
        {productRows.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">No products purchased yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-left">
                <tr>
                  <th className="px-4 py-2">Bill</th>
                  <th className="px-4 py-2">Invoice</th>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Dheri</th>
                  <th className="px-4 py-2">Farmer</th>
                  <th className="px-4 py-2">Product</th>
                  <th className="px-4 py-2">Bags</th>
                  <th className="px-4 py-2">Weight</th>
                  <th className="px-4 py-2">Rate</th>
                  <th className="px-4 py-2">Amount</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {productRows.map((row) => (
                  <tr key={row.key} className={row.itemId != null && selectedItems.includes(row.itemId) ? 'bg-primary/5' : ''}>
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        disabled={row.itemId == null}
                        checked={row.itemId != null && selectedItems.includes(row.itemId)}
                        onChange={() => row.itemId != null && toggleItem(row.itemId)}
                        aria-label={`Bill dheri ${row.dheri}`}
                      />
                    </td>
                    <td className="px-4 py-2"><Link className="text-primary" to={`/sales/${row.saleId}`}>{row.invoice}</Link></td>
                    <td className="px-4 py-2">{row.saleDate}</td>
                    <td className="px-4 py-2 font-semibold">{row.dheri}</td>
                    <td className="px-4 py-2">{row.farmer}</td>
                    <td className="px-4 py-2 font-medium">{row.product}</td>
                    <td className="px-4 py-2">{row.bags}</td>
                    <td className="px-4 py-2">{row.weight}</td>
                    <td className="px-4 py-2">{formatCurrency(row.rate)}</td>
                    <td className="px-4 py-2">{formatCurrency(row.amount)}</td>
                    <td className="px-4 py-2"><PaymentStatusBadge status={row.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2">{p.paymentDate}</td>
                  <td className="px-4 py-2 font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(p.amount)}</td>
                  <td className="px-4 py-2">{p.paymentMethod}</td>
                  <td className="px-4 py-2">{p.saleInvoiceNumber || p.invoiceNumber || '—'}</td>
                  <td className="px-4 py-2"><PaymentStatusBadge status={p.status || 'COMPLETED'} /></td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-primary text-xs font-semibold hover:underline"
                        onClick={() => { setEditingPayment(p); setPayOpen(true) }}
                      >
                        <Pencil className="h-3.5 w-3.5" /> Update
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-red-600 text-xs font-semibold hover:underline"
                        onClick={async () => {
                          if (!confirm('Delete this payment? Buyer remaining receivable will increase by this amount. Buyer record stays.')) return
                          try {
                            await paymentApi.delete(p.id)
                            toast.success('Payment deleted — balance restored')
                            load()
                          } catch (err: unknown) {
                            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
                            toast.error(msg || 'Failed to delete payment')
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
        )}
      </div>

      <PaymentModal
        open={payOpen}
        onClose={() => { setPayOpen(false); setEditingPayment(null) }}
        onSuccess={load}
        type="BUYER"
        partyId={buyer.id}
        partyName={buyer.name}
        outstanding={buyer.outstandingBalance || 0}
        sales={sales}
        editingPayment={editingPayment}
      />
    </div>
  )
}

function PaymentStatusBadge({ status }: { status: string }) {
  const upper = (status || '').toUpperCase()
  const paid = upper === 'PAID' || upper === 'COMPLETED' || upper === 'SETTLED'
  const partial = upper === 'PARTIAL'
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
      paid
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
        : partial
          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
    }`}>
      {paid && <CheckCircle2 className="h-3 w-3" />}
      {paid ? 'PAID' : upper || 'PENDING'}
    </span>
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
