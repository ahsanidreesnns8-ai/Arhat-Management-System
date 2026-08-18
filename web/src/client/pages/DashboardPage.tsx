import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  TrendingUp, Users, ShoppingBag, Package, Warehouse,
  ListOrdered, DollarSign, Percent, Activity, UserPlus, Scale, BookOpen, PackagePlus, Wheat, Coins,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts'
import toast from 'react-hot-toast'
import StatCard from '../components/ui/StatCard'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import PartyFields, { emptyPartyForm, type PartyFormValues } from '../components/forms/PartyFields'
import Modal from '../components/ui/Modal'
import { StatCardSkeleton, Skeleton } from '../components/ui/Skeleton'
import { Stagger, StaggerItem } from '../components/motion/Stagger'
import { useLiveReload } from '../context/SyncContext'
import { buyerApi, dashboardApi, farmerApi } from '../services/api'
import { formatCurrency, formatDateTime, formatNumber } from '../utils/format'
import type { DashboardStats } from '../types'
import { useAuth } from '../context/AuthContext'
import { useBusiness } from '../context/BusinessContext'
import { fadeUp } from '../utils/motion'
import { isOwnerFinanceRole } from '../../lib/roles'

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

export default function DashboardPage() {
  const { companyName } = useBusiness()
  const { user } = useAuth()
  const showFinance = isOwnerFinanceRole(user?.role)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [farmerOpen, setFarmerOpen] = useState(false)
  const [buyerOpen, setBuyerOpen] = useState(false)
  const [partyForm, setPartyForm] = useState<PartyFormValues>(emptyPartyForm())
  const [savingParty, setSavingParty] = useState(false)

  const load = useCallback(async (soft = false) => {
    if (!soft) setLoading(true)
    try {
      const [statsRes] = await Promise.all([
        dashboardApi.getStats(),
      ])
      setStats(statsRes.data?.data ?? null)
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
    if (!partyForm.code.trim()) {
      toast.error('Enter the ID you assign')
      return
    }
    setSavingParty(true)
    try {
      const payload = {
        name: partyForm.name,
        fatherName: partyForm.fatherName,
        code: partyForm.code,
        farmerId: partyForm.code,
        buyerId: partyForm.code,
        address: partyForm.address,
        city: partyForm.city,
        notes: partyForm.notes,
      }
      if (kind === 'farmer') {
        await farmerApi.create(payload)
        toast.success('Farmer added')
        setFarmerOpen(false)
      } else {
        await buyerApi.create(payload)
        toast.success('Buyer added')
        setBuyerOpen(false)
      }
      setPartyForm(emptyPartyForm())
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
    extraKgStock: 0,
    stockAsOf: '',
    stockLots: [],
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
    { title: 'Current Stock', value: formatNumber(view.currentStock), icon: <Warehouse className="h-5 w-5" />, color: 'green' as const, to: '/stock', trend: `Extra KG ${formatNumber(view.extraKgStock || 0)} · as of ${view.stockAsOf || 'today'}` },
    { title: 'Pending Payments', value: formatCurrency(view.pendingPayments), icon: <DollarSign className="h-5 w-5" />, color: 'red' as const, to: '/payments', ownerOnly: true },
    { title: 'Revenue', value: formatCurrency(view.revenue), icon: <TrendingUp className="h-5 w-5" />, color: 'teal' as const, to: '/sales', ownerOnly: true },
    { title: 'Commission', value: formatCurrency(view.commission), icon: <Percent className="h-5 w-5" />, color: 'orange' as const, to: '/reports', ownerOnly: true },
  ].filter((card) => showFinance || !card.ownerOnly)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Welcome to ${companyName} — tap any card for full details`}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Button
          className="h-auto py-3 flex-col sm:flex-row gap-1.5"
          onClick={() => { setPartyForm(emptyPartyForm()); setFarmerOpen(true) }}
        >
          <UserPlus className="h-4 w-4" /> Add Farmer
        </Button>
        <Button
          className="h-auto py-3 flex-col sm:flex-row gap-1.5"
          variant="secondary"
          onClick={() => { setPartyForm(emptyPartyForm()); setBuyerOpen(true) }}
        >
          <ShoppingBag className="h-4 w-4" /> Add Buyer
        </Button>
        <Link to="/daily-trade" className="contents">
          <Button className="h-auto py-3 flex-col sm:flex-row gap-1.5 w-full" variant="secondary">
            <Scale className="h-4 w-4" /> Daily Trade
          </Button>
        </Link>
        <Link to="/farmer-product" className="contents">
          <Button className="h-auto py-3 flex-col sm:flex-row gap-1.5 w-full" variant="secondary">
            <PackagePlus className="h-4 w-4" /> Farmer Product
          </Button>
        </Link>
        <Link to="/wheat-khata" className="contents">
          <Button className="h-auto py-3 flex-col sm:flex-row gap-1.5 w-full" variant="secondary">
            <Wheat className="h-4 w-4" /> Wheat Khata
          </Button>
        </Link>
        <Link to="/arhat-amount" className="contents">
          <Button className="h-auto py-3 flex-col sm:flex-row gap-1.5 w-full" variant="secondary">
            <Coins className="h-4 w-4" /> Arhat Amount
          </Button>
        </Link>
        {showFinance && (
          <Link to="/arhat-register" className="contents">
            <Button className="h-auto py-3 flex-col sm:flex-row gap-1.5 w-full" variant="secondary">
              <BookOpen className="h-4 w-4" /> Arhat Register
            </Button>
          </Link>
        )}
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

      {(view.stockLots?.length || 0) > 0 && (
        <div className="card-3d overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
            <h3 className="font-semibold">Stock details</h3>
            <span className="text-xs text-slate-500">as of {view.stockAsOf || 'today'}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-4 py-2">Product</th>
                  <th className="px-4 py-2">Remaining kg</th>
                  <th className="px-4 py-2">Amount</th>
                  <th className="px-4 py-2">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                {view.stockLots!.map((lot, i) => (
                  <tr key={`${lot.productName}-${lot.intakeDate}-${i}`}>
                    <td className="px-4 py-2">{lot.productName}</td>
                    <td className="px-4 py-2">{formatNumber(lot.remainingKg)} kg</td>
                    <td className="px-4 py-2">{formatCurrency(lot.amountValue)}</td>
                    <td className="px-4 py-2">{lot.intakeDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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
        <div className="space-y-4">
          <PartyFields form={partyForm} setForm={setPartyForm} idLabel="Farmer ID" />
          <Button onClick={() => void saveParty('farmer')} loading={savingParty}>Save</Button>
        </div>
      </Modal>
      <Modal open={buyerOpen} onClose={() => setBuyerOpen(false)} title="Add Buyer">
        <div className="space-y-4">
          <PartyFields form={partyForm} setForm={setPartyForm} idLabel="Buyer ID" />
          <Button onClick={() => void saveParty('buyer')} loading={savingParty}>Save</Button>
        </div>
      </Modal>
    </div>
  )
}
