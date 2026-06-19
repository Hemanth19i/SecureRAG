import { useEffect, useRef, useState } from 'react'
import { Activity, Server, Wifi, AlertTriangle, CheckCircle, Clock } from 'lucide-react'

const services = [
  { name: 'SIEM Ingestion', status: 'healthy', latency: '12ms', throughput: '2.4K eps' },
  { name: 'EDR Pipeline', status: 'healthy', latency: '8ms', throughput: '1.8K eps' },
  { name: 'Threat Intel Feed', status: 'healthy', latency: '45ms', throughput: '420 eps' },
  { name: 'IOC Enrichment', status: 'warning', latency: '230ms', throughput: '85 eps' },
  { name: 'ML Detection', status: 'healthy', latency: '18ms', throughput: '650 eps' },
  { name: 'Alert Correlation', status: 'healthy', latency: '6ms', throughput: '3.2K eps' },
  { name: 'Case Management', status: 'healthy', latency: '15ms', throughput: '120 eps' },
  { name: 'Report Engine', status: 'healthy', latency: '32ms', throughput: '45 eps' },
]

const recentEvents = [
  { time: '09:32:14', event: 'Alert ingested: Brute Force RDP', source: 'Firewall', severity: 'high' },
  { time: '09:32:12', event: 'Correlation rule triggered: Lateral Movement', source: 'Correlation Engine', severity: 'critical' },
  { time: '09:32:08', event: 'IOC enrichment complete: 185.220.101.47', source: 'Enrichment', severity: 'info' },
  { time: '09:32:05', event: 'ML model flagged suspicious PowerShell', source: 'ML Detection', severity: 'high' },
  { time: '09:31:58', event: 'EDR telemetry: Process injection detected', source: 'EDR', severity: 'critical' },
  { time: '09:31:52', event: 'Threat intel match: Cobalt Strike signature', source: 'Intel Feed', severity: 'critical' },
  { time: '09:31:45', event: 'Case auto-created: INV-2026-004291', source: 'Case Mgmt', severity: 'info' },
  { time: '09:31:38', event: 'Alert ingested: DGA Domain Query', source: 'DNS Monitor', severity: 'medium' },
]

