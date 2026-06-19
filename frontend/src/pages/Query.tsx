import { useState } from 'react'
import {
  Search, Loader2, AlertTriangle, Sparkles, FileText, Quote,
  ShieldAlert, ListChecks, Network, Clock, Fingerprint, Save, ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { fetchQuery, createCase, ApiError } from '@/lib/api'
import type { QueryResponse } from '@/lib/backend'
import { normSeverity, sevHex, riskHex, flattenIocs } from '@/lib/format'

const SAMPLE = 'Summarize the attack: how did the adversary gain access, move laterally, and exfiltrate data? What are the key IOCs and recommended actions?'

function SeverityPill({ level }: { level: string }) {
  const ui = normSeverity(level)
  const c = sevHex(ui)
  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide font-mono"
      style={{ color: c, backgroundColor: `${c}1f`, borderColor: `${c}40` }}
    >
      {String(level || 'unknown').toUpperCase()}
    </span>
  )
}

export default function Query() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [data, setData] = useState<QueryResponse | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const run = async (q?: string) => {
    const text = (q ?? query).trim()
    if (!text) return
    setQuery(text)
    setStatus('loading')
    setError('')
    try {
      const res = await fetchQuery(text)
      setData(res)
      setStatus('ready')
    } catch (err) {
      setStatus('error')
      setError(err instanceof ApiError ? err.message : 'Request failed — is the backend running?')
    }
  }

  const saveAsCase = async () => {
    if (!data) return
    setSaving(true)
    try {
      const c = await createCase({ query: data.query, snapshot: data })
      toast.success('Saved as case', { description: c.title || c.case_id })
    } catch (err) {
      toast.error('Could not save case', {
        description: err instanceof ApiError ? err.message : 'Request failed',
      })
    } finally {
      setSaving(false)
    }
  }

  const analysis = data?.analysis
  const iocs = flattenIocs(data?.iocs)
  const citations = data?.citations ?? []

  return (
    <div className="mx-auto max-w-[1100px] p-8 pb-16 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-sr-accent" />
          <h1 className="font-display text-xl font-bold text-sr-text">AI Investigation</h1>
        </div>
        <p className="mt-1 text-sm text-sr-text-secondary">
          Ask the RAG engine about your ingested logs. Answers are grounded in retrieved evidence — see Sources.
        </p>
      </div>

      {/* Query input */}
      <div className="rounded-lg border border-sr-border bg-sr-surface p-4 card-shadow">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') run()
          }}
          rows={3}
          placeholder="e.g. What happened in this incident? Trace the kill chain and list IOCs…"
          className="w-full resize-none bg-transparent text-sm text-sr-text placeholder:text-sr-text-tertiary focus:outline-none"
        />
        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={() => run(SAMPLE)}
            className="text-[11px] text-sr-text-tertiary hover:text-sr-accent transition-colors"
          >
            Try a sample question
          </button>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-[10px] text-sr-text-tertiary font-mono">⌘/Ctrl + ↵</span>
            <Button
              onClick={() => run()}
              disabled={status === 'loading' || !query.trim()}
              className="bg-sr-accent text-white hover:bg-sr-accent-hover"
            >
              {status === 'loading' ? (
                <><Loader2 size={15} className="animate-spin" /> Investigating…</>
              ) : (
                <><Search size={15} /> Investigate</>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Error */}
      {status === 'error' && (
        <div className="flex items-center gap-2 rounded-lg border border-sr-red/30 bg-sr-red/10 px-4 py-3 text-sm text-sr-red">
          <AlertTriangle size={15} className="shrink-0" /> {error}
        </div>
      )}

      {/* Loading skeleton */}
      {status === 'loading' && (
        <div className="space-y-4">
          <div className="h-40 rounded-lg border border-sr-border skeleton-shimmer" />
          <div className="h-48 rounded-lg border border-sr-border skeleton-shimmer" />
        </div>
      )}

      {/* Results */}
      {status === 'ready' && data && analysis && (
        <div className="space-y-8 animate-fade-in">
          {/* Hero answer */}
          <div className="rounded-lg border border-sr-border bg-sr-surface card-shadow overflow-hidden">
            <div className="flex items-center justify-between border-b border-sr-border bg-sr-elevated/50 px-5 py-3">
              <div className="flex items-center gap-2">
                <ShieldAlert size={15} className="text-sr-accent" />
                <span className="text-sm font-semibold text-sr-text">Analysis</span>
                {analysis.severity && <SeverityPill level={analysis.severity} />}
                {analysis.analysis_method && (
                  <Badge variant="outline" className="text-[10px] text-sr-text-tertiary border-sr-border">
                    {analysis.analysis_method}
                  </Badge>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={saveAsCase}
                disabled={saving}
                className="border-sr-border text-sr-text-secondary hover:text-sr-text"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Save as case
              </Button>
            </div>
            <div className="p-5 space-y-4">
              {analysis.error ? (
                <p className="text-sm text-sr-red">{analysis.error}</p>
              ) : (
                <p className="text-[15px] leading-relaxed text-sr-text whitespace-pre-wrap">
                  {analysis.answer}
                </p>
              )}
              {analysis.summary && (
                <p className="text-sm text-sr-text-secondary border-l-2 border-sr-accent/40 pl-3">
                  {analysis.summary}
                </p>
              )}
            </div>
          </div>

          {/* Threats + recommendations */}
          {(analysis.threats?.length > 0 || analysis.recommendations?.length > 0) && (
            <div className="grid gap-4 md:grid-cols-2">
              {analysis.threats?.length > 0 && (
                <div className="rounded-lg border border-sr-border bg-sr-surface p-5 card-shadow">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-sr-text">
                    <AlertTriangle size={14} className="text-sr-red" /> Threats
                  </h3>
                  <ul className="space-y-2">
                    {analysis.threats.map((t, i) => (
                      <li key={i} className="flex gap-2 text-sm text-sr-text-secondary">
                        <ChevronRight size={14} className="mt-0.5 shrink-0 text-sr-red" />
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {analysis.recommendations?.length > 0 && (
                <div className="rounded-lg border border-sr-border bg-sr-surface p-5 card-shadow">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-sr-text">
                    <ListChecks size={14} className="text-sr-green" /> Recommendations
                  </h3>
                  <ul className="space-y-2">
                    {analysis.recommendations.map((r, i) => (
                      <li key={i} className="flex gap-2 text-sm text-sr-text-secondary">
                        <ChevronRight size={14} className="mt-0.5 shrink-0 text-sr-green" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Sources / citations — the source-grounding differentiator */}
          <div className="rounded-lg border border-sr-accent/30 bg-sr-surface card-shadow overflow-hidden">
            <div className="flex items-center gap-2 border-b border-sr-border bg-sr-accent/5 px-5 py-3">
              <Quote size={15} className="text-sr-accent" />
              <span className="text-sm font-semibold text-sr-text">Sources</span>
              <span className="text-[11px] text-sr-text-tertiary">
                {citations.length} chunk{citations.length === 1 ? '' : 's'} grounded this answer
              </span>
            </div>
            {citations.length === 0 ? (
              <p className="px-5 py-6 text-sm text-sr-text-tertiary">
                No retrieved chunks for this query — ingest logs on the Ingest page, then ask again.
              </p>
            ) : (
              <div className="divide-y divide-sr-border">
                {citations.map((c, i) => (
                  <div key={c.chunk_id ?? i} className="px-5 py-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText size={13} className="shrink-0 text-sr-accent" />
                        <span className="truncate text-xs font-medium text-sr-text">
                          {c.source_file || 'unknown source'}
                        </span>
                        {c.chunk_id && (
                          <span className="truncate font-mono text-[10px] text-sr-text-tertiary">
                            {c.chunk_id}
                          </span>
                        )}
                      </div>
                      {typeof c.score === 'number' && (
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-sr-elevated">
                            <div className="h-full rounded-full bg-sr-accent" style={{ width: `${Math.round(c.score * 100)}%` }} />
                          </div>
                          <span className="font-mono text-[10px] text-sr-text-secondary">
                            {c.score.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                    <p className="font-mono text-xs leading-relaxed text-sr-text-secondary">
                      {c.snippet}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Structured intel */}
          <Tabs defaultValue="iocs" className="w-full">
            <TabsList className="bg-sr-elevated">
              <TabsTrigger value="iocs" className="gap-1.5"><Fingerprint size={13} /> IOCs ({iocs.length})</TabsTrigger>
              <TabsTrigger value="mitre" className="gap-1.5"><Network size={13} /> MITRE ({data.mitre?.techniques?.length ?? 0})</TabsTrigger>
              <TabsTrigger value="timeline" className="gap-1.5"><Clock size={13} /> Timeline ({data.timeline?.events?.length ?? 0})</TabsTrigger>
              <TabsTrigger value="correlation" className="gap-1.5"><Search size={13} /> Correlation</TabsTrigger>
            </TabsList>

            {/* IOCs */}
            <TabsContent value="iocs" className="mt-4">
              <div className="rounded-lg border border-sr-border bg-sr-surface p-5 card-shadow">
                {iocs.length === 0 ? (
                  <p className="text-sm text-sr-text-tertiary">No IOCs extracted from the retrieved evidence.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {iocs.map((io, i) => (
                      <span key={`${io.value}-${i}`} className="inline-flex items-center gap-1.5 rounded border border-sr-border bg-sr-elevated px-2 py-1">
                        <span className="rounded bg-sr-accent/10 px-1 text-[9px] uppercase text-sr-accent">{io.type}</span>
                        <span className="font-mono text-xs text-sr-text">{io.value}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* MITRE */}
            <TabsContent value="mitre" className="mt-4">
              <div className="rounded-lg border border-sr-border bg-sr-surface p-5 card-shadow">
                {(data.mitre?.techniques?.length ?? 0) === 0 ? (
                  <p className="text-sm text-sr-text-tertiary">No ATT&CK techniques mapped.</p>
                ) : (
                  <div className="space-y-2">
                    {data.mitre.techniques.map((t, i) => (
                      <div key={`${t.technique}-${i}`} className="flex items-start gap-3 rounded border border-sr-border bg-sr-elevated p-3">
                        <span className="font-mono text-xs text-sr-accent shrink-0">{t.technique}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-sr-text">{t.name}</span>
                            <Badge variant="outline" className="text-[9px] text-sr-text-tertiary border-sr-border">{t.tactic}</Badge>
                            {t.confidence && (
                              <span className="text-[9px] uppercase text-sr-text-tertiary">{t.confidence}</span>
                            )}
                          </div>
                          {t.evidence?.length > 0 && (
                            <p className="mt-1 font-mono text-[11px] text-sr-text-tertiary truncate">{t.evidence[0]}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Timeline */}
            <TabsContent value="timeline" className="mt-4">
              <div className="rounded-lg border border-sr-border bg-sr-surface p-5 card-shadow">
                {(data.timeline?.events?.length ?? 0) === 0 ? (
                  <p className="text-sm text-sr-text-tertiary">{data.timeline?.summary || 'No timeline events found.'}</p>
                ) : (
                  <div className="space-y-3">
                    {data.timeline.events.map((ev, i) => {
                      const c = sevHex(normSeverity(ev.severity))
                      return (
                        <div key={i} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <span className="mt-1 h-2 w-2 rounded-full" style={{ backgroundColor: c }} />
                            {i < data.timeline.events.length - 1 && <span className="w-px flex-1 bg-sr-border" />}
                          </div>
                          <div className="pb-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[11px] text-sr-text-tertiary">{ev.timestamp}</span>
                              <span className="text-sm text-sr-text">{ev.event_type}</span>
                              {ev.mitre_technique && (
                                <span className="font-mono text-[10px] text-sr-accent">{ev.mitre_technique}</span>
                              )}
                            </div>
                            <p className="text-xs text-sr-text-secondary">{ev.description}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Correlation */}
            <TabsContent value="correlation" className="mt-4">
              <div className="rounded-lg border border-sr-border bg-sr-surface p-5 card-shadow space-y-4">
                {(data.correlation?.analyst_insights?.length ?? 0) > 0 && (
                  <div>
                    <h4 className="mb-2 text-[11px] uppercase tracking-wider text-sr-text-secondary">Analyst Insights</h4>
                    <ul className="space-y-1.5">
                      {data.correlation.analyst_insights.map((s, i) => (
                        <li key={i} className="flex gap-2 text-sm text-sr-text-secondary">
                          <ChevronRight size={14} className="mt-0.5 shrink-0 text-sr-accent" /> {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {Object.keys(data.correlation?.details ?? {}).length === 0 ? (
                  <p className="text-sm text-sr-text-tertiary">No cross-file correlations yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-[10px] uppercase tracking-wider text-sr-text-secondary">
                          <th className="py-2 pr-4">Indicator</th>
                          <th className="py-2 pr-4">Category</th>
                          <th className="py-2 pr-4">Role</th>
                          <th className="py-2 pr-4">Risk</th>
                          <th className="py-2 pr-4 text-right">Freq</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-sr-border">
                        {Object.entries(data.correlation.details).map(([value, d]) => (
                          <tr key={value}>
                            <td className="py-2 pr-4 font-mono text-xs text-sr-text">{value}</td>
                            <td className="py-2 pr-4 text-xs text-sr-text-secondary">{d.category}</td>
                            <td className="py-2 pr-4 text-xs text-sr-text-secondary">{d.role}</td>
                            <td className="py-2 pr-4">
                              <span className="font-mono text-[11px] font-semibold" style={{ color: riskHex(d.risk_level) }}>
                                {d.risk_level}
                              </span>
                            </td>
                            <td className="py-2 pr-4 text-right font-mono text-xs text-sr-text-secondary">{d.frequency}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  )
}
