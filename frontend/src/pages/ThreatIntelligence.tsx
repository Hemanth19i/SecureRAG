import { useState } from 'react'
import { ChevronDown, ChevronUp, Shield, ShieldAlert, Hash, Globe, ExternalLink, Radio } from 'lucide-react'
import { threatIntel } from '@/data/demo'

const sources = [
  { name: 'VirusTotal', status: 'active', lastSync: '2 min ago', quota: 82 },
  { name: 'Abuse.ch', status: 'active', lastSync: '5 min ago', quota: 95 },
  { name: 'MISP', status: 'active', lastSync: '12 min ago', quota: 70 },
  { name: 'ThreatFox', status: 'active', lastSync: '8 min ago', quota: 88 },
  { name: 'AlienVault OTX', status: 'warning', lastSync: '1 hr ago', quota: 45 },
  { name: 'CISA', status: 'active', lastSync: '30 min ago', quota: 60 },
]

const worldRegions = [
  { name: 'North America', score: 85, x: 22, y: 35 },
  { name: 'South America', score: 42, x: 28, y: 68 },
  { name: 'Europe', score: 78, x: 52, y: 30 },
  { name: 'Africa', score: 35, x: 52, y: 55 },
  { name: 'Asia', score: 92, x: 75, y: 38 },
  { name: 'Middle East', score: 68, x: 60, y: 42 },
  { name: 'Oceania', score: 25, x: 85, y: 70 },
]

