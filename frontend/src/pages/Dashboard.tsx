import { useEffect, useState, lazy, Suspense } from 'react'
import { TrendingUp, AlertTriangle, Loader2, ArrowRight, ArrowUpRight, FileText, Database, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router'
// Decorative hero — lazy so three.js loads after first paint, off the landing
// route's critical path (the KPIs/charts render immediately).
const HeroCanvas = lazy(() => import('@/components/HeroCanvas'))
import IocTypeDonut from '@/components/charts/IocTypeDonut'
import AlertTypeBar from '@/components/charts/AlertTypeBar'
import { fetchStats, fetchCases, fetchAlerts, fetchCorrelation } from '@/lib/api'
import type { StatsResponse, CaseRow, AlertRow, Correlation } from '@/lib/backend'
import { useApiData } from '@/lib/useApi'
import { normSeverity, sevHex } from '@/lib/format'

interface DashData {
  stats: StatsResponse
  cases: CaseRow[]
  alerts: AlertRow[]
  correlation: Correlation & { high_risk_iocs: string[] }
}

// Most tiles read /stats readouts. "Critical Cases" instead counts real
// critical-severity cases (source: 'cases') — the /stats threats_critical metric
// measures HIGH-confidence MITRE chunks and stays 0 even when a CRITICAL case
// exists, which misrepresented reality (QA finding SR-007).
// `to` makes each KPI a command-center drill-in (routing only, no new backend).
const metricDefs = [
  { key: 'docs_indexed', label: 'Docs Indexed', to: '/upload' },
  { key: 'iocs_extracted', label: 'IOCs Extracted', to: '/ioc-explorer' },
  { key: 'critical_cases', label: 'Critical Cases', critical: true, source: 'cases' as const, to: '/investigations?severity=critical' },
  { key: 'mitre_mapped', label: 'MITRE Mapped', to: '/mitre' },
]

export default function Dashboard() {
  const navigate = useNavigate()
  // "Dashboard updated Ns ago" — anchored to real fetch-completion time, ticked
  // once a second. No fabricated telemetry; just the last successful load.
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())

  const { status, data, error, reload } = useApiData<DashData>(async () => {
    // Pull the full alert set (limit 200 covers the demo's ~46) so the Alert
    // Type chart reflects all alerts, not just a recent slice. The stream
    // preview below slices this to the latest few.
    const [stats, cases, alerts, correlation] = await Promise.all([
      fetchStats(),
      fetchCases(),
      fetchAlerts(0, 200),
      fetchCorrelation(),
    ])
    setUpdatedAt(Date.now()) // stamp on successful load (async continuation, not an effect body)
    return { stats, cases, alerts: alerts.alerts, correlation }
  })

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const agoSec = updatedAt != null ? Math.max(0, Math.floor((nowMs - updatedAt) / 1000)) : null
  const agoLabel = agoSec == null ? null : agoSec === 0 ? 'just now' : `${agoSec}s ago`

  const readouts = data?.stats.readouts ?? {}
  const evidence = data?.stats.evidence ?? []
  const cases = data?.cases ?? []
  const alerts = data?.alerts ?? []
  const criticalCases = cases.filter((c) => normSeverity(c.severity) === 'critical').length
  const metricValue = (m: (typeof metricDefs)[number]) =>
    m.source === 'cases' ? criticalCases : (readouts[m.key] ?? 0)

  return (
    <div className="pb-8">
      {/* Compact hero — the particle banner sets the tone without owning the fold. */}
      <section className="relative" style={{ height: '32vh', minHeight: 220 }}>
        <Suspense fallback={null}><HeroCanvas /></Suspense>
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'linear-gradient(transparent 30%, #050505 100%)', zIndex: 2 }}
        />
        <div className="absolute bottom-0 left-0 right-0 z-10 px-8 pb-4 text-center">
          <p className="text-sm font-normal text-sr-text-secondary">
            AI-powered threat investigation platform
          </p>
        </div>
      </section>

      <div className="relative z-10 mx-auto -mt-2 max-w-[1400px] space-y-8 px-8">
        {/* Section header + real last-refreshed indicator */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-sr-text">Overview</h2>
          <div className="flex items-center gap-3">
            {agoLabel && (
              <span className="font-mono text-[11px] text-sr-text-tertiary">Dashboard updated {agoLabel}</span>
            )}
            <button
              onClick={reload}
              title="Refresh"
              className="rounded-md p-1.5 text-sr-text-tertiary transition-colors hover:bg-sr-elevated hover:text-sr-text"
            >
              <RefreshCw size={14} className={status === 'loading' ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {status === 'error' && (
          <div className="flex items-center justify-between rounded-lg border border-sr-red/30 bg-sr-red/10 px-4 py-3 text-sm text-sr-red">
            <span className="flex items-center gap-2"><AlertTriangle size={15} /> {error}</span>
            <button onClick={reload} className="text-xs underline">Retry</button>
          </div>
        )}

        {/* KPI cards — primary content, each a drill-in. */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {metricDefs.map((m) => (
            <button
              key={m.key}
              onClick={() => navigate(m.to)}
              className="group rounded-lg border border-sr-border bg-sr-surface p-5 text-left card-shadow transition-colors hover:border-sr-border-focus"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-wider text-sr-text-secondary">{m.label}</span>
                <ArrowUpRight size={13} className="text-sr-text-tertiary opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <div className={`font-mono text-2xl font-medium ${m.critical && metricValue(m) > 0 ? 'text-sr-red' : 'text-sr-text'}`}>
                {status === 'loading' ? '—' : metricValue(m).toLocaleString()}
              </div>
              <div className="mt-1.5 flex items-center gap-1 text-xs font-medium text-sr-text-tertiary">
                <TrendingUp size={12} /> <span>live</span>
              </div>
            </button>
          ))}
        </div>

        {/* Real-data distributions (no time-series). */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {status === 'ready' && data ? (
            <>
              <AlertTypeBar alerts={alerts} />
              <IocTypeDonut details={data.correlation.details} />
            </>
          ) : (
            <>
              <div className="h-[300px] rounded-lg border border-sr-border skeleton-shimmer" />
              <div className="h-[300px] rounded-lg border border-sr-border skeleton-shimmer" />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Recent investigations (cases) */}
          <div className="lg:col-span-1">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-sr-text">Recent Investigations</h2>
              <button onClick={() => navigate('/investigations')} className="flex items-center gap-1 text-xs text-sr-accent hover:text-sr-accent-hover">
                View all <ArrowRight size={12} />
              </button>
            </div>
            <div className="space-y-3">
              {status === 'loading' && <Loader2 size={16} className="animate-spin text-sr-text-secondary" />}
              {status === 'ready' && cases.length === 0 && (
                <p className="rounded-lg border border-sr-border bg-sr-surface px-4 py-6 text-center text-xs text-sr-text-tertiary">
                  No cases yet — save a query as a case.
                </p>
              )}
              {cases.slice(0, 5).map((c) => {
                const sc = sevHex(normSeverity(c.severity))
                return (
                  <div
                    key={c.case_id}
                    onClick={() => navigate('/investigations')}
                    className="cursor-pointer rounded-lg border border-sr-border bg-sr-surface p-4 card-shadow transition-colors hover:border-sr-border-focus"
                  >
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="font-mono text-xs text-sr-accent">{c.case_id.slice(0, 8)}</span>
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: sc }} />
                    </div>
                    <div className="mb-2 text-sm font-medium text-sr-text">{c.title}</div>
                    <div className="flex items-center justify-between text-[11px] text-sr-text-tertiary">
                      <span className="uppercase">{String(c.status || '').replace('_', ' ').toLowerCase()}</span>
                      <span className="font-mono">{(c.created_at || '').slice(0, 10)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="space-y-6 lg:col-span-2">
            {/* Recent ingests (evidence) */}
            <div className="rounded-lg border border-sr-border bg-sr-surface card-shadow">
              <div className="flex items-center justify-between p-5 pb-3">
                <h2 className="flex items-center gap-2 text-base font-semibold text-sr-text">
                  <Database size={15} className="text-sr-accent" /> Recent Ingests
                </h2>
                <button onClick={() => navigate('/upload')} className="text-xs text-sr-accent hover:text-sr-accent-hover">Ingest</button>
              </div>
              <div className="max-h-[240px] divide-y divide-sr-border overflow-y-auto">
                {status === 'ready' && evidence.length === 0 && (
                  <p className="px-5 py-6 text-center text-xs text-sr-text-tertiary">No files ingested yet.</p>
                )}
                {evidence.map((ev) => {
                  const sc = sevHex(normSeverity(ev.severity))
                  return (
                    <div key={ev.upload_id} className="flex items-center gap-4 px-5 py-3">
                      <FileText size={14} className="shrink-0 text-sr-text-tertiary" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-sr-text">{ev.filename}</div>
                        <div className="font-mono text-[11px] text-sr-text-tertiary">
                          {ev.ioc_count} IOCs · {ev.mitre_count} ATT&CK
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold uppercase" style={{ color: sc }}>{String(ev.severity || '').toLowerCase()}</span>
                      <span className="shrink-0 font-mono text-[11px] text-sr-text-tertiary">{ev.ingested_at}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Live alert stream */}
            <div className="rounded-lg border border-sr-border bg-sr-surface card-shadow">
              <div className="flex items-center justify-between p-5 pb-3">
                <h2 className="text-base font-semibold text-sr-text">Live Alert Stream</h2>
                <button onClick={() => navigate('/monitoring')} className="text-xs text-sr-accent hover:text-sr-accent-hover">Monitor</button>
              </div>
              <div className="max-h-[300px] divide-y divide-sr-border overflow-y-auto">
                {status === 'ready' && alerts.length === 0 && (
                  <p className="px-5 py-6 text-center text-xs text-sr-text-tertiary">No alerts.</p>
                )}
                {alerts.slice(0, 8).map((a) => {
                  const sc = sevHex(normSeverity(a.severity))
                  return (
                    <div key={a.alert_id} className="flex items-center gap-4 px-5 py-3">
                      <div className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: sc }} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-sr-text">{a.title}</div>
                        <div className="truncate font-mono text-[11px] text-sr-text-secondary">{a.alert_type}</div>
                      </div>
                      <span className="shrink-0 font-mono text-[11px] text-sr-text-tertiary">{a.created_at}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
