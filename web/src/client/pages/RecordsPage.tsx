import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowRight,
  BarChart3,
  ChevronDown,
  ChevronRight,
  History,
  Package,
  PackagePlus,
  Receipt,
  Scale,
  ShoppingBag,
  Truck,
  Users,
  Wallet,
  Warehouse,
  Wheat,
  Sprout,
  Flower2,
  BookMarked,
  Leaf,
  Coins,
} from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import { Stagger, StaggerItem } from '../components/motion/Stagger'
import { dailyTradeApi } from '../services/api'
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '../utils/format'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { isOwnerFinanceRole } from '../../lib/roles'

const sections: Array<{
  to: string
  icon: LucideIcon
  title: string
  description: string
  ownerOnly?: boolean
}> = [
  {
    to: '/farmer-product',
    icon: PackagePlus,
    title: 'Farmer Product',
    description: 'Farmer product records and new product entry',
  },
  {
    to: '/daily-trade',
    icon: Scale,
    title: 'Daily Trade',
    description: 'Today’s board. Refresh saves the day here and starts from zero.',
  },
  {
    to: '/wheat-khata',
    icon: Wheat,
    title: 'Wheat Khata',
    description: 'Your Wheat Khata IDs with a name and secret code — same money, party, and company book as before',
  },
  {
    to: '/barley-khata',
    icon: Sprout,
    title: 'Barley Khata',
    description: 'Your Barley Khata IDs with a name and secret code, same pattern as Wheat Khata',
  },
  {
    to: '/maize-khata',
    icon: Flower2,
    title: 'Maize Khata',
    description: 'Your Maize Khata IDs with a name and secret code, same pattern as Wheat Khata',
  },
  {
    to: '/others-khata',
    icon: BookMarked,
    title: 'Others Khata',
    description: 'Create a named khata ID with a secret code. It appears with that name and Others Khata stays ready for the next one',
  },
  {
    to: '/paddy-khata',
    icon: Leaf,
    title: 'Paddy Khata',
    description: 'Secret Paddy Khata IDs for cash, purchase, variety, processing, rice, and receive amount',
  },
  {
    to: '/arhat-amount',
    icon: Coins,
    title: 'Arhat Amount',
    description: 'Shop cash book except Wheat Khata. Merge both books for a combined bill.',
  },
  {
    to: '/farmers',
    icon: Users,
    title: 'Farmer Records',
    description: 'Registration, dheris, trucks, payments, and ledgers',
  },
  {
    to: '/buyers',
    icon: ShoppingBag,
    title: 'Buyer Records',
    description: 'Purchases, payments, and outstanding balances',
  },
  {
    to: '/sales',
    icon: Receipt,
    title: 'Sales Records',
    description: 'Invoices with mixed-source line items',
  },
  {
    to: '/dheris',
    icon: Package,
    title: 'Dheri Records',
    description: 'Product lots with day-wise payment history',
  },
  {
    to: '/trucks',
    icon: Truck,
    title: 'Truck Records',
    description: 'Incoming trucks linked to farmers and dheris',
  },
  {
    to: '/stock',
    icon: Warehouse,
    title: 'Stock Records',
    description: 'Incoming, outgoing, adjustments, and history',
  },
  {
    to: '/reports?type=commission',
    icon: BarChart3,
    title: 'Commission Records',
    description: 'Arhat Head 3%, Paledari Head 0.70%, Tolai Head 0.30%',
    ownerOnly: true,
  },
  {
    to: '/payments',
    icon: Wallet,
    title: 'Payment Records',
    description: 'Farmer payouts, buyer receipts, filter by date',
  },
]

type ArchivedReceive = {
  dheriId?: string
  farmerName?: string
  productName?: string
  bags?: number
  weight?: number
  sellingStatus?: string
}

type ArchivedSale = {
  invoiceNumber?: string
  buyerName?: string
  bags?: number
  amount?: number
  items?: Array<{ dheriCode?: string; sourceType?: string }>
}

type ArchivedDay = {
  id: number
  sessionDate: string
  closedAt: string | null
  receivedBags: number
  soldBags: number
  receivedWeightKg: number
  soldWeightKg: number
  receiveCount: number
  saleCount: number
  receives: ArchivedReceive[]
  sales: ArchivedSale[]
}

