import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Select from '../ui/Select'
import { paymentApi } from '../../services/api'
import { formatCurrency } from '../../utils/format'
import type { Sale } from '../../types'

interface PaymentModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  type: 'FARMER' | 'BUYER'
  partyId: number
  partyName: string
  outstanding: number
  sales?: Sale[]
  dheriId?: number
}

export default function PaymentModal({
  open, onClose, onSuccess, type, partyId, partyName, outstanding, sales = [], dheriId,
}: PaymentModalProps) {
  const unpaidSales = sales.filter((s) => (s.totalAmount || 0) - (s.paidAmount || 0) > 0.001)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('CASH')
  const [saleId, setSaleId] = useState('')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setAmount(outstanding > 0 ? String(outstanding) : '')
      setMethod('CASH')
      setSaleId('')
      setReference('')
      setNotes('')
    }
  }, [open, outstanding])

  const maxForSale = () => {
    if (!saleId) return outstanding
    const sale = unpaidSales.find((s) => String(s.id) === saleId)
    if (!sale) return outstanding
    return Math.min(outstanding, (sale.totalAmount || 0) - (sale.paidAmount || 0))
  }

  const payAll = () => setAmount(String(maxForSale()))

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
      await paymentApi.create({
        paymentType: type,
        farmerId: type === 'FARMER' ? partyId : undefined,
        buyerId: type === 'BUYER' ? partyId : undefined,
        saleId: type === 'BUYER' && saleId ? Number(saleId) : undefined,
        dheriId: dheriId || undefined,
        amount: value,
        paymentMethod: method,
        paymentDate: new Date().toISOString().slice(0, 10),
        referenceNumber: reference || undefined,
        notes: notes || undefined,
      })
      toast.success(type === 'FARMER'
        ? `Paid ${formatCurrency(value)} to ${partyName}`
        : `Received ${formatCurrency(value)} from ${partyName}`)
      onSuccess()
      onClose()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Failed to record payment')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={type === 'FARMER' ? `Pay farmer — ${partyName}` : `Receive payment — ${partyName}`}
    >
      <div className="space-y-4">
        <div className="rounded-xl p-4 bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/15">
          <p className="text-sm text-gray-500">Outstanding remaining</p>
          <p className="text-2xl font-bold text-primary">{formatCurrency(outstanding)}</p>
        </div>

        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={payAll} disabled={outstanding <= 0}>
            Settle full remaining
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

        {type === 'BUYER' && unpaidSales.length > 0 && (
          <Select
            label="Apply to invoice (optional)"
            value={saleId}
            onChange={(e) => {
              setSaleId(e.target.value)
              const sale = unpaidSales.find((s) => String(s.id) === e.target.value)
              if (sale) {
                const rem = (sale.totalAmount || 0) - (sale.paidAmount || 0)
                setAmount(String(Math.min(outstanding, rem)))
              }
            }}
            options={[
              { value: '', label: 'General balance (no specific invoice)' },
              ...unpaidSales.map((s) => ({
                value: String(s.id),
                label: `${s.invoiceNumber} — remaining ${formatCurrency((s.totalAmount || 0) - (s.paidAmount || 0))}`,
              })),
            ]}
          />
        )}

        <Input label="Reference / receipt #" value={reference} onChange={(e) => setReference(e.target.value)} />
        <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving} disabled={outstanding <= 0}>
            {type === 'FARMER' ? 'Record farmer payment' : 'Record buyer payment'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
