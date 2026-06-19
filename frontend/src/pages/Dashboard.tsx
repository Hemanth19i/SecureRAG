import { useState } from 'react'
import { TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react'
import HeroCanvas from '@/components/HeroCanvas'
import ThreatActivityChart from '@/components/ThreatActivityChart'
import StatusBadge from '@/components/StatusBadge'
import SeverityDot from '@/components/SeverityDot'
import { investigations, alerts, iocs, chartData } from '@/data/demo'

const metrics = [
  { label: 'Active Alerts', value: '2,847', trend: 12, direction: 'up' as const },
  { label: 'Critical Threats', value: '23', trend: 5, direction: 'down' as const },
  { label: 'Open Cases', value: '156', trend: 3, direction: 'up' as const },
  { label: 'High-Risk IOCs', value: '1,204', trend: 0, direction: 'neutral' as const },
]

export default function Dashboard() {
  const [alertFilter, setAlertFilter] = useState('All')
  const alertFilters = ['All', 'Critical', 'High', 'Medium']

  const filteredAlerts = alertFilter === 'All'
    ? alerts.slice(0, 8)
    : alerts.filter(a => a.severity === alertFilter.toLowerCase()).slice(0, 8)

  return (
    <div className="space-y-8 pb-8">
      {/* Hero Section */}
      <section className="relative" style={{ height: '60vh', minHeight: 480 }}>
        <HeroCanvas />

        {/* Gradient overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(transparent 40%, #050505 100%)',
            zIndex: 2,
          }}
        />

        {/* Content overlay */}
        <div className="absolute bottom-0 left-0 right-0 z-10 px-8 pb-8">
          <p className="text-center text-sr-text-secondary text-base font-normal mb-8">
            AI-powered threat investigation platform
          </p>

          {/* Metric Cards */}
          <div className="grid grid-cols-4 gap-4 max-w-4xl mx-auto">
            {metrics.map((m) => (
              <div
                key={m.label}
                className="bg-sr-surface border border-sr-border rounded-lg p-5 card-shadow"
              >
                <div className="text-[11px] font-medium text-sr-text-secondary uppercase tracking-wider mb-2">
                  {m.label}
                </div>
                <div className="text-2xl font-mono font-medium text-sr-text mb-1.5">
                  {m.value}
                </div>
                <div className={`flex items-center gap-1 text-xs font-medium ${
                  m.direction === 'up' ? 'text-sr-red' : m.direction === 'down' ? 'text-sr-green' : 'text-sr-text-tertiary'
                }`}>
                  {m.direction === 'up' && <TrendingUp size={12} />}
                  {m.direction === 'down' && <TrendingDown size={12} />}
                  {m.direction === 'neutral' && <Minus size={12} />}
                  <span>{m.trend > 0 ? `+${m.trend}%` : m.trend < 0 ? `${m.trend}%` : '0%'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Content Grid */}
      <div className="px-8 max-w-[1400px] mx-auto space-y-8">
        {/* Recent Investigations + Threat Activity */}
        <div className="grid grid-cols-3 gap-6">
          {/* Recent Investigations */}
          <div className="col-span-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-sr-text">Recent Investigations</h2>
              <button className="text-xs text-sr-accent hover:text-sr-accent-hover flex items-center gap-1 transition-colors">
                View all <ArrowRight size={12} />
              </button>
            </div>
            <div className="space-y-3">
              {investigations.slice(0, 5).map((inv) => (
                <div
                  key={inv.id}
                  className="bg-sr-surface border border-sr-border rounded-lg p-4 card-shadow hover:border-sr-border-focus transition-colors cursor-pointer group"
                >
                  <div className="flex items-start justify-between mb-1.5">
                    <span className="text-xs font-mono text-sr-accent">{inv.id}</span>
                    <SeverityDot severity={inv.severity} />
                  </div>
                  <div className="text-sm font-medium text-sr-text mb-2 group-hover:text-sr-accent transition-colors">
                    {inv.title}
                  </div>
                  <div className="flex items-center justify-between">
                    <StatusBadge status={inv.status} />
                    <span className="text-[11px] text-sr-text-tertiary">{inv.lastActivity}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Threat Activity Chart + Alert Stream */}
          <div className="col-span-2 space-y-6">
            {/* Chart */}
            <div className="bg-sr-surface border border-sr-border rounded-lg p-5 card-shadow">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-sr-text">Threat Activity</h2>
                <span className="text-[11px] text-sr-text-tertiary font-mono">Last 7 days</span>
              </div>
              <ThreatActivityChart data={chartData} />
            </div>

            {/* Alert Stream */}
            <div className="bg-sr-surface border border-sr-border rounded-lg card-shadow">
              <div className="flex items-center justify-between p-5 pb-3">
                <h2 className="text-base font-semibold text-sr-text">Live Alert Stream</h2>
                <div className="flex items-center gap-1">
                  {alertFilters.map(f => (
                    <button
                      key={f}
                      onClick={() => setAlertFilter(f)}
                      className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                        alertFilter === f
                          ? 'bg-sr-accent/15 text-sr-accent'
                          : 'text-sr-text-tertiary hover:text-sr-text-secondary'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              <div className="divide-y divide-sr-border max-h-[360px] overflow-y-auto">
                {filteredAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-center gap-4 px-5 py-3 hover:bg-sr-elevated transition-colors group"
                  >
                    <div className={`w-1 h-8 rounded-full shrink-0 ${
                      alert.severity === 'critical' ? 'bg-sr-red' :
                      alert.severity === 'high' ? 'bg-sr-accent' :
                      alert.severity === 'medium' ? 'bg-sr-yellow' : 'bg-sr-green'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-sr-text font-medium truncate">{alert.title}</div>
                      <div className="text-[11px] font-mono text-sr-text-secondary truncate">
                        {alert.sourceIp} → {alert.destIp}
                      </div>
                    </div>
                    <span className="text-[11px] text-sr-text-tertiary font-mono shrink-0">
                      {new Date(alert.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <button className="text-[11px] text-sr-accent opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      Investigate
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Threat Intelligence Feed */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-sr-text">Threat Intelligence Feed</h2>
            <button className="text-xs text-sr-accent hover:text-sr-accent-hover flex items-center gap-1 transition-colors">
              View all <ArrowRight size={12} />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-4">
            {iocs.slice(0, 4).map((ioc) => (
              <div
                key={ioc.id}
                className="bg-sr-surface border border-sr-border rounded-lg p-4 card-shadow hover:border-sr-border-focus transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-mono text-sr-accent truncate">{ioc.value}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-sr-elevated text-sr-text-secondary uppercase">
                    {ioc.type}
                  </span>
                </div>
                <div className="text-xs text-sr-text mb-2">{ioc.threatFamily}</div>
                <div className="mb-2">
                  <div className="flex items-center justify-between text-[10px] text-sr-text-tertiary mb-1">
                    <span>Confidence</span>
                    <span className="font-mono">{ioc.confidence}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-sr-elevated overflow-hidden">
                    <div
                      className="h-full rounded-full bg-sr-red"
                      style={{ width: `${ioc.confidence}%` }}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {ioc.sources.slice(0, 2).map(s => (
                    <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-sr-accent/10 text-sr-accent">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
