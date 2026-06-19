import { useState } from 'react'
import { Search, Filter, ArrowUpDown, Eye, FileText, X } from 'lucide-react'
import StatusBadge from '@/components/StatusBadge'
import SeverityDot from '@/components/SeverityDot'
import { investigations } from '@/data/demo'
import type { Investigation } from '@/types'

export default function Investigations() {
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<string>('lastActivity')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selectedInvestigation, setSelectedInvestigation] = useState<Investigation | null>(null)

  const filtered = investigations.filter(inv =>
    inv.title.toLowerCase().includes(search.toLowerCase()) ||
    inv.id.toLowerCase().includes(search.toLowerCase()) ||
    inv.analyst.toLowerCase().includes(search.toLowerCase())
  )

  const sorted = [...filtered].sort((a, b) => {
    if (sortField === 'id') return sortDir === 'asc' ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id)
    if (sortField === 'severity') {
      const order = { critical: 0, high: 1, medium: 2, low: 3 }
      return sortDir === 'asc' ? order[a.severity] - order[b.severity] : order[b.severity] - order[a.severity]
    }
    return sortDir === 'asc' ? a.lastActivity.localeCompare(b.lastActivity) : b.lastActivity.localeCompare(a.lastActivity)
  })

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-sr-text-tertiary" />
            <input
              type="text"
              placeholder="Search investigations..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 bg-sr-surface border border-sr-border rounded-md text-sm text-sr-text placeholder:text-sr-text-tertiary focus:border-sr-accent focus:outline-none w-72 transition-colors"
            />
          </div>
          <button className="flex items-center gap-2 px-3 py-2 bg-sr-surface border border-sr-border rounded-md text-sm text-sr-text-secondary hover:text-sr-text hover:border-sr-border-focus transition-colors">
            <Filter size={14} />
            <span>Filter</span>
          </button>
        </div>
        <button className="px-4 py-2 bg-sr-accent text-sr-text rounded-md text-sm font-medium hover:bg-sr-accent-hover transition-colors">
          + New Investigation
        </button>
      </div>

      {/* Table */}
      <div className="bg-sr-surface border border-sr-border rounded-lg overflow-hidden card-shadow">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-sr-elevated">
                {[
                  { key: 'id', label: 'ID' },
                  { key: 'title', label: 'Title' },
                  { key: 'severity', label: 'Severity' },
                  { key: 'status', label: 'Status' },
                  { key: 'analyst', label: 'Analyst' },
                  { key: 'created', label: 'Created' },
                  { key: 'activity', label: 'Last Activity' },
                ].map(col => (
                  <th
                    key={col.key}
                    onClick={() => col.key !== 'analyst' && col.key !== 'created' && toggleSort(col.key)}
                    className={`px-4 py-3 text-left text-[11px] font-medium text-sr-text-secondary uppercase tracking-wider ${
                      col.key !== 'analyst' && col.key !== 'created' ? 'cursor-pointer hover:text-sr-text' : ''
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      {sortField === col.key && <ArrowUpDown size={10} className="text-sr-accent" />}
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 text-right text-[11px] font-medium text-sr-text-secondary uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sr-border">
              {sorted.map(inv => (
                <tr
                  key={inv.id}
                  className="hover:bg-sr-elevated transition-colors cursor-pointer"
                  onClick={() => setSelectedInvestigation(inv)}
                >
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono text-sr-accent">{inv.id}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-sr-text font-medium">{inv.title}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <SeverityDot severity={inv.severity} />
                      <span className="text-xs text-sr-text-secondary capitalize">{inv.severity}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={inv.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-sr-accent/20 flex items-center justify-center text-[10px] font-mono text-sr-accent font-medium">
                        {inv.analystAvatar}
                      </div>
                      <span className="text-xs text-sr-text-secondary">{inv.analyst}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-sr-text-tertiary font-mono">
                    {new Date(inv.created).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-xs text-sr-text-tertiary">
                    {inv.lastActivity}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className="p-1.5 rounded hover:bg-sr-elevated text-sr-text-tertiary hover:text-sr-text transition-colors">
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Investigation Detail Drawer */}
      {selectedInvestigation && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={() => setSelectedInvestigation(null)}
          />
          <div className="fixed right-0 top-0 h-full w-[420px] bg-sr-surface border-l border-sr-border z-50 animate-slide-in-right overflow-y-auto">
            <div className="sticky top-0 bg-sr-surface border-b border-sr-border p-5 flex items-center justify-between z-10">
              <div>
                <span className="text-xs font-mono text-sr-accent">{selectedInvestigation.id}</span>
                <h2 className="text-base font-semibold text-sr-text mt-0.5">{selectedInvestigation.title}</h2>
              </div>
              <button
                onClick={() => setSelectedInvestigation(null)}
                className="p-1.5 rounded hover:bg-sr-elevated text-sr-text-tertiary hover:text-sr-text transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-6">
              {/* Status */}
              <div className="flex items-center gap-3">
                <StatusBadge status={selectedInvestigation.status} />
                <SeverityDot severity={selectedInvestigation.severity} />
                <span className="text-xs text-sr-text-secondary capitalize">{selectedInvestigation.severity}</span>
              </div>

              {/* Description */}
              {selectedInvestigation.description && (
                <div>
                  <h3 className="text-[11px] font-medium text-sr-text-secondary uppercase tracking-wider mb-2">Description</h3>
                  <p className="text-sm text-sr-text leading-relaxed">{selectedInvestigation.description}</p>
                </div>
              )}

              {/* Analyst */}
              <div>
                <h3 className="text-[11px] font-medium text-sr-text-secondary uppercase tracking-wider mb-2">Assigned Analyst</h3>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-sr-accent/20 flex items-center justify-center text-xs font-mono text-sr-accent font-medium">
                    {selectedInvestigation.analystAvatar}
                  </div>
                  <span className="text-sm text-sr-text">{selectedInvestigation.analyst}</span>
                </div>
              </div>

              {/* IOCs */}
              {selectedInvestigation.iocs && (
                <div>
                  <h3 className="text-[11px] font-medium text-sr-text-secondary uppercase tracking-wider mb-2">Related IOCs</h3>
                  <div className="space-y-1.5">
                    {selectedInvestigation.iocs.map((ioc, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-2 bg-sr-elevated rounded border border-sr-border">
                        <FileText size={12} className="text-sr-accent shrink-0" />
                        <span className="text-xs font-mono text-sr-text">{ioc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* MITRE */}
              {selectedInvestigation.mitreTechniques && (
                <div>
                  <h3 className="text-[11px] font-medium text-sr-text-secondary uppercase tracking-wider mb-2">MITRE ATT&CK</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedInvestigation.mitreTechniques.map((tech) => (
                      <span key={tech} className="px-2 py-1 bg-sr-accent/10 border border-sr-accent/30 rounded text-xs font-mono text-sr-accent">
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div className="pt-4 border-t border-sr-border">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] text-sr-text-tertiary uppercase">Created</div>
                    <div className="text-xs text-sr-text-secondary font-mono">{new Date(selectedInvestigation.created).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-sr-text-tertiary uppercase">Last Activity</div>
                    <div className="text-xs text-sr-text-secondary">{selectedInvestigation.lastActivity}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
