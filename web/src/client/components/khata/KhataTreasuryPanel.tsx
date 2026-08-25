import { useState } from 'react'
import { Landmark, Receipt, Send, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Modal from '../ui/Modal'
import { formatCurrency } from '../../utils/format'
import type { KhataBankGroup, KhataHead, KhataTreasuryLine } from '../../types'

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
  bankGroups,
  expenses,
  transfers,
  saving,
  loadHeads,
  onAddBank,
  onReceiveBank,
  onExpense,
  onTransfer,
}: {
  inHand: number
  banks: KhataTreasuryLine[]
  bankGroups?: KhataBankGroup[]
  expenses?: KhataTreasuryLine[]
  transfers: KhataTreasuryLine[]
  saving: boolean
  loadHeads: () => Promise<KhataHead[]>
  onAddBank: (input: { bankName: string; amount: number; notes?: string }) => Promise<void>
  onReceiveBank: (input: { bankName: string; amount: number; notes?: string }) => Promise<void>
  onExpense: (input: { reason: string; amount: number }) => Promise<void>
  onTransfer: (input: { bookType: string; bookRef: string; amount: number; notes?: string }) => Promise<void>
}) {
  const [bankOpen, setBankOpen] = useState(false)
  const [receiveOpen, setReceiveOpen] = useState(false)
  const [expenseOpen, setExpenseOpen] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)
  const [heads, setHeads] = useState<KhataHead[]>([])
  const [bankForm, setBankForm] = useState({ bankName: '', amount: '', notes: '' })
  const [receiveForm, setReceiveForm] = useState({ bankName: '', amount: '', notes: '' })
  const [expenseForm, setExpenseForm] = useState({ reason: '', amount: '' })
  const [sendForm, setSendForm] = useState({ head: '', amount: '', notes: '' })

  const groups = bankGroups?.length
    ? bankGroups
    : Object.values(
        banks.filter((row) => row.kind === 'BANK').reduce<Record<string, KhataBankGroup>>((map, row) => {
          const key = (row.bankName || 'Bank').trim()
          const current = map[key] || { bankName: key, deposited: 0, withdrawn: 0, remaining: 0 }
          current.deposited += row.amount
          current.remaining += row.amount
          map[key] = current
          return map
        }, {}),
      )
  const bankNames = groups.map((row) => row.bankName)

  const openBank = () => {
    setBankForm({ bankName: '', amount: '', notes: '' })
    setBankOpen(true)
  }

  const openReceive = (bankName = '') => {
    setReceiveForm({ bankName, amount: '', notes: '' })
    setReceiveOpen(true)
  }

  const openExpense = () => {
    setExpenseForm({ reason: '', amount: '' })
    setExpenseOpen(true)
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

  const saveReceive = async () => {
    const amount = Number(receiveForm.amount)
    if (!receiveForm.bankName.trim()) {
      toast.error('Enter or search the bank name')
      return
    }
    if (!amount || amount <= 0) {
      toast.error('Enter the amount')
      return
    }
    try {
      await onReceiveBank({
        bankName: receiveForm.bankName.trim(),
        amount,
        notes: receiveForm.notes.trim() || undefined,
      })
      toast.success('Received from bank into amount in hand')
      setReceiveOpen(false)
    } catch (err) {
      toast.error(apiMessage(err, 'Could not receive from bank'))
    }
  }

  const saveExpense = async () => {
    const amount = Number(expenseForm.amount)
    if (!expenseForm.reason.trim()) {
      toast.error('Enter the reason')
      return
    }
    if (!amount || amount <= 0) {
      toast.error('Enter the amount')
      return
    }
    try {
      await onExpense({ reason: expenseForm.reason.trim(), amount })
      toast.success('Other expense saved and deducted from amount in hand')
      setExpenseOpen(false)
    } catch (err) {
      toast.error(apiMessage(err, 'Could not save expense'))
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

  const moveRows = transfers.filter((row) => row.kind === 'TRANSFER_IN' || row.kind === 'TRANSFER_OUT')
  const expenseRows = expenses || []

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={openBank}>
          <Landmark className="h-4 w-4" /> Add money in bank
        </Button>
        <Button variant="secondary" onClick={openExpense}>
          <Receipt className="h-4 w-4" /> Other Expense
        </Button>
        <Button variant="secondary" onClick={() => openReceive()}>
          <Wallet className="h-4 w-4" /> Receive from bank
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
        {!groups.length ? (
          <p className="p-5 text-sm text-slate-500">
            No bank amount yet. Amount in hand is {formatCurrency(inHand)}. Tap Add money in bank to park cash here. Bank money stays in this khata.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100 dark:border-white/10">
                  <th className="px-4 py-2">Bank</th>
                  <th className="px-4 py-2 text-right">In bank</th>
                  <th className="px-4 py-2 text-right">Received to hand</th>
                  <th className="px-4 py-2 text-right">Remaining</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {groups.map((row) => (
                  <tr key={row.bankName} className="border-b border-slate-100 dark:border-white/10">
                    <td className="px-4 py-2 font-medium">{row.bankName}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(row.deposited)}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(row.withdrawn)}</td>
                    <td className="px-4 py-2 text-right font-semibold">{formatCurrency(row.remaining)}</td>
                    <td className="px-4 py-2 text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={row.remaining <= 0}
                        onClick={() => openReceive(row.bankName)}
                      >
                        Receive
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card-3d overflow-hidden">
        <div className="px-5 py-3 bg-[#002D62] text-white font-semibold flex items-center gap-2">
          <Receipt className="h-4 w-4 text-[#C5A059]" />
          Other expenses
        </div>
        {!expenseRows.length ? (
          <p className="p-5 text-sm text-slate-500">
            No other expense yet. Amount is deducted from amount in hand and stored with the reason.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100 dark:border-white/10">
                  <th className="px-4 py-2">Day</th>
                  <th className="px-4 py-2">Reason</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {expenseRows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 dark:border-white/10">
                    <td className="px-4 py-2">{row.day} · {row.date} · {row.time}</td>
                    <td className="px-4 py-2">{row.notes || '—'}</td>
                    <td className="px-4 py-2 text-right font-semibold">{formatCurrency(row.amount)}</td>
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
            list="khata-bank-names"
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

      <Modal open={receiveOpen} onClose={() => setReceiveOpen(false)} title="Receive from bank">
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            Search the bank, enter the amount. It leaves that bank and is added to amount in hand.
          </p>
          <label className="space-y-1.5 block">
            <span className="block text-sm font-medium">Bank name *</span>
            <input
              className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2.5"
              list="khata-bank-names"
              value={receiveForm.bankName}
              onChange={(e) => setReceiveForm({ ...receiveForm, bankName: e.target.value })}
              placeholder="Search"
            />
          </label>
          <Input
            label="Amount (PKR) *"
            type="number"
            min="0"
            value={receiveForm.amount}
            onChange={(e) => setReceiveForm({ ...receiveForm, amount: e.target.value })}
          />
          <Input
            label="Note (optional)"
            value={receiveForm.notes}
            onChange={(e) => setReceiveForm({ ...receiveForm, notes: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setReceiveOpen(false)}>Cancel</Button>
            <Button onClick={() => void saveReceive()} loading={saving}>Receive to hand</Button>
          </div>
        </div>
      </Modal>

      <Modal open={expenseOpen} onClose={() => setExpenseOpen(false)} title="Other Expense">
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            Enter the reason and amount. It is stored with details and deducted from amount in hand ({formatCurrency(inHand)}).
          </p>
          <Input
            label="Reason *"
            value={expenseForm.reason}
            onChange={(e) => setExpenseForm({ ...expenseForm, reason: e.target.value })}
            placeholder="Labour, fuel, mill bill…"
          />
          <Input
            label="Amount (PKR) *"
            type="number"
            min="0"
            value={expenseForm.amount}
            onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setExpenseOpen(false)}>Cancel</Button>
            <Button onClick={() => void saveExpense()} loading={saving}>Save expense</Button>
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

      <datalist id="khata-bank-names">
        {bankNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </div>
  )
}
