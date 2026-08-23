import { useCallback, useEffect, useState } from 'react'
import { BookMarked, Flower2, Lock, Plus, Sprout, Wheat } from 'lucide-react'
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

type GrainCrop = 'wheat' | 'barley' | 'maize' | 'other'

const CROP_UI: Record<GrainCrop, {
  title: string
  idLabel: string
  description: string
  empty: string
  icon: typeof Wheat
}> = {
  wheat: {
    title: 'Wheat Khata',
    idLabel: 'Wheat Khata ID',
    description: 'Separate wheat books. Each Wheat Khata ID has its own name and secret code, and stays out of shop cash until the owner merges the shop Wheat Khata.',
    empty: 'Tap the plus button to create a Wheat Khata ID and set a secret code.',
    icon: Wheat,
  },
  barley: {
    title: 'Barley Khata',
    idLabel: 'Barley Khata ID',
    description: 'Separate barley books. Each Barley Khata ID has its own name and secret code, like Paddy Khata.',
    empty: 'Tap the plus button to create a Barley Khata ID and set a secret code.',
    icon: Sprout,
  },
  maize: {
    title: 'Maize Khata',
    idLabel: 'Maize Khata ID',
    description: 'Separate maize books. Each Maize Khata ID has its own name and secret code, like Paddy Khata.',
    empty: 'Tap the plus button to create a Maize Khata ID and set a secret code.',
    icon: Flower2,
  },
  other: {
    title: 'Others Khata',
    idLabel: 'Others Khata ID',
    description: 'Create a named khata when you need another book. Each ID has its own name and secret code. Others Khata stays here so you can make another.',
    empty: 'Tap the plus button, type the name you want, and set a secret code.',
    icon: BookMarked,
  },
}

function apiMessage(err: unknown, fallback: string) {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback
}

function secretKey(bookKey: string) {
  return `grain-khata-secret:${bookKey}`
}

export default function GrainKhataHubPage({ crop }: { crop: GrainCrop }) {
  const ui = CROP_UI[crop]
  const Icon = ui.icon
  const [books, setBooks] = useState<GrainKhataBookMeta[]>([])
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [secret, setSecret] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [unlockOpen, setUnlockOpen] = useState<GrainKhataBookMeta | null>(null)
  const [createForm, setCreateForm] = useState({ name: '', secret: '' })
  const [unlockSecret, setUnlockSecret] = useState('')

  const loadList = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      const res = await grainKhataApi.books(crop)
      setBooks(res.data.data || [])
    } catch (err) {
      toast.error(apiMessage(err, `Could not load ${ui.title}`))
    } finally {
      setLoading(false)
    }
  }, [crop, ui.title])

  const openBook = async (item: GrainKhataBookMeta, code: string) => {
    setLoading(true)
    try {
      await grainKhataApi.book(item.key, code || undefined)
      setOpenKey(item.key)
      setSecret(code)
      if (item.locked && code) sessionStorage.setItem(secretKey(item.key), code)
    } catch (err) {
      toast.error(apiMessage(err, 'Could not open this khata'))
      setOpenKey(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setOpenKey(null)
    setSecret('')
    void loadList()
  }, [loadList])

  useLiveReload(() => {
    if (!openKey) void loadList(true)
  })

  const saveCreate = async () => {
    if (crop === 'other' && !createForm.name.trim()) {
      toast.error('Enter a name for this khata')
      return
    }
    if (createForm.secret.trim().length < 4) {
      toast.error('Secret code must be at least 4 characters')
      return
    }
    setSaving(true)
    try {
      const code = createForm.secret.trim()
      const res = await grainKhataApi.createBook({
        crop,
        name: createForm.name.trim() || undefined,
        secret: code,
      })
      toast.success(`${ui.idLabel} created`)
      setCreateOpen(false)
      setCreateForm({ name: '', secret: '' })
      const created = res.data.data
      if (created?.key) {
        sessionStorage.setItem(secretKey(created.key), code)
        setOpenKey(created.key)
        setSecret(code)
      } else {
        void loadList(true)
      }
    } catch (err) {
      toast.error(apiMessage(err, `Could not create ${ui.idLabel}`))
    } finally {
      setSaving(false)
    }
  }

  const saveUnlock = async () => {
    if (!unlockOpen) return
    setSaving(true)
    try {
      await openBook(unlockOpen, unlockSecret.trim())
      setUnlockOpen(null)
      setUnlockSecret('')
    } finally {
      setSaving(false)
    }
  }

  const tapBook = (item: GrainKhataBookMeta) => {
    if (!item.locked) {
      void openBook(item, '')
      return
    }
    const stored = sessionStorage.getItem(secretKey(item.key))
    if (stored) {
      void openBook(item, stored)
      return
    }
    setUnlockOpen(item)
    setUnlockSecret('')
  }

  if (openKey) {
    return (
      <WheatKhataPage
        bookKey={openKey}
        secret={secret}
        onBack={() => {
          setOpenKey(null)
          setSecret('')
          void loadList()
        }}
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={ui.title}
        description={ui.description}
        action={
          <Button onClick={() => { setCreateForm({ name: '', secret: '' }); setCreateOpen(true) }}>
            <Plus className="h-4 w-4" /> {ui.idLabel}
          </Button>
        }
      />
      {loading ? (
        <TableSkeleton rows={4} />
      ) : !books.length ? (
        <div className="card-3d p-8 text-center">
          <Icon className="h-8 w-8 mx-auto text-[#C5A059] mb-3" />
          <p className="font-semibold">No {ui.idLabel} yet</p>
          <p className="text-sm text-slate-500 mt-1">{ui.empty}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {books.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => tapBook(item)}
              className="card-3d p-5 text-left hover:bg-slate-50 dark:hover:bg-white/5"
            >
              <p className="text-xs uppercase tracking-wide text-slate-500">{item.publicId}</p>
              <p className="text-lg font-semibold mt-1">{item.name}</p>
              <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
                <Lock className="h-3 w-3" />
                {item.locked ? 'Secret code required' : 'Shop book · no secret'}
              </p>
            </button>
          ))}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={`Create ${ui.idLabel}`}>
        <div className="space-y-3">
          <Input
            label={crop === 'other' ? 'Name *' : 'Name'}
            value={createForm.name}
            onChange={(e) => setCreateForm((s) => ({ ...s, name: e.target.value }))}
            placeholder={crop === 'other' ? 'Type the name you want' : ui.title}
          />
          <Input
            label="Secret code"
            type="password"
            value={createForm.secret}
            onChange={(e) => setCreateForm((s) => ({ ...s, secret: e.target.value }))}
            placeholder="At least 4 characters"
          />
          <Button className="w-full" loading={saving} onClick={() => void saveCreate()}>Save ID</Button>
        </div>
      </Modal>
      <Modal open={!!unlockOpen} onClose={() => setUnlockOpen(null)} title={unlockOpen ? `Open ${unlockOpen.publicId}` : 'Open'}>
        <div className="space-y-3">
          <p className="text-sm text-slate-500">{unlockOpen?.name}</p>
          <Input label="Secret code" type="password" value={unlockSecret} onChange={(e) => setUnlockSecret(e.target.value)} />
          <Button className="w-full" loading={saving} onClick={() => void saveUnlock()}>Open</Button>
        </div>
      </Modal>
    </div>
  )
}
