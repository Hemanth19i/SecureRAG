interface StatusBadgeProps {
  status: string
  size?: 'sm' | 'md'
}

const statusConfig: Record<string, { bg: string; text: string; dot?: string }> = {
  open: { bg: 'bg-sr-blue/15', text: 'text-sr-blue', dot: 'bg-sr-blue' },
  in_progress: { bg: 'bg-sr-yellow/15', text: 'text-sr-yellow', dot: 'bg-sr-yellow' },
  resolved: { bg: 'bg-sr-green/15', text: 'text-sr-green', dot: 'bg-sr-green' },
  escalated: { bg: 'bg-sr-red/15', text: 'text-sr-red', dot: 'bg-sr-red' },
  under_review: { bg: 'bg-sr-teal/15', text: 'text-sr-teal', dot: 'bg-sr-teal' },
  closed: { bg: 'bg-sr-text-tertiary/15', text: 'text-sr-text-tertiary', dot: 'bg-sr-text-tertiary' },
  critical: { bg: 'bg-sr-red/15', text: 'text-sr-red', dot: 'bg-sr-red' },
  high: { bg: 'bg-sr-accent/15', text: 'text-sr-accent', dot: 'bg-sr-accent' },
  medium: { bg: 'bg-sr-yellow/15', text: 'text-sr-yellow', dot: 'bg-sr-yellow' },
  low: { bg: 'bg-sr-green/15', text: 'text-sr-green', dot: 'bg-sr-green' },
  P1: { bg: 'bg-sr-red/15', text: 'text-sr-red', dot: 'bg-sr-red' },
  P2: { bg: 'bg-sr-yellow/15', text: 'text-sr-yellow', dot: 'bg-sr-yellow' },
  P3: { bg: 'bg-sr-blue/15', text: 'text-sr-blue', dot: 'bg-sr-blue' },
  P4: { bg: 'bg-sr-green/15', text: 'text-sr-green', dot: 'bg-sr-green' },
}

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.open
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  return (
    <span className={`
      inline-flex items-center gap-1.5 rounded-full font-medium
      ${config.bg} ${config.text}
      ${size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'}
    `}>
      {config.dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${config.dot} ${size === 'sm' ? '' : 'w-2 h-2'}`} />
      )}
      <span className="capitalize">{label}</span>
    </span>
  )
}
