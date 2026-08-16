import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  BarChart3,
  Package,
  PackagePlus,
  Receipt,
  Scale,
  ShoppingBag,
  Truck,
  Users,
  Wallet,
  Warehouse,
} from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import { Stagger, StaggerItem } from '../components/motion/Stagger'

const sections = [
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
    description: 'Receive and sell today’s bags, Extra KG stock, bills EN/UR',
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
    description: 'Arhat 3%, Munshi 0.70%, Workers 0.30% — preview & print',
  },
  {
    to: '/payments',
    icon: Wallet,
    title: 'Payment Records',
    description: 'Farmer payouts, buyer receipts, filter by date',
  },
]

export default function RecordsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Records"
        description="Open any record module — each card goes to its working page"
      />
      <Stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sections.map((section) => (
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
