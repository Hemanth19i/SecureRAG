import { useState } from 'react'
import { Search, Loader2, AlertTriangle } from 'lucide-react'
import { fetchCases } from '@/lib/api'
import type { CaseRow } from '@/lib/backend'
import { useApiData } from '@/lib/useApi'
import { normSeverity, sevHex } from '@/lib/format'

// Backend case statuses (server/api/routes.py PATCH allow-list).
const columns = ['OPEN', 'IN_PROGRESS', 'CONTAINED', 'CLOSED'] as const
const columnLabels: Record<string, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  CONTAINED: 'Contained',
  CLOSED: 'Closed',
}

export default function CaseManagement() {
  const [search, setSearch] = useState('')
  const [sevFilter, setSevFilter] = useState<string[]>([])

  const { status, data, error, reload } = useApiData<CaseRow[]>(() => fetchCases())
  const cases = data ?? []

  const severities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
  const toggleSev = (s: string) =>
    setSevFilter((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))

  const filtered = cases.filter((c) => {
    const matchSearch =
      search === '' ||
      c.title?.toLowerCase().includes(search.toLowerCase()) ||
      c.case_id?.toLowerCase().includes(search.toLowerCase())
    const matchSev = sevFilter.length === 0 || sevFilter.includes(String(c.severity || '').toUpperCase())
    return matchSearch && matchSev
  })

  const byColumn = (col: string) => filtered.filter((c) => String(c.status || '').toUpperCase() === col)

  return (
    <div className="mx-auto flex h-full max-w-[1400px] flex-col p-8">
      <div className="mb-6 flex shrink-0 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-sr-text-tertiary" />
            <input
              type="text"
              placeholder="Search cases…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 rounded-md border border-sr-border bg-sr-surface py-2 pl-9 pr-4 text-sm text-sr-text placeholder:text-sr-text-tertiary transition-colors focus:border-sr-accent focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-1">
            {severities.map((s) => {
              const c = sevHex(normSeverity(s))
              const active = sevFilter.includes(s)
              return (
                <button
                  key={s}
                  onClick={() => toggleSev(s)}
                  className="rounded border px-2.5 py-1.5 text-[11px] font-medium transition-colors"
                  style={
                    active
                      ? { color: c, backgroundColor: `${c}1f`, borderColor: `${c}66` }
                      : { color: '#8A8A8A', borderColor: '#1A1A1A' }
                  }
                >
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </button>
              )
            })}
          </div>
        </div>
        <span className="text-xs text-sr-text-tertiary">{cases.length} cases</span>
      </div>

      {status === 'loading' && (
        <div className="flex items-center gap-2 text-sm text-sr-text-secondary">
          <Loader2 size={15} className="animate-spin" /> Loading cases…
        </div>
      )}
      {status === 'error' && (
        <div className="flex items-center justify-between rounded-lg border border-sr-red/30 bg-sr-red/10 px-4 py-3 text-sm text-sr-red">
          <span className="flex items-center gap-2"><AlertTriangle size={15} /> {error}</span>
          <button onClick={reload} className="text-xs underline">Retry</button>
        </div>
      )}

      {status === 'ready' && (
        <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto">
          {columns.map((col) => {
            const colCases = byColumn(col)
            return (
              <div key={col} className="flex min-w-[260px] flex-1 flex-col">
                <div className="mb-3 flex items-center gap-2 px-1">
                  <span className="text-sm font-semibold text-sr-text">{columnLabels[col]}</span>
                  <span className="rounded-full bg-sr-elevated px-1.5 py-0.5 font-mono text-[11px] text-sr-text-secondary">
                    {colCases.length}
                  </span>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                  {colCases.length === 0 && (
                    <div className="rounded-lg border border-dashed border-sr-border px-3 py-6 text-center text-[11px] text-sr-text-tertiary">
                      None
                    </div>
                  )}
                  {colCases.map((c) => {
                    const sc = sevHex(normSeverity(c.severity))
                    return (
                      <div
                        key={c.case_id}
                        className="cursor-pointer rounded-lg border border-l-[3px] border-sr-border bg-sr-surface p-4 card-shadow transition-all hover:border-sr-border-focus"
                        style={{ borderLeftColor: sc }}
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span className="font-mono text-[10px] text-sr-accent">{c.case_id.slice(0, 8)}</span>
                          <span className="text-[10px] font-semibold uppercase" style={{ color: sc }}>
                            {String(c.severity || '').toLowerCase()}
                          </span>
                        </div>
                        <h4 className="mb-3 text-sm font-medium leading-snug text-sr-text">{c.title}</h4>
                        <div className="flex items-center justify-between border-t border-sr-border pt-2 text-[10px] text-sr-text-secondary">
                          <span>{c.assigned_to || c.created_by || 'unassigned'}</span>
                          <span className="font-mono text-sr-text-tertiary">{(c.created_at || '').slice(0, 10)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
