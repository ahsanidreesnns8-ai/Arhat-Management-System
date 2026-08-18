import { useCallback, useEffect, useState } from 'react'
import { Play, CheckCircle, XCircle, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Select from '../components/ui/Select'
import Modal from '../components/ui/Modal'
import { TableSkeleton } from '../components/ui/Skeleton'
import { useLiveReload } from '../context/SyncContext'
import { useVoicePageActions } from '../context/VoiceControlContext'
import { queueApi, dheriApi } from '../services/api'
import { useLanguage } from '../context/LanguageContext'
import type { Dheri, QueueEntry } from '../types'

export default function QueuePage() {
  const { t } = useLanguage()
  const [pending, setPending] = useState<QueueEntry[]>([])
  const [active, setActive] = useState<QueueEntry[]>([])
  const [completed, setCompleted] = useState<QueueEntry[]>([])
  const [dheris, setDheris] = useState<Dheri[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedDheri, setSelectedDheri] = useState('')

  const load = useCallback((soft = false) => {
    if (!soft) setLoading(true)
    Promise.allSettled([queueApi.getPending(), queueApi.getActive(), queueApi.getCompleted(), dheriApi.getAll()])
      .then(([p, a, c, d]) => {
        if (p.status === 'fulfilled') setPending(p.value.data?.data ?? [])
        if (a.status === 'fulfilled') setActive(a.value.data?.data ?? [])
        if (c.status === 'fulfilled') setCompleted(c.value.data?.data ?? [])
        if (d.status === 'fulfilled') setDheris((d.value.data?.data ?? []).filter((dh) => !dh.queueNumber))
        const failed = [p, a, c, d].filter((r) => r.status === 'rejected').length
        if (failed === 4 && !soft) toast.error('Failed to load queue')
      })
      .finally(() => { if (!soft) setLoading(false) })
  }, [])

  useEffect(() => { load() }, [load])
  useLiveReload(() => load(true))

  const handleAdd = async () => {
    if (!selectedDheri) return
    try {
      await queueApi.add(parseInt(selectedDheri))
      toast.success('Added to queue')
      setModalOpen(false)
      load()
    } catch {
      toast.error('Failed to add to queue')
    }
  }

  const handleAction = async (id: number, action: 'activate' | 'complete' | 'cancel') => {
    try {
      if (action === 'activate') await queueApi.activate(id)
      else if (action === 'complete') await queueApi.complete(id)
      else await queueApi.cancel(id)
      const labels = { activate: 'activated', complete: 'completed', cancel: 'cancelled' } as const
      toast.success(`Queue ${labels[action]}`)
      load()
    } catch {
      toast.error(`Failed to ${action} queue`)
    }
  }

  const QueueTable = ({ entries, showActions }: { entries: QueueEntry[]; showActions?: boolean }) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <th className="text-left p-3 font-semibold text-gray-600">Queue #</th>
            <th className="text-left p-3 font-semibold text-gray-600">Dheri</th>
            <th className="text-left p-3 font-semibold text-gray-600">Farmer</th>
            <th className="text-left p-3 font-semibold text-gray-600">Product</th>
            <th className="text-right p-3 font-semibold text-gray-600">{t('bags')}</th>
            {showActions && <th className="text-right p-3 font-semibold text-gray-600">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-b border-gray-100 dark:border-gray-800">
              <td className="p-3 font-mono text-primary font-bold">#{e.queueNumber}</td>
              <td className="p-3">{e.dheriCode}</td>
              <td className="p-3">{e.farmerName}</td>
              <td className="p-3">{e.productName}</td>
              <td className="p-3 text-right">{e.numberOfBags}</td>
              {showActions && (
                <td className="p-3 text-right">
                  <div className="flex justify-end gap-1">
                    {e.status === 'PENDING' && (
                      <button onClick={() => handleAction(e.id, 'activate')} className="p-2 rounded-lg hover:bg-green-50 text-green-600" title="Activate">
                        <Play className="h-4 w-4" />
                      </button>
                    )}
                    {e.status === 'ACTIVE' && (
                      <button onClick={() => handleAction(e.id, 'complete')} className="p-2 rounded-lg hover:bg-blue-50 text-blue-600" title="Complete">
                        <CheckCircle className="h-4 w-4" />
                      </button>
                    )}
                    {(e.status === 'PENDING' || e.status === 'ACTIVE') && (
                      <button onClick={() => handleAction(e.id, 'cancel')} className="p-2 rounded-lg hover:bg-red-50 text-red-600" title="Cancel">
                        <XCircle className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
          {!entries.length && (
            <tr><td colSpan={showActions ? 6 : 5} className="p-6 text-center text-gray-500">No entries</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )

  useVoicePageActions({
    openCreate: () => setModalOpen(true),
    save: () => { void handleAdd() },
    cancel: () => setModalOpen(false),
    refresh: () => load(),
  })


  return (
    <div className="space-y-6">
      <PageHeader
        title="Queue Management"
        description="Each dheri gets its own independent queue number"
        action={
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Add to Queue
          </Button>
        }
      />

      {loading ? (
        <div className="card p-6"><TableSkeleton /></div>
      ) : (
        <div className="space-y-6">
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-yellow-500" />
              <h3 className="font-semibold">Pending Queue ({pending.length})</h3>
            </div>
            <QueueTable entries={pending} showActions />
          </div>

          <div className="card overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <h3 className="font-semibold">Active Queue ({active.length})</h3>
            </div>
            <QueueTable entries={active} showActions />
          </div>

          <div className="card overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gray-400" />
              <h3 className="font-semibold">Completed ({completed.length})</h3>
            </div>
            <QueueTable entries={completed.slice(0, 10)} />
          </div>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Dheri to Queue">
        <Select
          label="Select Dheri"
          value={selectedDheri}
          onChange={(e) => setSelectedDheri(e.target.value)}
          options={[
            { value: '', label: 'Select dheri' },
            ...dheris.map((d) => ({ value: d.id, label: `${d.dheriId} — ${d.farmerName}` })),
          ]}
        />
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button onClick={handleAdd}>Add to Queue</Button>
        </div>
      </Modal>
    </div>
  )
}
