import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, Pencil, Plus, Search, Trash2, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { TableSkeleton } from '../components/ui/Skeleton'
import PaymentModal from '../components/payments/PaymentModal'
import { useLiveReload } from '../context/SyncContext'
import { buyerApi, farmerApi, paymentApi } from '../services/api'
import { formatCurrency, formatDateTime } from '../utils/format'
import type { Buyer, Farmer, Payment, Sale } from '../types'

type TypeFilter = 'ALL' | 'FARMER' | 'BUYER'
type PayFlow = {
  type: 'FARMER' | 'BUYER'
  partyId: number
  partyName: string
  outstanding: number
  sales: Sale[]
  editingPayment?: Payment | null
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [farmers, setFarmers] = useState<Farmer[]>([])
  const [buyers, setBuyers] = useState<Buyer[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL')
  const [search, setSearch] = useState('')

  const [payFlow, setPayFlow] = useState<PayFlow | null>(null)
  const [payOpen, setPayOpen] = useState(false)

  const [viewPayment, setViewPayment] = useState<Payment | null>(null)
  const [viewLoading, setViewLoading] = useState(false)

  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [newOpen, setNewOpen] = useState(false)
  const [newType, setNewType] = useState<'FARMER' | 'BUYER'>('BUYER')
  const [newPartyId, setNewPartyId] = useState('')
  const [startingPay, setStartingPay] = useState(false)

  const load = useCallback((soft = false) => {
    if (!soft) setLoading(true)
    const req = dateFilter ? paymentApi.getByDate(dateFilter) : paymentApi.getAll()
    req
      .then((res) => setPayments(res.data?.data || []))
      .catch(() => {
        if (!soft) {
          setPayments([])
          toast.error('Failed to load payments')
        }
      })
      .finally(() => { if (!soft) setLoading(false) })
  }, [dateFilter])

  const loadParties = useCallback(() => {
    Promise.allSettled([farmerApi.getAll(), buyerApi.getAll()]).then(([f, b]) => {
      if (f.status === 'fulfilled') setFarmers(f.value.data?.data ?? [])
      if (b.status === 'fulfilled') setBuyers(b.value.data?.data ?? [])
    })
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadParties() }, [loadParties])
  useLiveReload(() => {
    load(true)
    loadParties()
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return payments.filter((p) => {
      if (typeFilter !== 'ALL' && p.paymentType !== typeFilter) return false
      if (!q) return true
      return (
        (p.farmerName || '').toLowerCase().includes(q)
        || (p.buyerName || '').toLowerCase().includes(q)
        || (p.dheriCode || '').toLowerCase().includes(q)
        || (p.saleInvoiceNumber || p.invoiceNumber || '').toLowerCase().includes(q)
        || (p.referenceNumber || '').toLowerCase().includes(q)
        || (p.notes || '').toLowerCase().includes(q)
        || String(p.amount || '').includes(q)
      )
    })
  }, [payments, typeFilter, search])

  const openView = async (p: Payment) => {
    setViewLoading(true)
    setViewPayment(p)
    try {
      const res = await paymentApi.getById(p.id)
      setViewPayment(res.data.data)
    } catch {
      // keep list row data
      toast.error('Could not refresh payment details')
    } finally {
      setViewLoading(false)
    }
  }

  const openEdit = async (p: Payment) => {
    try {
      if (p.paymentType === 'FARMER' && p.farmerId) {
        const f = await farmerApi.getById(p.farmerId)
        setPayFlow({
          type: 'FARMER',
          partyId: p.farmerId,
          partyName: p.farmerName || f.data.data.name,
          outstanding: f.data.data.outstandingBalance || 0,
          sales: [],
          editingPayment: p,
        })
      } else if (p.buyerId) {
        const [b, s] = await Promise.all([
          buyerApi.getById(p.buyerId),
          buyerApi.getSales(p.buyerId).catch(() => ({ data: { data: [] as Sale[] } })),
        ])
        setPayFlow({
          type: 'BUYER',
          partyId: p.buyerId,
          partyName: p.buyerName || b.data.data.name,
          outstanding: b.data.data.outstandingBalance || 0,
          sales: s.data.data || [],
          editingPayment: p,
        })
      } else {
        toast.error('Payment has no linked farmer/buyer')
        return
      }
      setPayOpen(true)
    } catch {
      toast.error('Could not load party balance for update')
    }
  }

  const openNewPayment = async () => {
    if (!newPartyId) {
      toast.error('Select a farmer or buyer first')
      return
    }
    setStartingPay(true)
    try {
      const id = Number(newPartyId)
      if (newType === 'FARMER') {
        const f = await farmerApi.getById(id)
        const outstanding = f.data.data.outstandingBalance || 0
        if (outstanding <= 0) {
          toast.error('This farmer has nothing outstanding to pay')
          return
        }
        setPayFlow({
          type: 'FARMER',
          partyId: id,
          partyName: f.data.data.name,
          outstanding,
          sales: [],
          editingPayment: null,
        })
      } else {
        const [b, s] = await Promise.all([
          buyerApi.getById(id),
          buyerApi.getSales(id).catch(() => ({ data: { data: [] as Sale[] } })),
        ])
        const outstanding = b.data.data.outstandingBalance || 0
        if (outstanding <= 0) {
          toast.error('This buyer has nothing outstanding to receive')
          return
        }
        setPayFlow({
          type: 'BUYER',
          partyId: id,
          partyName: b.data.data.name,
          outstanding,
          sales: s.data.data || [],
          editingPayment: null,
        })
      }
      setNewOpen(false)
      setPayOpen(true)
    } catch {
      toast.error('Could not start payment')
    } finally {
      setStartingPay(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await paymentApi.delete(deleteId)
      toast.success('Payment deleted — balance restored')
      setDeleteId(null)
      load()
      loadParties()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Failed to delete payment')
    } finally {
      setDeleting(false)
    }
  }

  const partyOptions = newType === 'FARMER'
    ? farmers
      .filter((f) => (f.outstandingBalance || 0) > 0)
      .map((f) => ({
        value: String(f.id),
        label: `${f.name} (${f.farmerId}) — due ${formatCurrency(f.outstandingBalance || 0)}`,
      }))
    : buyers
      .filter((b) => (b.outstandingBalance || 0) > 0)
      .map((b) => ({
        value: String(b.id),
        label: `${b.name} (${b.buyerId}) — due ${formatCurrency(b.outstandingBalance || 0)}`,
      }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment Records"
        description="View, update, delete, and record farmer/buyer payments with balance settlement"
        action={
          <Button onClick={() => { setNewType('BUYER'); setNewPartyId(''); setNewOpen(true) }}>
            <Plus className="h-4 w-4" /> Record payment
          </Button>
        }
      />

      <div className="card-3d p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative sm:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            className="input pl-10 w-full"
            placeholder="Search party, invoice, dheri, notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          label="Type"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
          options={[
            { value: 'ALL', label: 'All payments' },
            { value: 'FARMER', label: 'Paid to farmer' },
            { value: 'BUYER', label: 'Received from buyer' },
          ]}
        />
        <div>
          <Input
            label="Filter by date"
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
          {dateFilter && (
            <button type="button" className="text-sm text-primary mt-1" onClick={() => setDateFilter('')}>
              Show all dates
            </button>
          )}
        </div>
      </div>

      <div className="card-3d overflow-hidden">
        {loading ? (
          <div className="p-6"><TableSkeleton /></div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            <Wallet className="h-8 w-8 mx-auto mb-3 opacity-40" />
            {dateFilter || search || typeFilter !== 'ALL'
              ? 'No payments match your filters.'
              : 'No payments recorded yet. Click “Record payment” or use farmer/buyer Pay buttons.'}
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
                {filtered.map((p) => (
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
                        <Link className="text-primary hover:underline" to={`/farmers/${p.farmerId}`}>{p.farmerName}</Link>
                      ) : p.buyerId ? (
                        <Link className="text-primary hover:underline" to={`/buyers/${p.buyerId}`}>{p.buyerName}</Link>
                      ) : '—'}
                    </td>
                    <td className="p-4">
                      {p.dheriId ? (
                        <Link className="text-primary font-mono hover:underline" to={`/dheris/${p.dheriId}`}>
                          {p.dheriCode || `#${p.dheriId}`}
                        </Link>
                      ) : '—'}
                    </td>
                    <td className="p-4 text-right font-semibold">{formatCurrency(p.amount)}</td>
                    <td className="p-4">{p.paymentMethod?.replace('_', ' ')}</td>
                    <td className="p-4">
                      {p.saleId ? (
                        <Link className="text-primary hover:underline" to={`/sales/${p.saleId}`}>
                          {p.saleInvoiceNumber || p.invoiceNumber || `#${p.saleId}`}
                        </Link>
                      ) : '—'}
                    </td>
                    <td className="p-4">{p.status}</td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:underline"
                          onClick={() => openView(p)}
                        >
                          <Eye className="h-3.5 w-3.5" /> View
                        </button>
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
                          onClick={() => setDeleteId(p.id)}
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

      {/* View details */}
      <Modal
        open={!!viewPayment}
        onClose={() => setViewPayment(null)}
        title="Payment details"
        size="lg"
      >
        {viewPayment && (
          <div className="space-y-4">
            {viewLoading && <p className="text-sm text-gray-500">Refreshing…</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <Detail label="Date" value={viewPayment.paymentDate} />
              <Detail
                label="Type"
                value={viewPayment.paymentType === 'FARMER' ? 'Paid to farmer' : 'Received from buyer'}
              />
              <Detail label="Amount" value={formatCurrency(viewPayment.amount)} />
              <Detail label="Method" value={viewPayment.paymentMethod?.replace('_', ' ') || '—'} />
              <Detail label="Status" value={viewPayment.status || '—'} />
              <Detail label="Reference" value={viewPayment.referenceNumber || '—'} />
              <div>
                <p className="text-gray-500">Party</p>
                <p className="font-semibold mt-0.5">
                  {viewPayment.paymentType === 'FARMER' && viewPayment.farmerId ? (
                    <Link className="text-primary" to={`/farmers/${viewPayment.farmerId}`} onClick={() => setViewPayment(null)}>
                      {viewPayment.farmerName}
                    </Link>
                  ) : viewPayment.buyerId ? (
                    <Link className="text-primary" to={`/buyers/${viewPayment.buyerId}`} onClick={() => setViewPayment(null)}>
                      {viewPayment.buyerName}
                    </Link>
                  ) : '—'}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Invoice</p>
                <p className="font-semibold mt-0.5">
                  {viewPayment.saleId ? (
                    <Link className="text-primary" to={`/sales/${viewPayment.saleId}`} onClick={() => setViewPayment(null)}>
                      {viewPayment.saleInvoiceNumber || viewPayment.invoiceNumber || `#${viewPayment.saleId}`}
                    </Link>
                  ) : '—'}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Dheri</p>
                <p className="font-semibold mt-0.5">
                  {viewPayment.dheriId ? (
                    <Link className="text-primary" to={`/dheris/${viewPayment.dheriId}`} onClick={() => setViewPayment(null)}>
                      {viewPayment.dheriCode || `#${viewPayment.dheriId}`}
                    </Link>
                  ) : '—'}
                </p>
              </div>
              <Detail label="Created" value={formatDateTime(viewPayment.createdAt)} />
            </div>
            {viewPayment.notes && (
              <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3 text-sm">
                <p className="text-gray-500 mb-1">Notes</p>
                <p>{viewPayment.notes}</p>
              </div>
            )}
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setViewPayment(null)}>Close</Button>
              <Button
                variant="secondary"
                onClick={() => {
                  const p = viewPayment
                  setViewPayment(null)
                  void openEdit(p)
                }}
              >
                <Pencil className="h-4 w-4" /> Update
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  setDeleteId(viewPayment.id)
                  setViewPayment(null)
                }}
              >
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* New payment party picker */}
      <Modal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        title="Record payment"
      >
        <div className="space-y-4">
          <Select
            label="Payment type"
            value={newType}
            onChange={(e) => {
              setNewType(e.target.value as 'FARMER' | 'BUYER')
              setNewPartyId('')
            }}
            options={[
              { value: 'BUYER', label: 'Receive from buyer' },
              { value: 'FARMER', label: 'Pay farmer' },
            ]}
          />
          <Select
            label={newType === 'FARMER' ? 'Farmer (with outstanding)' : 'Buyer (with outstanding)'}
            value={newPartyId}
            onChange={(e) => setNewPartyId(e.target.value)}
            options={[
              { value: '', label: partyOptions.length ? 'Select…' : 'No parties with outstanding balance' },
              ...partyOptions,
            ]}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button onClick={openNewPayment} loading={startingPay} disabled={!newPartyId}>
              Continue
            </Button>
          </div>
        </div>
      </Modal>

      {payFlow && (
        <PaymentModal
          open={payOpen}
          onClose={() => { setPayOpen(false); setPayFlow(null) }}
          onSuccess={() => { load(); loadParties() }}
          type={payFlow.type}
          partyId={payFlow.partyId}
          partyName={payFlow.partyName}
          outstanding={payFlow.outstanding}
          sales={payFlow.sales}
          editingPayment={payFlow.editingPayment || null}
        />
      )}

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        title="Delete payment?"
        message="This removes the payment and restores the farmer/buyer outstanding balance (and invoice paid amount if linked)."
        confirmLabel="Delete payment"
        loading={deleting}
      />
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-gray-500">{label}</p>
      <p className="font-semibold mt-0.5">{value || '—'}</p>
    </div>
  )
}
