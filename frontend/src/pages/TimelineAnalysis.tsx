import { useEffect, useRef, useState } from 'react'
import { Clock, AlertTriangle, Shield, Zap, Filter } from 'lucide-react'
import { timelineEvents } from '@/data/demo'

const phaseColors: Record<string, string> = {
  'Initial Access': '#3B82F6',
  'Execution': '#FF7A00',
  'Persistence': '#EAB308',
  'Credential Access': '#EF4444',
  'Lateral Movement': '#A855F7',
  'Command & Control': '#14B8A6',
  'Exfiltration': '#EC4899',
}

const severityIcons = {
  critical: AlertTriangle,
  high: Zap,
  medium: Shield,
  low: Clock,
}

export default function TimelineAnalysis() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollY, setScrollY] = useState(0)
  const [selectedPhase, setSelectedPhase] = useState('All')
  const animRef = useRef<number>(0)

  const phases = ['All', ...Array.from(new Set(timelineEvents.map(e => e.phase)))]
  const filtered = selectedPhase === 'All' ? timelineEvents : timelineEvents.filter(e => e.phase === selectedPhase)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let targetScroll = 0
    let currentScroll = 0

    const handleMouseMove = (_e: MouseEvent) => {
      // Mouse tracking for potential interactive features
    }

    container.addEventListener('mousemove', handleMouseMove)

    const animate = () => {
      const maxScroll = Math.max(0, filtered.length * 80 - container.clientHeight + 100)
      targetScroll = y * maxScroll
      currentScroll += (targetScroll - currentScroll) * 0.08
      setScrollY(currentScroll)
      animRef.current = requestAnimationFrame(animate)
    }

    const y = 0.3
    animate()

    return () => {
      container.removeEventListener('mousemove', handleMouseMove)
      cancelAnimationFrame(animRef.current)
    }
  }, [filtered.length])

  return (
    <div className="h-full flex flex-col">
      {/* Controls */}
      <div className="px-8 py-4 border-b border-sr-border bg-sr-surface/50 backdrop-blur-sm flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Filter size={14} className="text-sr-text-secondary" />
          <div className="flex items-center gap-1">
            {phases.map(phase => (
              <button
                key={phase}
                onClick={() => setSelectedPhase(phase)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                  selectedPhase === phase
                    ? 'bg-sr-accent/15 text-sr-accent'
                    : 'text-sr-text-tertiary hover:text-sr-text-secondary'
                }`}
              >
                {phase}
              </button>
            ))}
          </div>
        </div>
        <div className="text-[11px] text-sr-text-tertiary font-mono">
          {filtered.length} events
        </div>
      </div>

      {/* 3D Timeline Scene */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden cursor-crosshair"
        style={{ perspective: '900px', background: '#050505' }}
      >
        {/* Camera / Frame */}
        <div
          style={{
            width: '100%',
            height: '100%',
            transformStyle: 'preserve-3d',
            position: 'relative',
          }}
        >
          {/* Timeline Spine */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '2%',
              width: '2px',
              height: '96%',
              background: 'linear-gradient(to bottom, transparent, #2A2A2A 10%, #2A2A2A 90%, transparent)',
              transform: 'translateX(-50%) translateZ(-1px)',
            }}
          />

          {/* Timeline Items */}
          <div
            style={{
              width: '100%',
              height: '100%',
              transformStyle: 'preserve-3d',
              transform: `translateY(${-scrollY}px)`,
              transition: 'transform 0.1s linear',
            }}
          >
            {filtered.map((event, index) => {
              const Icon = severityIcons[event.severity]
              const color = phaseColors[event.phase] || '#FF7A00'
              const depth = 1 + Math.sin(index * 0.5) * 0.5
              const leftSide = index % 2 === 0

              return (
                <div
                  key={event.id}
                  style={{
                    position: 'absolute',
                    left: leftSide ? '8%' : '52%',
                    top: `${index * 90 + 60}px`,
                    transformStyle: 'preserve-3d',
                    transform: `translateZ(${depth * 80}px)`,
                    width: leftSide ? '40%' : '40%',
                  }}
                >
                  {/* Event Card */}
                  <div
                    className="rounded-lg border overflow-hidden group hover:border-sr-border-focus transition-all duration-200"
                    style={{
                      background: '#0B0B0B',
                      borderColor: '#1A1A1A',
                      borderLeftWidth: '3px',
                      borderLeftColor: event.severity === 'critical' ? '#EF4444' : event.severity === 'high' ? '#FF7A00' : event.severity === 'medium' ? '#EAB308' : '#22C55E',
                    }}
                  >
                    <div className="p-4">
                      {/* Header */}
                      <div className="flex items-center gap-2 mb-2">
                        <Icon size={12} style={{ color }} />
                        <span className="text-[10px] font-mono" style={{ color }}>{event.time}</span>
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                          style={{ background: `${color}15`, color }}
                        >
                          {event.phase}
                        </span>
                      </div>

                      {/* Title */}
                      <h4 className="text-sm font-semibold text-sr-text mb-1 group-hover:text-sr-accent transition-colors">
                        {event.title}
                      </h4>

                      {/* Description */}
                      <p className="text-[11px] text-sr-text-secondary leading-relaxed mb-2">
                        {event.description}
                      </p>

                      {/* Footer */}
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-sr-text-tertiary flex items-center gap-1">
                          <Shield size={9} /> {event.source}
                        </span>
                        <span className={`text-[10px] font-medium capitalize ${
                          event.severity === 'critical' ? 'text-sr-red' :
                          event.severity === 'high' ? 'text-sr-accent' :
                          event.severity === 'medium' ? 'text-sr-yellow' : 'text-sr-green'
                        }`}>
                          {event.severity}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Connector dot on spine */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      [leftSide ? 'right' : 'left']: leftSide ? '-5%' : '-5%',
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: color,
                      boxShadow: `0 0 12px ${color}40`,
                      transform: 'translateY(-50%)',
                    }}
                  />
                </div>
              )
            })}
          </div>
        </div>

        {/* Fog Overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(to bottom, rgba(5,5,5,0.95) 0%, transparent 12%, transparent 88%, rgba(5,5,5,0.95) 100%)',
            zIndex: 10,
          }}
        />

        {/* Mouse position indicator */}
        <div
          className="absolute left-2 top-2 z-20 text-[10px] font-mono text-sr-text-tertiary pointer-events-none"
        >
          Scroll: {Math.round(scrollY)}px
        </div>
      </div>
    </div>
  )
}
