import { useState } from 'react'
import { Search, ExternalLink, Plus, Download, ShieldCheck, Hash, Globe, Link2 } from 'lucide-react'
import { iocs } from '@/data/demo'
import type { IOC } from '@/types'

const typeIcons = {
  ip: Globe,
  hash: Hash,
  domain: Globe,
  url: Link2,
}

export default function IOCExplorer() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [selectedIOC, setSelectedIOC] = useState<IOC | null>(null)

  const filtered = iocs.filter(ioc => {
    const matchSearch = search === '' || ioc.value.toLowerCase().includes(search.toLowerCase()) || ioc.threatFamily?.toLowerCase().includes(search.toLowerCase())
    const matchType = typeFilter === 'All' || ioc.type === typeFilter.toLowerCase()
    return matchSearch && matchType
  })

  return (
    <div className="p-8 max-w-[1400px] mx-auto h-full flex flex-col">
      {/* Search & Filter Bar */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-xl">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-sr-text-tertiary" />
          <input
            type="text"
            placeholder="Search by IP, hash, domain, URL..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-sr-surface border border-sr-border rounded-md text-sm font-mono text-sr-text placeholder:text-sr-text-tertiary focus:border-sr-accent focus:outline-none transition-colors"
          />
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-2.5 bg-sr-surface border border-sr-border rounded-md text-sm text-sr-text-secondary focus:border-sr-accent focus:outline-none cursor-pointer"
        >
          <option value="All">All Types</option>
          <option value="IP">IP Address</option>
          <option value="Hash">File Hash</option>
          <option value="Domain">Domain</option>
          <option value="URL">URL</option>
        </select>
        <select className="px-3 py-2.5 bg-sr-surface border border-sr-border rounded-md text-sm text-sr-text-secondary focus:border-sr-accent focus:outline-none cursor-pointer">
          <option>All Confidence</option>
          <option>High (90%+)</option>
          <option>Medium (70-89%)</option>
          <option>Low (&lt;70%)</option>
        </select>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-sr-accent text-sr-text rounded-md text-sm font-medium hover:bg-sr-accent-hover transition-colors">
          <ExternalLink size={14} />
          Enrich
        </button>
      </div>

      {/* Split View */}
      <div className="flex gap-6 flex-1 min-h-0">
        {/* Table */}
        <div className={`bg-sr-surface border border-sr-border rounded-lg overflow-hidden card-shadow ${selectedIOC ? 'flex-1' : 'w-full'}`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-sr-elevated">
                  <th className="px-4 py-3 text-left text-[11px] font-medium text-sr-text-secondary uppercase tracking-wider">Value</th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium text-sr-text-secondary uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium text-sr-text-secondary uppercase tracking-wider">Reputation</th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium text-sr-text-secondary uppercase tracking-wider">First Seen</th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium text-sr-text-secondary uppercase tracking-wider">Sources</th>
                  <th className="px-4 py-3 text-left text-[11px] font-medium text-sr-text-secondary uppercase tracking-wider">Threats</th>
                  <th className="px-4 py-3 text-right text-[11px] font-medium text-sr-text-secondary uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sr-border">
                {filtered.map(ioc => {
                  const Icon = typeIcons[ioc.type] || Globe
                  const repColor = ioc.reputationScore >= 90 ? 'bg-sr-red' : ioc.reputationScore >= 70 ? 'bg-sr-accent' : 'bg-sr-yellow'
                  return (
                    <tr
                      key={ioc.id}
                      className={`hover:bg-sr-elevated transition-colors cursor-pointer ${selectedIOC?.id === ioc.id ? 'bg-sr-elevated' : ''}`}
                      onClick={() => setSelectedIOC(ioc)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Icon size={14} className="text-sr-accent shrink-0" />
                          <span className="text-xs font-mono text-sr-accent truncate max-w-[180px]">{ioc.value}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-sr-elevated text-sr-text-secondary uppercase border border-sr-border">
                          {ioc.type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-sr-elevated overflow-hidden">
                            <div className={`h-full rounded-full ${repColor}`} style={{ width: `${ioc.reputationScore}%` }} />
                          </div>
                          <span className="text-xs font-mono text-sr-text-secondary">{ioc.reputationScore}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-sr-text-tertiary font-mono">{ioc.firstSeen}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {ioc.sources.slice(0, 2).map(s => (
                            <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-sr-accent/10 text-sr-accent">{s}</span>
                          ))}
                          {ioc.sources.length > 2 && (
                            <span className="text-[10px] text-sr-text-tertiary">+{ioc.sources.length - 2}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-sr-text-secondary">{ioc.associatedThreats.join(', ')}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button className="p-1.5 rounded hover:bg-sr-elevated text-sr-text-tertiary hover:text-sr-text transition-colors" title="Add to case">
                            <Plus size={13} />
                          </button>
                          <button className="p-1.5 rounded hover:bg-sr-elevated text-sr-text-tertiary hover:text-sr-text transition-colors" title="Export">
                            <Download size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail Panel */}
        {selectedIOC && (
          <div className="w-[380px] bg-sr-surface border border-sr-border rounded-lg card-shadow overflow-y-auto shrink-0">
            <div className="p-5 border-b border-sr-border">
              <div className="flex items-center gap-2 mb-2">
                {(() => { const Icon = typeIcons[selectedIOC.type] || Globe; return <Icon size={16} className="text-sr-accent" /> })()}
                <span className="text-[10px] px-2 py-0.5 rounded bg-sr-elevated text-sr-text-secondary uppercase border border-sr-border">
                  {selectedIOC.type}
                </span>
              </div>
              <h3 className="text-base font-mono text-sr-accent break-all">{selectedIOC.value}</h3>
              {selectedIOC.threatFamily && (
                <p className="text-sm text-sr-text mt-1">{selectedIOC.threatFamily}</p>
              )}
            </div>

            <div className="p-5 space-y-5">
              {/* Reputation */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-sr-text-secondary uppercase tracking-wider">Reputation Score</span>
                  <span className="text-lg font-mono font-medium text-sr-red">{selectedIOC.reputationScore}/100</span>
                </div>
                <div className="w-full h-2 rounded-full bg-sr-elevated overflow-hidden">
                  <div
                    className={`h-full rounded-full ${selectedIOC.reputationScore >= 90 ? 'bg-sr-red' : selectedIOC.reputationScore >= 70 ? 'bg-sr-accent' : 'bg-sr-yellow'}`}
                    style={{ width: `${selectedIOC.reputationScore}%` }}
                  />
                </div>
              </div>

              {/* Confidence */}
              {selectedIOC.confidence && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] text-sr-text-secondary uppercase tracking-wider">Confidence</span>
                    <span className="text-sm font-mono text-sr-text">{selectedIOC.confidence}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-sr-elevated overflow-hidden">
                    <div className="h-full rounded-full bg-sr-accent" style={{ width: `${selectedIOC.confidence}%` }} />
                  </div>
                </div>
              )}

              {/* Sources */}
              <div>
                <h4 className="text-[11px] text-sr-text-secondary uppercase tracking-wider mb-2">Intelligence Sources</h4>
                <div className="space-y-1.5">
                  {selectedIOC.sources.map(source => (
                    <div key={source} className="flex items-center gap-2 px-3 py-2 bg-sr-elevated rounded border border-sr-border">
                      <ShieldCheck size={12} className="text-sr-green shrink-0" />
                      <span className="text-xs text-sr-text">{source}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Associated Threats */}
              <div>
                <h4 className="text-[11px] text-sr-text-secondary uppercase tracking-wider mb-2">Associated Threats</h4>
                <div className="flex flex-wrap gap-1.5">
                  {selectedIOC.associatedThreats.map(threat => (
                    <span key={threat} className="px-2 py-1 bg-sr-red/10 border border-sr-red/30 rounded text-xs text-sr-red">
                      {threat}
                    </span>
                  ))}
                </div>
              </div>

              {/* Timeline */}
              <div>
                <h4 className="text-[11px] text-sr-text-secondary uppercase tracking-wider mb-2">Timeline</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-sr-green shrink-0" />
                    <div>
                      <div className="text-[10px] text-sr-text-tertiary">First Seen</div>
                      <div className="text-xs text-sr-text font-mono">{selectedIOC.firstSeen}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-sr-accent shrink-0" />
                    <div>
                      <div className="text-[10px] text-sr-text-tertiary">Last Seen</div>
                      <div className="text-xs text-sr-text font-mono">{selectedIOC.lastSeen}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-sr-border flex gap-2">
                <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-sr-accent text-sr-text rounded text-xs font-medium hover:bg-sr-accent-hover transition-colors">
                  <Plus size={12} /> Add to Case
                </button>
                <button className="flex items-center justify-center gap-2 px-3 py-2 bg-sr-elevated border border-sr-border text-sr-text-secondary rounded text-xs hover:text-sr-text hover:border-sr-border-focus transition-colors">
                  <Download size={12} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
