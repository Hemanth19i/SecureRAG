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
  const resStatus = String(result?.status ?? '')

  // The provider's real detail fields live nested under `enrichment_data`; surface
  // them as labeled rows (only the ones actually populated — no null dumps).
  const ed =
    result && typeof result.enrichment_data === 'object' && result.enrichment_data
      ? (result.enrichment_data as Record<string, unknown>)
      : {}
  const FIELD_LABELS: [string, string][] = [
    ['country_code', 'Country'],
    ['isp', 'ISP'],
    ['domain', 'Domain'],
    ['usage_type', 'Usage type'],
    ['total_reports', 'Total reports'],
    ['last_reported_at', 'Last reported'],
    ['is_tor', 'Tor exit node'],
  ]
  const dataFields = FIELD_LABELS
    .map(([k, label]) => [label, ed[k]] as const)
    .filter(([, v]) => v != null && v !== '')

  // Honest, context-specific explanations for non-OK backend states (never invent data).
  const STATUS_HELP: Record<string, { title: string; detail: string }> = {
    unavailable: {
      title: 'Enrichment provider not configured',
      detail: 'Set ABUSEIPDB_API_KEY in server/.env to enable IP reputation lookups, then retry.',
    },
    unsupported: {
      title: 'Indicator type not supported',
      detail: 'Reputation enrichment currently covers public IP addresses (IPv4/IPv6) only.',
    },
    error: {
      title: 'Provider lookup failed',
      detail: 'The threat-intel provider could not be reached. This is a transient issue — try again shortly.',
    },
  }
  const statusHelp = resStatus !== 'ok' ? STATUS_HELP[resStatus] : undefined

  return (
    <div className="mx-auto max-w-[900px] p-8">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <ShieldAlert size={18} className="text-sr-accent" />
          <h2 className="font-display text-xl font-bold text-sr-text">IOC Enrichment</h2>
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
            {/* Honest empty/degraded state — no fabricated data */}
            {statusHelp && (
              <div className="flex items-start gap-2 rounded-lg border border-sr-border bg-sr-elevated px-4 py-3">
                <ShieldAlert size={15} className="mt-0.5 shrink-0 text-sr-text-tertiary" />
                <div>
                  <div className="text-sm font-medium text-sr-text">{statusHelp.title}</div>
                  <div className="mt-0.5 text-xs text-sr-text-secondary">{statusHelp.detail}</div>
                </div>
              </div>
            )}

            {resStatus === 'ok' && typeof result.abuse_confidence === 'number' && (
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

            {dataFields.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {dataFields.map(([label, v]) => (
                  <div key={label} className="rounded border border-sr-border bg-sr-elevated px-3 py-2">
                    <div className="text-[10px] uppercase text-sr-text-tertiary">{label}</div>
                    <div className="truncate font-mono text-xs text-sr-text">
                      {typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {result.source != null && resStatus === 'ok' && (
              <p className="text-[11px] text-sr-text-tertiary">
                Source: <span className="font-mono text-sr-text-secondary">{String(result.source)}</span>
                {result.cached === true ? ' · cached' : ''}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