export default function RecordsPage() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const showFinance = isOwnerFinanceRole(user?.role)
  const [days, setDays] = useState<ArchivedDay[]>([])
  const [openId, setOpenId] = useState<number | null>(null)
  const [loadingDays, setLoadingDays] = useState(true)

  useEffect(() => {
    let cancelled = false
    void dailyTradeApi
      .getHistory()
      .then((res) => {
        if (!cancelled) setDays((res.data.data || []) as ArchivedDay[])
      })
      .catch(() => {
        if (!cancelled) setDays([])
      })
      .finally(() => {
        if (!cancelled) setLoadingDays(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Records"
      />

      <section className="card-3d overflow-hidden">
        <div className="px-5 py-3 bg-[#002D62] text-white font-semibold flex items-center gap-2">
          <History className="h-4 w-4 text-[#C5A059]" />
          Daily Trade — saved days
        </div>
        {loadingDays && (
          <p className="p-4 text-sm text-slate-500">Loading saved days…</p>
        )}
        {!loadingDays && !days.length && (
          <p className="p-4 text-sm text-slate-500">
            No saved days yet. On Daily Trade, tap Refresh — next day (Save today to Records).
          </p>
        )}
        <div className="divide-y divide-slate-100 dark:divide-white/10">
          {days.map((day) => {
            const open = openId === day.id
            return (
              <div key={day.id}>
                <button
                  type="button"
                  className="w-full px-5 py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-50 dark:hover:bg-white/5"
                  onClick={() => setOpenId(open ? null : day.id)}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    {open ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-primary" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                    )}
                    <span className="font-medium truncate">
                      {formatDate(day.sessionDate)}
                      {day.closedAt ? ` · saved ${formatDateTime(day.closedAt)}` : ''}
                    </span>
                  </span>
                  <span className="text-xs text-slate-500 shrink-0">
                    In {day.receivedBags} {t('bags')} · Out {day.soldBags} {t('bags')}
                  </span>
                </button>
                {open && (
                  <div className="px-5 pb-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-white/10">
                      <div className="px-3 py-2 text-sm font-semibold bg-emerald-700 text-white">
                        Receiving · {day.receiveCount} · {formatNumber(day.receivedWeightKg)} kg
                      </div>
                      <table className="w-full text-sm">
                        <thead className="text-left bg-emerald-50 dark:bg-emerald-950/20">
                          <tr>
                            <th className="px-3 py-2">Dheri</th>
                            <th className="px-3 py-2">Farmer</th>
                            <th className="px-3 py-2">{t('bags')}</th>
                            <th className="px-3 py-2">Weight</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                          {day.receives.map((row, idx) => (
                            <tr key={`${day.id}-r-${idx}`}>
                              <td className="px-3 py-2">{row.dheriId || '—'}</td>
                              <td className="px-3 py-2">{row.farmerName || '—'}</td>
                              <td className="px-3 py-2">{row.bags ?? 0}</td>
                              <td className="px-3 py-2">{formatNumber(row.weight)} kg</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-white/10">
                      <div className="px-3 py-2 text-sm font-semibold bg-[#002D62] text-white">
                        Selling · {day.saleCount} · {formatNumber(day.soldWeightKg)} kg
                      </div>
                      <table className="w-full text-sm">
                        <thead className="text-left bg-slate-50 dark:bg-slate-800/50">
                          <tr>
                            <th className="px-3 py-2">Invoice</th>
                            <th className="px-3 py-2">Seller</th>
                            <th className="px-3 py-2">{t('bags')}</th>
                            <th className="px-3 py-2">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                          {day.sales.map((row, idx) => (
                            <tr key={`${day.id}-s-${idx}`}>
                              <td className="px-3 py-2">{row.invoiceNumber || '—'}</td>
                              <td className="px-3 py-2">{row.buyerName || '—'}</td>
                              <td className="px-3 py-2">{row.bags ?? 0}</td>
                              <td className="px-3 py-2">{formatCurrency(row.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <Stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sections
          .filter((section) => showFinance || !section.ownerOnly)
          .map((section) => (
          <StaggerItem key={section.title}>
            <Link to={section.to} className="block h-full group">
              <motion.div
                className="card-3d p-6 h-full flex flex-col"
                whileHover={{ y: -6, transition: { type: 'spring', stiffness: 400, damping: 28 } }}
                whileTap={{ scale: 0.985 }}
              >
                <motion.div
                  className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/15 to-accent/20 border border-accent/30 flex items-center justify-center mb-4 shadow-[0_0_16px_rgba(197,160,89,0.18)]"
                  whileHover={{ scale: 1.1, rotate: -4 }}
                >
                  <section.icon className="h-5 w-5 text-primary dark:text-accent-500" />
                </motion.div>
                <h3 className="font-semibold text-slate-900 dark:text-white">{section.title}</h3>
                <p className="text-sm text-slate-500 mt-1 flex-1">{section.description}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary group-hover:gap-2 transition-all">
                  Open <ArrowRight className="h-4 w-4" />
                </span>
              </motion.div>
            </Link>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  )
}
