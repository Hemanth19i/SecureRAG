import { useState } from 'react'
import { Search, Plus, Calendar } from 'lucide-react'
import { cases } from '@/data/demo'

const columns = ['open', 'in_progress', 'under_review', 'resolved', 'closed'] as const

const columnLabels: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  under_review: 'Under Review',
  resolved: 'Resolved',
  closed: 'Closed',
}

const priorityColors: Record<string, string> = {
  P1: 'border-l-sr-red',
  P2: 'border-l-sr-yellow',
  P3: 'border-l-sr-blue',
  P4: 'border-l-sr-green',
}

export default function CaseManagement() {
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<string[]>([])

  const priorities = ['P1', 'P2', 'P3', 'P4']

  const togglePriority = (p: string) => {
    setPriorityFilter(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    )
  }

  const filteredCases = cases.filter(c => {
    const matchSearch = search === '' || c.title.toLowerCase().includes(search.toLowerCase()) || c.id.toLowerCase().includes(search.toLowerCase())
    const matchPriority = priorityFilter.length === 0 || priorityFilter.includes(c.priority)
    return matchSearch && matchPriority
  })

  const casesByColumn = (status: string) =>
    filteredCases.filter(c => c.status === status)

  return (
    <div className="p-8 max-w-[1400px] mx-auto h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-sr-text-tertiary" />
            <input
              type="text"
              placeholder="Search cases..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 bg-sr-surface border border-sr-border rounded-md text-sm text-sr-text placeholder:text-sr-text-tertiary focus:border-sr-accent focus:outline-none w-64 transition-colors"
            />
          </div>
          <div className="flex items-center gap-1">
            {priorities.map(p => (
              <button
                key={p}
                onClick={() => togglePriority(p)}
                className={`px-2.5 py-1.5 rounded text-[11px] font-medium border transition-colors ${
                  priorityFilter.includes(p)
                    ? 'bg-sr-accent/15 border-sr-accent text-sr-accent'
                    : 'border-sr-border text-sr-text-tertiary hover:text-sr-text-secondary'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-sr-accent text-sr-text rounded-md text-sm font-medium hover:bg-sr-accent-hover transition-colors">
          <Plus size={14} /> New Case
        </button>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 flex-1 min-h-0 overflow-x-auto">
        {columns.map(col => {
          const colCases = casesByColumn(col)
          return (
            <div key={col} className="flex-1 min-w-[260px] flex flex-col">
              {/* Column Header */}
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-sr-text">{columnLabels[col]}</span>
                  <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-sr-elevated text-sr-text-secondary font-mono">
                    {colCases.length}
                  </span>
                </div>
              </div>

              {/* Cards */}
              <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                {colCases.map(c => (
                  <div
                    key={c.id}
                    className={`bg-sr-surface border border-sr-border rounded-lg p-4 card-shadow hover:border-sr-border-focus transition-all cursor-pointer group border-l-[3px] ${priorityColors[c.priority]}`}
                  >
                    {/* ID + Priority */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono text-sr-accent">{c.id}</span>
                      <span className={`text-[10px] font-semibold ${
                        c.priority === 'P1' ? 'text-sr-red' :
                        c.priority === 'P2' ? 'text-sr-yellow' :
                        c.priority === 'P3' ? 'text-sr-blue' : 'text-sr-green'
                      }`}>{c.priority}</span>
                    </div>

                    {/* Title */}
                    <h4 className="text-sm font-medium text-sr-text mb-3 group-hover:text-sr-accent transition-colors leading-snug">
                      {c.title}
                    </h4>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1 mb-3">
                      {c.tags.slice(0, 2).map(tag => (
                        <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-sr-elevated text-sr-text-tertiary font-mono">
                          {tag}
                        </span>
                      ))}
                      {c.tags.length > 2 && (
                        <span className="text-[9px] text-sr-text-tertiary">+{c.tags.length - 2}</span>
                      )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-2 border-t border-sr-border">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-sr-accent/20 flex items-center justify-center text-[8px] font-mono text-sr-accent font-medium">
                          {c.assigneeAvatar}
                        </div>
                        <span className="text-[10px] text-sr-text-secondary">{c.assignee}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-sr-text-tertiary">
                        <Calendar size={9} />
                        <span>{new Date(c.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
