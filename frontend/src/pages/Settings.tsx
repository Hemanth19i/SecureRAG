import { useState } from 'react'
import { Bell, Key, Users, Globe, Monitor, ToggleLeft, ToggleRight, Copy, RefreshCw, Check, UserPlus, X, Loader2, AlertTriangle, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { register, ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth'

const settingsSections = [
  { id: 'general', label: 'General', icon: Globe },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'api', label: 'API Keys', icon: Key },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'appearance', label: 'Appearance', icon: Monitor },
]

const apiKeys = [
  { name: 'Production API', key: 'srag_prod_••••••••••••X8f2', created: '2026-01-15', lastUsed: '2 min ago' },
  { name: 'Development API', key: 'srag_dev_••••••••••••K3m9', created: '2026-03-22', lastUsed: '1 hr ago' },
  { name: 'Integration API', key: 'srag_int_••••••••••••P7q4', created: '2026-05-10', lastUsed: '3 hr ago' },
]

const notificationSettings = [
  { label: 'Critical Alerts', description: 'Immediate notifications for critical severity alerts', enabled: true },
  { label: 'New Investigations', description: 'When a new investigation is created', enabled: true },
  { label: 'Case Assignments', description: 'When a case is assigned to you', enabled: true },
  { label: 'IOC Enrichment Complete', description: 'When IOC enrichment finishes', enabled: false },
  { label: 'Daily Digest', description: 'Summary of daily activity', enabled: true },
  { label: 'Weekly Report', description: 'Weekly threat landscape summary', enabled: false },
]

