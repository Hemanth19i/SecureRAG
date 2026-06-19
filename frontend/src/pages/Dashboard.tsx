import { TrendingUp, AlertTriangle, Loader2, ArrowRight, FileText, Database } from 'lucide-react'
import { useNavigate } from 'react-router'
import HeroCanvas from '@/components/HeroCanvas'
import { fetchStats, fetchCases, fetchAlerts } from '@/lib/api'
import type { StatsResponse, CaseRow, AlertRow } from '@/lib/backend'
import { useApiData } from '@/lib/useApi'
import { normSeverity, sevHex } from '@/lib/format'

interface DashData {
  stats: StatsResponse
  cases: CaseRow[]
  alerts: AlertRow[]
}

const metricDefs = [
  { key: 'docs_indexed', label: 'Docs Indexed' },
  { key: 'iocs_extracted', label: 'IOCs Extracted' },
  { key: 'threats_critical', label: 'Critical Threats', critical: true },
  { key: 'mitre_mapped', label: 'MITRE Mapped' },
]

export default function Dashboard() {
  const navigate = useNavigate()
  const { status, data, error, reload } = useApiData<DashData>(async () => {
    const [stats, cases, alerts] = await Promise.all([
      fetchStats(),
      fetchCases(),
      fetchAlerts(0, 8),
    ])
    return { stats, cases, alerts: alerts.alerts }
  })

  const readouts = data?.stats.readouts ?? {}
  const evidence = data?.stats.evidence ?? []
  const cases = data?.cases ?? []
  const alerts = data?.alerts ?? []

  return (
    <div className="space-y-8 pb-8">
      {/* Hero */}
      <section className="relative" style={{ height: '60vh', minHeight: 480 }}>
        <HeroCanvas />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'linear-gradient(transparent 40%, #050505 100%)', zIndex: 2 }}
        />
        <div className="absolute bottom-0 left-0 right-0 z-10 px-8 pb-8">
          <p className="mb-8 text-center text-base font-normal text-sr-text-secondary">
            AI-powered threat investigation platform
          </p>
          <div className="mx-auto grid max-w-4xl grid-cols-2 gap-4 md:grid-cols-4">
            {metricDefs.map((m) => (
              <div key={m.key} className="rounded-lg border border-sr-border bg-sr-surface p-5 card-shadow">
                <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-sr-text-secondary">
                  {m.label}
                </div>
                <div className={`font-mono text-2xl font-medium ${m.critical && (readouts[m.key] ?? 0) > 0 ? 'text-sr-red' : 'text-sr-text'}`}>
                  {status === 'loading' ? '—' : (readouts[m.key] ?? 0).toLocaleString()}
                </div>
                <div className="mt-1.5 flex items-center gap-1 text-xs font-medium text-sr-text-tertiary">
                  <TrendingUp size={12} /> <span>live</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1400px] space-y-8 px-8">
        {status === 'error' && (
          <div className="flex items-center justify-between rounded-lg border border-sr-red/30 bg-sr-red/10 px-4 py-3 text-sm text-sr-red">
            <span className="flex items-center gap-2"><AlertTriangle size={15} /> {error}</span>
            <button onClick={reload} className="text-xs underline">Retry</button>
          </div>
        )}

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
                {alerts.map((a) => {
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
