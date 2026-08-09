import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Users, ShoppingBag, Receipt, Warehouse, Percent, Wallet } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import { Stagger, StaggerItem } from '../components/motion/Stagger'

const sections = [
  { to: '/farmer-product', icon: Receipt, title: 'Farmer Product', description: 'Farmer product records and new product entry' },
  { to: '/arhat-sale', icon: Receipt, title: 'Arhat Sale', description: 'Sell to buyer or post farmer payable' },
  { to: '/farmers', icon: Users, title: 'Farmer Records', description: 'Registration, dheris, trucks, payments, and ledgers' },
  { to: '/buyers', icon: ShoppingBag, title: 'Buyer Records', description: 'Purchases, payments, and outstanding balances' },
  { to: '/sales', icon: Receipt, title: 'Sales Records', description: 'Invoices with mixed-source line items' },
  { to: '/dheris', icon: Warehouse, title: 'Dheri Records', description: 'Product lots with day-wise payment history' },
  { to: '/stock', icon: Warehouse, title: 'Stock Records', description: 'Incoming, outgoing, adjustments, and history' },
  { to: '/reports', icon: Percent, title: 'Commission Records', description: 'Arhat 3%, Munshi 0.70%, Workers 0.30% of total' },
  { to: '/payments', icon: Wallet, title: 'Payment Records', description: 'Farmer payouts, buyer receipts, filter by date' },
]

export default function RecordsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Records"
        description="Central hub for every farmer, buyer, sale, stock, commission, and payment record"
      />
      <Stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sections.map((section) => (
          <StaggerItem key={section.title}>
            <Link to={section.to} className="block h-full">
              <motion.div
                className="card p-6 h-full"
                whileHover={{ y: -4, transition: { type: 'spring', stiffness: 400, damping: 28 } }}
                whileTap={{ scale: 0.985 }}
              >
                <motion.div
                  className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4"
                  whileHover={{ scale: 1.1, rotate: -4 }}
                >
                  <section.icon className="h-5 w-5 text-primary" />
                </motion.div>
                <h3 className="font-semibold text-gray-900 dark:text-white">{section.title}</h3>
                <p className="text-sm text-gray-500 mt-1">{section.description}</p>
              </motion.div>
            </Link>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  )
}
