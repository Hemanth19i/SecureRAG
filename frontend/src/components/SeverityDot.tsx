interface SeverityDotProps {
  severity: 'critical' | 'high' | 'medium' | 'low'
  size?: 'sm' | 'md'
}

const colors = {
  critical: 'bg-sr-red',
  high: 'bg-sr-accent',
  medium: 'bg-sr-yellow',
  low: 'bg-sr-green',
}

export default function SeverityDot({ severity, size = 'sm' }: SeverityDotProps) {
  return (
    <span
      className={`inline-block rounded-full ${colors[severity]} ${size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5'}`}
      title={severity}
    />
  )
}