export default function LiveMonitoring() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [liveMetrics, setLiveMetrics] = useState({ alerts: 2847, events: 45231, eps: 3240, latency: 14 })

  // Animated metrics line
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio, 2)
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.scale(dpr, dpr)

    const dataPoints: number[] = []
    for (let i = 0; i < 100; i++) {
      dataPoints.push(30 + Math.sin(i * 0.15) * 20 + Math.random() * 10)
    }

    let offset = 0
    let animId = 0

    const draw = () => {
      ctx.clearRect(0, 0, w, h)

      // Draw grid
      ctx.strokeStyle = '#1A1A1A'
      ctx.lineWidth = 0.5
      for (let i = 0; i < 5; i++) {
        const y = (h / 4) * i
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(w, y)
        ctx.stroke()
      }

      // Draw line
      ctx.strokeStyle = '#FF7A00'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      for (let i = 0; i < dataPoints.length; i++) {
        const x = (i / (dataPoints.length - 1)) * w
        const y = h - dataPoints[(i + offset) % dataPoints.length]
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()

      // Draw fill
      ctx.fillStyle = 'rgba(255, 122, 0, 0.08)'
      ctx.lineTo(w, h)
      ctx.lineTo(0, h)
      ctx.closePath()
      ctx.fill()

      offset = (offset + 0.5) % dataPoints.length
      animId = requestAnimationFrame(draw)
    }

    draw()

    return () => cancelAnimationFrame(animId)
  }, [])

  // Simulate live metric updates
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveMetrics(prev => ({
        alerts: prev.alerts + Math.floor(Math.random() * 3),
        events: prev.events + Math.floor(Math.random() * 50),
        eps: 3200 + Math.floor(Math.random() * 200),
        latency: 10 + Math.floor(Math.random() * 20),
      }))
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-6">
      {/* Live Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-sr-surface border border-sr-border rounded-lg p-5 card-shadow">
          <div className="flex items-center gap-2 mb-2">
            <Activity size={14} className="text-sr-accent" />
            <span className="text-[11px] text-sr-text-secondary uppercase tracking-wider">Events/sec</span>
          </div>
          <div className="text-2xl font-mono font-semibold text-sr-text">{liveMetrics.eps.toLocaleString()}</div>
          <div className="text-[10px] text-sr-green mt-1">+2.4% from last hour</div>
        </div>
        <div className="bg-sr-surface border border-sr-border rounded-lg p-5 card-shadow">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} className="text-sr-red" />
            <span className="text-[11px] text-sr-text-secondary uppercase tracking-wider">Active Alerts</span>
          </div>
          <div className="text-2xl font-mono font-semibold text-sr-text">{liveMetrics.alerts.toLocaleString()}</div>
          <div className="text-[10px] text-sr-red mt-1">+12 in last 5 min</div>
        </div>
        <div className="bg-sr-surface border border-sr-border rounded-lg p-5 card-shadow">
          <div className="flex items-center gap-2 mb-2">
            <Server size={14} className="text-sr-teal" />
            <span className="text-[11px] text-sr-text-secondary uppercase tracking-wider">Total Events</span>
          </div>
          <div className="text-2xl font-mono font-semibold text-sr-text">{liveMetrics.events.toLocaleString()}</div>
          <div className="text-[10px] text-sr-text-tertiary mt-1">Since midnight UTC</div>
        </div>
        <div className="bg-sr-surface border border-sr-border rounded-lg p-5 card-shadow">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={14} className="text-sr-yellow" />
            <span className="text-[11px] text-sr-text-secondary uppercase tracking-wider">Avg Latency</span>
          </div>
          <div className="text-2xl font-mono font-semibold text-sr-text">{liveMetrics.latency}ms</div>
          <div className="text-[10px] text-sr-green mt-1">-3ms from baseline</div>
        </div>
      </div>

      {/* Services + Event Stream */}
      <div className="grid grid-cols-3 gap-6">
        {/* Services */}
        <div className="col-span-1 bg-sr-surface border border-sr-border rounded-lg p-5 card-shadow">
          <h2 className="text-sm font-semibold text-sr-text mb-4">Pipeline Services</h2>
          <div className="space-y-2">
            {services.map(service => (
              <div key={service.name} className="flex items-center gap-3 p-2.5 bg-sr-elevated rounded border border-sr-border">
                {service.status === 'healthy' ? (
                  <CheckCircle size={14} className="text-sr-green shrink-0" />
                ) : (
                  <AlertTriangle size={14} className="text-sr-yellow shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-sr-text">{service.name}</div>
                  <div className="text-[10px] text-sr-text-tertiary">{service.throughput}</div>
                </div>
                <span className={`text-[10px] font-mono ${service.status === 'healthy' ? 'text-sr-green' : 'text-sr-yellow'}`}>
                  {service.latency}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Live Event Stream */}
        <div className="col-span-2 bg-sr-surface border border-sr-border rounded-lg card-shadow overflow-hidden">
          <div className="p-5 border-b border-sr-border">
            <div className="flex items-center gap-2">
              <Wifi size={14} className="text-sr-green animate-pulse-dot" />
              <h2 className="text-sm font-semibold text-sr-text">Live Event Stream</h2>
            </div>
          </div>
          <div className="divide-y divide-sr-border max-h-[400px] overflow-y-auto">
            {recentEvents.map((evt, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3 hover:bg-sr-elevated transition-colors">
                <span className="text-[11px] font-mono text-sr-accent w-16 shrink-0">{evt.time}</span>
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  evt.severity === 'critical' ? 'bg-sr-red' :
                  evt.severity === 'high' ? 'bg-sr-accent' :
                  evt.severity === 'medium' ? 'bg-sr-yellow' : 'bg-sr-blue'
                }`} />
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-sr-text truncate block">{evt.event}</span>
                </div>
                <span className="text-[10px] text-sr-text-tertiary shrink-0">{evt.source}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Throughput Graph */}
      <div className="bg-sr-surface border border-sr-border rounded-lg p-5 card-shadow">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-sr-text">Pipeline Throughput</h2>
          <span className="text-[11px] text-sr-text-tertiary font-mono">Real-time</span>
        </div>
        <div className="w-full h-48">
          <canvas ref={canvasRef} className="w-full h-full" />
        </div>
      </div>
    </div>
  )
}
