import { useNavigate, useLocation } from 'react-router'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  Sparkles,
  UploadCloud,
  Search,
  Globe,
  Grid3X3,
  Clock,
  Share2,
  FolderOpen,
  Shield,
  FileText,
  Activity,
  Settings,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  LogOut,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { label: 'AI Investigation', icon: Sparkles, path: '/query' },
  { label: 'Ingest Logs', icon: UploadCloud, path: '/upload' },
  { label: 'Investigations', icon: Search, path: '/investigations' },
  { label: 'IOC Explorer', icon: Globe, path: '/ioc-explorer' },
  { label: 'MITRE Mapping', icon: Grid3X3, path: '/mitre' },
  { label: 'Timeline', icon: Clock, path: '/timeline' },
  { label: 'Attack Graph', icon: Share2, path: '/attack-graph' },
  { label: 'Case Management', icon: FolderOpen, path: '/cases' },
  { label: 'Threat Intelligence', icon: Shield, path: '/threat-intel' },
  { label: 'Reports', icon: FileText, path: '/reports' },
  { label: 'Live Monitoring', icon: Activity, path: '/monitoring' },
]

// Settings is an in-app route; Help opens the project repo in a new tab (it was
// a dead '#' link before the Phase B honesty pass).
const bottomItems: { label: string; icon: LucideIcon; path?: string; href?: string }[] = [
  { label: 'Settings', icon: Settings, path: '/settings' },
  { label: 'Help', icon: HelpCircle, href: 'https://github.com/Hemanth19i/SecureRAG' },
]

interface SidebarProps {
  currentPage: string
  onPageChange: (page: string) => void
}

export default function Sidebar({ currentPage, onPageChange }: SidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { username, role, logout } = useAuth()
  const [collapsed, setCollapsed] = useState(false)

  const initials = (username || 'user').slice(0, 2).toUpperCase()
  const roleLabel = role ? role.charAt(0) + role.slice(1).toLowerCase() : 'Analyst'

  useEffect(() => {
    const currentItem = navItems.find(item => item.path === location.pathname)
    if (currentItem) {
      onPageChange(currentItem.label)
    } else if (location.pathname === '/settings') {
      onPageChange('Settings')
    }
  }, [location.pathname, onPageChange])

  const handleNav = (item: typeof navItems[0]) => {
    onPageChange(item.label)
    navigate(item.path)
  }

  return (
    <aside
      className="flex flex-col h-full bg-sr-surface border-r border-sr-border transition-all duration-300 ease-out select-none"
      style={{ width: collapsed ? 64 : 240 }}
    >
      {/* Logo */}
      <div className="flex items-center h-14 px-4 border-b border-sr-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative flex items-center justify-center w-8 h-8 shrink-0">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14 2L3 7.5V14.5C3 20.5 7.8 26.1 14 27.5C20.2 26.1 25 20.5 25 14.5V7.5L14 2Z" stroke="#FF7A00" strokeWidth="1.5" fill="none"/>
              <text x="14" y="17" textAnchor="middle" fill="#FF7A00" fontSize="9" fontWeight="700" fontFamily="Space Grotesk">SR</text>
            </svg>
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-sr-accent" />
          </div>
          {!collapsed && (
            <span className="font-display font-bold text-sr-text text-base tracking-tight truncate">
              SecureRAG
            </span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 overflow-y-auto">
        <div className="px-2 space-y-0.5">
          {navItems.map((item) => {
            const isActive = currentPage === item.label
            const Icon = item.icon
            return (
              <button
                key={item.label}
                onClick={() => handleNav(item)}
                className={`
                  flex items-center w-full gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150
                  ${isActive
                    ? 'bg-sr-elevated text-sr-text border-l-[3px] border-sr-accent'
                    : 'text-sr-text-secondary hover:bg-sr-elevated hover:text-sr-text border-l-[3px] border-transparent'
                  }
                  ${collapsed ? 'justify-center' : ''}
                `}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={18} strokeWidth={1.5} className="shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            )
          })}
        </div>
      </nav>

      {/* Bottom section */}
      <div className="px-2 pb-3 space-y-0.5 border-t border-sr-border pt-3 shrink-0">
        {bottomItems.map((item) => {
          const Icon = item.icon
          // External docs link (Help) — a real anchor opening in a new tab.
          if (item.href) {
            return (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`
                  flex items-center w-full gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150
                  text-sr-text-secondary hover:bg-sr-elevated hover:text-sr-text border-l-[3px] border-transparent
                  ${collapsed ? 'justify-center' : ''}
                `}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={18} strokeWidth={1.5} className="shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </a>
            )
          }
          const isActive = currentPage === item.label
          return (
            <button
              key={item.label}
              onClick={() => item.path && navigate(item.path)}
              className={`
                flex items-center w-full gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150
                ${isActive
                  ? 'bg-sr-elevated text-sr-text border-l-[3px] border-sr-accent'
                  : 'text-sr-text-secondary hover:bg-sr-elevated hover:text-sr-text border-l-[3px] border-transparent'
                }
                ${collapsed ? 'justify-center' : ''}
              `}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={18} strokeWidth={1.5} className="shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          )
        })}
        {/* User + logout */}
        {!collapsed && (
          <div className="mt-1 flex items-center gap-2 px-3 py-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sr-accent/20 text-xs font-mono font-medium text-sr-accent">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-sr-text">{username || 'Operator'}</div>
              <div className="truncate text-[10px] text-sr-text-tertiary">{roleLabel}</div>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="rounded p-1.5 text-sr-text-tertiary transition-colors hover:bg-sr-elevated hover:text-sr-red"
            >
              <LogOut size={15} strokeWidth={1.5} />
            </button>
          </div>
        )}
        {collapsed && (
          <div className="flex flex-col items-center gap-1 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sr-accent/20 text-xs font-mono font-medium text-sr-accent">
              {initials}
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="rounded p-1.5 text-sr-text-tertiary transition-colors hover:bg-sr-elevated hover:text-sr-red"
            >
              <LogOut size={15} strokeWidth={1.5} />
            </button>
          </div>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-16 w-6 h-6 rounded-full bg-sr-elevated border border-sr-border flex items-center justify-center text-sr-text-tertiary hover:text-sr-text transition-colors z-10"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  )
}
