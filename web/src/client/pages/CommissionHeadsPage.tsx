import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import { TableSkeleton } from '../components/ui/Skeleton'
import { useLiveReload } from '../context/SyncContext'
import { reportApi } from '../services/api'
import { formatCurrency, formatNumber } from '../utils/format'
import type { CommissionHeadsBook } from '../types'

type HeadKey = 'arhat' | 'paledari' | 'tolai'

function keyFromPath(pathname: string): HeadKey {
  if (pathname.includes('paledari')) return 'paledari'
  if (pathname.includes('tolai')) return 'tolai'
  return 'arhat'
}

export default function CommissionHeadsPage() {
  const location = useLocation()
  const open = keyFromPath(location.pathname)
  const [book, setBook] = useState<CommissionHeadsBook | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      const res = await reportApi.heads()
      setBook(res.data.data)
    } catch {
      if (!quiet) toast.error('Could not load heads')
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])
  useLiveReload(() => { void load(true) })

  if (loading && !book) return <TableSkeleton rows={8} />

  const head = book?.[open]
  if (!head) return <p className="text-sm text-slate-500">No commission yet.</p>

  return (
    <div className="space-y-6">
      <PageHeader title={head.name} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card-3d p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total amount</p>
          <p className="text-2xl font-bold text-primary mt-1">{formatCurrency(head.total)}</p>
          <p className="text-xs text-slate-500 mt-1">{head.percentage}% of amount</p>
        </div>
        <div className="card-3d p-5 sm:col-span-2">
          <p className="text-xs uppercase tracking-wide text-slate-500">Recently added</p>
          {!head.recentlyAdded.length ? (
            <p className="text-sm text-slate-500 mt-2">No commission yet.</p>
          ) : (
            <div className="mt-2 space-y-2">
              {head.recentlyAdded.slice(0, 6).map((row) => (
                <div key={row.id} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <p className="font-semibold">{row.farmerName} · {row.dheriNumber}</p>
                  <p className="text-slate-500">
                    {row.date} · {row.time} · {formatNumber(row.bags, 0)} bags · {formatCurrency(row.share)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card-3d overflow-hidden">
        <div className="px-5 py-3 bg-[#002D62] text-white font-semibold">History</div>
        {!head.history.length ? (
          <p className="p-5 text-sm text-slate-500">No history yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-100 dark:border-white/10">
                  <th className="px-4 py-2">Day</th>
                  <th className="px-4 py-2">Dheri</th>
                  <th className="px-4 py-2">Farmer</th>
                  <th className="px-4 py-2">Product</th>
                  <th className="px-4 py-2">Bags</th>
                  <th className="px-4 py-2">Gross</th>
                  <th className="px-4 py-2">Commission</th>
                  <th className="px-4 py-2">This head</th>
                </tr>
              </thead>
              <tbody>
                {head.history.map((row) => (
                  <tr key={row.id} className="border-b border-slate-50 dark:border-white/5">
                    <td className="px-4 py-2">{row.date} · {row.time}</td>
                    <td className="px-4 py-2 font-medium">{row.dheriNumber}</td>
                    <td className="px-4 py-2">{row.farmerName}</td>
                    <td className="px-4 py-2">{row.productName}</td>
                    <td className="px-4 py-2">{formatNumber(row.bags, 0)}</td>
                    <td className="px-4 py-2">{formatCurrency(row.totalPrice)}</td>
                    <td className="px-4 py-2">{formatCurrency(row.commission)}</td>
                    <td className="px-4 py-2 font-semibold">{formatCurrency(row.share)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
