import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookOpen, HandCoins, Landmark, Plus, Printer, Sprout, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import { TableSkeleton } from '../components/ui/Skeleton'
import { farmerApi, registerApi, billApi } from '../services/api'
import { billErrorMessage, openHtmlBill } from '../utils/bill'
import { formatCurrency } from '../utils/format'
import { useAuth } from '../context/AuthContext'
import { isOwnerFinanceRole } from '../../lib/roles'
import { Navigate } from 'react-router-dom'
import type { Farmer, RegisterEntry, RegisterParty, ZakatSummary } from '../types'
import PartyCombobox from '../components/forms/PartyCombobox'

type Section = 'PEOPLE' | 'ZAKAT' | 'ADVANCE'
type MoneyKind = 'GIVING' | 'RECEIVING'

function netCopy(balance: number) {
  if (balance > 0) return `Owner received ${formatCurrency(balance)} more`
  if (balance < 0) return `Owner gave ${formatCurrency(Math.abs(balance))} more`
  return 'Settled'
}

export default function ArhatRegisterPage() {
  const { user } = useAuth()
  const isOwner = isOwnerFinanceRole(user?.role)
  const [section, setSection] = useState<Section>('PEOPLE')
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
  const [money, setMoney] = useState({ partyId: '', amount: '', notes: '', kind: 'GIVING' as MoneyKind })
  const [fullOpen, setFullOpen] = useState(false)
  const [fullForm, setFullForm] = useState({ partyId: '', received: '', given: '', notes: '' })
  const [calcPartyId, setCalcPartyId] = useState('')
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
        const [p, given, received] = await Promise.all([
          registerApi.parties('RECEIVING'),
          registerApi.entries('GIVING'),
          registerApi.entries('RECEIVING'),
        ])
        setParties(p.data.data || [])
        const merged = [...(given.data.data || []), ...(received.data.data || [])].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        setEntries(merged)
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Could not load register')
    } finally {
      setLoading(false)
    }
  }, [section])

  useEffect(() => { void load() }, [load])

  const selectedParty = useMemo(
    () => parties.find((p) => String(p.id) === money.partyId) || null,
    [parties, money.partyId],
  )

  const bookReceived = parties.reduce((sum, p) => sum + (p.receivedTotal || 0), 0)
  const bookGiven = parties.reduce((sum, p) => sum + (p.givenTotal || 0), 0)
  const bookBalance = bookReceived - bookGiven

  if (!isOwner) return <Navigate to="/dashboard" replace />

  const openMoney = (kind: MoneyKind, partyId = '') => {
    setMoney({ partyId, amount: '', notes: '', kind })
    setGiveOpen(true)
  }

  const savePerson = async () => {
    if (!person.name.trim()) {
      toast.error('Name is required')
      return
    }
    setSaving(true)
    try {
      await registerApi.addParty({
        kind: 'RECEIVING',
        name: person.name.trim(),
        address: person.address.trim() || undefined,
        notes: person.notes.trim() || undefined,
      })
      toast.success('Person saved — you can receive and give money for them')
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
        kind: money.kind,
        partyId: Number(money.partyId),
        amount,
        notes: money.notes.trim() || undefined,
      })
      toast.success(money.kind === 'RECEIVING' ? 'Received amount saved' : 'Given amount saved')
      setMoney({ partyId: '', amount: '', notes: '', kind: money.kind })
      setGiveOpen(false)
      void load()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Could not save amount')
    } finally {
      setSaving(false)
    }
  }

  const saveFullAmount = async () => {
    if (!fullForm.partyId) {
      toast.error('Choose a name first')
      return
    }
    const received = Number(fullForm.received)
    const given = Number(fullForm.given)
    if ((!received || received <= 0) && (!given || given <= 0)) {
      toast.error('Enter how much you received, how much you gave, or both')
      return
    }
    setSaving(true)
    try {
      await registerApi.addPersonAmounts({
        partyId: Number(fullForm.partyId),
        receivedAmount: received > 0 ? received : undefined,
        givenAmount: given > 0 ? given : undefined,
        notes: fullForm.notes.trim() || undefined,
      })
      toast.success('Person totals updated')
      setFullForm({ partyId: '', received: '', given: '', notes: '' })
      setFullOpen(false)
      void load()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Could not save person amounts')
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

  const openEntryBill = async (row: RegisterEntry) => {
    try {
      if (row.partyId) {
        const res = await billApi.registerParty(row.partyId, 'en')
        openHtmlBill(typeof res.data === 'string' ? res.data : String(res.data), 'Bill')
        return
      }
      const res = await billApi.register(row.id, 'en')
      openHtmlBill(typeof res.data === 'string' ? res.data : String(res.data), 'Bill')
    } catch (err) {
      toast.error(billErrorMessage(err, 'Could not generate bill'))
    }
  }

  const openPartyBill = async (id: number) => {
    try {
      const res = await billApi.registerParty(id, 'en')
      openHtmlBill(typeof res.data === 'string' ? res.data : String(res.data), 'Bill')
    } catch (err) {
      toast.error(billErrorMessage(err, 'Could not generate bill'))
    }
  }

  const historyTotal = entries.reduce((sum, row) => sum + (row.amount || 0), 0)
  const calcParty = parties.find((p) => String(p.id) === calcPartyId) || null
  const calcReceived = calcParty ? calcParty.receivedTotal || 0 : bookReceived
  const calcGiven = calcParty ? calcParty.givenTotal || 0 : bookGiven
  const calcTurnover = calcReceived + calcGiven
  const calcNet = calcReceived - calcGiven

  return (
    <div className="space-y-6">
      <PageHeader
        title="Arhat Register"
        description="One person, one ledger: record how much you gave and how much you received. Totals update on every entry."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {([
          { id: 'PEOPLE' as const, label: 'People', icon: BookOpen },
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

      {section === 'PEOPLE' && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => { setPerson({ name: '', address: '', notes: '' }); setPersonOpen(true) }}>
            <Plus className="h-4 w-4" /> Add Person
          </Button>
          <Button variant="secondary" onClick={() => {
            setFullForm({ partyId: '', received: '', given: '', notes: '' })
            setFullOpen(true)
          }}>
            <Wallet className="h-4 w-4" /> Add full amount
          </Button>
          <Button variant="secondary" onClick={() => openMoney('RECEIVING')}>
            <Wallet className="h-4 w-4" /> Receive amount
          </Button>
          <Button variant="secondary" onClick={() => openMoney('GIVING')}>
            <HandCoins className="h-4 w-4" /> Give amount
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

      {section === 'PEOPLE' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="card-3d p-5">
            <p className="text-xs uppercase tracking-wide text-slate-500">Received from people</p>
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">{formatCurrency(bookReceived)}</p>
          </div>
          <div className="card-3d p-5">
            <p className="text-xs uppercase tracking-wide text-slate-500">Given to people</p>
            <p className="text-2xl font-bold text-rose-700 dark:text-rose-400 mt-1">{formatCurrency(bookGiven)}</p>
          </div>
          <div className="card-3d p-5">
            <p className="text-xs uppercase tracking-wide text-slate-500">Net</p>
            <p className="text-2xl font-bold text-primary mt-1">{formatCurrency(Math.abs(bookBalance))}</p>
            <p className="text-xs text-slate-500 mt-1">{netCopy(bookBalance)}</p>
          </div>
        </div>
      )}

      {section === 'PEOPLE' && (
        <div className="card-3d p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Calculate totals</h3>
            <p className="text-[11px] text-slate-500">Pick any person — or leave blank for everyone — to see receiving, giving, and total.</p>
          </div>
          <PartyCombobox
            label="Person"
            items={parties.map((p) => ({
              id: String(p.id),
              name: p.name,
              address: p.address,
              notes: `Received ${formatCurrency(p.receivedTotal || 0)} · Given ${formatCurrency(p.givenTotal || 0)}`,
            }))}
            value={calcPartyId}
            onChange={setCalcPartyId}
            placeholder="All people, or type a name"
            emptyLabel="Add a person first"
          />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[12px]">
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-500/10 px-3 py-2">
              <div className="text-slate-500">Receiving</div>
              <div className="font-semibold">{formatCurrency(calcReceived)}</div>
            </div>
            <div className="rounded-lg bg-rose-50 dark:bg-rose-500/10 px-3 py-2">
              <div className="text-slate-500">Giving</div>
              <div className="font-semibold">{formatCurrency(calcGiven)}</div>
            </div>
            <div className="rounded-lg bg-slate-50 dark:bg-white/5 px-3 py-2">
              <div className="text-slate-500">Total</div>
              <div className="font-semibold">{formatCurrency(calcTurnover)}</div>
            </div>
            <div className="rounded-lg bg-slate-50 dark:bg-white/5 px-3 py-2">
              <div className="text-slate-500">Net</div>
              <div className="font-semibold">{formatCurrency(Math.abs(calcNet))}</div>
              <div className="text-[11px] text-slate-500">{netCopy(calcNet)}</div>
            </div>
          </div>
        </div>
      )}

      {section === 'ADVANCE' && (
        <div className="card-3d p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total in this book</p>
          <p className="text-2xl font-bold text-primary mt-1">{formatCurrency(historyTotal)}</p>
        </div>
      )}

      {section === 'PEOPLE' && (
        <div className="space-y-3">
          <div className="px-1">
            <h3 className="text-sm font-semibold">People</h3>
            <p className="text-[11px] text-slate-500">
              Receive more than once from the same person, or also give money to them. Totals update automatically.
            </p>
          </div>
          {loading ? (
            <div className="card-3d p-4"><TableSkeleton rows={3} /></div>
          ) : !parties.length ? (
            <p className="card-3d p-5 text-sm text-slate-500">Add a person first, then receive or give money.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {parties.map((p) => {
                const received = p.receivedTotal || 0
                const given = p.givenTotal || 0
                const balance = p.balance ?? received - given
                return (
                  <div key={p.id} className="card-3d p-4 space-y-3">
                    <div>
                      <p className="font-semibold truncate">{p.name}</p>
                      <p className="text-[11px] text-slate-500 truncate">{p.address || p.notes || 'No address'}</p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                      <div className="rounded-lg bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1.5">
                        <div className="text-slate-500">Received</div>
                        <div className="font-semibold text-emerald-800 dark:text-emerald-300">{formatCurrency(received)}</div>
                        <div className="text-slate-500">{p.receivedCount || 0} time{(p.receivedCount || 0) === 1 ? '' : 's'}</div>
                      </div>
                      <div className="rounded-lg bg-rose-50 dark:bg-rose-500/10 px-2 py-1.5">
                        <div className="text-slate-500">Given</div>
                        <div className="font-semibold text-rose-800 dark:text-rose-300">{formatCurrency(given)}</div>
                        <div className="text-slate-500">{p.givenCount || 0} time{(p.givenCount || 0) === 1 ? '' : 's'}</div>
                      </div>
                      <div className="rounded-lg bg-slate-50 dark:bg-white/5 px-2 py-1.5">
                        <div className="text-slate-500">Total</div>
                        <div className="font-semibold">{formatCurrency(received + given)}</div>
                      </div>
                      <div className="rounded-lg bg-slate-50 dark:bg-white/5 px-2 py-1.5">
                        <div className="text-slate-500">Net</div>
                        <div className="font-semibold">{formatCurrency(Math.abs(balance))}</div>
                        <div className="text-slate-500">{balance === 0 ? 'Settled' : balance > 0 ? 'Received more' : 'Gave more'}</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" onClick={() => openMoney('RECEIVING', String(p.id))}>
                        <Wallet className="h-3.5 w-3.5" /> Receive
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => openMoney('GIVING', String(p.id))}>
                        <HandCoins className="h-3.5 w-3.5" /> Give
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => {
                        setFullForm({ partyId: String(p.id), received: '', given: '', notes: '' })
                        setFullOpen(true)
                      }}>
                        Add full amount
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setCalcPartyId(String(p.id))}>
                        Totals
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => void openPartyBill(p.id)}>
                        <Printer className="h-3.5 w-3.5" /> Bill
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <div className="card-3d overflow-hidden">
        <div className="px-5 py-3 bg-[#002D62] text-white font-semibold flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-[#C5A059]" />
          {section === 'PEOPLE' ? 'Recent receive & give' : 'History'}
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
                  {section === 'PEOPLE' && (
                    <th className="px-4 py-2">Type</th>
                  )}
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="px-4 py-2">Note</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((row) => (
                  <tr key={`${row.kind}-${row.id}`} className="border-b border-slate-100 dark:border-white/10">
                    <td className="px-4 py-2">{row.day}</td>
                    <td className="px-4 py-2">{row.date}</td>
                    <td className="px-4 py-2">{row.time}</td>
                    <td className="px-4 py-2 font-medium">{row.partyName || (row.kind === 'ZAKAT' ? 'Zakat' : '—')}</td>
                    {section === 'PEOPLE' && (
                      <td className="px-4 py-2">
                        <span className={row.kind === 'RECEIVING' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}>
                          {row.kind === 'RECEIVING' ? 'Received' : 'Given'}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-2 text-right font-semibold">{formatCurrency(row.amount)}</td>
                    <td className="px-4 py-2 text-slate-500">{row.notes || '—'}</td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        {section === 'PEOPLE' && row.partyId ? (
                          <Button
                            variant="ghost"
                            className="!py-1.5 !px-2"
                            onClick={() => setCalcPartyId(String(row.partyId))}
                          >
                            Totals
                          </Button>
                        ) : null}
                        <Button variant="secondary" className="!py-1.5 !px-2" onClick={() => void openEntryBill(row)}>
                          <Printer className="h-3.5 w-3.5" /> Bill
                        </Button>
                      </div>
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
          <p className="text-sm text-slate-500">
            One person is used for both receiving and giving. If the name already exists, that same account is reused.
          </p>
          <Input label="Name *" value={person.name} onChange={(e) => setPerson({ ...person, name: e.target.value })} />
          <Input label="Address (optional)" value={person.address} onChange={(e) => setPerson({ ...person, address: e.target.value })} />
          <Input label="Note (optional)" value={person.notes} onChange={(e) => setPerson({ ...person, notes: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setPersonOpen(false)}>Cancel</Button>
            <Button onClick={() => void savePerson()} loading={saving}>Save person</Button>
          </div>
        </div>
      </Modal>

      <Modal open={giveOpen} onClose={() => setGiveOpen(false)} title={money.kind === 'RECEIVING' ? 'Receive amount' : 'Give amount'}>
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            {money.kind === 'RECEIVING'
              ? 'Owner received this money from the selected person. You can receive more later — the total updates.'
              : 'Owner gave this money to the selected person. You can give more later — the total updates.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={money.kind === 'RECEIVING' ? 'primary' : 'secondary'}
              onClick={() => setMoney({ ...money, kind: 'RECEIVING' })}
            >
              Receive
            </Button>
            <Button
              size="sm"
              variant={money.kind === 'GIVING' ? 'primary' : 'secondary'}
              onClick={() => setMoney({ ...money, kind: 'GIVING' })}
            >
              Give
            </Button>
          </div>
          <PartyCombobox
            label="Name"
            required
            items={parties.map((p) => ({
              id: String(p.id),
              name: p.name,
              address: p.address,
              notes: `Received ${formatCurrency(p.receivedTotal || 0)} · Given ${formatCurrency(p.givenTotal || 0)}`,
            }))}
            value={money.partyId}
            onChange={(id) => setMoney({ ...money, partyId: id })}
            placeholder="Type ahs… then pick the name"
            emptyLabel="Add a person first"
          />
          {selectedParty && (
            <div className="rounded-lg bg-slate-50 dark:bg-white/5 px-3 py-2 text-[12px] text-slate-600 dark:text-slate-300">
              Current total for {selectedParty.name}: received {formatCurrency(selectedParty.receivedTotal || 0)} · given {formatCurrency(selectedParty.givenTotal || 0)} · {netCopy(selectedParty.balance ?? 0)}
            </div>
          )}
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

      <Modal open={fullOpen} onClose={() => setFullOpen(false)} title="Add full amount">
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            Record how much we received from this person and how much we gave them in one save. Leave a box empty if that side is zero.
          </p>
          <PartyCombobox
            label="Person"
            required
            items={parties.map((p) => ({
              id: String(p.id),
              name: p.name,
              address: p.address,
              notes: `Received ${formatCurrency(p.receivedTotal || 0)} · Given ${formatCurrency(p.givenTotal || 0)}`,
            }))}
            value={fullForm.partyId}
            onChange={(id) => setFullForm({ ...fullForm, partyId: id })}
            placeholder="Type a name, then pick the person"
            emptyLabel="Add a person first"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Amount received from them (PKR)"
              type="number"
              min="0"
              value={fullForm.received}
              onChange={(e) => setFullForm({ ...fullForm, received: e.target.value })}
            />
            <Input
              label="Amount given to them (PKR)"
              type="number"
              min="0"
              value={fullForm.given}
              onChange={(e) => setFullForm({ ...fullForm, given: e.target.value })}
            />
          </div>
          <Input
            label="Note (optional)"
            value={fullForm.notes}
            onChange={(e) => setFullForm({ ...fullForm, notes: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setFullOpen(false)}>Cancel</Button>
            <Button onClick={() => void saveFullAmount()} loading={saving} disabled={!parties.length}>Save both</Button>
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
          <PartyCombobox
            label="Farmer"
            required
            items={farmers.map((f) => ({
              id: String(f.id),
              code: f.farmerId,
              name: f.name,
              fatherName: f.fatherName,
              address: f.address,
              city: f.city,
              phone: f.phone,
            }))}
            value={advance.farmerId}
            onChange={(id) => setAdvance({ ...advance, farmerId: id })}
            placeholder="Type ahs… then pick Ahsan"
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
