import { useState } from 'react'
import { Landmark, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Modal from '../ui/Modal'
import { formatCurrency } from '../../utils/format'
import type { KhataHead, KhataTreasuryLine } from '../../types'

function cropLabel(crop: string) {
  if (crop === 'wheat') return 'Wheat'
  if (crop === 'barley') return 'Barley'
  if (crop === 'maize') return 'Maize'
  if (crop === 'paddy') return 'Paddy'
  if (crop === 'other') return 'Others'
  return crop
}

function apiMessage(err: unknown, fallback: string) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback
}

export default function KhataTreasuryPanel({
  inHand,
  banks,
  transfers,
  saving,
  loadHeads,
  onAddBank,
  onTransfer,
}: {
  inHand: number
  banks: KhataTreasuryLine[]
  transfers: KhataTreasuryLine[]
  saving: boolean
  loadHeads: () => Promise<KhataHead[]>
  onAddBank: (input: { bankName: string; amount: number; notes?: string }) => Promise<void>
  onTransfer: (input: { bookType: string; bookRef: string; amount: number; notes?: string }) => Promise<void>
}) {
  const [bankOpen, setBankOpen] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)
  const [heads, setHeads] = useState<KhataHead[]>([])
  const [bankForm, setBankForm] = useState({ bankName: '', amount: '', notes: '' })
  const [sendForm, setSendForm] = useState({ head: '', amount: '', notes: '' })

  const openBank = () => {
    setBankForm({ bankName: '', amount: '', notes: '' })
    setBankOpen(true)
  }

  const openSend = async () => {
    try {
      const list = await loadHeads()
      setHeads(list)
      setSendForm({ head: list[0] ? `${list[0].bookType}:${list[0].bookRef}` : '', amount: '', notes: '' })
      setSendOpen(true)
    } catch (err) {
      toast.error(apiMessage(err, 'Could not load khata heads'))
    }
  }

  const saveBank = async () => {
    const amount = Number(bankForm.amount)
    if (!bankForm.bankName.trim()) {
      toast.error('Enter the bank name')
      return
    }
    if (!amount || amount <= 0) {
      toast.error('Enter the amount')
      return
    }
    try {
      await onAddBank({
        bankName: bankForm.bankName.trim(),
        amount,
        notes: bankForm.notes.trim() || undefined,
      })
      toast.success('Amount saved in bank')
      setBankOpen(false)
    } catch (err) {
      toast.error(apiMessage(err, 'Could not save bank amount'))
    }
  }

  const saveSend = async () => {
    const amount = Number(sendForm.amount)
    const [bookType, ...rest] = sendForm.head.split(':')
    const bookRef = rest.join(':')
    if (!bookType || !bookRef) {
      toast.error('Choose a khata head')
      return
    }
    if (!amount || amount <= 0) {
      toast.error('Enter the amount')
      return
    }
    try {
      await onTransfer({
        bookType,
        bookRef,
        amount,
        notes: sendForm.notes.trim() || undefined,
      })
      toast.success('Amount sent. This is borrowed money on the other khata.')
      setSendOpen(false)
    } catch (err) {
      toast.error(apiMessage(err, 'Could not send amount'))
    }
  }

  const bankRows = banks.filter((row) => row.kind === 'BANK')
  const moveRows = transfers.filter((row) => row.kind === 'TRANSFER_IN' || row.kind === 'TRANSFER_OUT')

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={openBank}>
          <Landmark className="h-4 w-4" /> Add money in bank
        </Button>
        <Button variant="secondary" onClick={() => void openSend()}>
          <Send className="h-4 w-4" /> Give money to another khata
        </Button>
      </div>

      <div className="card-3d overflow-hidden">
        <div className="px-5 py-3 bg-[#002D62] text-white font-semibold flex items-center gap-2">
          <Landmark className="h-4 w-4 text-[#C5A059]" />
          Money in bank
        </div>
        {!bankRows.length ? (
          <p className="p-5 text-sm text-slate-500">
            No bank amount yet. Amount in hand is {formatCurrency(inHand)}. Tap Add money in bank to park cash here. Bank money stays in this khata.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100 dark:border-white/10">
                  <th className="px-4 py-2">Day</th>
                  <th className="px-4 py-2">Bank</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="px-4 py-2">Note</th>
                </tr>
              </thead>
              <tbody>
                {bankRows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 dark:border-white/10">
                    <td className="px-4 py-2">{row.day} · {row.date} · {row.time}</td>
                    <td className="px-4 py-2 font-medium">{row.bankName || '—'}</td>
                    <td className="px-4 py-2 text-right font-semibold">{formatCurrency(row.amount)}</td>
                    <td className="px-4 py-2 text-slate-500">{row.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card-3d overflow-hidden">
        <div className="px-5 py-3 bg-[#002D62] text-white font-semibold flex items-center gap-2">
          <Send className="h-4 w-4 text-[#C5A059]" />
          Borrowed between khatas
        </div>
        {!moveRows.length ? (
          <p className="p-5 text-sm text-slate-500">
            No borrowed money yet. Give money to another khata deducts from amount in hand here and adds it as borrowed money on that head.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100 dark:border-white/10">
                  <th className="px-4 py-2">Day</th>
                  <th className="px-4 py-2">Side</th>
                  <th className="px-4 py-2">Head</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="px-4 py-2">Note</th>
                </tr>
              </thead>
              <tbody>
                {moveRows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 dark:border-white/10">
                    <td className="px-4 py-2">{row.day} · {row.date} · {row.time}</td>
                    <td className="px-4 py-2">
                      {row.kind === 'TRANSFER_OUT' ? 'Given (borrowed out)' : 'Received (borrowed in)'}
                    </td>
                    <td className="px-4 py-2">{row.counterName || '—'}</td>
                    <td className="px-4 py-2 text-right font-semibold">{formatCurrency(row.amount)}</td>
                    <td className="px-4 py-2 text-slate-500">{row.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={bankOpen} onClose={() => setBankOpen(false)} title="Add money in bank">
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            Bank money stays in this khata. Amount in hand is {formatCurrency(inHand)}. Put that or less in the bank.
          </p>
          <Input
            label="Bank name *"
            value={bankForm.bankName}
            onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })}
            placeholder="HBL, Meezan, cash at bank…"
          />
          <Input
            label="Amount (PKR) *"
            type="number"
            min="0"
            value={bankForm.amount}
            onChange={(e) => setBankForm({ ...bankForm, amount: e.target.value })}
          />
          <Input
            label="Note (optional)"
            value={bankForm.notes}
            onChange={(e) => setBankForm({ ...bankForm, notes: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setBankOpen(false)}>Cancel</Button>
            <Button onClick={() => void saveBank()} loading={saving}>Save in bank</Button>
          </div>
        </div>
      </Modal>

      <Modal open={sendOpen} onClose={() => setSendOpen(false)} title="Give money to another khata">
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            Amount in hand is {formatCurrency(inHand)}. Send that or less. It is deducted here and added as borrowed money on the other head. Shop Arhat Amount stays the same because both sides are recorded.
          </p>
          <label className="space-y-1.5 block">
            <span className="block text-sm font-medium">Head name *</span>
            <select
              className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2.5"
              value={sendForm.head}
              onChange={(e) => setSendForm({ ...sendForm, head: e.target.value })}
            >
              <option value="">Choose khata</option>
              {heads.map((head) => (
                <option key={`${head.bookType}:${head.bookRef}`} value={`${head.bookType}:${head.bookRef}`}>
                  {head.name} · {head.publicId} ({cropLabel(head.crop)})
                </option>
              ))}
            </select>
          </label>
          <Input
            label="Amount (PKR) *"
            type="number"
            min="0"
            value={sendForm.amount}
            onChange={(e) => setSendForm({ ...sendForm, amount: e.target.value })}
          />
          <Input
            label="Note (optional)"
            value={sendForm.notes}
            onChange={(e) => setSendForm({ ...sendForm, notes: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setSendOpen(false)}>Cancel</Button>
            <Button onClick={() => void saveSend()} loading={saving} disabled={!heads.length}>Send</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