export default function Settings() {
  const { role } = useAuth()
  const isAdmin = role === 'ADMIN'
  const [activeSection, setActiveSection] = useState('general')
  const [notifs, setNotifs] = useState(notificationSettings)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [density, setDensity] = useState('default')

  // Create-user modal (wired to the ADMIN-only POST /auth/register).
  const [showCreate, setShowCreate] = useState(false)
  const [cuUser, setCuUser] = useState('')
  const [cuPass, setCuPass] = useState('')
  const [cuRole, setCuRole] = useState('ANALYST')
  const [cuBusy, setCuBusy] = useState(false)
  const [cuError, setCuError] = useState('')

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (cuUser.trim().length < 3 || cuPass.length < 8) {
      setCuError('Username ≥ 3 chars and password ≥ 8 chars required.')
      return
    }
    setCuBusy(true)
    setCuError('')
    try {
      await register(cuUser.trim(), cuPass, cuRole)
      toast.success(`User "${cuUser.trim()}" created`, { description: `Role: ${cuRole}. They can now log in.` })
      setShowCreate(false)
      setCuUser(''); setCuPass(''); setCuRole('ANALYST')
    } catch (err) {
      setCuError(
        err instanceof ApiError
          ? (err.status === 409 ? 'Username already exists.'
            : err.status === 403 ? 'Only ADMIN can create users.'
            : err.message)
          : 'Could not create user.',
      )
    } finally {
      setCuBusy(false)
    }
  }

  const toggleNotif = (index: number) => {
    setNotifs(prev => prev.map((n, i) => i === index ? { ...n, enabled: !n.enabled } : n))
  }

  const copyKey = (index: number) => {
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto h-full flex gap-6">
      {/* Sidebar */}
      <div className="w-56 shrink-0">
        <nav className="space-y-0.5 sticky top-4">
          {settingsSections.map(section => {
            const Icon = section.icon
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm transition-colors ${
                  activeSection === section.id
                    ? 'bg-sr-elevated text-sr-text font-medium'
                    : 'text-sr-text-secondary hover:bg-sr-elevated hover:text-sr-text'
                }`}
              >
                <Icon size={16} strokeWidth={1.5} />
                {section.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* General */}
        {activeSection === 'general' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-sr-text">General Settings</h2>
            <div className="bg-sr-surface border border-sr-border rounded-lg p-6 card-shadow space-y-5">
              <div>
                <label className="block text-sm font-medium text-sr-text mb-2">Platform Name</label>
                <input
                  type="text"
                  defaultValue="SecureRAG"
                  className="w-full max-w-md px-3 py-2 bg-sr-elevated border border-sr-border rounded-md text-sm text-sr-text focus:border-sr-accent focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-sr-text mb-2">Timezone</label>
                <select className="w-full max-w-md px-3 py-2 bg-sr-elevated border border-sr-border rounded-md text-sm text-sr-text focus:border-sr-accent focus:outline-none">
                  <option>UTC (Coordinated Universal Time)</option>
                  <option>America/New_York (EST/EDT)</option>
                  <option>Europe/London (GMT/BST)</option>
                  <option>Asia/Tokyo (JST)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-sr-text mb-2">Date Format</label>
                <select className="w-full max-w-md px-3 py-2 bg-sr-elevated border border-sr-border rounded-md text-sm text-sr-text focus:border-sr-accent focus:outline-none">
                  <option>YYYY-MM-DD</option>
                  <option>MM/DD/YYYY</option>
                  <option>DD/MM/YYYY</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Users */}
        {activeSection === 'users' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-sr-text">Users</h2>
              <button
                onClick={() => { setCuError(''); setShowCreate(true) }}
                disabled={!isAdmin}
                title={isAdmin ? undefined : 'Only ADMIN can create users'}
                className="flex items-center gap-1.5 px-4 py-2 bg-sr-accent text-white rounded-md text-sm font-medium hover:bg-sr-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <UserPlus size={14} /> Add User
              </button>
            </div>

            {!isAdmin && (
              <div className="flex items-center gap-2 rounded-lg border border-sr-yellow/30 bg-sr-yellow/10 px-4 py-3 text-sm text-sr-yellow">
                <ShieldAlert size={15} className="shrink-0" />
                User management requires an ADMIN session. You're signed in as {role || 'a non-admin role'}.
              </div>
            )}

            {/* No GET /users endpoint exists in the backend, so we don't fabricate a
                directory. Created users authenticate via /auth/login. */}
            <div className="bg-sr-surface border border-sr-border rounded-lg card-shadow p-6 text-sm text-sr-text-secondary">
              <Users size={18} className="text-sr-text-tertiary mb-2" />
              <p>The backend has no user-directory endpoint, so existing users aren't listed here.</p>
              <p className="mt-1 text-sr-text-tertiary">
                {isAdmin
                  ? 'Use “Add User” to create an account (ADMIN/ANALYST/VIEWER). New users sign in from the login screen.'
                  : 'Ask an ADMIN to create accounts.'}
              </p>
            </div>

          </div>
        )}

        {/* API Keys */}
        {activeSection === 'api' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-sr-text">API Keys</h2>
              <button className="px-4 py-2 bg-sr-accent text-sr-text rounded-md text-sm font-medium hover:bg-sr-accent-hover transition-colors">
                + Generate Key
              </button>
            </div>
            <div className="space-y-3">
              {apiKeys.map((api, i) => (
                <div key={api.name} className="bg-sr-surface border border-sr-border rounded-lg p-5 card-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-sm font-medium text-sr-text">{api.name}</div>
                      <div className="text-[11px] text-sr-text-tertiary mt-0.5">Created: {api.created}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => copyKey(i)}
                        className="p-1.5 rounded hover:bg-sr-elevated text-sr-text-tertiary hover:text-sr-text transition-colors"
                      >
                        {copiedIndex === i ? <Check size={14} className="text-sr-green" /> : <Copy size={14} />}
                      </button>
                      <button className="p-1.5 rounded hover:bg-sr-elevated text-sr-text-tertiary hover:text-sr-text transition-colors">
                        <RefreshCw size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <code className="flex-1 px-3 py-2 bg-sr-elevated rounded border border-sr-border text-xs font-mono text-sr-text-secondary">
                      {api.key}
                    </code>
                    <span className="text-[11px] text-sr-text-tertiary">Last used: {api.lastUsed}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notifications */}
        {activeSection === 'notifications' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-sr-text">Notification Preferences</h2>
            <div className="bg-sr-surface border border-sr-border rounded-lg card-shadow divide-y divide-sr-border">
              {notifs.map((notif, i) => (
                <div key={notif.label} className="flex items-center justify-between px-5 py-4">
                  <div>
                    <div className="text-sm font-medium text-sr-text">{notif.label}</div>
                    <div className="text-[11px] text-sr-text-secondary mt-0.5">{notif.description}</div>
                  </div>
                  <button
                    onClick={() => toggleNotif(i)}
                    className="shrink-0"
                  >
                    {notif.enabled ? (
                      <ToggleRight size={24} className="text-sr-accent" />
                    ) : (
                      <ToggleLeft size={24} className="text-sr-text-tertiary" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Appearance */}
        {activeSection === 'appearance' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-sr-text">Appearance</h2>
            <div className="bg-sr-surface border border-sr-border rounded-lg p-6 card-shadow space-y-5">
              <div>
                <label className="block text-sm font-medium text-sr-text mb-3">Theme</label>
                <div className="flex gap-3">
                  <button className="flex-1 max-w-[140px] p-4 bg-sr-elevated border-2 border-sr-accent rounded-lg text-center">
                    <div className="w-full h-8 bg-sr-bg rounded border border-sr-border mb-2" />
                    <span className="text-xs text-sr-text font-medium">Dark</span>
                  </button>
                  <button className="flex-1 max-w-[140px] p-4 bg-sr-elevated border-2 border-sr-border rounded-lg text-center opacity-50 cursor-not-allowed">
                    <div className="w-full h-8 bg-gray-100 rounded border border-gray-300 mb-2" />
                    <span className="text-xs text-sr-text-secondary font-medium">Light</span>
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-sr-text mb-3">Density</label>
                <div className="flex gap-2">
                  {['compact', 'default', 'relaxed'].map(d => (
                    <button
                      key={d}
                      onClick={() => setDensity(d)}
                      className={`px-4 py-2 rounded-md text-xs font-medium capitalize transition-colors ${
                        density === d
                          ? 'bg-sr-accent text-sr-text'
                          : 'bg-sr-elevated border border-sr-border text-sr-text-secondary hover:text-sr-text'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create User modal (ADMIN-only; POST /auth/register) */}
      {showCreate && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <form
            onSubmit={createUser}
            className="fixed left-1/2 top-1/2 z-50 w-[400px] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-lg border border-sr-border bg-sr-surface p-6 card-shadow"
          >
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-semibold text-sr-text">
                <UserPlus size={16} className="text-sr-accent" /> Create User
              </h3>
              <button type="button" onClick={() => setShowCreate(false)} className="rounded p-1 text-sr-text-tertiary hover:bg-sr-elevated hover:text-sr-text">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cu-user" className="text-xs text-sr-text-secondary">Username</Label>
              <Input id="cu-user" value={cuUser} onChange={(e) => setCuUser(e.target.value)} autoComplete="off"
                placeholder="analyst2" className="border-sr-border bg-sr-elevated font-mono text-sr-text" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cu-pass" className="text-xs text-sr-text-secondary">Password</Label>
              <Input id="cu-pass" type="password" value={cuPass} onChange={(e) => setCuPass(e.target.value)} autoComplete="new-password"
                placeholder="≥ 8 characters" className="border-sr-border bg-sr-elevated font-mono text-sr-text" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cu-role" className="text-xs text-sr-text-secondary">Role</Label>
              <select id="cu-role" value={cuRole} onChange={(e) => setCuRole(e.target.value)}
                className="w-full rounded-md border border-sr-border bg-sr-elevated px-3 py-2 text-sm text-sr-text focus:border-sr-accent focus:outline-none">
                <option value="ANALYST">ANALYST</option>
                <option value="VIEWER">VIEWER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>

            {cuError && (
              <div className="flex items-center gap-2 rounded border border-sr-red/30 bg-sr-red/10 px-3 py-2 text-xs text-sr-red">
                <AlertTriangle size={13} className="shrink-0" /> {cuError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)} className="border-sr-border">Cancel</Button>
              <Button type="submit" disabled={cuBusy} className="bg-sr-accent text-white hover:bg-sr-accent-hover">
                {cuBusy ? <><Loader2 size={14} className="animate-spin" /> Creating…</> : 'Create user'}
              </Button>
            </div>
          </form>
        </>
      )}
    </div>
  )
}
