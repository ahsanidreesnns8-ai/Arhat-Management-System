import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil, Trash2, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { TableSkeleton } from '../components/ui/Skeleton'
import PaymentModal from '../components/payments/PaymentModal'
import { dheriApi, farmerApi, paymentApi } from '../services/api'
import { formatCurrency, formatNumber } from '../utils/format'
import { useLanguage } from '../context/LanguageContext'
import type { Dheri, Payment } from '../types'

export default function DheriDetailPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { id } = useParams()
  const dheriId = Number(id)
  const [dheri, setDheri] = useState<Dheri | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [farmerOutstanding, setFarmerOutstanding] = useState(0)
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState('')
  const [payOpen, setPayOpen] = useState(false)
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState({
    numberOfBags: '',
    weightPerBag: '',
    partialBagWeight: '',
    marketRate: '',
    notes: '',
  })

  const load = useCallback(() => {
    if (!dheriId) return
    setLoading(true)
    Promise.all([
      dheriApi.getById(dheriId),
      paymentApi.getByDheri(dheriId, dateFilter || undefined).catch(() => ({ data: { data: [] } })),
    ])
      .then(async ([d, p]) => {
        setDheri(d.data.data)
        setPayments(p.data.data || [])
        try {
          const f = await farmerApi.getById(d.data.data.farmerId)
          setFarmerOutstanding(f.data.data.outstandingBalance || 0)
        } catch {
          setFarmerOutstanding(0)
        }
      })
      .catch(() => toast.error('Dheri not found'))
      .finally(() => setLoading(false))
  }, [dheriId, dateFilter])

  useEffect(() => { load() }, [load])

  const openEdit = () => {
    if (!dheri) return
    setEditForm({
      numberOfBags: String(dheri.numberOfBags || 0),
      weightPerBag: String(dheri.weightPerBag || 40),
      partialBagWeight: String(dheri.partialBagWeight || 0),
      marketRate: String(dheri.marketRate || 0),
      notes: dheri.notes || '',
    })
    setEditOpen(true)
  }

  const saveEdit = async () => {
    if (!dheri) return
    setSaving(true)
    try {
      const res = await dheriApi.update(dheri.id, {
        numberOfBags: Number(editForm.numberOfBags) || 0,
        weightPerBag: Number(editForm.weightPerBag) || 40,
        partialBagWeight: Number(editForm.partialBagWeight) || 0,
        marketRate: Number(editForm.marketRate) || 0,
        notes: editForm.notes,
      })
      setDheri(res.data.data)
      setEditOpen(false)
      toast.success('Dheri updated')
      load()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!dheri) return
    setSaving(true)
    try {
      await dheriApi.delete(dheri.id)
      toast.success('Deleted')
      navigate('/dheris')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Could not delete')
    } finally {
      setSaving(false)
    }
  }

  if (loading && !dheri) return <TableSkeleton rows={5} />
  if (!dheri) return <p className="text-gray-500">Dheri not found.</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/dheris" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><ArrowLeft className="h-5 w-5" /></Link>
        <PageHeader
          title={dheri.dheriId}
          description={`${dheri.productName} · ${dheri.sellingStatus}${dheri.payablePosted ? ' · payable posted' : ''}`}
          action={
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={openEdit}>
                <Pencil className="h-4 w-4" /> Edit
              </Button>
              <Button variant="danger" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
              <Button onClick={() => setPayOpen(true)} disabled={farmerOutstanding <= 0}>
                <Wallet className="h-4 w-4" /> Pay farmer for this dheri
              </Button>
            </div>
          }
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label={t('bags')} value={String(dheri.numberOfBags)} />
        <Stat label="Total weight" value={`${formatNumber(dheri.totalWeight)} kg`} />
        <Stat label="Total price" value={formatCurrency(dheri.totalPrice)} />
        <Stat label="Farmer receivable" value={formatCurrency(dheri.farmerReceivable)} />
      </div>

      <div className="card-3d p-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
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
          <p className="font-medium">Arhat Head {formatCurrency(dheri.arhatShare)} · Paledari Head {formatCurrency(dheri.supervisorShare)} · Tolai Head {formatCurrency(dheri.laborShare)}</p>
        </div>
      </div>

      <div className="card-3d overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold">Payment records for this dheri</h3>
          <div className="flex items-center gap-2">
            <Input
              label=""
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-44"
            />
            {dateFilter && (
              <button type="button" className="text-sm text-primary" onClick={() => setDateFilter('')}>
                Clear date
              </button>
            )}
          </div>
        </div>
        {payments.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">
            {dateFilter ? `No payments on ${dateFilter} for this dheri.` : 'No payments linked to this dheri yet.'}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-left">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Amount</th>
                <th className="px-4 py-2">Method</th>
                <th className="px-4 py-2">Notes</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2 font-medium">{p.paymentDate}</td>
                  <td className="px-4 py-2">{p.paymentType === 'FARMER' ? 'Paid to farmer' : 'Received from buyer'}</td>
                  <td className="px-4 py-2 text-emerald-700 dark:text-emerald-300 font-semibold">{formatCurrency(p.amount)}</td>
                  <td className="px-4 py-2">{p.paymentMethod}</td>
                  <td className="px-4 py-2 text-gray-500">{p.notes || '—'}</td>
                  <td className="px-4 py-2">
                    {p.paymentType === 'FARMER' && (
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
                            if (!confirm('Delete this payment?')) return
                            try {
                              await paymentApi.delete(p.id)
                              toast.success('Payment deleted')
                              load()
                            } catch (err: unknown) {
                              const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
                              toast.error(msg || 'Could not delete')
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      </div>
                    )}
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
        type="FARMER"
        partyId={dheri.farmerId}
        partyName={dheri.farmerName}
        outstanding={farmerOutstanding}
        dheriId={dheri.id}
        editingPayment={editingPayment}
      />

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit dheri">
        <div className="space-y-3">
          <Input label={t('bags')} type="number" value={editForm.numberOfBags} onChange={(e) => setEditForm({ ...editForm, numberOfBags: e.target.value })} />
          <Input label="Weight per bag" type="number" value={editForm.weightPerBag} onChange={(e) => setEditForm({ ...editForm, weightPerBag: e.target.value })} />
          <Input label="Extra KG" type="number" value={editForm.partialBagWeight} onChange={(e) => setEditForm({ ...editForm, partialBagWeight: e.target.value })} />
          <Input label="Rate / 40kg" type="number" value={editForm.marketRate} onChange={(e) => setEditForm({ ...editForm, marketRate: e.target.value })} />
          <Input label="Notes" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={() => void saveEdit()}>Save</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => void confirmDelete()}
        title="Delete this dheri?"
        message="The dheri will be removed."
        confirmLabel="Delete"
        loading={saving}
      />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-3d p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-semibold mt-1">{value}</p>
    </div>
  )
}
