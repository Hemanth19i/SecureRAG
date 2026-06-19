import { useState } from 'react'
import { Search, Loader2, AlertTriangle, ShieldAlert, Globe } from 'lucide-react'
import { fetchEnrichment, fetchCorrelation, ApiError } from '@/lib/api'
import type { Enrichment, Correlation } from '@/lib/backend'
import { useApiData } from '@/lib/useApi'
import { sevHex, isPublicIp } from '@/lib/format'

export default function ThreatIntelligence() {
  const [value, setValue] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [result, setResult] = useState<Enrichment | null>(null)
  const [error, setError] = useState('')

  // Real quick-picks: high-risk IOCs from the correlation engine.
  const { data: corr } = useApiData<Correlation & { high_risk_iocs: string[] }>(() => fetchCorrelation())
  const quickPicks = (corr?.high_risk_iocs ?? []).filter(isPublicIp).slice(0, 8)

  const lookup = async (v?: string) => {
    const q = (v ?? value).trim()
    if (!q) return
    setValue(q)
    setStatus('loading')
    setError('')
    try {
      setResult(await fetchEnrichment(q))
      setStatus('ready')
    } catch (e) {
      setStatus('error')
      setError(e instanceof ApiError ? e.message : 'Request failed — is the backend running?')
    }
  }

  const verdict = result?.verdict
  const verdictColor = verdict ? sevHex(String(verdict)) : '#8A8A8A'
  // Raw fields beyond the headline ones.
  const extra = result
    ? Object.entries(result).filter(([k]) => !['status', 'verdict', 'abuse_confidence'].includes(k))
    : []

  return (
    <div className="mx-auto max-w-[900px] p-8">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <ShieldAlert size={18} className="text-sr-accent" />
          <h2 className="font-display text-xl font-bold text-sr-text">Threat Intelligence</h2>
        </div>
        <p className="mt-1 text-sm text-sr-text-secondary">
          Look up an indicator's reputation via the threat-intel provider (public IPs supported).
        </p>
      </div>

      <div className="mb-6 flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-sr-text-tertiary" />
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && lookup()}
            placeholder="Enter an IP address…"
            className="w-full rounded-md border border-sr-border bg-sr-surface py-2.5 pl-9 pr-4 font-mono text-sm text-sr-text placeholder:text-sr-text-tertiary focus:border-sr-accent focus:outline-none"
          />
        </div>
        <button
          onClick={() => lookup()}
          disabled={status === 'loading' || !value.trim()}
          className="flex items-center gap-2 rounded-md bg-sr-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sr-accent-hover disabled:opacity-50"
        >
          {status === 'loading' ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} Enrich
        </button>
      </div>

      {quickPicks.length > 0 && (
        <div className="mb-6">
          <div className="mb-2 text-[11px] uppercase tracking-wider text-sr-text-tertiary">High-risk indicators (from correlation)</div>
          <div className="flex flex-wrap gap-2">
            {quickPicks.map((ip) => (
              <button
                key={ip}
                onClick={() => lookup(ip)}
                className="flex items-center gap-1.5 rounded border border-sr-border bg-sr-surface px-2.5 py-1 font-mono text-xs text-sr-accent transition-colors hover:border-sr-accent"
              >
                <Globe size={11} /> {ip}
              </button>
            ))}
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center gap-2 rounded-lg border border-sr-red/30 bg-sr-red/10 px-4 py-3 text-sm text-sr-red">
          <AlertTriangle size={15} /> {error}
        </div>
      )}

      {status === 'ready' && result && (
        <div className="rounded-lg border border-sr-border bg-sr-surface card-shadow animate-fade-in">
          <div className="flex items-center justify-between border-b border-sr-border px-5 py-4">
            <div className="flex items-center gap-3">
              <Globe size={16} className="text-sr-accent" />
              <span className="font-mono text-sm text-sr-text">{value}</span>
            </div>
            {verdict ? (
              <span className="rounded-full border px-3 py-0.5 text-xs font-semibold uppercase" style={{ color: verdictColor, backgroundColor: `${verdictColor}1f`, borderColor: `${verdictColor}40` }}>
                {String(verdict)}
              </span>
            ) : (
              <span className="rounded-full border border-sr-border px-3 py-0.5 text-xs uppercase text-sr-text-tertiary">{String(result.status)}</span>
            )}
          </div>
          <div className="space-y-5 p-5">
            {typeof result.abuse_confidence === 'number' && (
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="uppercase tracking-wider text-sr-text-secondary">Abuse confidence</span>
                  <span className="font-mono text-sr-text">{result.abuse_confidence}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-sr-elevated">
                  <div className="h-full rounded-full" style={{ width: `${result.abuse_confidence}%`, background: verdictColor }} />
                </div>
              </div>
            )}
            {extra.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {extra.map(([k, v]) => (
                  <div key={k} className="rounded border border-sr-border bg-sr-elevated px-3 py-2">
                    <div className="text-[10px] uppercase text-sr-text-tertiary">{k.replace(/_/g, ' ')}</div>
                    <div className="truncate font-mono text-xs text-sr-text">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-sr-text-tertiary">No additional fields returned (status: {String(result.status)}).</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
