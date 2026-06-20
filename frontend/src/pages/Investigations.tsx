import { useState } from 'react'
import { Search, Loader2, AlertTriangle } from 'lucide-react'
import { fetchCases } from '@/lib/api'
import type { CaseRow } from '@/lib/backend'
import { useApiData } from '@/lib/useApi'
import { normSeverity, sevHex } from '@/lib/format'
import CaseDetailDrawer from '@/components/CaseDetailDrawer'

function StatusPill({ status }: { status: string }) {
  const s = String(status || '').toUpperCase()
  const map: Record<string, string> = {
    OPEN: '#3B82F6', IN_PROGRESS: '#EAB308', CONTAINED: '#FF7A00', CLOSED: '#22C55E',
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
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { status, data, error, reload } = useApiData<CaseRow[]>(() => fetchCases())
  const cases = data ?? []

  const filtered = cases.filter(
    (c) =>
      c.title?.toLowerCase().includes(search.toLowerCase()) ||
      c.case_id?.toLowerCase().includes(search.toLowerCase()) ||
      (c.assigned_to || c.created_by || '').toLowerCase().includes(search.toLowerCase()),
  )

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
                    onClick={() => setSelectedId(c.case_id)}
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

      <CaseDetailDrawer caseId={selectedId} onClose={() => setSelectedId(null)} onChanged={reload} />
    </div>
  )
}