export default function ThreatIntelligence() {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className="p-8 max-w-[1400px] mx-auto space-y-8">
      {/* Threat Map + Sources Row */}
      <div className="grid grid-cols-3 gap-6">
        {/* World Map */}
        <div className="col-span-2 bg-sr-surface border border-sr-border rounded-lg p-5 card-shadow">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-sr-text">Global Threat Map</h2>
            <span className="text-[11px] text-sr-text-tertiary">Threat Score by Region</span>
          </div>
          <div className="relative w-full aspect-[2/1]">
            <svg viewBox="0 0 100 80" className="w-full h-full">
              {/* Simplified world map outlines */}
              <path d="M15,25 Q20,20 30,22 Q35,18 40,20 Q38,28 35,32 Q30,35 25,33 Q18,30 15,25Z" fill="#111" stroke="#1A1A1A" strokeWidth="0.3" />
              <path d="M20,50 Q25,48 30,52 Q28,60 25,65 Q22,62 20,58 Q18,54 20,50Z" fill="#111" stroke="#1A1A1A" strokeWidth="0.3" />
              <path d="M45,20 Q55,18 60,22 Q58,30 55,32 Q50,35 48,30 Q45,25 45,20Z" fill="#111" stroke="#1A1A1A" strokeWidth="0.3" />
              <path d="M48,45 Q55,42 60,48 Q58,58 55,62 Q50,60 48,55 Q46,50 48,45Z" fill="#111" stroke="#1A1A1A" strokeWidth="0.3" />
              <path d="M65,25 Q75,22 82,26 Q85,32 80,38 Q75,40 70,38 Q65,35 65,30Z" fill="#111" stroke="#1A1A1A" strokeWidth="0.3" />
              <path d="M80,60 Q85,58 88,62 Q87,68 84,70 Q80,68 80,64Z" fill="#111" stroke="#1A1A1A" strokeWidth="0.3" />
              <path d="M58,38 Q63,36 66,40 Q64,46 60,48 Q57,44 58,38Z" fill="#111" stroke="#1A1A1A" strokeWidth="0.3" />
              {/* Heat dots */}
              {worldRegions.map(region => (
                <g key={region.name}>
                  <circle
                    cx={region.x}
                    cy={region.y}
                    r={3 + region.score / 20}
                    fill="#FF7A00"
                    opacity={0.1 + region.score / 200}
                  />
                  <circle
                    cx={region.x}
                    cy={region.y}
                    r={1.5}
                    fill="#FF7A00"
                    opacity={0.6 + region.score / 250}
                  />
                </g>
              ))}
            </svg>
            {/* Region labels */}
            {worldRegions.map(region => (
              <div
                key={region.name}
                className="absolute group cursor-pointer"
                style={{ left: `${region.x}%`, top: `${region.y * 1.25}%`, transform: 'translate(-50%, -50%)' }}
              >
                <div className="w-2 h-2 rounded-full bg-sr-accent opacity-60 group-hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-sr-elevated border border-sr-border rounded text-[10px] text-sr-text whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  {region.name}: {region.score}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Intel Sources */}
        <div className="bg-sr-surface border border-sr-border rounded-lg p-5 card-shadow">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-sr-text">Intel Sources</h2>
            <Radio size={14} className="text-sr-green animate-pulse-dot" />
          </div>
          <div className="space-y-3">
            {sources.map(source => (
              <div key={source.name} className="flex items-center gap-3 p-2.5 bg-sr-elevated rounded border border-sr-border">
                <div className={`w-2 h-2 rounded-full shrink-0 ${source.status === 'active' ? 'bg-sr-green' : 'bg-sr-yellow'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-sr-text">{source.name}</div>
                  <div className="text-[10px] text-sr-text-tertiary">{source.lastSync}</div>
                </div>
                <div className="w-12">
                  <div className="w-full h-1 rounded-full bg-sr-border overflow-hidden">
                    <div
                      className={`h-full rounded-full ${source.quota > 70 ? 'bg-sr-green' : source.quota > 40 ? 'bg-sr-yellow' : 'bg-sr-red'}`}
                      style={{ width: `${source.quota}%` }}
                    />
                  </div>
                  <div className="text-[9px] text-sr-text-tertiary text-right mt-0.5">{source.quota}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Threat Feed */}
      <div>
        <h2 className="text-base font-semibold text-sr-text mb-4">Threat Intelligence Feed</h2>
        <div className="space-y-3">
          {threatIntel.map(entry => {
            const isExpanded = expandedId === entry.id
            const confidenceColor = entry.confidence >= 90 ? 'text-sr-red' : entry.confidence >= 80 ? 'text-sr-accent' : 'text-sr-yellow'

            return (
              <div
                key={entry.id}
                className="bg-sr-surface border border-sr-border rounded-lg card-shadow overflow-hidden"
              >
                {/* Collapsed Header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-sr-elevated transition-colors text-left"
                >
                  <ShieldAlert size={18} className="text-sr-accent shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-sr-text">{entry.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-sr-elevated text-sr-text-secondary border border-sr-border">
                        {entry.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[11px] text-sr-text-secondary">{entry.source}</span>
                      <span className="text-[11px] text-sr-text-tertiary">{entry.date}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <div className={`text-sm font-mono font-semibold ${confidenceColor}`}>{entry.confidence}%</div>
                      <div className="text-[9px] text-sr-text-tertiary">Confidence</div>
                    </div>
                    {isExpanded ? <ChevronUp size={16} className="text-sr-text-tertiary" /> : <ChevronDown size={16} className="text-sr-text-tertiary" />}
                  </div>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-sr-border bg-sr-elevated/30">
                    <p className="text-sm text-sr-text-secondary leading-relaxed mt-4 mb-4">{entry.description}</p>

                    <div className="grid grid-cols-2 gap-4">
                      {/* IOCs */}
                      <div>
                        <h4 className="text-[10px] text-sr-text-secondary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Hash size={10} /> Related IOCs
                        </h4>
                        <div className="space-y-1">
                          {entry.iocs.map(ioc => (
                            <div key={ioc} className="flex items-center gap-2 px-2.5 py-1.5 bg-sr-surface rounded border border-sr-border">
                              <Globe size={10} className="text-sr-accent shrink-0" />
                              <span className="text-[11px] font-mono text-sr-accent">{ioc}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* MITRE */}
                      <div>
                        <h4 className="text-[10px] text-sr-text-secondary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Shield size={10} /> MITRE ATT&CK
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {entry.mitreTechniques.map(tech => (
                            <span key={tech} className="px-2 py-1 bg-sr-accent/10 border border-sr-accent/30 rounded text-[10px] font-mono text-sr-accent">
                              {tech}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Enrichment Links */}
                    <div className="mt-4 pt-3 border-t border-sr-border flex gap-2">
                      <button className="flex items-center gap-1.5 px-3 py-1.5 bg-sr-accent/10 border border-sr-accent/30 rounded text-[11px] text-sr-accent hover:bg-sr-accent/20 transition-colors">
                        <ExternalLink size={10} /> VirusTotal
                      </button>
                      <button className="flex items-center gap-1.5 px-3 py-1.5 bg-sr-accent/10 border border-sr-accent/30 rounded text-[11px] text-sr-accent hover:bg-sr-accent/20 transition-colors">
                        <ExternalLink size={10} /> MISP
                      </button>
                      <button className="flex items-center gap-1.5 px-3 py-1.5 bg-sr-accent/10 border border-sr-accent/30 rounded text-[11px] text-sr-accent hover:bg-sr-accent/20 transition-colors">
                        <ExternalLink size={10} /> MITRE
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
