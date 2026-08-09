import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  TrendingUp, Users, ShoppingBag, Package, Warehouse,
  ListOrdered, DollarSign, Percent, Activity,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from 'recharts'
import StatCard from '../components/ui/StatCard'
import PageHeader from '../components/ui/PageHeader'
import { StatCardSkeleton, Skeleton } from '../components/ui/Skeleton'
import { Stagger, StaggerItem } from '../components/motion/Stagger'
import { dashboardApi } from '../services/api'
import { formatCurrency, formatDateTime } from '../utils/format'
import type { DashboardStats } from '../types'
import { useBusiness } from '../context/BusinessContext'
import { fadeUp } from '../utils/motion'

const chartData = [
  { name: 'Mon', sales: 42000, stock: 1200 },
  { name: 'Tue', sales: 38000, stock: 1100 },
  { name: 'Wed', sales: 55000, stock: 980 },
  { name: 'Thu', sales: 47000, stock: 850 },
  { name: 'Fri', sales: 62000, stock: 720 },
  { name: 'Sat', sales: 71000, stock: 600 },
  { name: 'Sun', sales: 45000, stock: 550 },
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
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    dashboardApi.getStats()
      .then((res) => setStats(res.data.data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false))
  }, [])

  const statCards = stats ? [
    { title: "Today's Sales", value: formatCurrency(stats.todaySales), icon: <TrendingUp className="h-5 w-5" />, color: 'teal' as const, to: '/sales' },
    { title: 'Current Queue', value: stats.currentQueue, icon: <ListOrdered className="h-5 w-5" />, color: 'orange' as const, to: '/queue' },
    { title: 'Total Farmers', value: stats.totalFarmers, icon: <Users className="h-5 w-5" />, color: 'green' as const, to: '/farmers' },
    { title: 'Total Buyers', value: stats.totalBuyers, icon: <ShoppingBag className="h-5 w-5" />, color: 'blue' as const, to: '/buyers' },
    { title: 'Total Dheris', value: stats.totalDheris, icon: <Package className="h-5 w-5" />, color: 'amber' as const, to: '/dheris' },
    { title: 'Current Stock', value: formatNumber(stats.currentStock), icon: <Warehouse className="h-5 w-5" />, color: 'green' as const, to: '/stock' },
    { title: 'Pending Payments', value: formatCurrency(stats.pendingPayments), icon: <DollarSign className="h-5 w-5" />, color: 'red' as const, to: '/payments' },
    { title: 'Revenue', value: formatCurrency(stats.revenue), icon: <TrendingUp className="h-5 w-5" />, color: 'teal' as const, to: '/sales' },
    { title: 'Commission', value: formatCurrency(stats.commission), icon: <Percent className="h-5 w-5" />, color: 'orange' as const, to: '/reports' },
  ] : []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Welcome to ${companyName} — tap any card for full details`}
      />

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
            <Link to="/sales" className="text-sm text-cyan-500 dark:text-cyan-300 hover:underline">View sales</Link>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip
                contentStyle={{
                  background: 'rgba(15,23,42,0.92)',
                  border: '1px solid rgba(56,189,248,0.25)',
                  borderRadius: 12,
                  color: '#E2E8F0',
                }}
              />
              <Area
                type="monotone"
                dataKey="sales"
                stroke="#38BDF8"
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
            <Link to="/stock" className="text-sm text-cyan-500 dark:text-cyan-300 hover:underline">View stock</Link>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <defs>
                <linearGradient id="stockGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#A78BFA" />
                  <stop offset="100%" stopColor="#22D3EE" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip
                contentStyle={{
                  background: 'rgba(15,23,42,0.92)',
                  border: '1px solid rgba(139,92,246,0.3)',
                  borderRadius: 12,
                  color: '#E2E8F0',
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
          <Activity className="h-5 w-5 text-cyan-400" />
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
                    className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-gradient-to-r from-sky-500/5 to-violet-500/10 hover:from-sky-500/10 hover:to-violet-500/15 transition-colors"
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
    </div>
  )
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-PK').format(value)
}
