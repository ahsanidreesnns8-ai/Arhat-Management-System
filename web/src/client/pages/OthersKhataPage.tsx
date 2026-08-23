import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { BookMarked, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import { TableSkeleton } from '../components/ui/Skeleton'
import { grainKhataApi } from '../services/api'
import { useLiveReload } from '../context/SyncContext'
import WheatKhataPage from './WheatKhataPage'
import type { GrainKhataBookMeta } from '../types'

function apiMessage(err: unknown, fallback: string) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback
}

export function OtherGrainKhataPage() {
  const { bookKey } = useParams()
  if (!bookKey) return <Navigate to="/others-khata" replace />
  return <WheatKhataPage bookKey={bookKey} />
}

export default function OthersKhataPage() {
  const navigate = useNavigate()
  const [books, setBooks] = useState<GrainKhataBookMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      const res = await grainKhataApi.books()
      setBooks((res.data.data || []).filter((book) => !book.builtin))
    } catch (err) {
      toast.error(apiMessage(err, 'Could not load Others Khata'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])
  useLiveReload(() => { void load(true) })

  const create = async () => {
    const next = name.trim()
    if (!next) {
      toast.error('Enter a name for this khata')
      return
    }
    setSaving(true)
    try {
      const res = await grainKhataApi.createBook({ name: next })
      const created = res.data.data
      toast.success(`${created.name} is ready`)
      setName('')
      setOpen(false)
      navigate(created.href)
    } catch (err) {
      toast.error(apiMessage(err, 'Could not create khata'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Others Khata"
        description="Create a named khata when you need a book besides Wheat, Barley, Maize, or Paddy. Tap Others Khata again anytime to add another name. Each named book works like Wheat Khata."
      />

      <div className="rounded-xl border border-amber-300/50 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
        Others Khata stays available so you can keep creating new books. A created khata appears with the name you typed and keeps its own money, parties, companies, bags, and bills.
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => { setName(''); setOpen(true) }}>
          <Plus className="h-4 w-4" /> Create khata
        </Button>
      </div>

      {loading ? (
        <div className="card-3d p-4"><TableSkeleton rows={3} /></div>
      ) : !books.length ? (
        <div className="card-3d p-6 space-y-3">
          <BookMarked className="h-6 w-6 text-primary" />
          <p className="font-semibold">No named khata yet</p>
          <p className="text-sm text-slate-500">
            Tap Create khata, type the name you want (for example Rice Mill or Cotton), then open it. Others Khata remains here for the next book.
          </p>
          <Button onClick={() => { setName(''); setOpen(true) }}>
            <Plus className="h-4 w-4" /> Create khata
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => { setName(''); setOpen(true) }}
            className="card-3d p-5 text-left border border-dashed border-[#C5A059]/50 hover:bg-slate-50 dark:hover:bg-white/5"
          >
            <Plus className="h-5 w-5 text-primary mb-2" />
            <p className="font-semibold">Create another khata</p>
            <p className="text-[11px] text-slate-500 mt-1">Others Khata stays here. Name the next book as you wish.</p>
          </button>
          {books.map((book) => (
            <Link key={book.key} to={book.href} className="card-3d p-5 hover:bg-slate-50 dark:hover:bg-white/5">
              <BookMarked className="h-5 w-5 text-primary mb-2" />
              <p className="font-semibold truncate">{book.name}</p>
              <p className="text-[11px] text-slate-500 mt-1">Open this khata — same Add Money, Add Party, and Add Company flow as Wheat Khata.</p>
            </Link>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Create khata">
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            Type the name you want this book to show. After you save, it appears here with that name and Others Khata still works for the next one.
          </p>
          <Input
            label="Khata name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="For example Rice Mill"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => void create()} loading={saving}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
