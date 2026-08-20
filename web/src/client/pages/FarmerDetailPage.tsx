import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, FileText, Pencil, Printer, Trash2, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import SettledBadge, { isPartySettled } from '../components/ui/SettledBadge'
import { TableSkeleton } from '../components/ui/Skeleton'
import PaymentModal from '../components/payments/PaymentModal'
import { farmerApi, paymentApi } from '../services/api'
import { billErrorMessage, openHtmlBill } from '../utils/bill'
import { formatCurrency } from '../utils/format'
import { useLanguage } from '../context/LanguageContext'
import type { Dheri, Farmer, Payment, Truck } from '../types'

export default function FarmerDetailPage() {
  const { t } = useLanguage()
  const { id } = useParams()
  const farmerId = Number(id)
  const [farmer, setFarmer] = useState<Farmer | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [dheris, setDheris] = useState<Dheri[]>([])
  const [trucks, setTrucks] = useState<Truck[]>([])
  const [loading, setLoading] = useState(true)
  const [payOpen, setPayOpen] = useState(false)
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null)

  const load = useCallback(() => {
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

  useEffect(() => { load() }, [load])

  const openBill = async (lang: 'en' | 'ur' = 'en') => {
    try {
      const res = await farmerApi.getBillHtml(farmerId, lang)
      openHtmlBill(typeof res.data === 'string' ? res.data : String(res.data), `Farmer Bill ${farmer?.farmerId || farmerId}`)
    } catch (err) {
      toast.error(billErrorMessage(err, 'Could not generate farmer bill'))
    }
  }

  const openBalance = async (lang: 'en' | 'ur' = 'en') => {
    try {
      const res = await farmerApi.getBalanceHtml(farmerId, lang)
      openHtmlBill(typeof res.data === 'string' ? res.data : String(res.data), `Balance ${farmer?.farmerId || farmerId}`)
    } catch (err) {
      toast.error(billErrorMessage(err, 'Could not generate balance'))
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

  const totalBilled = farmer.totalBilled ?? dheris.reduce((s, d) => s + (d.farmerReceivable || 0), 0)
  const totalPaid = farmer.totalPaid ?? payments.reduce((s, p) => s + (p.amount || 0), 0)
  const remainingToPay = Math.max(0, totalBilled - totalPaid)
  const settled = isPartySettled({
    outstandingBalance: remainingToPay,
    totalBilled,
    totalPaid,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/farmers" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><ArrowLeft className="h-5 w-5" /></Link>
        <PageHeader
          title={farmer.name}
          description={`${farmer.farmerId}${settled ? ' · Fully paid — record kept' : ''}`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <SettledBadge settled={settled} label="Paid in full" />
              <Button
                onClick={() => { setEditingPayment(null); setPayOpen(true) }}
                disabled={(remainingToPay || 0) <= 0}
                title={settled ? 'Already paid — history is kept' : 'Pay farmer'}
              >
                {settled ? <CheckCircle2 className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
                {settled ? 'Paid' : 'Pay / Settle remaining'}
              </Button>
              <Button variant="secondary" onClick={() => openBill('en')}><FileText className="h-4 w-4" /> Product bill (EN)</Button>
              <Button variant="secondary" onClick={() => openBill('ur')}><FileText className="h-4 w-4" /> پروڈکٹ بل</Button>
              <Button variant="secondary" onClick={() => void openBalance()}>Balance</Button>
              <Button variant="secondary" onClick={() => openBill('en')}><Printer className="h-4 w-4" /> Print</Button>
            </div>
          }
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MoneyCard label="Total payable (products)" value={totalBilled} tone="neutral" />
        <MoneyCard label="Amount paid to farmer" value={totalPaid} tone="good" />
        <MoneyCard
          label="Remaining to pay (products)"
          value={remainingToPay}
          tone={settled ? 'good' : 'warn'}
        />
      </div>
      <div className="card-3d p-5">
        <p className="text-sm text-gray-500">Father / address</p>
        <p className="mt-1 font-medium">{farmer.fatherName || '—'}</p>
        <p className="text-sm text-gray-500">{[farmer.address, farmer.city].filter(Boolean).join(', ') || ''}</p>
        {farmer.notes ? <p className="mt-2 text-sm text-gray-500">{farmer.notes}</p> : null}
        <p className="mt-2 text-sm text-slate-500">
          This page is farmer product only. Arhat Register cash is not mixed here.
          Product bill prints these dheris. Balance prints product plus register given / received for ID {farmer.farmerId}.
        </p>
        {settled && (
          <p className="mt-3 text-xs text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> Settled — kept in records
          </p>
        )}
      </div>

      <Section title="Dheri / product history" empty="No dheris" headers={['Dheri', 'Product', t('bags'), 'Farmer amount', 'Status']}>
        {dheris.map((d) => (
          <tr key={d.id}>
            <td className="px-4 py-2"><Link className="text-primary" to={`/dheris/${d.id}`}>{d.dheriId}</Link></td>
            <td className="px-4 py-2">{d.productName}</td>
            <td className="px-4 py-2">{d.numberOfBags}</td>
            <td className="px-4 py-2 font-medium">{formatCurrency(d.farmerReceivable)}</td>
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

      <Section title="Payments made to farmer" empty="No payments yet" headers={['Date', 'Amount paid', 'Method', 'Status', 'Actions']}>
        {payments.map((p) => (
          <tr key={p.id}>
            <td className="px-4 py-2">{p.paymentDate}</td>
            <td className="px-4 py-2 font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(p.amount)}</td>
            <td className="px-4 py-2">{p.paymentMethod}</td>
            <td className="px-4 py-2">{p.status}</td>
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
                    if (!confirm('Delete this payment? Farmer remaining to pay will increase by this amount.')) return
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
      </Section>

      <PaymentModal
        open={payOpen}
        onClose={() => { setPayOpen(false); setEditingPayment(null) }}
        onSuccess={load}
        type="FARMER"
        partyId={farmer.id}
        partyName={farmer.name}
        outstanding={remainingToPay}
        editingPayment={editingPayment}
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
    <div className="card-3d overflow-hidden">
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
