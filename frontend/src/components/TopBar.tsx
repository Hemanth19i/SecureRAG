import { Search, Bell, Command } from 'lucide-react'

interface TopBarProps {
  pageTitle: string
}

export default function TopBar({ pageTitle }: TopBarProps) {
  return (
    <header className="flex items-center justify-between h-14 px-6 bg-sr-bg/80 backdrop-blur-xl border-b border-sr-border sticky top-0 z-40">
      {/* Left: Breadcrumb + Title */}
      <div className="flex flex-col justify-center">
        <div className="flex items-center gap-1.5 text-[11px] text-sr-text-tertiary">
          <span>SecureRAG</span>
          <span>/</span>
          <span className="text-sr-text-secondary">{pageTitle}</span>
        </div>
        <h1 className="text-lg font-display font-bold text-sr-text leading-tight tracking-tight">
          {pageTitle}
        </h1>
      </div>

      {/* Right: Search, Notifications */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-sr-surface border border-sr-border text-sr-text-tertiary hover:text-sr-text-secondary hover:border-sr-border-focus transition-all duration-150">
          <Search size={14} strokeWidth={1.5} />
          <span className="text-xs">Search</span>
          <kbd className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-sr-elevated text-[10px] font-mono text-sr-text-tertiary">
            <Command size={9} />
            <span>K</span>
          </kbd>
        </button>

        {/* Notifications */}
        <button className="relative p-2 rounded-md text-sr-text-secondary hover:text-sr-text hover:bg-sr-elevated transition-all duration-150">
          <Bell size={16} strokeWidth={1.5} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-sr-red animate-pulse-dot" />
        </button>

        {/* Live indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-sr-surface border border-sr-border">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sr-green opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-sr-green" />
          </span>
          <span className="text-xs font-medium text-sr-text-secondary">Live</span>
        </div>
      </div>
    </header>
  )
}
