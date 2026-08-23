import { useCallback, useEffect, useMemo, useState } from 'react'
import { Banknote, Coins, FileText, GitMerge, Plus, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import { TableSkeleton } from '../components/ui/Skeleton'
import { arhatAmountApi, billApi } from '../services/api'
import { billErrorMessage, openHtmlBill } from '../utils/bill'
import { formatCurrency } from '../utils/format'
import { useLiveReload } from '../context/SyncContext'
import { useVoicePageActions } from '../context/VoiceControlContext'
import { useAuth } from '../context/AuthContext'
import { isOwnerFinanceRole } from '../../lib/roles'
import type { ArhatAmountBook, ArhatAmountLine, ArhatAmountMergeReport } from '../types'

type Section = 'ADD' | 'RECEIVING' | 'GIVING'

const emptyBook: ArhatAmountBook = {
  totals: { added: 0, receiving: 0, giving: 0, zakat: 0, commission: 0, totalAmount: 0 },
  manual: [],
  history: [],
}

function apiMessage(err: unknown, fallback: string) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback
}

export default function ArhatAmountPage() {
  const { user } = useAuth()
  const isOwner = isOwnerFinanceRole(user?.role)
  const [section, setSection] = useState<Section>('ADD')
  const [book, setBook] = useState<ArhatAmountBook>(emptyBook)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [billing, setBilling] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState({ amount: '', notes: '' })
  const [mergeOpen, setMergeOpen] = useState(false)
  const [merge, setMerge] = useState<ArhatAmountMergeReport | null>(null)
  const [mergeLoading, setMergeLoading] = useState(false)

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      const res = await arhatAmountApi.book()
      setBook(res.data.data || emptyBook)
    } catch (err) {
      toast.error(apiMessage(err, 'Could not load Arhat Amount'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])
  useLiveReload(() => { void load(true) })

  const openForm = (kind: Section) => {
    setSection(kind)
    setForm({ amount: '', notes: '' })
    setFormOpen(true)
  }

  const saveEntry = async () => {
    const amount = Number(form.amount)
    if (!amount || amount <= 0) {
      toast.error('Enter the amount')
      return
    }
    setSaving(true)
    try {
      await arhatAmountApi.addEntry({
        kind: section,
        amount,
        notes: form.notes.trim() || undefined,
      })
      toast.success(
        section === 'ADD'
          ? 'Amount added to Arhat Amount'
          : section === 'RECEIVING'
            ? 'Receiving amount saved'
            : 'Giving amount saved',
      )
      setForm({ amount: '', notes: '' })
      setFormOpen(false)
      void load(true)
    } catch (err) {
      toast.error(apiMessage(err, 'Could not save amount'))
    } finally {
      setSaving(false)
    }
  }

  const openArhatBill = async () => {
    setBilling(true)
    try {
      const res = await billApi.arhatAmount()
      openHtmlBill(typeof res.data === 'string' ? res.data : String(res.data), 'Bill')
    } catch (err) {
      toast.error(billErrorMessage(err, 'Could not generate bill'))
    } finally {
      setBilling(false)
    }
  }

  const openMerge = async () => {
    setMergeLoading(true)
    setMergeOpen(true)
    try {
      const res = await arhatAmountApi.merge()
      setMerge(res.data.data || null)
    } catch (err) {
      toast.error(apiMessage(err, 'Could not merge amounts'))
      setMergeOpen(false)
    } finally {
      setMergeLoading(false)
    }
  }

  const openMergeBill = async () => {
    setBilling(true)
    try {
      const res = await billApi.arhatAmountMerge()
      openHtmlBill(typeof res.data === 'string' ? res.data : String(res.data), 'Bill')
    } catch (err) {
      toast.error(billErrorMessage(err, 'Could not generate merge bill'))
    } finally {
      setBilling(false)
    }
  }

  useVoicePageActions({
    openCreate: () => openForm(section),
    refresh: () => { void load() },
    save: () => { if (formOpen) void saveEntry() },
    cancel: () => {
      setFormOpen(false)
      setMergeOpen(false)
    },
  })

  const { totals } = book
  const sectionLines = useMemo(
    () => book.history.filter((row) => row.kind === section),
    [book.history, section],
  )

  const sectionCopy = {
    ADD: {
      title: 'Add Amount',
      hint: 'Cash you put into Arhat Amount. Buyer receipts, register receiving, and farmer payouts are counted automatically.',
      reason: 'Reason this money was added',
    },
    RECEIVING: {
      title: 'Receiving Amount',
      hint: 'Extra cash received here, plus automatic receipts from buyers and Arhat Register receiving.',
      reason: 'Reason this money was received',
    },
    GIVING: {
      title: 'Giving Amount',
      hint: 'Extra cash given here, plus automatic payouts to farmers, Arhat Register giving, and zakat.',
      reason: 'Reason this money was given',
    },
  }[section]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Arhat Amount"
        description="End-of-day shop cash. Farmer payouts, buyer receipts, register, zakat, and every khata add / give / receive are counted here as they happen."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void openArhatBill()} loading={billing}>
              <FileText className="h-4 w-4" /> Bill
            </Button>
            {isOwner && (
              <Button onClick={() => void openMerge()} loading={mergeLoading}>
                <GitMerge className="h-4 w-4" /> Merge all amount
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total', value: totals.totalAmount },
          { label: 'Added', value: totals.added },
          { label: 'Receiving', value: totals.receiving },
          { label: 'Giving', value: totals.giving },
          { label: 'Zakat', value: totals.zakat },
          { label: 'Commission', value: totals.commission },
        ].map((card) => (
          <div key={card.label} className="card-3d p-3">
            <div className="text-[11px] text-slate-500">{card.label}</div>
            <div className="font-semibold mt-1">{formatCurrency(card.value)}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {([
          { id: 'ADD' as const, label: 'Add Amount', icon: Banknote, hint: 'Deposit cash into this book' },
          { id: 'RECEIVING' as const, label: 'Receiving Amount', icon: Wallet, hint: 'Cash in, including buyers' },
          { id: 'GIVING' as const, label: 'Giving Amount', icon: Coins, hint: 'Cash out, including farmers and zakat' },
        ]).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSection(item.id)}
            className={`card-3d p-4 text-left transition ${
              section === item.id ? 'ring-2 ring-[#C5A059]' : 'hover:bg-slate-50 dark:hover:bg-white/5'
            }`}
          >
            <item.icon className="h-5 w-5 text-primary mb-2" />
            <p className="font-semibold">{item.label}</p>
            <p className="text-[11px] text-slate-500 mt-1">{item.hint}</p>
          </button>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => openForm(section)}>
            <Plus className="h-4 w-4" /> {sectionCopy.title}
          </Button>
        </div>
        <p className="text-[11px] text-slate-500 px-1">{sectionCopy.hint}</p>
        {loading ? (
          <div className="card-3d p-4"><TableSkeleton rows={4} /></div>
        ) : !sectionLines.length ? (
          <p className="card-3d p-5 text-sm text-slate-500">No {sectionCopy.title.toLowerCase()} lines yet.</p>
        ) : (
          <HistoryTable rows={sectionLines} />
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold px-1">Complete history</h3>
        <p className="text-[11px] text-slate-500 px-1">
          Wheat, Barley, Maize, Others, and Paddy khata cash is included in this list as it is saved.
        </p>
        {loading ? (
          <div className="card-3d p-4"><TableSkeleton rows={6} /></div>
        ) : !book.history.length ? (
          <p className="card-3d p-5 text-sm text-slate-500">No Arhat Amount history yet.</p>
        ) : (
          <HistoryTable rows={book.history} />
        )}
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={sectionCopy.title}
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-500">{sectionCopy.hint}</p>
          <Input
            label="Amount (PKR) *"
            type="number"
            min="0"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
          <Input
            label={`${sectionCopy.reason} (optional)`}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Why this money moved"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={() => void saveEntry()} loading={saving}>Save</Button>
          </div>
        </div>
      </Modal>

      <Modal open={mergeOpen} onClose={() => setMergeOpen(false)} title="Merge all amount">
        {mergeLoading || !merge ? (
          <div className="p-2"><TableSkeleton rows={5} /></div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Owner-only breakdown. Arhat Amount already includes every khata. Merge splits shop lines from Wheat, Barley, Maize, Others, and Paddy cash so you can check the same total two ways.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-100 dark:border-white/10">
                    <th className="px-2 py-2">Particulars</th>
                    <th className="px-2 py-2 text-right">Arhat shop</th>
                    <th className="px-2 py-2 text-right">All khatas</th>
                    <th className="px-2 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Added amount', merge.arhat.added, merge.wheatKhata.added, merge.combined.added],
                    ['Receiving amount', merge.arhat.receiving, merge.wheatKhata.receiving, merge.combined.receiving],
                    ['Giving amount', merge.arhat.giving, merge.wheatKhata.giving, merge.combined.giving],
                    ['Commission', merge.arhat.commission, merge.wheatKhata.commission, merge.combined.commission],
                    ['Zakat', merge.arhat.zakat, merge.wheatKhata.zakat, merge.combined.zakat],
                    ['Total amount', merge.arhat.totalAmount, merge.wheatKhata.totalAmount, merge.combined.totalAmount],
                  ].map((row) => (
                    <tr key={String(row[0])} className="border-b border-slate-100 dark:border-white/10">
                      <td className="px-2 py-2">{row[0]}</td>
                      <td className="px-2 py-2 text-right">{formatCurrency(Number(row[1]))}</td>
                      <td className="px-2 py-2 text-right">{formatCurrency(Number(row[2]))}</td>
                      <td className="px-2 py-2 text-right font-semibold">{formatCurrency(Number(row[3]))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-2">Complete history</h4>
              <p className="text-[11px] text-slate-500 mb-2">
                Day, date, time, and why money was added or deducted — including farmer payouts and buyer receipts.
              </p>
              <HistoryTable rows={merge.history} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setMergeOpen(false)}>Close</Button>
              <Button onClick={() => void openMergeBill()} loading={billing}>
                <FileText className="h-4 w-4" /> Bill
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function HistoryTable({ rows }: { rows: ArhatAmountLine[] }) {
  const kindLabel = (kind: string) =>
    kind === 'ADD' ? 'Added' : kind === 'RECEIVING' ? 'Received' : kind === 'GIVING' ? 'Given' : kind
  const bookLabel = (book: string) => (book === 'WHEAT_KHATA' || book === 'KHATA' ? 'Khata' : 'Arhat')
  return (
    <div className="card-3d overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-100 dark:border-white/10">
              <th className="px-4 py-2">Day</th>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Time</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Reason</th>
              <th className="px-4 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100 dark:border-white/10">
                <td className="px-4 py-2 whitespace-nowrap">{row.day}</td>
                <td className="px-4 py-2 whitespace-nowrap">{row.date}</td>
                <td className="px-4 py-2 whitespace-nowrap">{row.time}</td>
                <td className="px-4 py-2 whitespace-nowrap">
                  {bookLabel(row.book)} · {kindLabel(row.kind)}
                </td>
                <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{row.reason}</td>
                <td className="px-4 py-2 text-right font-semibold">{formatCurrency(row.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
