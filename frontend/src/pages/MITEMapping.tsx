import { useState } from 'react'
import { X, Shield, BookOpen, Loader2, AlertTriangle, Sparkles, Quote } from 'lucide-react'
import { fetchMitreMap, ApiError } from '@/lib/api'
import type { MitreTechnique } from '@/lib/backend'

// Canonical ATT&CK tactic order; only columns with mapped techniques render.
const TACTIC_ORDER = [
  'Initial Access', 'Execution', 'Persistence', 'Privilege Escalation',
  'Defense Evasion', 'Credential Access', 'Discovery', 'Lateral Movement',
  'Collection', 'Command and Control', 'Exfiltration', 'Impact',
]

const confColor: Record<string, string> = { HIGH: '#EF4444', MEDIUM: '#FF7A00', LOW: '#EAB308' }

export default function MITEMapping() {
  const [text, setText] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [techniques, setTechniques] = useState<MitreTechnique[]>([])
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<MitreTechnique | null>(null)

  const analyze = async () => {
    if (!text.trim()) return
    setStatus('loading')
    setError('')
    try {
      const r = await fetchMitreMap(text)
      setTechniques(r.techniques || [])
      setStatus('ready')
    } catch (e) {
      setStatus('error')
      setError(e instanceof ApiError ? e.message : 'Request failed — is the backend running?')
    }
  }

  const tacticsPresent = TACTIC_ORDER.filter((t) => techniques.some((x) => x.tactic === t))
  const extraTactics = Array.from(new Set(techniques.map((t) => t.tactic))).filter(
    (t) => !TACTIC_ORDER.includes(t),
  )
  const columns = [...tacticsPresent, ...extraTactics]

  return (
    <div className="mx-auto max-w-[1400px] p-8">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-sr-accent" />
          <h2 className="font-display text-xl font-bold text-sr-text">MITRE ATT&CK Mapping</h2>
        </div>
        <p className="mt-1 text-sm text-sr-text-secondary">Paste log text or analyst notes to map against ATT&CK techniques.</p>
      </div>

      <div className="mb-6 rounded-lg border border-sr-border bg-sr-surface p-4 card-shadow">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="Paste log lines or notes…"
          className="w-full resize-none bg-transparent font-mono text-sm text-sr-text placeholder:text-sr-text-tertiary focus:outline-none"
        />
        <div className="mt-3 flex justify-end">
          <button
            onClick={analyze}
            disabled={status === 'loading' || !text.trim()}
            className="flex items-center gap-2 rounded-md bg-sr-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sr-accent-hover disabled:opacity-50"
          >
            {status === 'loading' ? <><Loader2 size={15} className="animate-spin" /> Mapping…</> : 'Analyze'}
          </button>
        </div>
      </div>

      {status === 'error' && (
        <div className="flex items-center gap-2 rounded-lg border border-sr-red/30 bg-sr-red/10 px-4 py-3 text-sm text-sr-red">
          <AlertTriangle size={15} /> {error}
        </div>
      )}
      {status === 'ready' && techniques.length === 0 && (
        <div className="rounded-lg border border-sr-border bg-sr-surface px-5 py-10 text-center text-sm text-sr-text-tertiary card-shadow">
          No ATT&CK techniques mapped from that text.
        </div>
      )}

      {status === 'ready' && techniques.length > 0 && (
        <>
          <div className="mb-4 text-xs text-sr-text-secondary">
            {techniques.length} technique{techniques.length === 1 ? '' : 's'} across {columns.length} tactic{columns.length === 1 ? '' : 's'}
          </div>
          <div className="overflow-hidden rounded-lg border border-sr-border bg-sr-surface card-shadow">
            <div className="overflow-x-auto">
              <div className="flex" style={{ minWidth: Math.max(columns.length * 200, 600) }}>
                {columns.map((tactic) => {
                  const techs = techniques.filter((t) => t.tactic === tactic)
                  return (
                    <div key={tactic} className="flex-1 border-r border-sr-border last:border-r-0">
                      <div className="border-b border-sr-border bg-sr-elevated px-3 py-3 text-center">
                        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-sr-text">{tactic}</h3>
                        <div className="mt-0.5 text-[10px] text-sr-text-tertiary">{techs.length}</div>
                      </div>
                      <div className="space-y-1 p-1.5">
                        {techs.map((tech, i) => {
                          const c = confColor[tech.confidence] || '#8A8A8A'
                          return (
                            <button
                              key={`${tech.technique}-${i}`}
                              onClick={() => setSelected(tech)}
                              className="w-full rounded border border-sr-border p-2.5 text-left transition-all hover:border-sr-accent"
                              style={{ background: `${c}0d` }}
                            >
                              <div className="font-mono text-[10px] text-sr-accent">{tech.technique}</div>
                              <div className="text-[11px] font-medium leading-tight text-sr-text">{tech.name}</div>
                              <div className="mt-1 flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
                                <span className="text-[9px] uppercase text-sr-text-tertiary">{tech.confidence}{tech.inferred ? ' · inferred' : ''}</span>
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
        </>
      )}

      {/* Detail modal */}
      {selected && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="fixed left-1/2 top-1/2 z-50 max-h-[80vh] w-[560px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-sr-border bg-sr-surface card-shadow animate-fade-in">
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-sr-border bg-sr-surface p-5">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-mono text-xs text-sr-accent">{selected.technique}</span>
                  <span className="rounded bg-sr-elevated px-1.5 py-0.5 text-[10px] text-sr-text-secondary">{selected.tactic}</span>
                  <span className="text-[10px] uppercase text-sr-text-tertiary">{selected.confidence}</span>
                </div>
                <h3 className="text-lg font-semibold text-sr-text">{selected.name}</h3>
              </div>
              <button onClick={() => setSelected(null)} className="rounded p-1.5 text-sr-text-tertiary hover:bg-sr-elevated hover:text-sr-text">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-6 p-5">
              {selected.note && (
                <div>
                  <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-sr-text-secondary">
                    <BookOpen size={12} /> Note
                  </h4>
                  <p className="text-sm leading-relaxed text-sr-text">{selected.note}</p>
                </div>
              )}
              <div>
                <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-sr-text-secondary">
                  <Quote size={12} /> Evidence ({selected.evidence?.length ?? 0})
                </h4>
                {(selected.evidence?.length ?? 0) === 0 ? (
                  <p className="text-xs text-sr-text-tertiary">No evidence lines.</p>
                ) : (
                  <div className="space-y-1.5">
                    {selected.evidence.map((e, i) => (
                      <div key={i} className="rounded border border-sr-border bg-sr-elevated px-3 py-2 font-mono text-[11px] text-sr-text">{e}</div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 rounded border border-sr-border bg-sr-elevated p-3">
                <Shield size={15} className="text-sr-accent" />
                <span className="text-xs text-sr-text-secondary">Phase {selected.phase} · {selected.inferred ? 'inferred' : 'observed'}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
