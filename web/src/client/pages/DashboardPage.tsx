import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  TrendingUp, Users, ShoppingBag, Package, Warehouse,
  ListOrdered, DollarSign, Percent, Activity, UserPlus, Scale, Store,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts'
import toast from 'react-hot-toast'
import StatCard from '../components/ui/StatCard'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import { StatCardSkeleton, Skeleton } from '../components/ui/Skeleton'
import { Stagger, StaggerItem } from '../components/motion/Stagger'
import { useLiveReload } from '../context/SyncContext'
import { buyerApi, dailyTradeApi, dashboardApi, farmerApi } from '../services/api'
import { formatCurrency, formatDateTime, formatNumber } from '../utils/format'
import type { DashboardStats } from '../types'
import { useBusiness } from '../context/BusinessContext'
import { fadeUp } from '../utils/motion'

const emptyWeeklyTrend = [
  { name: 'Mon', sales: 0, stock: 0 },
  { name: 'Tue', sales: 0, stock: 0 },
  { name: 'Wed', sales: 0, stock: 0 },
  { name: 'Thu', sales: 0, stock: 0 },
  { name: 'Fri', sales: 0, stock: 0 },
  { name: 'Sat', sales: 0, stock: 0 },
  { name: 'Sun', sales: 0, stock: 0 },
]

const activityLink = (entityType?: string) => {
  const t = (entityType || '').toUpperCase()
  if (t.includes('FARMER')) return '/farmers'
  if (t.includes('BUYER')) return '/buyers'
  if (t.includes('SALE')) return '/sales'
  if (t.includes('DHERI')) return '/dheris'
  if (t.includes('TRUCK')) return '/trucks'
  if (t.includes('STOCK')) return '/stock'
  if (t.includes('PAYMENT')) return '/payments'
  if (t.includes('QUEUE')) return '/queue'
  return '/records'
}

const emptyParty = { name: '', phone: '', city: '', address: '' }

