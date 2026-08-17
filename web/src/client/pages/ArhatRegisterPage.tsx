import { useCallback, useEffect, useState } from 'react'
import { BookOpen, HandCoins, Landmark, Plus, Printer, Sprout, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Modal from '../components/ui/Modal'
import { TableSkeleton } from '../components/ui/Skeleton'
import { farmerApi, registerApi, billApi } from '../services/api'
import { billErrorMessage, openHtmlBill } from '../utils/bill'
import { formatCurrency } from '../utils/format'
import { useAuth } from '../context/AuthContext'
import { isOwnerFinanceRole } from '../../lib/roles'
import { Navigate } from 'react-router-dom'
import type { Farmer, RegisterEntry, RegisterParty, ZakatSummary } from '../types'

type Section = 'GIVING' | 'RECEIVING' | 'ZAKAT' | 'ADVANCE'

export default function ArhatRegisterPage() {
  const { user } = useAuth()
  const isOwner = isOwnerFinanceRole(user?.role)
  const [section, setSection] = useState<Section>('GIVING')
  const [parties, setParties] = useState<RegisterParty[]>([])
  const [entries, setEntries] = useState<RegisterEntry[]>([])
  const [zakat, setZakat] = useState<ZakatSummary | null>(null)
  const [farmers, setFarmers] = useState<Farmer[]>([])
  const [loading, setLoading] = useState(true)

  const [personOpen, setPersonOpen] = useState(false)
  const [giveOpen, setGiveOpen] = useState(false)
  const [zakatOpen, setZakatOpen] = useState(false)
  const [advanceOpen, setAdvanceOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [person, setPerson] = useState({ name: '', address: '', notes: '' })
  const [money, setMoney] = useState({ partyId: '', amount: '', notes: '' })
  const [zakatForm, setZakatForm] = useState({ amount: '', notes: '' })
  const [advance, setAdvance] = useState({ farmerId: '', amount: '', notes: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (section === 'ZAKAT') {
        const res = await registerApi.zakat()
        setZakat(res.data.data || null)
        setEntries(res.data.data?.entries || [])
      } else if (section === 'ADVANCE') {
        const [e, f] = await Promise.all([registerApi.entries('FARMER_ADVANCE'), farmerApi.getAll()])
        setEntries(e.data.data || [])
        setFarmers(f.data.data || [])
      } else {
        const kind = section
        const [p, e] = await Promise.all([registerApi.parties(kind), registerApi.entries(kind)])
        setParties(p.data.data || [])
        setEntries(e.data.data || [])
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Could not load register')
    } finally {
      setLoading(false)
    }
  }, [section])

  useEffect(() => { void load() }, [load])

  if (!isOwner) return <Navigate to="/dashboard" replace />

  const savePerson = async () => {
    if (!person.name.trim()) {
      toast.error('Name is required')
      return
    }
    setSaving(true)
    try {
      await registerApi.addParty({
        kind: section === 'RECEIVING' ? 'RECEIVING' : 'GIVING',
        name: person.name.trim(),
        address: person.address.trim() || undefined,
        notes: person.notes.trim() || undefined,
      })
      toast.success('Person added')
      setPerson({ name: '', address: '', notes: '' })
      setPersonOpen(false)
      void load()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Could not add person')
    } finally {
      setSaving(false)
    }
  }

  const saveMoney = async () => {
    const amount = Number(money.amount)
    if (!money.partyId) {
      toast.error('Choose a name first')
      return
    }
    if (!amount || amount <= 0) {
      toast.error('Enter the amount')
      return
    }
    setSaving(true)
    try {
      await registerApi.addEntry({
        kind: section,
        partyId: Number(money.partyId),
        amount,
        notes: money.notes.trim() || undefined,
      })
      toast.success('Amount saved')
      setMoney({ partyId: '', amount: '', notes: '' })
      setGiveOpen(false)
      void load()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Could not save amount')
    } finally {
      setSaving(false)
    }
  }

  const saveZakat = async () => {
    const amount = Number(zakatForm.amount)
    if (!amount || amount <= 0) {
      toast.error('Enter zakat amount')
      return
    }
    setSaving(true)
    try {
      await registerApi.addEntry({
        kind: 'ZAKAT',
        amount,
        notes: zakatForm.notes.trim() || undefined,
      })
      toast.success('Zakat recorded')
      setZakatForm({ amount: '', notes: '' })
      setZakatOpen(false)
      void load()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Could not save zakat')
    } finally {
      setSaving(false)
    }
  }

  const saveAdvance = async () => {
    const amount = Number(advance.amount)
    if (!advance.farmerId) {
      toast.error('Choose a farmer')
      return
    }
    if (!amount || amount <= 0) {
      toast.error('Enter the advance amount')
      return
    }
    setSaving(true)
    try {
      await registerApi.addEntry({
        kind: 'FARMER_ADVANCE',
        farmerId: Number(advance.farmerId),
        amount,
        notes: advance.notes.trim() || 'Advance payment',
      })
      toast.success('Advance saved — it will appear on the farmer bill')
      setAdvance({ farmerId: '', amount: '', notes: '' })
      setAdvanceOpen(false)
      void load()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Could not save advance')
    } finally {
      setSaving(false)
    }
  }

  const openBill = async (id: number) => {
    try {
      const res = await billApi.register(id, 'en')
      openHtmlBill(typeof res.data === 'string' ? res.data : String(res.data), 'RTC Register Bill')
    } catch (err) {
      toast.error(billErrorMessage(err, 'Could not generate bill'))
    }
  }

  const total = entries.reduce((sum, row) => sum + (row.amount || 0), 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Arhat Register"
        description="Giving, receiving, zakat, and farmer advances — dated with day and time"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {([
          { id: 'GIVING' as const, label: 'Giving Amount', icon: HandCoins },
          { id: 'RECEIVING' as const, label: 'Receiving Amount', icon: Wallet },
          { id: 'ZAKAT' as const, label: 'Zakat Amount', icon: Landmark },
          { id: 'ADVANCE' as const, label: 'Advance Payment To Farmer', icon: Sprout },
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
          </button>
        ))}
      </div>

      {(section === 'GIVING' || section === 'RECEIVING') && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => { setPerson({ name: '', address: '', notes: '' }); setPersonOpen(true) }}>
            <Plus className="h-4 w-4" /> Add Person
          </Button>
          <Button
            variant="secondary"
            onClick={() => { setMoney({ partyId: '', amount: '', notes: '' }); setGiveOpen(true) }}
          >
            <HandCoins className="h-4 w-4" /> {section === 'RECEIVING' ? 'Receive amount' : 'Give amount'}
          </Button>
        </div>
      )}

      {section === 'ZAKAT' && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => { setZakatForm({ amount: '', notes: '' }); setZakatOpen(true) }}>
            <Landmark className="h-4 w-4" /> Give Zakat
          </Button>
        </div>
      )}

      {section === 'ADVANCE' && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => { setAdvance({ farmerId: '', amount: '', notes: '' }); setAdvanceOpen(true) }}>
            <Sprout className="h-4 w-4" /> Give advance
          </Button>
        </div>
      )}

      {section === 'ZAKAT' && zakat && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="card-3d p-5">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total given (all time)</p>
            <p className="text-2xl font-bold text-primary mt-1">{formatCurrency(zakat.allTime)}</p>
          </div>
          <div className="card-3d p-5">
            <p className="text-xs uppercase tracking-wide text-slate-500">Last 12 months</p>
            <p className="text-2xl font-bold text-primary mt-1">{formatCurrency(zakat.last12Months)}</p>
            <p className="text-xs text-slate-500 mt-1">Resets on a rolling one-year window</p>
          </div>
        </div>
      )}

      {section !== 'ZAKAT' && (
        <div className="card-3d p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total in this book</p>
          <p className="text-2xl font-bold text-primary mt-1">{formatCurrency(total)}</p>
        </div>
      )}

      <div className="card-3d overflow-hidden">
        <div className="px-5 py-3 bg-[#002D62] text-white font-semibold flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-[#C5A059]" />
          History
        </div>
        {loading ? (
          <div className="p-4"><TableSkeleton rows={4} /></div>
        ) : !entries.length ? (
          <p className="p-5 text-sm text-slate-500">No entries yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100 dark:border-white/10">
                  <th className="px-4 py-2">Day</th>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Time</th>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="px-4 py-2">Note</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 dark:border-white/10">
                    <td className="px-4 py-2">{row.day}</td>
                    <td className="px-4 py-2">{row.date}</td>
                    <td className="px-4 py-2">{row.time}</td>
                    <td className="px-4 py-2 font-medium">{row.partyName || (row.kind === 'ZAKAT' ? 'Zakat' : '—')}</td>
                    <td className="px-4 py-2 text-right font-semibold">{formatCurrency(row.amount)}</td>
                    <td className="px-4 py-2 text-slate-500">{row.notes || '—'}</td>
                    <td className="px-4 py-2">
                      <Button variant="secondary" className="!py-1.5 !px-2" onClick={() => void openBill(row.id)}>
                        <Printer className="h-3.5 w-3.5" /> Bill
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={personOpen} onClose={() => setPersonOpen(false)} title="Add person">
        <div className="space-y-3">
          <Input label="Name *" value={person.name} onChange={(e) => setPerson({ ...person, name: e.target.value })} />
          <Input label="Address (optional)" value={person.address} onChange={(e) => setPerson({ ...person, address: e.target.value })} />
          <Input label="Note (optional)" value={person.notes} onChange={(e) => setPerson({ ...person, notes: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setPersonOpen(false)}>Cancel</Button>
            <Button onClick={() => void savePerson()} loading={saving}>Save person</Button>
          </div>
        </div>
      </Modal>

      <Modal open={giveOpen} onClose={() => setGiveOpen(false)} title={section === 'RECEIVING' ? 'Receive amount' : 'Give amount'}>
        <div className="space-y-3">
          <Select
            label="Name *"
            value={money.partyId}
            onChange={(e) => setMoney({ ...money, partyId: e.target.value })}
            options={[
              { value: '', label: parties.length ? 'Select name' : 'Add a person first' },
              ...parties.map((p) => ({ value: String(p.id), label: p.name })),
            ]}
          />
          <Input
            label="Amount (PKR) *"
            type="number"
            min="0"
            value={money.amount}
            onChange={(e) => setMoney({ ...money, amount: e.target.value })}
          />
          <Input label="Note (optional)" value={money.notes} onChange={(e) => setMoney({ ...money, notes: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setGiveOpen(false)}>Cancel</Button>
            <Button onClick={() => void saveMoney()} loading={saving} disabled={!parties.length}>Save</Button>
          </div>
        </div>
      </Modal>

      <Modal open={zakatOpen} onClose={() => setZakatOpen(false)} title="Give Zakat">
        <div className="space-y-3">
          <Input
            label="Amount (PKR) *"
            type="number"
            min="0"
            value={zakatForm.amount}
            onChange={(e) => setZakatForm({ ...zakatForm, amount: e.target.value })}
          />
          <Input label="Note (optional)" value={zakatForm.notes} onChange={(e) => setZakatForm({ ...zakatForm, notes: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setZakatOpen(false)}>Cancel</Button>
            <Button onClick={() => void saveZakat()} loading={saving}>Save zakat</Button>
          </div>
        </div>
      </Modal>

      <Modal open={advanceOpen} onClose={() => setAdvanceOpen(false)} title="Advance payment to farmer">
        <div className="space-y-3">
          <p className="text-sm text-slate-500">This amount prints on the farmer bill and reduces what is still payable.</p>
          <Select
            label="Farmer *"
            value={advance.farmerId}
            onChange={(e) => setAdvance({ ...advance, farmerId: e.target.value })}
            options={[
              { value: '', label: 'Select farmer' },
              ...farmers.map((f) => ({ value: String(f.id), label: `${f.name} · ${f.farmerId}` })),
            ]}
          />
          <Input
            label="Amount (PKR) *"
            type="number"
            min="0"
            value={advance.amount}
            onChange={(e) => setAdvance({ ...advance, amount: e.target.value })}
          />
          <Input label="Note" value={advance.notes} onChange={(e) => setAdvance({ ...advance, notes: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setAdvanceOpen(false)}>Cancel</Button>
            <Button onClick={() => void saveAdvance()} loading={saving}>Save advance</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
