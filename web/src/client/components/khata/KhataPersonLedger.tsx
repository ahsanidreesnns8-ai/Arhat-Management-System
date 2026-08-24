import { useMemo, useState } from 'react'
import { FileText, Pencil, Trash2, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Modal from '../ui/Modal'
import ConfirmDialog from '../ui/ConfirmDialog'
import { formatCurrency } from '../../utils/format'
import type { KhataLedgerPerson } from '../../types'

function apiMessage(err: unknown, fallback: string) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback
}

type EditLine = { id: number; amount: string; kind: 'GIVING' | 'RECEIVING'; notes: string; delete?: boolean }

export default function KhataPersonLedger({
  inHand,
  people,
  givingToPerson,
  receivingFromPerson,
  saving,
  onGive,
  onReceive,
  onLoadPerson,
  onUpdate,
  onDelete,
}: {
  inHand: number
  people: KhataLedgerPerson[]
  givingToPerson: number
  receivingFromPerson: number
  saving: boolean
  onGive: (input: { name: string; amount: number; notes?: string; address?: string }) => Promise<void>
  onReceive: (input: { name: string; amount: number; notes?: string; address?: string }) => Promise<void>
  onLoadPerson: (id: number) => Promise<KhataLedgerPerson>
  onUpdate: (id: number, input: {
    name: string
    address?: string
    notes?: string
    entries: Array<{ id: number; amount: number; kind: 'GIVING' | 'RECEIVING'; notes?: string; delete?: boolean }>
  }) => Promise<void>
  onDelete: (id: number) => Promise<void>
}) {
  const [kindOpen, setKindOpen] = useState<'GIVING' | 'RECEIVING' | null>(null)
  const [form, setForm] = useState({ name: '', amount: '', notes: '', address: '' })
  const [balanceOpen, setBalanceOpen] = useState<KhataLedgerPerson | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({ id: 0, name: '', address: '', notes: '', lines: [] as EditLine[] })
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [cashPerson, setCashPerson] = useState<KhataLedgerPerson | null>(null)

  const names = useMemo(() => people.map((row) => row.name), [people])

  const openMoney = (kind: 'GIVING' | 'RECEIVING', person?: KhataLedgerPerson) => {
    setKindOpen(kind)
    setCashPerson(person || null)
    setForm({
      name: person?.name || '',
      amount: '',
      notes: '',
      address: person?.address || '',
    })
  }

  const saveMoney = async () => {
    if (!kindOpen) return
    const amount = Number(form.amount)
    if (!form.name.trim()) {
      toast.error('Enter the name')
      return
    }
    if (!amount || amount <= 0) {
      toast.error('Enter the amount')
      return
    }
    try {
      const payload = {
        name: form.name.trim(),
        amount,
        notes: form.notes.trim() || undefined,
        address: form.address.trim() || undefined,
      }
      if (kindOpen === 'GIVING') await onGive(payload)
      else await onReceive(payload)
      toast.success(kindOpen === 'GIVING' ? 'Given and stored on this person' : 'Received and stored on this person')
      setKindOpen(null)
      setCashPerson(null)
    } catch (err) {
      toast.error(apiMessage(err, 'Could not save amount'))
    }
  }

  const openBalance = async (person: KhataLedgerPerson) => {
    try {
      const full = await onLoadPerson(person.id)
      setBalanceOpen(full)
    } catch (err) {
      toast.error(apiMessage(err, 'Could not load total balance'))
    }
  }

  const openEdit = async (person: KhataLedgerPerson) => {
    try {
      const full = await onLoadPerson(person.id)
      setEditForm({
        id: full.id,
        name: full.name,
        address: full.address || '',
        notes: full.notes || '',
        lines: (full.entries || []).map((row) => ({
          id: row.id,
          amount: String(row.amount),
          kind: row.kind === 'RECEIVING' ? 'RECEIVING' : 'GIVING',
          notes: row.notes || '',
        })),
      })
      setEditOpen(true)
    } catch (err) {
      toast.error(apiMessage(err, 'Could not open person'))
    }
  }

  const saveEdit = async () => {
    if (!editForm.name.trim()) {
      toast.error('Name is required')
      return
    }
    try {
      await onUpdate(editForm.id, {
        name: editForm.name.trim(),
        address: editForm.address.trim() || undefined,
        notes: editForm.notes.trim() || undefined,
        entries: editForm.lines.map((line) => ({
          id: line.id,
          amount: Number(line.amount),
          kind: line.kind,
          notes: line.notes.trim() || undefined,
          delete: line.delete,
        })),
      })
      toast.success('Person updated')
      setEditOpen(false)
    } catch (err) {
      toast.error(apiMessage(err, 'Could not update person'))
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card-3d p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">Amount in hand</p>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">{formatCurrency(inHand)}</p>
        </div>
        <div className="card-3d p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">Giving to person</p>
          <p className="text-2xl font-bold text-rose-700 dark:text-rose-400 mt-1">{formatCurrency(givingToPerson)}</p>
        </div>
        <div className="card-3d p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">Receiving from person</p>
          <p className="text-2xl font-bold text-sky-800 dark:text-sky-300 mt-1">{formatCurrency(receivingFromPerson)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => openMoney('RECEIVING')}>
          <Wallet className="h-4 w-4" /> Receive money
        </Button>
        <Button variant="secondary" onClick={() => openMoney('GIVING')}>
          <Wallet className="h-4 w-4" /> Give money
        </Button>
      </div>

      {!people.length ? (
        <p className="text-sm text-slate-500">
          No person yet. Tap Give money or Receive money, enter the name and amount. Each person is stored in a frame like Arhat Register.
        </p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {people.map((person) => (
            <div key={person.id} className="card-3d p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{person.name}</p>
                  <p className="text-xs text-slate-500">{person.address || 'No address'}</p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => void openEdit(person)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Given</p>
                  <p className="font-semibold">{formatCurrency(person.cashGiven)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Received</p>
                  <p className="font-semibold">{formatCurrency(person.cashReceived)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Product in</p>
                  <p className="font-semibold">{formatCurrency(person.productIn)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Product out</p>
                  <p className="font-semibold">{formatCurrency(person.productOut)}</p>
                </div>
              </div>
              <p className="text-sm font-semibold">
                {person.displayLabel}: {formatCurrency(person.remainingToGive || person.remainingToReceive || 0)}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => openMoney('RECEIVING', person)}>Receive</Button>
                <Button size="sm" variant="secondary" onClick={() => openMoney('GIVING', person)}>Give</Button>
                <Button size="sm" onClick={() => void openBalance(person)}>
                  <FileText className="h-3.5 w-3.5" /> Total Balance
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!kindOpen}
        onClose={() => { setKindOpen(null); setCashPerson(null) }}
        title={kindOpen === 'RECEIVING' ? 'Receive money' : 'Give money'}
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            {kindOpen === 'GIVING'
              ? `Amount in hand is ${formatCurrency(inHand)}. Enter the person name and amount.`
              : 'Enter the person name and amount received.'}
          </p>
          <label className="space-y-1.5 block">
            <span className="block text-sm font-medium">Name *</span>
            <input
              className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-transparent px-3 py-2.5"
              list="khata-person-names"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Type to search or add a name"
              disabled={!!cashPerson}
            />
          </label>
          <Input
            label="Address (optional)"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
          <Input
            label="Amount (PKR) *"
            type="number"
            min="0"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
          <Input
            label="Note (optional)"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => { setKindOpen(null); setCashPerson(null) }}>Cancel</Button>
            <Button loading={saving} onClick={() => void saveMoney()}>Save</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!balanceOpen} onClose={() => setBalanceOpen(null)} title={`Total balance · ${balanceOpen?.name || ''}`} size="lg">
        {balanceOpen ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Complete history: money given or received, plus product given or received to this person.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="card-3d p-4">
                <p className="text-xs text-slate-500">Already given</p>
                <p className="text-lg font-bold mt-1">{formatCurrency(balanceOpen.cashGiven)}</p>
              </div>
              <div className="card-3d p-4">
                <p className="text-xs text-slate-500">Already received</p>
                <p className="text-lg font-bold mt-1">{formatCurrency(balanceOpen.cashReceived)}</p>
              </div>
              <div className="card-3d p-4">
                <p className="text-xs text-slate-500">Product in</p>
                <p className="text-lg font-bold mt-1">{formatCurrency(balanceOpen.productIn)}</p>
              </div>
              <div className="card-3d p-4">
                <p className="text-xs text-slate-500">Product out</p>
                <p className="text-lg font-bold mt-1">{formatCurrency(balanceOpen.productOut)}</p>
              </div>
            </div>
            <p className="font-semibold">
              {balanceOpen.displayLabel}: {formatCurrency(balanceOpen.remainingToGive || balanceOpen.remainingToReceive || 0)}
            </p>
            {balanceOpen.lines?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-100 dark:border-white/10">
                      <th className="px-2 py-2">Date</th>
                      <th className="px-2 py-2">Particular</th>
                      <th className="px-2 py-2 text-right">Added</th>
                      <th className="px-2 py-2 text-right">Deducted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balanceOpen.lines.map((row, index) => (
                      <tr key={`${row.kind}-${index}`} className="border-b border-slate-50 dark:border-white/5">
                        <td className="px-2 py-2">{row.date || '—'}</td>
                        <td className="px-2 py-2">{row.particular}</td>
                        <td className="px-2 py-2 text-right">{row.addition ? formatCurrency(row.addition) : '—'}</td>
                        <td className="px-2 py-2 text-right">{row.deduction ? formatCurrency(row.deduction) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No lines yet.</p>
            )}
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setBalanceOpen(null)}>Close</Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Person details" size="lg">
        <div className="space-y-3">
          <Input label="Name *" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
          <Input label="Address (optional)" value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
          <Input label="Note (optional)" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Amounts</h4>
            {!editForm.lines.length ? (
              <p className="text-sm text-slate-500">No amounts yet. Use Receive money or Give money.</p>
            ) : editForm.lines.map((line, index) => (
              <div
                key={line.id}
                className={`rounded-xl border border-slate-200 dark:border-white/10 p-3 space-y-2 ${line.delete ? 'opacity-50' : ''}`}
              >
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={line.kind === 'RECEIVING' ? 'primary' : 'secondary'}
                    onClick={() => {
                      const lines = [...editForm.lines]
                      lines[index] = { ...line, kind: 'RECEIVING', delete: false }
                      setEditForm({ ...editForm, lines })
                    }}
                    disabled={line.delete}
                  >
                    Received
                  </Button>
                  <Button
                    size="sm"
                    variant={line.kind === 'GIVING' ? 'primary' : 'secondary'}
                    onClick={() => {
                      const lines = [...editForm.lines]
                      lines[index] = { ...line, kind: 'GIVING', delete: false }
                      setEditForm({ ...editForm, lines })
                    }}
                    disabled={line.delete}
                  >
                    Given
                  </Button>
                  <Button
                    size="sm"
                    variant={line.delete ? 'secondary' : 'danger'}
                    onClick={() => {
                      const lines = [...editForm.lines]
                      lines[index] = { ...line, delete: !line.delete }
                      setEditForm({ ...editForm, lines })
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> {line.delete ? 'Undo delete' : 'Delete amount'}
                  </Button>
                </div>
                <Input
                  label="Amount (PKR) *"
                  type="number"
                  min="0"
                  value={line.amount}
                  onChange={(e) => {
                    const lines = [...editForm.lines]
                    lines[index] = { ...line, amount: e.target.value }
                    setEditForm({ ...editForm, lines })
                  }}
                  disabled={line.delete}
                />
                <Input
                  label="Note (optional)"
                  value={line.notes}
                  onChange={(e) => {
                    const lines = [...editForm.lines]
                    lines[index] = { ...line, notes: e.target.value }
                    setEditForm({ ...editForm, lines })
                  }}
                  disabled={line.delete}
                />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap justify-between gap-2 pt-2">
            <Button variant="danger" onClick={() => setDeleteId(editForm.id)}>
              <Trash2 className="h-4 w-4" /> Delete person
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button loading={saving} onClick={() => void saveEdit()}>Save changes</Button>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteId != null}
        onClose={() => setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId == null) return
          try {
            await onDelete(deleteId)
            toast.success('Person deleted. Record is kept.')
            setDeleteId(null)
            setEditOpen(false)
          } catch (err) {
            toast.error(apiMessage(err, 'Could not delete person'))
          }
        }}
        title="Delete this person?"
        message="The person leaves this list. The record is stored permanently."
        confirmLabel="Delete"
        loading={saving}
      />

      <datalist id="khata-person-names">
        {names.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </div>
  )
}
