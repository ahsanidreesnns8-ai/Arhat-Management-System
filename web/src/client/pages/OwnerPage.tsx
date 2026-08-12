import { useEffect, useState } from 'react'
import { Shield, Users, Database, Activity, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Modal from '../components/ui/Modal'
import { useAuth } from '../context/AuthContext'
import { auditApi, backupApi, userApi } from '../services/api'
import type { SystemUser } from '../types'
import { useVoicePageActions } from '../context/VoiceControlContext'

export default function OwnerPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState<SystemUser[]>([])
  const [logs, setLogs] = useState<Array<{ action: string; entityType: string; createdAt: string }>>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ username: '', email: '', fullName: '', password: '', role: 'OPERATOR' })
  const [saving, setSaving] = useState(false)

  const load = () => {
    userApi.getAll().then((res) => setUsers(res.data.data || [])).catch(() => toast.error('Failed to load users'))
    auditApi.getRecent().then((res) => setLogs(res.data.data || [])).catch(() => {})
  }

  useEffect(() => { load() }, [])

  const createUser = async () => {
    if (!form.username || !form.email || !form.password || !form.fullName) {
      toast.error('Fill all required fields')
      return
    }
    setSaving(true)
    try {
      await userApi.create(form)
      toast.success('User created')
      setModalOpen(false)
      setForm({ username: '', email: '', fullName: '', password: '', role: 'OPERATOR' })
      load()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Failed to create user')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (u: SystemUser) => {
    try {
      if (u.active) await userApi.suspend(u.id)
      else await userApi.activate(u.id)
      toast.success(u.active ? 'User suspended' : 'User activated')
      load()
    } catch {
      toast.error('Update failed')
    }
  }

  const doBackup = async () => {
    try {
      const res = await backupApi.export()
      const blob = res.data as Blob
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `rehmani-backup-${new Date().toISOString().slice(0, 10)}.zip`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Backup downloaded')
    } catch {
      toast.error('Backup failed')
    }
  }

  const doRestore = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const parsed = JSON.parse(text)
        await backupApi.restore(parsed)
        toast.success('Restore completed')
        load()
      } catch {
        toast.error('Restore failed — use Backup JSON file')
      }
    }
    input.click()
  }

  const doBackupJson = async () => {
    try {
      const res = await backupApi.exportJson()
      const blob = new Blob([JSON.stringify(res.data?.data ?? res.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `rehmani-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('JSON backup downloaded')
    } catch {
      toast.error('JSON backup failed')
    }
  }

  useVoicePageActions({
    openCreate: () => setModalOpen(true),
    save: () => { void createUser() },
    cancel: () => setModalOpen(false),
    refresh: () => load(),
  })

  const summary = [
    { label: 'Role', value: user?.role || 'OWNER', icon: Shield },
    { label: 'Users', value: String(users.length), icon: Users },
    { label: 'Backup', value: 'Ready', icon: Database },
    { label: 'Audit', value: String(logs.length), icon: Activity },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Owner Panel"
        description="Users, backups, audit"
        action={
          <Button size="sm" onClick={() => setModalOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-2">
        {summary.map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/70 dark:bg-white/5 px-3 py-2.5"
          >
            <div className="flex items-center gap-1.5 text-slate-500 mb-1">
              <item.icon className="h-3.5 w-3.5" />
              <span className="text-[10px] font-medium uppercase tracking-wide">{item.label}</span>
            </div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="px-3 py-2.5 border-b border-gray-100 dark:border-gray-800 text-sm font-semibold">
          Users
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {users.map((u) => (
            <div key={u.id} className="px-3 py-2.5 flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{u.fullName}</p>
                <p className="text-[11px] text-gray-500 truncate">
                  {u.username} · {u.role} · {u.active ? 'Active' : 'Suspended'}
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => toggleActive(u)}>
                {u.active ? 'Suspend' : 'Activate'}
              </Button>
            </div>
          ))}
          {!users.length && (
            <p className="p-3 text-sm text-gray-500">No users</p>
          )}
        </div>
      </div>

      <div className="card p-3 space-y-2">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Database className="h-4 w-4 text-primary" />
          Database
        </h3>
        <p className="text-[11px] text-gray-500">
          Use JSON for restore. ZIP is archive only.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={doBackup}>ZIP</Button>
          <Button size="sm" variant="secondary" onClick={doBackupJson}>JSON</Button>
          <Button size="sm" variant="secondary" onClick={doRestore}>Restore</Button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-3 py-2.5 border-b border-gray-100 dark:border-gray-800 text-sm font-semibold">
          Audit log
        </div>
        <ul className="divide-y divide-gray-100 dark:divide-gray-800 max-h-56 overflow-y-auto">
          {logs.length === 0 && (
            <li className="p-3 text-sm text-gray-500">No events yet</li>
          )}
          {logs.map((log, i) => (
            <li key={i} className="px-3 py-2 text-[12px]">
              <span className="font-medium">{log.action}</span> · {log.entityType}
              <div className="text-[10px] text-gray-500">{log.createdAt}</div>
            </li>
          ))}
        </ul>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create user">
        <div className="space-y-2.5">
          <Input label="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <Input label="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <Select
            label="Role"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            options={[
              { value: 'OWNER', label: 'Owner' },
              { value: 'ADMIN', label: 'Admin' },
              { value: 'SUPERVISOR', label: 'Supervisor' },
              { value: 'OPERATOR', label: 'Operator' },
              { value: 'VIEWER', label: 'Viewer' },
            ]}
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={createUser} loading={saving}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
