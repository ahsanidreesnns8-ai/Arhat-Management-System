import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Select from '../ui/Select'
import { paymentApi } from '../../services/api'
import { formatCurrency } from '../../utils/format'
import type { Payment, Sale } from '../../types'

interface PaymentModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  type: 'FARMER' | 'BUYER'
  partyId: number
  partyName: string
  /** Current remaining balance (does NOT include payment being edited) */
  outstanding: number
  sales?: Sale[]
  dheriId?: number
  /** When set, modal updates this payment and re-settles balances */
  editingPayment?: Payment | null
}

export default function PaymentModal({
  open,
  onClose,
  onSuccess,
  type,
  partyId,
  partyName,
  outstanding,
  sales = [],
  dheriId,
  editingPayment = null,
}: PaymentModalProps) {
  const isEdit = !!editingPayment

  // While editing, the old amount is already applied — max allowed = remaining + old amount
  const effectiveOutstanding = useMemo(() => {
    if (!isEdit || !editingPayment) return outstanding
    return Number(((outstanding || 0) + (editingPayment.amount || 0)).toFixed(2))
  }, [isEdit, editingPayment, outstanding])

  const unpaidSales = useMemo(() => {
    return sales.filter((s) => {
      const rem = (s.totalAmount || 0) - (s.paidAmount || 0)
      if (isEdit && editingPayment?.saleId === s.id) {
        return rem + (editingPayment.amount || 0) > 0.001
      }
      return rem > 0.001
    })
  }, [sales, isEdit, editingPayment])

  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('CASH')
  const [saleId, setSaleId] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (editingPayment) {
      setAmount(String(editingPayment.amount || ''))
      setMethod(editingPayment.paymentMethod || 'CASH')
      setSaleId(editingPayment.saleId ? String(editingPayment.saleId) : '')
      setPaymentDate(editingPayment.paymentDate || new Date().toISOString().slice(0, 10))
      setReference(editingPayment.referenceNumber || '')
      setNotes(editingPayment.notes || '')
    } else {
      setAmount(outstanding > 0 ? String(outstanding) : '')
      setMethod('CASH')
      setSaleId('')
      setPaymentDate(new Date().toISOString().slice(0, 10))
      setReference('')
      setNotes('')
    }
  }, [open, outstanding, editingPayment])

  const maxForSale = () => {
    if (!saleId) return effectiveOutstanding
    const sale = sales.find((s) => String(s.id) === saleId)
    if (!sale) return effectiveOutstanding
    let rem = (sale.totalAmount || 0) - (sale.paidAmount || 0)
    if (isEdit && editingPayment?.saleId === sale.id) {
      rem += editingPayment.amount || 0
    }
    return Math.min(effectiveOutstanding, rem)
  }

  const settleFull = () => setAmount(String(maxForSale()))

  const handleSubmit = async () => {
    const value = parseFloat(amount)
    if (!value || value <= 0) {
      toast.error('Enter a valid amount greater than zero')
      return
    }
    const max = maxForSale()
    if (value > max + 0.001) {
      toast.error(`Amount cannot exceed ${formatCurrency(max)}`)
      return
    }
    setSaving(true)
    try {
      const payload = {
        paymentType: type,
        farmerId: type === 'FARMER' ? partyId : undefined,
        buyerId: type === 'BUYER' ? partyId : undefined,
        saleId: type === 'BUYER' && saleId ? Number(saleId) : undefined,
        dheriId: dheriId || editingPayment?.dheriId || undefined,
        amount: value,
        paymentMethod: method,
        paymentDate,
        referenceNumber: reference || undefined,
        notes: notes || undefined,
      }

      if (isEdit && editingPayment) {
        await paymentApi.update(editingPayment.id, payload)
        toast.success(
          type === 'FARMER'
            ? `Updated farmer payment — remaining to pay will refresh`
            : `Updated buyer payment — remaining receivable will refresh`,
        )
      } else {
        await paymentApi.create(payload)
        toast.success(
          type === 'FARMER'
            ? `Paid ${formatCurrency(value)} to ${partyName}`
            : `Received ${formatCurrency(value)} from ${partyName}`,
        )
      }
      onSuccess()
      onClose()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || (isEdit ? 'Failed to update payment' : 'Failed to record payment'))
    } finally {
      setSaving(false)
    }
  }

  const title = isEdit
    ? (type === 'FARMER' ? `Update farmer payment — ${partyName}` : `Update buyer payment — ${partyName}`)
    : (type === 'FARMER' ? `Pay farmer — ${partyName}` : `Receive payment — ${partyName}`)

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div className="rounded-xl p-4 bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/15">
          <p className="text-sm text-gray-500">
            {isEdit ? 'Max you can set for this payment (remaining + this payment)' : 'Outstanding remaining'}
          </p>
          <p className="text-2xl font-bold text-primary">{formatCurrency(effectiveOutstanding)}</p>
          {isEdit && (
            <p className="text-xs text-gray-500 mt-1">
              Current remaining after this payment: {formatCurrency(outstanding)}. Changing amount re-settles the balance.
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={settleFull} disabled={effectiveOutstanding <= 0}>
            {type === 'FARMER' ? 'Settle full amount to pay' : 'Settle full amount to receive'}
          </Button>
        </div>

        <Input
          label="Amount (PKR) *"
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <Input
          label="Payment date"
          type="date"
          value={paymentDate}
          onChange={(e) => setPaymentDate(e.target.value)}
        />

        <Select
          label="Payment method"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          options={[
            { value: 'CASH', label: 'Cash' },
            { value: 'BANK_TRANSFER', label: 'Bank transfer' },
            { value: 'CHEQUE', label: 'Cheque' },
            { value: 'OTHER', label: 'Other' },
          ]}
        />

        {type === 'BUYER' && (unpaidSales.length > 0 || (isEdit && editingPayment?.saleId)) && (
          <Select
            label="Apply to invoice (optional)"
            value={saleId}
            onChange={(e) => {
              setSaleId(e.target.value)
              const sale = sales.find((s) => String(s.id) === e.target.value)
              if (sale) {
                let rem = (sale.totalAmount || 0) - (sale.paidAmount || 0)
                if (isEdit && editingPayment?.saleId === sale.id) rem += editingPayment.amount || 0
                setAmount(String(Math.min(effectiveOutstanding, rem)))
              }
            }}
            options={[
              { value: '', label: 'General balance (no specific invoice)' },
              ...unpaidSales.map((s) => {
                let rem = (s.totalAmount || 0) - (s.paidAmount || 0)
                if (isEdit && editingPayment?.saleId === s.id) rem += editingPayment.amount || 0
                return {
                  value: String(s.id),
                  label: `${s.invoiceNumber} — remaining ${formatCurrency(rem)}`,
                }
              }),
            ]}
          />
        )}

        <Input label="Reference / receipt #" value={reference} onChange={(e) => setReference(e.target.value)} />
        <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving} disabled={effectiveOutstanding <= 0}>
            {isEdit
              ? 'Update & settle balance'
              : type === 'FARMER'
                ? 'Record farmer payment'
                : 'Record buyer payment'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
