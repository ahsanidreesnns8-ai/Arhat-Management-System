import { useEffect, useState } from 'react'
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
import { dashboardApi } from '../services/api'
import { formatCurrency, formatDateTime } from '../utils/format'
import type { DashboardStats } from '../types'
import { useBusiness } from '../context/BusinessContext'

const chartData = [
  { name: 'Mon', sales: 42000, stock: 1200 },
  { name: 'Tue', sales: 38000, stock: 1100 },
  { name: 'Wed', sales: 55000, stock: 980 },
  { name: 'Thu', sales: 47000, stock: 850 },
  { name: 'Fri', sales: 62000, stock: 720 },
  { name: 'Sat', sales: 71000, stock: 600 },
  { name: 'Sun', sales: 45000, stock: 550 },
]

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
    { title: "Today's Sales", value: formatCurrency(stats.todaySales), icon: <TrendingUp className="h-5 w-5" />, color: 'blue' as const },
    { title: 'Current Queue', value: stats.currentQueue, icon: <ListOrdered className="h-5 w-5" />, color: 'orange' as const },
    { title: 'Total Farmers', value: stats.totalFarmers, icon: <Users className="h-5 w-5" />, color: 'green' as const },
    { title: 'Total Buyers', value: stats.totalBuyers, icon: <ShoppingBag className="h-5 w-5" />, color: 'purple' as const },
    { title: 'Total Dheris', value: stats.totalDheris, icon: <Package className="h-5 w-5" />, color: 'blue' as const },
    { title: 'Current Stock', value: formatNumber(stats.currentStock), icon: <Warehouse className="h-5 w-5" />, color: 'green' as const },
    { title: 'Pending Payments', value: formatCurrency(stats.pendingPayments), icon: <DollarSign className="h-5 w-5" />, color: 'red' as const },
    { title: 'Revenue', value: formatCurrency(stats.revenue), icon: <TrendingUp className="h-5 w-5" />, color: 'blue' as const },
    { title: 'Commission', value: formatCurrency(stats.commission), icon: <Percent className="h-5 w-5" />, color: 'orange' as const },
  ] : []

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Dashboard"
        description={`Welcome to ${companyName} — live business overview`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading
          ? Array.from({ length: 9 }).map((_, i) => <StatCardSkeleton key={i} />)
          : statCards.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <StatCard {...card} />
            </motion.div>
          ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Weekly Sales Trend</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} />
              <Tooltip />
              <Area type="monotone" dataKey="sales" stroke="#2563EB" fill="url(#salesGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Stock Levels</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} />
              <Tooltip />
              <Bar dataKey="stock" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h3>
        </div>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : stats?.recentActivity?.length ? (
          <div className="space-y-3">
            {stats.recentActivity.map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{item.description}</p>
                  <p className="text-xs text-gray-500">{item.entityType} · {item.action}</p>
                </div>
                <span className="text-xs text-gray-400">{formatDateTime(item.timestamp)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No recent activity yet.</p>
        )}
      </div>
    </div>
  )
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-PK').format(value)
}
