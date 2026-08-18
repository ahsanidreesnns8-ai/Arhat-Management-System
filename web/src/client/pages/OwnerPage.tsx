import { useEffect, useState } from 'react'
import { Shield, Users, Database, Activity, Plus, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import { useAuth } from '../context/AuthContext'
import { auditApi, backupApi, userApi } from '../services/api'
import type { StaffUsageSummary, SystemUser } from '../types'
import { useVoicePageActions } from '../context/VoiceControlContext'
import { formatDateTime } from '../utils/format'

export default function OwnerPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState<SystemUser[]>([])
  const [logs, setLogs] = useState<Array<{ action: string; entityType: string; createdAt: string }>>([])
  const [staffUsage, setStaffUsage] = useState<StaffUsageSummary | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ username: '', fullName: '', password: '' })
  const [saving, setSaving] = useState(false)

  const load = () => {
    userApi.getAll().then((res) => setUsers(res.data.data || [])).catch(() => toast.error('Failed to load users'))
    auditApi.getRecent().then((res) => setLogs(res.data.data || [])).catch(() => {})
    userApi.staffUsage().then((res) => setStaffUsage(res.data.data || null)).catch(() => {})
  }

  useEffect(() => { load() }, [])

  const createUser = async () => {
    if (!form.username.trim() || !form.password.trim() || !form.fullName.trim()) {
      toast.error('Fill name, username, and password')
      return
    }
    setSaving(true)
    try {
      await userApi.create({
        fullName: form.fullName.trim(),
        username: form.username.trim(),
        password: form.password,
        role: 'OPERATOR',
      })
      toast.success('User saved — they can log in now')
      setModalOpen(false)
      setForm({ username: '', fullName: '', password: '' })
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
        description="Users, staff access time, backups, audit"
        action={
          <Button size="sm" onClick={() => setModalOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Add user
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
        <div className="px-3 py-2.5 border-b border-gray-100 dark:border-gray-800 text-sm font-semibold flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-primary" />
          Staff access time
        </div>
        <div className="px-3 py-2 text-[11px] text-gray-500 border-b border-gray-100 dark:border-gray-800">
          How many times and how long staff accounts used this website. Shared owner logins are not listed here.
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {(staffUsage?.staff || []).map((row) => (
            <div key={row.userId} className="px-3 py-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{row.fullName}</p>
                  <p className="text-[11px] text-gray-500 truncate">
                    {row.username} · {row.role} · {row.active ? 'Active' : 'Suspended'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-primary">{row.totalDurationLabel}</p>
                  <p className="text-[10px] text-gray-500">{row.loginCount} login{row.loginCount === 1 ? '' : 's'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-lg bg-slate-50 dark:bg-white/5 px-2 py-1.5">
                  <div className="text-gray-500">Active now</div>
                  <div className="font-medium">{row.activeSessions}</div>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-white/5 px-2 py-1.5">
                  <div className="text-gray-500">Last login</div>
                  <div className="font-medium">{row.lastLoginAt ? formatDateTime(row.lastLoginAt) : '—'}</div>
                </div>
              </div>
              {row.recentSessions.length > 0 && (
                <ul className="space-y-1 max-h-36 overflow-y-auto">
                  {row.recentSessions.map((s) => (
                    <li key={s.id} className="text-[11px] flex justify-between gap-2 text-gray-600 dark:text-gray-300">
                      <span className="truncate">
                        {formatDateTime(s.loginAt)}
                        {s.active ? ' · online' : ''}
                      </span>
                      <span className="font-medium shrink-0">{s.durationLabel}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          {!staffUsage?.staff?.length && (
            <p className="p-3 text-sm text-gray-500">No staff usage yet — staff logins will appear here.</p>
          )}
        </div>
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add user">
        <div className="space-y-2.5">
          <p className="text-[12px] text-slate-500">
            Save a name, username, and password. That person can then sign in on the login page with those details.
          </p>
          <Input label="Name *" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <Input label="Username *" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} autoComplete="off" />
          <Input label="Password *" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={createUser} loading={saving}>Save</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
