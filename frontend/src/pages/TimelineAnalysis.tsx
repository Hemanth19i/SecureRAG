import { useState } from 'react'
import { Clock, AlertTriangle, Loader2, Sparkles } from 'lucide-react'
import { fetchTimeline, ApiError } from '@/lib/api'
import type { BackendTimelineEvent } from '@/lib/backend'
import { normSeverity, sevHex } from '@/lib/format'

export default function TimelineAnalysis() {
  const [text, setText] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [events, setEvents] = useState<BackendTimelineEvent[]>([])
  const [summary, setSummary] = useState('')
  const [error, setError] = useState('')
  const [sevFilter, setSevFilter] = useState('All')

  const analyze = async () => {
    if (!text.trim()) return
    setStatus('loading')
    setError('')
    try {
      const r = await fetchTimeline(text)
      setEvents(r.timeline || [])
      setSummary(r.summary || '')
      setStatus('ready')
    } catch (e) {
      setStatus('error')
      setError(e instanceof ApiError ? e.message : 'Request failed — is the backend running?')
    }
  }

  const severities = ['All', 'critical', 'high', 'medium', 'low']
  const filtered = sevFilter === 'All' ? events : events.filter((e) => normSeverity(e.severity) === sevFilter)

  return (
    <div className="mx-auto max-w-[1000px] p-8">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-sr-accent" />
          <h2 className="font-display text-xl font-bold text-sr-text">Timeline Analysis</h2>
        </div>
        <p className="mt-1 text-sm text-sr-text-secondary">Paste log text to reconstruct a chronological attack timeline.</p>
      </div>

      <div className="mb-6 rounded-lg border border-sr-border bg-sr-surface p-4 card-shadow">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="Paste timestamped log lines…"
          className="w-full resize-none bg-transparent font-mono text-sm text-sr-text placeholder:text-sr-text-tertiary focus:outline-none"
        />
        <div className="mt-3 flex justify-end">
          <button
            onClick={analyze}
            disabled={status === 'loading' || !text.trim()}
            className="flex items-center gap-2 rounded-md bg-sr-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sr-accent-hover disabled:opacity-50"
          >
            {status === 'loading' ? <><Loader2 size={15} className="animate-spin" /> Building…</> : 'Analyze'}
          </button>
        </div>
      </div>

      {status === 'error' && (
        <div className="flex items-center gap-2 rounded-lg border border-sr-red/30 bg-sr-red/10 px-4 py-3 text-sm text-sr-red">
          <AlertTriangle size={15} /> {error}
        </div>
      )}
      {status === 'ready' && events.length === 0 && (
        <div className="rounded-lg border border-sr-border bg-sr-surface px-5 py-10 text-center text-sm text-sr-text-tertiary card-shadow">
          {summary || 'No timeline events found.'}
        </div>
      )}

      {status === 'ready' && events.length > 0 && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-1">
              {severities.map((s) => (
                <button
                  key={s}
                  onClick={() => setSevFilter(s)}
                  className={`rounded px-2.5 py-1 text-[11px] font-medium capitalize transition-colors ${
                    sevFilter === s ? 'bg-sr-accent/15 text-sr-accent' : 'text-sr-text-tertiary hover:text-sr-text-secondary'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <span className="font-mono text-[11px] text-sr-text-tertiary">{filtered.length} events</span>
          </div>

          <div className="relative pl-2">
            {filtered.map((ev, i) => {
              const c = sevHex(normSeverity(ev.severity))
              return (
                <div key={i} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span className="mt-1.5 h-3 w-3 rounded-full border-2" style={{ borderColor: c, background: '#050505', boxShadow: `0 0 10px ${c}55` }} />
                    {i < filtered.length - 1 && <span className="w-px flex-1 bg-sr-border" />}
                  </div>
                  <div className="mb-4 flex-1 rounded-lg border border-l-[3px] border-sr-border bg-sr-surface p-4 card-shadow" style={{ borderLeftColor: c }}>
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <Clock size={11} className="text-sr-text-tertiary" />
                      <span className="font-mono text-[11px] text-sr-text-tertiary">{ev.timestamp}</span>
                      {ev.mitre_technique && (
                        <span className="font-mono text-[10px] text-sr-accent">{ev.mitre_technique}</span>
                      )}
                      <span className="ml-auto text-[10px] font-semibold uppercase" style={{ color: c }}>{String(ev.severity || '').toLowerCase()}</span>
                    </div>
                    <h4 className="text-sm font-semibold text-sr-text">{ev.event_type}</h4>
                    <p className="mt-1 text-[12px] leading-relaxed text-sr-text-secondary">{ev.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