export default function DashboardPage() {
  const { companyName } = useBusiness()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [board, setBoard] = useState<{
    receivedBags: number
    soldBags: number
    stockKg: number
    balanced: boolean
  } | null>(null)
  const [farmerOpen, setFarmerOpen] = useState(false)
  const [buyerOpen, setBuyerOpen] = useState(false)
  const [partyForm, setPartyForm] = useState(emptyParty)
  const [savingParty, setSavingParty] = useState(false)

  const load = useCallback(async (soft = false) => {
    if (!soft) setLoading(true)
    try {
      const [statsRes, boardRes] = await Promise.all([
        dashboardApi.getStats(),
        dailyTradeApi.getBoard().catch(() => null),
      ])
      setStats(statsRes.data?.data ?? null)
      if (boardRes?.data?.data) {
        const s = boardRes.data.data.session as {
          receivedBags: number
          soldBags: number
          balanced: boolean
        }
        setBoard({
          receivedBags: Number(s.receivedBags || 0),
          soldBags: Number(s.soldBags || 0),
          stockKg: Number(boardRes.data.data.stockKgAvailable || 0),
          balanced: Boolean(s.balanced),
        })
      }
      setLoadError(false)
    } catch {
      if (!soft) {
        try {
          await new Promise((r) => window.setTimeout(r, 700))
          const res = await dashboardApi.getStats()
          setStats(res.data?.data ?? null)
          setLoadError(false)
        } catch {
          setStats(null)
          setLoadError(true)
        }
      }
    } finally {
      if (!soft) setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])
  useLiveReload(() => { void load(true) })

  const saveParty = async (kind: 'farmer' | 'buyer') => {
    if (!partyForm.name.trim()) {
      toast.error('Name is required')
      return
    }
    setSavingParty(true)
    try {
      if (kind === 'farmer') {
        await farmerApi.create(partyForm)
        toast.success('Farmer added')
        setFarmerOpen(false)
      } else {
        await buyerApi.create(partyForm)
        toast.success('Buyer added')
        setBuyerOpen(false)
      }
      setPartyForm(emptyParty)
      void load(true)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Could not save')
    } finally {
      setSavingParty(false)
    }
  }

  const emptyStats: DashboardStats = {
    todaySales: 0,
    currentQueue: 0,
    totalFarmers: 0,
    totalBuyers: 0,
    totalDheris: 0,
    currentStock: 0,
    pendingPayments: 0,
    revenue: 0,
    commission: 0,
    weeklyTrend: emptyWeeklyTrend,
    recentActivity: [],
  }
  const view = stats || emptyStats
  const chartData = view.weeklyTrend?.length ? view.weeklyTrend : emptyWeeklyTrend

  const statCards = [
    { title: "Today's Sales", value: formatCurrency(view.todaySales), icon: <TrendingUp className="h-5 w-5" />, color: 'teal' as const, to: '/sales' },
    { title: 'Current Queue', value: view.currentQueue, icon: <ListOrdered className="h-5 w-5" />, color: 'orange' as const, to: '/queue' },
    { title: 'Total Farmers', value: view.totalFarmers, icon: <Users className="h-5 w-5" />, color: 'green' as const, to: '/farmers' },
    { title: 'Total Buyers', value: view.totalBuyers, icon: <ShoppingBag className="h-5 w-5" />, color: 'blue' as const, to: '/buyers' },
    { title: 'Total Dheris', value: view.totalDheris, icon: <Package className="h-5 w-5" />, color: 'amber' as const, to: '/dheris' },
    { title: 'Current Stock', value: formatNumber(view.currentStock), icon: <Warehouse className="h-5 w-5" />, color: 'green' as const, to: '/stock' },
    { title: 'Pending Payments', value: formatCurrency(view.pendingPayments), icon: <DollarSign className="h-5 w-5" />, color: 'red' as const, to: '/payments' },
    { title: 'Revenue', value: formatCurrency(view.revenue), icon: <TrendingUp className="h-5 w-5" />, color: 'teal' as const, to: '/sales' },
    { title: 'Commission', value: formatCurrency(view.commission), icon: <Percent className="h-5 w-5" />, color: 'orange' as const, to: '/reports' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Welcome to ${companyName} — tap any card for full details`}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Button
          className="h-auto py-3 flex-col sm:flex-row gap-1.5"
          onClick={() => { setPartyForm(emptyParty); setFarmerOpen(true) }}
        >
          <UserPlus className="h-4 w-4" /> Add Farmer
        </Button>
        <Button
          className="h-auto py-3 flex-col sm:flex-row gap-1.5"
          variant="secondary"
          onClick={() => { setPartyForm(emptyParty); setBuyerOpen(true) }}
        >
          <ShoppingBag className="h-4 w-4" /> Add Buyer
        </Button>
        <Link to="/arhat-sale" className="contents">
          <Button className="h-auto py-3 flex-col sm:flex-row gap-1.5 w-full" variant="secondary">
            <Store className="h-4 w-4" /> Arhat Sale
          </Button>
        </Link>
        <Link to="/daily-trade" className="contents">
          <Button className="h-auto py-3 flex-col sm:flex-row gap-1.5 w-full" variant="secondary">
            <Scale className="h-4 w-4" /> Daily Trade
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link to="/daily-trade" className="card-3d p-5 block hover:ring-1 hover:ring-primary/30 transition">
          <p className="text-xs uppercase tracking-wide text-slate-500">Receiving today</p>
          <p className="text-3xl font-bold mt-1 tabular-nums">{board?.receivedBags ?? 0}</p>
          <p className="text-sm text-slate-500">bags from farmers · Extra stock {formatNumber(board?.stockKg ?? 0)} kg</p>
        </Link>
        <Link to="/daily-trade" className="card-3d p-5 block hover:ring-1 hover:ring-primary/30 transition">
          <p className="text-xs uppercase tracking-wide text-slate-500">Selling today</p>
          <p className="text-3xl font-bold mt-1 tabular-nums">{board?.soldBags ?? 0}</p>
          <p className={`text-sm mt-1 ${board?.balanced ? 'text-emerald-600' : 'text-amber-700 dark:text-amber-300'}`}>
            {board?.balanced ? 'Equal with receiving' : `Need ${(board?.receivedBags ?? 0) - (board?.soldBags ?? 0)} more bags to balance`}
          </p>
        </Link>
      </div>

      {loadError && !loading && (
        <div className="rounded-xl border border-amber-300/50 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-200 flex items-center justify-between gap-3">
          <span>Could not refresh live stats. Showing zeros until the API reconnects.</span>
          <button type="button" onClick={() => load()} className="font-semibold underline">Retry</button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      ) : (
        <Stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {statCards.map((card) => (
            <StaggerItem key={card.title}>
              <StatCard {...card} />
            </StaggerItem>
          ))}
        </Stagger>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div className="card-3d p-6" variants={fadeUp} initial="hidden" animate="show">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Weekly Sales Trend</h3>
            <Link to="/sales" className="text-sm text-primary dark:text-accent-500 hover:underline">View sales</Link>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#002D62" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#C5A059" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip
                contentStyle={{
                  background: 'rgba(11,29,54,0.94)',
                  border: '1px solid rgba(197,160,89,0.3)',
                  borderRadius: 12,
                  color: '#F3EFE6',
                }}
              />
              <Area
                type="monotone"
                dataKey="sales"
                stroke="#3B6FA8"
                fill="url(#salesGrad)"
                strokeWidth={2.5}
                isAnimationActive
                animationDuration={900}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div
          className="card-3d p-6"
          variants={fadeUp}
          initial="hidden"
          animate="show"
          transition={{ delay: 0.08 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Stock Levels</h3>
            <Link to="/stock" className="text-sm text-primary dark:text-accent-500 hover:underline">View stock</Link>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <defs>
                <linearGradient id="stockGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C5A059" />
                  <stop offset="100%" stopColor="#0A3A75" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip
                contentStyle={{
                  background: 'rgba(11,29,54,0.94)',
                  border: '1px solid rgba(197,160,89,0.3)',
                  borderRadius: 12,
                  color: '#F3EFE6',
                }}
              />
              <Bar
                dataKey="stock"
                fill="url(#stockGrad)"
                radius={[8, 8, 0, 0]}
                isAnimationActive
                animationDuration={900}
                animationEasing="ease-out"
              />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      <motion.div className="card-3d p-6" variants={fadeUp} initial="hidden" animate="show">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-5 w-5 text-accent" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Recent Activity</h3>
        </div>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : stats?.recentActivity?.length ? (
          <Stagger className="space-y-3">
            {stats.recentActivity.map((item, i) => (
              <StaggerItem key={i}>
                <Link to={activityLink(item.entityType)}>
                  <motion.div
                    className="flex items-center justify-between p-3 rounded-xl border border-primary/5 dark:border-accent/10 bg-gradient-to-r from-primary/5 to-accent/10 hover:from-primary/10 hover:to-accent/15 transition-colors"
                    whileHover={{ x: 4, scale: 1.01 }}
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{item.description}</p>
                      <p className="text-xs text-slate-500">{item.entityType} · {item.action}</p>
                    </div>
                    <span className="text-xs text-slate-400">{formatDateTime(item.timestamp)}</span>
                  </motion.div>
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
        ) : (
          <p className="text-gray-500 text-sm">No recent activity yet.</p>
        )}
      </motion.div>

      <Modal open={farmerOpen} onClose={() => setFarmerOpen(false)} title="Add Farmer">
        <PartyForm
          form={partyForm}
          setForm={setPartyForm}
          saving={savingParty}
          onSave={() => void saveParty('farmer')}
        />
      </Modal>
      <Modal open={buyerOpen} onClose={() => setBuyerOpen(false)} title="Add Buyer">
        <PartyForm
          form={partyForm}
          setForm={setPartyForm}
          saving={savingParty}
          onSave={() => void saveParty('buyer')}
        />
      </Modal>
    </div>
  )
}

function PartyForm({
  form,
  setForm,
  saving,
  onSave,
}: {
  form: typeof emptyParty
  setForm: (v: typeof emptyParty) => void
  saving: boolean
  onSave: () => void
}) {
  return (
    <div className="space-y-3">
      <Input label="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      <Input label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
      <Input label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
      <Button onClick={onSave} loading={saving}>Save</Button>
    </div>
  )
}
