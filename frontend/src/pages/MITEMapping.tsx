import { useState } from 'react'
import { X, Shield, BookOpen, Bell, Wrench } from 'lucide-react'
import { mitreTechniques } from '@/data/demo'

const tactics = [
  'Initial Access',
  'Execution',
  'Persistence',
  'Credential Access',
  'Lateral Movement',
  'Command and Control',
  'Exfiltration',
]

const tacticBgMap: Record<string, string> = {
  'Initial Access': 'bg-sr-blue/5',
  'Execution': 'bg-sr-accent/5',
  'Persistence': 'bg-sr-yellow/5',
  'Credential Access': 'bg-sr-red/5',
  'Lateral Movement': 'bg-purple-500/5',
  'Command and Control': 'bg-sr-teal/5',
  'Exfiltration': 'bg-pink-500/5',
}

interface TechniqueDetail {
  id: string
  name: string
  tactic: string
  count: number
  description: string
  detectionRules: string[]
  mitigations: string[]
}

export default function MITEMapping() {
  const [selectedTechnique, setSelectedTechnique] = useState<TechniqueDetail | null>(null)
  const [hoveredTactic, setHoveredTactic] = useState<string | null>(null)

  const techniquesByTactic = (tactic: string) =>
    mitreTechniques.filter(t => t.tactic === tactic)

  const maxCount = Math.max(...mitreTechniques.map(t => t.count))

  const handleTechniqueClick = (tech: typeof mitreTechniques[0]) => {
    setSelectedTechnique({
      id: tech.id,
      name: tech.name,
      tactic: tech.tactic,
      count: tech.count,
      description: `The adversary is trying to get into your network. ${tech.name} involves techniques that use various entry vectors to gain an initial foothold within a network.`,
      detectionRules: ['SIGMA: process_creation_suspicious_powershell', 'YARA: apt_backdoor_generic', 'Splunk: unusual_lateral_movement'],
      mitigations: ['M1031: Network Intrusion Prevention', 'M1021: Restrict Web-based Content', 'M1054: Software Configuration'],
    })
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-display font-bold text-sr-text">MITRE ATT&CK Matrix</h2>
          <p className="text-sm text-sr-text-secondary mt-1">Interactive threat technique mapping</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-4 text-[11px] text-sr-text-secondary">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-sr-text-tertiary/30" /> No data</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-sr-accent/50" /> Low</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-sr-accent" /> High</span>
          </div>
        </div>
      </div>

      {/* Matrix Grid */}
      <div className="bg-sr-surface border border-sr-border rounded-lg overflow-hidden card-shadow">
        <div className="overflow-x-auto">
          <div className="flex" style={{ minWidth: 1200 }}>
            {tactics.map(tactic => {
              const techniques = techniquesByTactic(tactic)
              return (
                <div
                  key={tactic}
                  className="flex-1 border-r border-sr-border last:border-r-0"
                  onMouseEnter={() => setHoveredTactic(tactic)}
                  onMouseLeave={() => setHoveredTactic(null)}
                >
                  {/* Tactic Header */}
                  <div className={`px-3 py-3 bg-sr-elevated border-b border-sr-border ${hoveredTactic === tactic ? 'bg-sr-accent/10' : ''} transition-colors`}>
                    <h3 className="text-[11px] font-semibold text-sr-text uppercase tracking-wider text-center">{tactic}</h3>
                    <div className="text-center text-[10px] text-sr-text-tertiary mt-0.5">{techniques.length} techniques</div>
                  </div>

                  {/* Technique Cells */}
                  <div className="p-1.5 space-y-1">
                    {techniques.map(tech => {
                      const intensity = tech.count / maxCount
                      return (
                        <button
                          key={tech.id}
                          onClick={() => handleTechniqueClick(tech)}
                          className={`w-full text-left p-2.5 rounded border border-sr-border hover:border-sr-accent hover:shadow-elevated transition-all duration-150 group ${tacticBgMap[tactic] || ''}`}
                          style={{ opacity: 0.5 + intensity * 0.5 }}
                        >
                          <div className="text-[10px] font-mono text-sr-accent mb-0.5">{tech.id}</div>
                          <div className="text-[11px] text-sr-text font-medium leading-tight group-hover:text-sr-accent transition-colors">
                            {tech.name}
                          </div>
                          <div className="flex items-center justify-between mt-1.5">
                            <div className="w-full h-1 rounded-full bg-sr-elevated overflow-hidden mr-2">
                              <div
                                className="h-full rounded-full bg-sr-accent"
                                style={{ width: `${intensity * 100}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-mono text-sr-text-tertiary shrink-0">{tech.count}</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Technique Detail Modal */}
      {selectedTechnique && (
        <>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={() => setSelectedTechnique(null)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[560px] max-h-[80vh] bg-sr-surface border border-sr-border rounded-lg z-50 overflow-y-auto card-shadow animate-fade-in">
            {/* Header */}
            <div className="sticky top-0 bg-sr-surface border-b border-sr-border p-5 flex items-start justify-between z-10">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-sr-accent">{selectedTechnique.id}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-sr-elevated text-sr-text-secondary">{selectedTechnique.tactic}</span>
                </div>
                <h3 className="text-lg font-semibold text-sr-text">{selectedTechnique.name}</h3>
              </div>
              <button
                onClick={() => setSelectedTechnique(null)}
                className="p-1.5 rounded hover:bg-sr-elevated text-sr-text-tertiary hover:text-sr-text transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-6">
              {/* Detection Count */}
              <div className="flex items-center gap-3 p-3 bg-sr-elevated rounded-lg border border-sr-border">
                <Shield size={18} className="text-sr-accent" />
                <div>
                  <div className="text-2xl font-mono font-semibold text-sr-text">{selectedTechnique.count}</div>
                  <div className="text-[11px] text-sr-text-secondary">Detections in last 30 days</div>
                </div>
              </div>

              {/* Description */}
              <div>
                <h4 className="text-[11px] font-medium text-sr-text-secondary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <BookOpen size={12} /> Description
                </h4>
                <p className="text-sm text-sr-text leading-relaxed">{selectedTechnique.description}</p>
              </div>

              {/* Detection Rules */}
              <div>
                <h4 className="text-[11px] font-medium text-sr-text-secondary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Bell size={12} /> Detection Rules
                </h4>
                <div className="space-y-1.5">
                  {selectedTechnique.detectionRules.map(rule => (
                    <div key={rule} className="flex items-center gap-2 px-3 py-2 bg-sr-elevated rounded border border-sr-border">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-sr-accent/15 text-sr-accent font-medium">
                        {rule.split(':')[0]}
                      </span>
                      <span className="text-xs font-mono text-sr-text">{rule.split(':')[1]}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mitigations */}
              <div>
                <h4 className="text-[11px] font-medium text-sr-text-secondary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Wrench size={12} /> Mitigations
                </h4>
                <div className="space-y-1.5">
                  {selectedTechnique.mitigations.map(mit => (
                    <div key={mit} className="flex items-center gap-2 px-3 py-2 bg-sr-elevated rounded border border-sr-border">
                      <span className="text-xs font-mono text-sr-green">{mit.split(':')[0]}</span>
                      <span className="text-xs text-sr-text">{mit.split(':')[1]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
