import { useState } from 'react'
import { Bell, Key, Users, Globe, Monitor, ToggleLeft, ToggleRight, Copy, RefreshCw, Check } from 'lucide-react'

const settingsSections = [
  { id: 'general', label: 'General', icon: Globe },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'api', label: 'API Keys', icon: Key },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'appearance', label: 'Appearance', icon: Monitor },
]

const users = [
  { name: 'Sarah Chen', email: 'sarah.chen@securerag.io', role: 'Admin', lastActive: 'Now', avatar: 'SC' },
  { name: 'Marcus Johnson', email: 'marcus.j@securerag.io', role: 'Analyst', lastActive: '5 min ago', avatar: 'MJ' },
  { name: 'Elena Rodriguez', email: 'elena.r@securerag.io', role: 'Analyst', lastActive: '12 min ago', avatar: 'ER' },
  { name: 'David Park', email: 'david.p@securerag.io', role: 'Viewer', lastActive: '1 hr ago', avatar: 'DP' },
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
  const [activeSection, setActiveSection] = useState('general')
  const [notifs, setNotifs] = useState(notificationSettings)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [density, setDensity] = useState('default')

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
              <button className="px-4 py-2 bg-sr-accent text-sr-text rounded-md text-sm font-medium hover:bg-sr-accent-hover transition-colors">
                + Add User
              </button>
            </div>
            <div className="bg-sr-surface border border-sr-border rounded-lg card-shadow overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-sr-elevated">
                    <th className="px-4 py-3 text-left text-[11px] font-medium text-sr-text-secondary uppercase tracking-wider">User</th>
                    <th className="px-4 py-3 text-left text-[11px] font-medium text-sr-text-secondary uppercase tracking-wider">Role</th>
                    <th className="px-4 py-3 text-left text-[11px] font-medium text-sr-text-secondary uppercase tracking-wider">Last Active</th>
                    <th className="px-4 py-3 text-right text-[11px] font-medium text-sr-text-secondary uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sr-border">
                  {users.map(user => (
                    <tr key={user.email} className="hover:bg-sr-elevated transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-sr-accent/20 flex items-center justify-center text-xs font-mono text-sr-accent font-medium">
                            {user.avatar}
                          </div>
                          <div>
                            <div className="text-sm text-sr-text font-medium">{user.name}</div>
                            <div className="text-[11px] text-sr-text-secondary">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded bg-sr-elevated text-sr-text-secondary border border-sr-border">
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-sr-text-tertiary">{user.lastActive}</td>
                      <td className="px-4 py-3 text-right">
                        <button className="text-xs text-sr-accent hover:text-sr-accent-hover transition-colors">Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
    </div>
  )
}
