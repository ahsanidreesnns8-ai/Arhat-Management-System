import { Construction } from 'lucide-react'
import Card from '../components/ui/Card'

interface PlaceholderPageProps {
  title: string
  description?: string
}

export default function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{title}</h1>
      <Card>
        <div className="flex flex-col items-center justify-center text-center py-12">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Construction className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Coming soon</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
            {description ?? `The ${title} module is being built next.`}
          </p>
        </div>
      </Card>
    </div>
  )
}
