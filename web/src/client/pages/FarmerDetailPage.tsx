import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, FileText, Pencil, Printer, Trash2, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import SettledBadge, { isPartySettled } from '../components/ui/SettledBadge'
import { TableSkeleton } from '../components/ui/Skeleton'
import PaymentModal from '../components/payments/PaymentModal'
import { farmerApi, paymentApi, registerApi } from '../services/api'
import { billErrorMessage, openHtmlBill } from '../utils/bill'
import { formatCurrency } from '../utils/format'
import { useLanguage } from '../context/LanguageContext'
import type { AccountStatement, Dheri, Farmer, Payment, Truck } from '../types'

export default function FarmerDetailPage() {
  const { t } = useLanguage()
  const { id } = useParams()
  const farmerId = Number(id)
  const [farmer, setFarmer] = useState<Farmer | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [dheris, setDheris] = useState<Dheri[]>([])
  const [trucks, setTrucks] = useState<Truck[]>([])
  const [statement, setStatement] = useState<AccountStatement | null>(null)
  const [loading, setLoading] = useState(true)
  const [payOpen, setPayOpen] = useState(false)
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null)
  const [idCashOpen, setIdCashOpen] = useState<'GIVING' | 'RECEIVING' | null>(null)
  const [idCashForm, setIdCashForm] = useState({ amount: '', notes: '' })
  const [savingIdCash, setSavingIdCash] = useState(false)
  const [balanceOpen, setBalanceOpen] = useState(false)

  const load = useCallback(() => {
    if (!farmerId) return
    setLoading(true)
    Promise.all([
      farmerApi.getById(farmerId),
      farmerApi.getPayments(farmerId).catch(() => ({ data: { data: [] } })),
      farmerApi.getDheris(farmerId).catch(() => ({ data: { data: [] } })),
      farmerApi.getTrucks(farmerId).catch(() => ({ data: { data: [] } })),
    ])
      .then(async ([f, p, d, t]) => {
        const next = f.data.data
        setFarmer(next)
        setPayments(p.data.data || [])
        setDheris(d.data.data || [])
        setTrucks(t.data.data || [])
        if (next?.farmerId) {
          try {
            const res = await registerApi.statement(next.farmerId)
            setStatement(res.data.data)
          } catch {
            setStatement(null)
          }
        }
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
  const remainingToGive = statement?.remainingToGive ?? 0
  const remainingToReceive = statement?.remainingToReceive ?? 0
  const alreadyGiven = statement?.cashGiven ?? farmer.registerGiven ?? 0
  const alreadyReceived = statement?.cashReceived ?? farmer.registerReceived ?? 0
  const productTotal = statement?.productTotal ?? totalBilled
  const totalBalanceLabel = remainingToGive > 0
    ? 'Remaining to give'
    : remainingToReceive > 0
      ? 'Remaining to receive'
      : alreadyGiven || alreadyReceived || productTotal
        ? 'Settled'
        : 'Total balance'
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
              <Button variant="secondary" onClick={() => openBill('en')}><FileText className="h-4 w-4" /> Product bill</Button>
              <Button variant="secondary" onClick={() => openBill('ur')}>پروڈکٹ بل</Button>
              <Button variant="secondary" onClick={() => setBalanceOpen(true)}>Total balance</Button>
              <Button variant="secondary" onClick={() => openBill('en')}><Printer className="h-4 w-4" /> Print product bill</Button>
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

      <button
        type="button"
        onClick={() => setBalanceOpen(true)}
        className="card-3d p-5 space-y-3 w-full text-left hover:ring-2 hover:ring-primary/30 transition"
      >
        <div>
          <p className="text-sm font-semibold">Total balance</p>
          <p className="text-sm text-slate-500 mt-1">
            Tap to see money already given or received on Arhat Register, plus product history. Generate the total-balance bill from there. Product bill stays product-only.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <MoneyCard label="Already given" value={alreadyGiven} tone={alreadyGiven > 0 ? 'warn' : 'neutral'} />
          <MoneyCard label="Already received" value={alreadyReceived} tone={alreadyReceived > 0 ? 'good' : 'neutral'} />
          <MoneyCard
            label="Remaining to give"
            value={remainingToGive}
            tone={remainingToGive > 0 ? 'warn' : 'good'}
          />
          <MoneyCard
            label="Remaining to receive"
            value={remainingToReceive}
            tone={remainingToReceive > 0 ? 'warn' : 'good'}
          />
        </div>
        <p className="text-sm font-semibold text-primary">
          {totalBalanceLabel}: {formatCurrency(remainingToGive || remainingToReceive || 0)}
        </p>
      </button>
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => {
            setIdCashForm({ amount: remainingToGive > 0 ? String(remainingToGive) : '', notes: '' })
            setIdCashOpen('GIVING')
          }}
        >
          <Wallet className="h-4 w-4" /> Give on this ID
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setIdCashForm({ amount: remainingToReceive > 0 ? String(remainingToReceive) : '', notes: '' })
            setIdCashOpen('RECEIVING')
          }}
        >
          Receive on this ID
        </Button>
        <Button variant="secondary" onClick={() => setBalanceOpen(true)}>
          <FileText className="h-4 w-4" /> Open total balance
        </Button>
      </div>

      <div className="card-3d p-5">
        <p className="text-sm text-gray-500">Father / address</p>
        <p className="mt-1 font-medium">{farmer.fatherName || '—'}</p>
        <p className="text-sm text-gray-500">{[farmer.address, farmer.city].filter(Boolean).join(', ') || ''}</p>
        {farmer.notes ? <p className="mt-2 text-sm text-gray-500">{farmer.notes}</p> : null}
        <p className="mt-2 text-sm text-slate-500">
          Generate bill here or from Farmer Product prints these dheris only (product calculation). Tap Total balance for Arhat Register given/received plus product history.
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

      <Modal
        open={balanceOpen}
        onClose={() => setBalanceOpen(false)}
        title={`Total balance · ${farmer.name}`}
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Already given or received on Arhat Register is included here with product. This is not the product bill.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <MoneyCard label="Already given" value={alreadyGiven} tone={alreadyGiven > 0 ? 'warn' : 'neutral'} />
            <MoneyCard label="Already received" value={alreadyReceived} tone={alreadyReceived > 0 ? 'good' : 'neutral'} />
            <MoneyCard label="Product in" value={productTotal} tone="neutral" />
            <MoneyCard
              label={totalBalanceLabel}
              value={remainingToGive || remainingToReceive || 0}
              tone={(remainingToGive || remainingToReceive) ? 'warn' : 'good'}
            />
          </div>
          {statement?.lines?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-100 dark:border-white/10">
                    <th className="px-2 py-2">Particular</th>
                    <th className="px-2 py-2 text-right">Added</th>
                    <th className="px-2 py-2 text-right">Deducted</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.lines.map((row, index) => (
                    <tr key={`${row.kind}-${index}`} className="border-b border-slate-50 dark:border-white/5">
                      <td className="px-2 py-2">{row.particular}</td>
                      <td className="px-2 py-2 text-right">{row.addition ? formatCurrency(row.addition) : '—'}</td>
                      <td className="px-2 py-2 text-right">{row.deduction ? formatCurrency(row.deduction) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No register or product lines yet for this person.</p>
          )}
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setBalanceOpen(false)}>Close</Button>
            <Button variant="secondary" onClick={() => void openBalance('ur')}>Total balance bill (UR)</Button>
            <Button onClick={() => void openBalance('en')}>
              <FileText className="h-4 w-4" /> Generate total balance bill
            </Button>
          </div>
        </div>
      </Modal>

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

      <Modal
        open={!!idCashOpen}
        onClose={() => setIdCashOpen(null)}
        title={idCashOpen === 'RECEIVING' ? `Receive on ID ${farmer.farmerId}` : `Give on ID ${farmer.farmerId}`}
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            {idCashOpen === 'RECEIVING'
              ? `Record money received from ${farmer.name} (${farmer.farmerId}). Product bill is not changed.`
              : `Record money given to ${farmer.name} (${farmer.farmerId}). Product bill is not changed.`}
          </p>
          <Input
            label="Amount (PKR) *"
            type="number"
            min="0"
            value={idCashForm.amount}
            onChange={(e) => setIdCashForm({ ...idCashForm, amount: e.target.value })}
          />
          <Input
            label="Note (optional)"
            value={idCashForm.notes}
            onChange={(e) => setIdCashForm({ ...idCashForm, notes: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setIdCashOpen(null)}>Cancel</Button>
            <Button
              loading={savingIdCash}
              onClick={async () => {
                const amount = Number(idCashForm.amount)
                if (!idCashOpen || !amount || amount <= 0) {
                  toast.error('Enter the amount')
                  return
                }
                setSavingIdCash(true)
                try {
                  await registerApi.adjust({
                    key: farmer.farmerId,
                    kind: idCashOpen,
                    amount,
                    notes: idCashForm.notes.trim() || undefined,
                    farmerId: farmer.id,
                  })
                  toast.success(idCashOpen === 'RECEIVING' ? 'Received on this farmer ID' : 'Given on this farmer ID')
                  setIdCashOpen(null)
                  load()
                } catch (err: unknown) {
                  const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
                  toast.error(msg || 'Could not save amount')
                } finally {
                  setSavingIdCash(false)
                }
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </Modal>
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
