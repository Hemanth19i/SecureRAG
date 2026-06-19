import { useState } from 'react'
import { Search, X, Loader2, AlertTriangle, FileText, Clock, ShieldCheck } from 'lucide-react'
import { fetchCases, fetchCase } from '@/lib/api'
import type { CaseRow, CaseDetail } from '@/lib/backend'
import { useApiData } from '@/lib/useApi'
import { normSeverity, sevHex } from '@/lib/format'

function StatusPill({ status }: { status: string }) {
  const s = String(status || '').toUpperCase()
  const map: Record<string, string> = {
    OPEN: '#3B82F6',
    IN_PROGRESS: '#EAB308',
    CONTAINED: '#FF7A00',
    CLOSED: '#22C55E',
  }
  const c = map[s] || '#8A8A8A'
  return (
    <span
      className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide"
      style={{ color: c, backgroundColor: `${c}1f`, border: `1px solid ${c}40` }}
    >
      {s.replace('_', ' ') || 'UNKNOWN'}
    </span>
  )
}

function SevDot({ level }: { level: string }) {
  const c = sevHex(normSeverity(level))
  return <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: c }} />
}

export default function Investigations() {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<CaseDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const { status, data, error, reload } = useApiData<CaseRow[]>(() => fetchCases())
  const cases = data ?? []

  const filtered = cases.filter(
    (c) =>
      c.title?.toLowerCase().includes(search.toLowerCase()) ||
      c.case_id?.toLowerCase().includes(search.toLowerCase()) ||
      (c.assigned_to || c.created_by || '').toLowerCase().includes(search.toLowerCase()),
  )

  const openCase = async (id: string) => {
    setLoadingDetail(true)
    try {
      setSelected(await fetchCase(id))
    } catch {
      /* detail failure leaves drawer closed */
    } finally {
      setLoadingDetail(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1400px] p-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-sr-text-tertiary" />
          <input
            type="text"
            placeholder="Search investigations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-72 rounded-md border border-sr-border bg-sr-surface py-2 pl-9 pr-4 text-sm text-sr-text placeholder:text-sr-text-tertiary transition-colors focus:border-sr-accent focus:outline-none"
          />
        </div>
        <span className="text-xs text-sr-text-tertiary">
          Backed by saved cases · {cases.length} total
        </span>
      </div>

      {status === 'loading' && (
        <div className="flex items-center gap-2 px-1 py-6 text-sm text-sr-text-secondary">
          <Loader2 size={15} className="animate-spin" /> Loading investigations…
        </div>
      )}
      {status === 'error' && (
        <div className="flex items-center justify-between rounded-lg border border-sr-red/30 bg-sr-red/10 px-4 py-3 text-sm text-sr-red">
          <span className="flex items-center gap-2"><AlertTriangle size={15} /> {error}</span>
          <button onClick={reload} className="text-xs underline">Retry</button>
        </div>
      )}
      {status === 'ready' && filtered.length === 0 && (
        <div className="rounded-lg border border-sr-border bg-sr-surface px-5 py-10 text-center text-sm text-sr-text-tertiary card-shadow">
          No investigations yet. Run a query on the AI Investigation page and click <span className="text-sr-text">Save as case</span> to start one.
        </div>
      )}

      {status === 'ready' && filtered.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-sr-border bg-sr-surface card-shadow">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-sr-elevated">
                  {['ID', 'Title', 'Severity', 'Status', 'Owner', 'Created'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-sr-text-secondary">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-sr-border">
                {filtered.map((c) => (
                  <tr
                    key={c.case_id}
                    onClick={() => openCase(c.case_id)}
                    className="cursor-pointer transition-colors hover:bg-sr-elevated"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-sr-accent">{c.case_id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-sr-text">{c.title}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2 text-xs capitalize text-sr-text-secondary">
                        <SevDot level={c.severity} /> {String(c.severity || '').toLowerCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3"><StatusPill status={c.status} /></td>
                    <td className="px-4 py-3 text-xs text-sr-text-secondary">{c.assigned_to || c.created_by || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-sr-text-tertiary">{c.created_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail drawer */}
      {(selected || loadingDetail) && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="fixed right-0 top-0 z-50 h-full w-[440px] animate-slide-in-right overflow-y-auto border-l border-sr-border bg-sr-surface">
            {loadingDetail || !selected ? (
              <div className="flex h-full items-center justify-center text-sr-text-secondary">
                <Loader2 size={18} className="animate-spin" />
              </div>
            ) : (
              <>
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-sr-border bg-sr-surface p-5">
                  <div>
                    <span className="font-mono text-xs text-sr-accent">{selected.case_id.slice(0, 8)}</span>
                    <h2 className="mt-0.5 text-base font-semibold text-sr-text">{selected.title}</h2>
                  </div>
                  <button onClick={() => setSelected(null)} className="rounded p-1.5 text-sr-text-tertiary hover:bg-sr-elevated hover:text-sr-text">
                    <X size={16} />
                  </button>
                </div>
                <div className="space-y-6 p-5">
                  <div className="flex items-center gap-3">
                    <StatusPill status={selected.status} />
                    <span className="flex items-center gap-1.5 text-xs capitalize text-sr-text-secondary">
                      <SevDot level={selected.severity} /> {String(selected.severity || '').toLowerCase()}
                    </span>
                  </div>

                  {selected.query && (
                    <div>
                      <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-sr-text-secondary">Query</h3>
                      <p className="rounded border border-sr-border bg-sr-elevated px-3 py-2 text-sm text-sr-text">{selected.query}</p>
                    </div>
                  )}
                  {selected.summary && (
                    <div>
                      <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-sr-text-secondary">Summary</h3>
                      <p className="text-sm leading-relaxed text-sr-text">{selected.summary}</p>
                    </div>
                  )}

                  <div>
                    <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-sr-text-secondary">
                      <ShieldCheck size={12} /> Evidence ({selected.evidence?.length ?? 0})
                    </h3>
                    {(selected.evidence?.length ?? 0) === 0 ? (
                      <p className="text-xs text-sr-text-tertiary">No evidence linked.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {selected.evidence.map((ev, i) => (
                          <div key={i} className="flex items-center gap-2 rounded border border-sr-border bg-sr-elevated px-3 py-2">
                            <FileText size={12} className="shrink-0 text-sr-accent" />
                            <span className="text-xs text-sr-text">{ev.evidence_type}</span>
                            <span className="ml-auto font-mono text-[10px] text-sr-text-tertiary">{ev.created_at}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-sr-text-secondary">
                      <Clock size={12} /> Audit Trail ({selected.audit?.length ?? 0})
                    </h3>
                    {(selected.audit?.length ?? 0) === 0 ? (
                      <p className="text-xs text-sr-text-tertiary">No audit entries.</p>
                    ) : (
                      <div className="space-y-2">
                        {selected.audit.map((a, i) => (
                          <div key={i} className="flex gap-2 text-xs">
                            <span className="font-mono text-sr-text-tertiary">{a.created_at}</span>
                            <span className="text-sr-text-secondary">
                              <span className="text-sr-accent">{a.actor}</span> · {a.entry_type}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
