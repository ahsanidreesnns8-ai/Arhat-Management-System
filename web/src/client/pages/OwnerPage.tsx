import { useEffect, useState } from 'react'
import { Shield, Users, Database, Activity, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../components/ui/PageHeader'
import StatCard from '../components/ui/StatCard'
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
        toast.error('Restore failed — select the backup JSON (not the ZIP). Use Export JSON if needed.')
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
      toast.success('JSON backup downloaded (use this file for Restore)')
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


  return (
    <div className="space-y-6">
      <PageHeader
        title="Owner Panel"
        description="User management, backups, and audit controls"
        action={<Button onClick={() => setModalOpen(true)}><Plus className="h-4 w-4" /> Add user</Button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Your Role" value={user?.role || 'OWNER'} icon={<Shield className="h-5 w-5" />} color="teal" />
        <StatCard title="Users" value={String(users.length)} icon={<Users className="h-5 w-5" />} color="blue" />
        <StatCard title="Database Backup" value="Ready" icon={<Database className="h-5 w-5" />} color="green" />
        <StatCard title="Audit events" value={String(logs.length)} icon={<Activity className="h-5 w-5" />} color="orange" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 font-semibold">User management</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-left">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Role</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-2">
                      <div className="font-medium">{u.fullName}</div>
                      <div className="text-xs text-gray-500">{u.username} · {u.email}</div>
                    </td>
                    <td className="px-4 py-2">{u.role}</td>
                    <td className="px-4 py-2">{u.active ? 'Active' : 'Suspended'}</td>
                    <td className="px-4 py-2 text-right">
                      <Button size="sm" variant="secondary" onClick={() => toggleActive(u)}>
                        {u.active ? 'Suspend' : 'Activate'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Database Management
            </h3>
            <p className="text-gray-500 text-sm mb-4">
              ZIP is for archive. For Restore, download JSON and select that JSON file.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button onClick={doBackup}>Backup ZIP</Button>
              <Button variant="secondary" onClick={doBackupJson}>Backup JSON</Button>
              <Button variant="secondary" onClick={doRestore}>Restore from JSON</Button>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 font-semibold">Recent audit log</div>
            <ul className="divide-y divide-gray-100 dark:divide-gray-800 max-h-72 overflow-y-auto">
              {logs.length === 0 && <li className="p-4 text-sm text-gray-500">No audit events yet</li>}
              {logs.map((log, i) => (
                <li key={i} className="px-4 py-3 text-sm">
                  <span className="font-medium">{log.action}</span> on {log.entityType}
                  <div className="text-xs text-gray-500">{log.createdAt}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create user">
        <div className="space-y-3">
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
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={createUser} loading={saving}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
