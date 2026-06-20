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

      {/* Right: live status (Search ⌘K and the notifications bell were removed in
          the Phase B honesty pass — neither had a handler or a backing feature). */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-sr-surface border border-sr-border">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sr-green opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-sr-green" />
        </span>
        <span className="text-xs font-medium text-sr-text-secondary">Live</span>
      </div>
    </header>
  )
}
