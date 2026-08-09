interface StatCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  trend?: string
  color?: 'blue' | 'green' | 'orange' | 'purple' | 'red'
}

const colorMap = {
  blue: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  green: 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400',
  orange: 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
  purple: 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  red: 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400',
}

export default function StatCard({ title, value, icon, trend, color = 'blue' }: StatCardProps) {
  return (
    <div className="stat-card group">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
          {trend && <p className="text-xs text-gray-400 mt-1">{trend}</p>}
        </div>
        <div className={clsx('p-3 rounded-xl transition-transform group-hover:scale-110', colorMap[color])}>
          {icon}
        </div>
      </div>
    </div>
  )
}

function clsx(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
