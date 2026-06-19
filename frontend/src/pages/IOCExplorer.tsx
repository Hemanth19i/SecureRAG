import { useState } from 'react'
import { Search, ExternalLink, Loader2, AlertTriangle, ShieldCheck, Globe } from 'lucide-react'
import { fetchCorrelation, fetchEnrichment } from '@/lib/api'
import type { Correlation, CorrelationDetail, Enrichment } from '@/lib/backend'
import { useApiData } from '@/lib/useApi'
import { riskHex, sevHex, isPublicIp } from '@/lib/format'

interface Row extends CorrelationDetail {
  value: string
}

function RiskPill({ level }: { level: string }) {
  const c = riskHex(level)
  return (
    <span className="font-mono text-[11px] font-semibold" style={{ color: c }}>
      {String(level || '').toUpperCase()}
    </span>
  )
}

export default function IOCExplorer() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [selected, setSelected] = useState<Row | null>(null)
  const [enr, setEnr] = useState<Record<string, Enrichment>>({})
  const [enriching, setEnriching] = useState(false)

  const { status, data, error, reload } = useApiData<Correlation & { high_risk_iocs: string[] }>(
    () => fetchCorrelation(),
  )

  const rows: Row[] = Object.entries(data?.details ?? {}).map(([value, d]) => ({ value, ...d }))
  const types = ['All', ...Array.from(new Set(rows.map((r) => r.type).filter(Boolean)))]

  const filtered = rows.filter((r) => {
    const matchSearch =
      search === '' ||
      r.value.toLowerCase().includes(search.toLowerCase()) ||
      (r.category || '').toLowerCase().includes(search.toLowerCase())
    const matchType = typeFilter === 'All' || r.type === typeFilter
    return matchSearch && matchType
  })

  const publicTargets = rows.filter((r) => isPublicIp(r.value))

  const enrichAll = async () => {
    if (enriching || publicTargets.length === 0) return
    setEnriching(true)
    setEnr((prev) => {
      const next = { ...prev }
      publicTargets.forEach((t) => (next[t.value] = { status: 'loading' }))
      return next
    })
    for (const t of publicTargets) {
      try {
        const d = await fetchEnrichment(t.value)
        setEnr((prev) => ({ ...prev, [t.value]: d }))
      } catch {
        setEnr((prev) => ({ ...prev, [t.value]: { status: 'error' } }))
      }
    }
    setEnriching(false)
  }

  const repCell = (r: Row) => {
    if (!isPublicIp(r.value)) return <span className="text-sr-text-tertiary">—</span>
    const e = enr[r.value]
    if (!e) return <span className="text-sr-text-tertiary">—</span>
    if (e.status === 'loading') return <Loader2 size={12} className="animate-spin text-sr-text-tertiary" />
    if (e.status === 'ok' && e.verdict) {
      const c = sevHex(String(e.verdict))
      return (
        <span className="font-mono text-[11px] font-semibold uppercase" style={{ color: c }}>
          {String(e.verdict)}
          {typeof e.abuse_confidence === 'number' ? ` ${e.abuse_confidence}` : ''}
        </span>
      )
    }
    if (e.status === 'unsupported') return <span className="text-sr-text-tertiary">—</span>
    return <span className="font-mono text-[11px] text-sr-text-tertiary">{String(e.status).toUpperCase()}</span>
  }

  return (
    <div className="mx-auto flex h-full max-w-[1400px] flex-col p-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="relative max-w-xl flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-sr-text-tertiary" />
          <input
            type="text"
            placeholder="Search indicators…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-sr-border bg-sr-surface py-2.5 pl-9 pr-4 font-mono text-sm text-sr-text placeholder:text-sr-text-tertiary transition-colors focus:border-sr-accent focus:outline-none"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="cursor-pointer rounded-md border border-sr-border bg-sr-surface px-3 py-2.5 text-sm text-sr-text-secondary focus:border-sr-accent focus:outline-none"
        >
          {types.map((t) => (
            <option key={t} value={t}>{t === 'All' ? 'All Types' : t}</option>
          ))}
        </select>
        <button
          onClick={enrichAll}
          disabled={enriching || publicTargets.length === 0}
          className="flex items-center gap-2 rounded-md bg-sr-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sr-accent-hover disabled:opacity-50"
        >
          {enriching ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
          Enrich {publicTargets.length > 0 ? `(${publicTargets.length} IP${publicTargets.length === 1 ? '' : 's'})` : ''}
        </button>
      </div>

      {status === 'loading' && (
        <div className="flex items-center gap-2 text-sm text-sr-text-secondary">
          <Loader2 size={15} className="animate-spin" /> Querying correlation engine…
        </div>
      )}
      {status === 'error' && (
        <div className="flex items-center justify-between rounded-lg border border-sr-red/30 bg-sr-red/10 px-4 py-3 text-sm text-sr-red">
          <span className="flex items-center gap-2"><AlertTriangle size={15} /> {error}</span>
          <button onClick={reload} className="text-xs underline">Retry</button>
        </div>
      )}
      {status === 'ready' && rows.length === 0 && (
        <div className="rounded-lg border border-sr-border bg-sr-surface px-5 py-10 text-center text-sm text-sr-text-tertiary card-shadow">
          No correlated indicators yet — ingest logs to populate the correlation engine.
        </div>
      )}

      {status === 'ready' && rows.length > 0 && (
        <div className="flex min-h-0 flex-1 gap-6">
          <div className={`overflow-hidden rounded-lg border border-sr-border bg-sr-surface card-shadow ${selected ? 'flex-1' : 'w-full'}`}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-sr-elevated">
                    {['Indicator', 'Type', 'Category', 'Role', 'Risk', 'Files', 'Freq', 'Reputation'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-sr-text-secondary">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-sr-border">
                  {filtered.map((r) => (
                    <tr
                      key={r.value}
                      onClick={() => setSelected(r)}
                      className={`cursor-pointer transition-colors hover:bg-sr-elevated ${selected?.value === r.value ? 'bg-sr-elevated' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2">
                          <Globe size={13} className="shrink-0 text-sr-accent" />
                          <span className="max-w-[200px] truncate font-mono text-xs text-sr-accent">{r.value}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3"><span className="rounded bg-sr-elevated px-2 py-0.5 text-[10px] uppercase text-sr-text-secondary">{r.type || '—'}</span></td>
                      <td className="px-4 py-3 text-xs text-sr-text-secondary">{r.category || '—'}</td>
                      <td className="px-4 py-3 text-xs text-sr-text-secondary">{r.role || '—'}</td>
                      <td className="px-4 py-3"><RiskPill level={r.risk_level} /></td>
                      <td className="px-4 py-3 font-mono text-xs text-sr-text-secondary">{r.seen_in_files?.length ?? 0}</td>
                      <td className="px-4 py-3 font-mono text-xs text-sr-text-secondary">{r.frequency}</td>
                      <td className="px-4 py-3">{repCell(r)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {selected && (
            <div className="w-[360px] shrink-0 overflow-y-auto rounded-lg border border-sr-border bg-sr-surface card-shadow">
              <div className="border-b border-sr-border p-5">
                <span className="rounded bg-sr-elevated px-2 py-0.5 text-[10px] uppercase text-sr-text-secondary">{selected.type}</span>
                <h3 className="mt-2 break-all font-mono text-base text-sr-accent">{selected.value}</h3>
                <div className="mt-1 flex items-center gap-2">
                  <RiskPill level={selected.risk_level} />
                  <span className="text-xs text-sr-text-secondary">{selected.category}</span>
                </div>
              </div>
              <div className="space-y-5 p-5">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div><div className="text-[10px] uppercase text-sr-text-tertiary">Role</div><div className="text-sr-text">{selected.role || '—'}</div></div>
                  <div><div className="text-[10px] uppercase text-sr-text-tertiary">Frequency</div><div className="font-mono text-sr-text">{selected.frequency}</div></div>
                  <div><div className="text-[10px] uppercase text-sr-text-tertiary">First seen</div><div className="font-mono text-sr-text">{selected.first_seen || '—'}</div></div>
                  <div><div className="text-[10px] uppercase text-sr-text-tertiary">Last seen</div><div className="font-mono text-sr-text">{selected.last_seen || '—'}</div></div>
                </div>
                <div>
                  <h4 className="mb-2 text-[11px] uppercase tracking-wider text-sr-text-secondary">Seen in files ({selected.seen_in_files?.length ?? 0})</h4>
                  <div className="space-y-1.5">
                    {(selected.seen_in_files ?? []).map((f) => (
                      <div key={f} className="flex items-center gap-2 rounded border border-sr-border bg-sr-elevated px-3 py-2">
                        <ShieldCheck size={12} className="shrink-0 text-sr-green" />
                        <span className="truncate text-xs text-sr-text">{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {(selected.context_flags?.length ?? 0) > 0 && (
                  <div>
                    <h4 className="mb-2 text-[11px] uppercase tracking-wider text-sr-text-secondary">Context flags</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.context_flags.map((c) => (
                        <span key={c} className="rounded border border-sr-accent/30 bg-sr-accent/10 px-2 py-1 text-xs text-sr-accent">{c}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
