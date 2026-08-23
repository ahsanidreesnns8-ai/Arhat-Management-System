import { useEffect, useState } from 'react'
import { Shield, Users, Database, Activity, Plus, Clock, KeyRound, Trash2 } from 'lucide-react'
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

const PASSWORD_HINT =
  'At least 10 characters, with letters and numbers. Do not reuse a leaked password.'

type ShopStorage = {
  databaseBytes: number
  databaseSize: string
  neonFreeCap: string
  measuredAt: string
  counts: Record<string, number>
}

function isSystemAccount(username: string) {
  const value = username.trim().toLowerCase()
  return value === 'owner' || value === 'staff'
}

export default function OwnerPage() {
  const { user, logout } = useAuth()
  const [users, setUsers] = useState<SystemUser[]>([])
  const [logs, setLogs] = useState<Array<{ action: string; entityType: string; createdAt: string }>>([])
  const [staffUsage, setStaffUsage] = useState<StaffUsageSummary | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ username: '', fullName: '', password: '' })
  const [saving, setSaving] = useState(false)
  const [passwordUser, setPasswordUser] = useState<SystemUser | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [deleteUserRow, setDeleteUserRow] = useState<SystemUser | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [storage, setStorage] = useState<ShopStorage | null>(null)
  const [wipeOpen, setWipeOpen] = useState(false)
  const [wipeConfirm, setWipeConfirm] = useState('')
  const [wiping, setWiping] = useState(false)

  const load = () => {
    userApi.getAll().then((res) => setUsers(res.data.data || [])).catch(() => toast.error('Failed to load users'))
    auditApi.getRecent().then((res) => setLogs(res.data.data || [])).catch(() => {})
    userApi.staffUsage().then((res) => setStaffUsage(res.data.data || null)).catch(() => {})
    backupApi.usage().then((res) => setStorage(res.data.data || null)).catch(() => {})
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
    if (u.username === 'owner' || u.role === 'OWNER') {
      toast.error('Owner account cannot be suspended')
      return
    }
    try {
      if (u.active) await userApi.suspend(u.id)
      else await userApi.activate(u.id)
      toast.success(u.active ? 'User suspended — they cannot sign in' : 'User activated — they can sign in again')
      load()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Update failed')
    }
  }

  const savePassword = async () => {
    if (!passwordUser) return
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    setSavingPassword(true)
    try {
      await userApi.updatePassword(passwordUser.id, newPassword)
      const changingSelf = user?.id === passwordUser.id || user?.username === passwordUser.username
      setPasswordUser(null)
      setNewPassword('')
      setConfirmPassword('')
      if (changingSelf) {
        toast.success('Password updated. Sign in again with the new password.')
        logout()
        window.location.assign('/login')
        return
      }
      toast.success(`Password updated for ${passwordUser.username}`)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Failed to update password')
    } finally {
      setSavingPassword(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteUserRow) return
    if (deleteConfirm.trim().toLowerCase() !== deleteUserRow.username.toLowerCase()) {
      toast.error('Type the username to confirm delete')
      return
    }
    setDeleting(true)
    try {
      await userApi.delete(deleteUserRow.id)
      toast.success(`${deleteUserRow.username} deleted — they can no longer log in`)
      setDeleteUserRow(null)
      setDeleteConfirm('')
      load()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Failed to delete user')
    } finally {
      setDeleting(false)
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

  const confirmWipe = async () => {
    if (wipeConfirm.trim().toUpperCase() !== 'START NEW') {
      toast.error('Type START NEW to wipe shop data')
      return
    }
    setWiping(true)
    try {
      const res = await backupApi.wipe()
      setStorage(res.data.data || null)
      setWipeOpen(false)
      setWipeConfirm('')
      toast.success('Shop is empty. Owner and staff logins still work.')
      load()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Wipe failed')
    } finally {
      setWiping(false)
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
        description="Change your password, add users, suspend access, and manage staff. Staff cannot change passwords."
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const me =
                  users.find((row) => row.username === user?.username) ||
                  (user
                    ? {
                        id: user.id,
                        username: user.username,
                        fullName: user.fullName,
                        email: user.email || '',
                        role: user.role,
                        active: true,
                      }
                    : null)
                if (!me) return
                setPasswordUser(me)
                setNewPassword('')
                setConfirmPassword('')
              }}
            >
              <KeyRound className="h-3.5 w-3.5" /> Change my password
            </Button>
            <Button size="sm" onClick={() => setModalOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add user
            </Button>
          </div>
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
        <div className="px-3 py-2 text-[11px] text-gray-500 border-b border-gray-100 dark:border-gray-800">
          Add a name, username, and password so that person can sign in. Change any password — the previous one is deleted. Suspend a user to block the site. Staff cannot do this. The owner login cannot be suspended or deleted.
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {users.map((u) => {
            const system = isSystemAccount(u.username)
            return (
              <div key={u.id} className="px-3 py-2.5 flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{u.fullName}</p>
                  <p className="text-[11px] text-gray-500 truncate">
                    {u.username} · {u.role} · {u.active ? 'Active' : 'Suspended'}
                    {system ? ' · system' : ''}
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setPasswordUser(u)
                      setNewPassword('')
                      setConfirmPassword('')
                    }}
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    Password
                  </Button>
                  {!system && (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => toggleActive(u)}>
                        {u.active ? 'Suspend' : 'Activate'}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          setDeleteUserRow(u)
                          setDeleteConfirm('')
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </>
                  )}
                  {system && u.username !== 'owner' && (
                    <Button size="sm" variant="secondary" onClick={() => toggleActive(u)}>
                      {u.active ? 'Suspend' : 'Activate'}
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
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
          Use JSON for restore. ZIP is archive only. Neon free storage cap is {storage?.neonFreeCap || '0.5 GB'}. Compute hours are on the Neon dashboard.
        </p>
        {storage && (
          <div className="rounded-lg bg-slate-50 dark:bg-white/5 px-3 py-2 text-[12px] space-y-1">
            <p><span className="font-semibold">{storage.databaseSize}</span> stored now</p>
            <p className="text-[11px] text-gray-500">
              Farmers {storage.counts.farmers ?? 0} · Buyers {storage.counts.buyers ?? 0} · Dheris {storage.counts.dheris ?? 0} · Sales {storage.counts.sales ?? 0} · Payments {storage.counts.payments ?? 0}
            </p>
            <p className="text-[10px] text-gray-500">Measured {formatDateTime(storage.measuredAt)}</p>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={doBackup}>ZIP</Button>
          <Button size="sm" variant="secondary" onClick={doBackupJson}>JSON</Button>
          <Button size="sm" variant="secondary" onClick={doRestore}>Restore</Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              setWipeConfirm('')
              setWipeOpen(true)
            }}
          >
            Start brand new shop
          </Button>
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
          <p className="text-[11px] text-slate-500">{PASSWORD_HINT}</p>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={createUser} loading={saving}>Save</Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!passwordUser}
        onClose={() => setPasswordUser(null)}
        title={passwordUser ? `Change password · ${passwordUser.username}` : 'Change password'}
      >
        <div className="space-y-2.5">
          <p className="text-[12px] text-slate-500">
            This permanently replaces the previous password. {passwordUser?.username} will be signed out everywhere. {PASSWORD_HINT}
          </p>
          <Input
            label="New password *"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
          <Input
            label="Confirm password *"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setPasswordUser(null)}>Cancel</Button>
            <Button onClick={savePassword} loading={savingPassword}>Update password</Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!deleteUserRow}
        onClose={() => setDeleteUserRow(null)}
        title={deleteUserRow ? `Delete ${deleteUserRow.username}` : 'Delete user'}
      >
        <div className="space-y-2.5">
          <p className="text-[12px] text-slate-500">
            This removes {deleteUserRow?.fullName} ({deleteUserRow?.username}). They will not be able to log in. Type the username to confirm.
          </p>
          <Input
            label="Username *"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            autoComplete="off"
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setDeleteUserRow(null)}>Cancel</Button>
            <Button variant="danger" onClick={confirmDelete} loading={deleting}>Delete user</Button>
          </div>
        </div>
      </Modal>

      <Modal open={wipeOpen} onClose={() => setWipeOpen(false)} title="Start brand new shop">
        <div className="space-y-2.5">
          <p className="text-[12px] text-slate-500">
            This permanently deletes farmers, buyers, dheris, sales, payments, Wheat Khata, Barley Khata, Maize Khata, Others Khata, Paddy Khata, Arhat Register, and extra users. Owner and staff logins stay. Products and company settings stay. Type START NEW to confirm.
          </p>
          <Input
            label='Type START NEW *'
            value={wipeConfirm}
            onChange={(e) => setWipeConfirm(e.target.value)}
            autoComplete="off"
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setWipeOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={confirmWipe} loading={wiping}>Wipe shop data</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
