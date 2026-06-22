import {
  ShieldAlert, FileText, Fingerprint, Network, Clock, ListChecks,
  AlertTriangle, StickyNote, Quote,
} from 'lucide-react'
import type { Analysis, Iocs, Mitre, Timeline, Correlation, CaseDetail } from '@/lib/backend'
import { normSeverity, sevHex, flattenIocs } from '@/lib/format'

// The case snapshot mirrors the POST /query response shape.
export interface ReportSnapshot {
  analysis?: Analysis
  iocs?: Iocs
  mitre?: Mitre
  timeline?: Timeline
  correlation?: Correlation
  query?: string
}

interface Props {
  detail: CaseDetail
  narrative?: string // backend POST /report text (Executive Summary body)
  generatedAt: string
}

function Section({
  icon: Icon, title, count, children,
}: {
  icon: typeof FileText
  title: string
  count?: number | string
  children: React.ReactNode
}) {
  return (
    <section className="ir-section">
      <div className="mb-3 flex items-center gap-2 border-b border-sr-border pb-2">
        <Icon size={15} className="text-sr-accent" />
        <h3 className="text-sm font-semibold uppercase tracking-wide text-sr-text">{title}</h3>
        {count != null && <span className="ml-auto font-mono text-[11px] text-sr-text-tertiary">{count}</span>}
      </div>
      {children}
    </section>
  )
}

function MetaItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-sr-text-tertiary">{label}</div>
      <div className="mt-0.5 text-sm text-sr-text">{value || '—'}</div>
    </div>
  )
}

export default function IncidentReport({ detail, narrative, generatedAt }: Props) {
  const snap = (detail.snapshot as ReportSnapshot | undefined) || {}
  const analysis = snap.analysis
  const iocs = flattenIocs(snap.iocs)
  const techniques = snap.mitre?.techniques ?? []
  const events = snap.timeline?.events ?? []
  const recommendations = analysis?.recommendations ?? []
  const threats = analysis?.threats ?? []
  const notes = (detail.audit ?? []).filter((a) => a.entry_type === 'note' && a.content)

  const sev = normSeverity(analysis?.severity || detail.severity)
  const c = sevHex(sev)

  const iocsByType = iocs.reduce<Record<string, string[]>>((m, io) => {
    (m[io.type] ??= []).push(io.value)
    return m
  }, {})

  // Prefer the clean analysis prose; the backend /report text (a flat dump that
  // duplicates the structured sections below) is only a fallback when it's absent.
  const execBody = analysis?.answer?.trim() || narrative?.trim() || 'No analysis narrative is available for this case.'

  return (
    <div id="incident-report" className="space-y-6 bg-sr-surface p-6 text-sr-text">
      {/* Masthead */}
      <header className="flex items-start justify-between gap-4 border-b border-sr-border pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md border border-sr-accent/40">
            <ShieldAlert size={18} className="text-sr-accent" />
          </div>
          <div>
            <div className="font-display text-lg font-bold leading-tight text-sr-text">SecureRAG</div>
            <div className="text-[11px] uppercase tracking-widest text-sr-text-secondary">Incident Report</div>
          </div>
        </div>
        <div className="text-right text-[11px] text-sr-text-tertiary">
          <div>Case <span className="font-mono text-sr-text-secondary">{detail.case_id.slice(0, 8)}</span></div>
          <div className="mt-0.5">Generated {generatedAt}</div>
        </div>
      </header>

      {/* Severity banner */}
      <div
        className="rounded-lg border border-l-4 px-5 py-4"
        style={{ borderColor: `${c}55`, borderLeftColor: c, background: `${c}14` }}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: c }}>
              {sev} severity incident
            </div>
            <h1 className="mt-1 truncate font-display text-xl font-bold text-sr-text" title={detail.title}>
              {detail.title}
            </h1>
          </div>
          <span
            className="shrink-0 rounded-full border px-3 py-1 text-sm font-bold uppercase"
            style={{ color: c, borderColor: `${c}66`, background: `${c}1f` }}
          >
            {sev}
          </span>
        </div>
      </div>

      {/* Incident metadata */}
      <Section icon={FileText} title="Incident Metadata">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-lg border border-sr-border bg-sr-elevated p-4 sm:grid-cols-3">
          <MetaItem label="Case ID" value={<span className="font-mono text-xs">{detail.case_id}</span>} />
          <MetaItem label="Status" value={String(detail.status || '').replace('_', ' ')} />
          <MetaItem label="Severity" value={<span style={{ color: c }} className="font-semibold">{sev.toUpperCase()}</span>} />
          <MetaItem label="Owner" value={detail.assigned_to || detail.created_by} />
          <MetaItem label="Opened" value={<span className="font-mono text-xs">{detail.created_at}</span>} />
          <MetaItem label="Last updated" value={<span className="font-mono text-xs">{detail.updated_at || detail.created_at}</span>} />
        </div>
        {detail.query && (
          <div className="mt-3 rounded-lg border border-sr-border bg-sr-elevated p-3">
            <div className="text-[10px] uppercase tracking-wider text-sr-text-tertiary">Originating query</div>
            <div className="mt-1 text-sm text-sr-text-secondary">{detail.query}</div>
          </div>
        )}
      </Section>

      {/* Executive summary */}
      <Section icon={Quote} title="Executive Summary">
        {analysis?.summary && (
          <p className="mb-3 border-l-2 pl-3 text-sm text-sr-text-secondary" style={{ borderColor: `${c}66` }}>
            {analysis.summary}
          </p>
        )}
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-sr-text">{execBody}</p>
      </Section>

      {/* Key threats */}
      {threats.length > 0 && (
        <Section icon={AlertTriangle} title="Key Threats" count={threats.length}>
          <ul className="space-y-2">
            {threats.map((t, i) => (
              <li key={i} className="flex gap-2 text-sm text-sr-text-secondary">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sr-red" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* IOCs */}
      <Section icon={Fingerprint} title="Indicators of Compromise" count={iocs.length}>
        {iocs.length === 0 ? (
          <p className="text-sm text-sr-text-tertiary">No indicators of compromise were extracted for this investigation.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-sr-border">
            <table className="w-full">
              <thead>
                <tr className="bg-sr-elevated text-[10px] uppercase tracking-wider text-sr-text-secondary">
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-left">Indicators</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sr-border">
                {Object.entries(iocsByType).map(([type, values]) => (
                  <tr key={type} className="align-top">
                    <td className="px-4 py-2.5">
                      <span className="rounded bg-sr-elevated px-2 py-0.5 text-[10px] uppercase text-sr-accent">{type}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        {values.map((v) => (
                          <span key={v} className="rounded border border-sr-border px-2 py-0.5 font-mono text-xs text-sr-text">{v}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* MITRE ATT&CK */}
      <Section icon={Network} title="MITRE ATT&CK" count={techniques.length}>
        {techniques.length === 0 ? (
          <p className="text-sm text-sr-text-tertiary">No ATT&CK techniques were mapped for this investigation.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-sr-border">
            <table className="w-full">
              <thead>
                <tr className="bg-sr-elevated text-[10px] uppercase tracking-wider text-sr-text-secondary">
                  <th className="px-4 py-2 text-left">Technique</th>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-left">Tactic</th>
                  <th className="px-4 py-2 text-left">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sr-border">
                {techniques.map((t, i) => (
                  <tr key={`${t.technique}-${i}`}>
                    <td className="px-4 py-2.5 font-mono text-xs text-sr-accent">{t.technique}</td>
                    <td className="px-4 py-2.5 text-sm text-sr-text">{t.name}</td>
                    <td className="px-4 py-2.5 text-xs text-sr-text-secondary">{t.tactic}</td>
                    <td className="px-4 py-2.5 text-[11px] uppercase text-sr-text-tertiary">{t.confidence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Timeline */}
      <Section icon={Clock} title="Attack Timeline" count={events.length}>
        {events.length === 0 ? (
          <p className="text-sm text-sr-text-tertiary">{snap.timeline?.summary || 'No timeline events were reconstructed.'}</p>
        ) : (
          <div className="space-y-3">
            {events.map((ev, i) => {
              const ec = sevHex(normSeverity(ev.severity))
              return (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: ec }} />
                    {i < events.length - 1 && <span className="w-px flex-1 bg-sr-border" />}
                  </div>
                  <div className="min-w-0 pb-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] text-sr-text-tertiary">{ev.timestamp}</span>
                      <span className="text-sm font-medium text-sr-text">{ev.event_type}</span>
                      {ev.mitre_technique && <span className="font-mono text-[10px] text-sr-accent">{ev.mitre_technique}</span>}
                    </div>
                    <p className="text-xs text-sr-text-secondary">{ev.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Section>

      {/* Recommendations */}
      <Section icon={ListChecks} title="Recommendations" count={recommendations.length || undefined}>
        {recommendations.length === 0 ? (
          <p className="text-sm text-sr-text-tertiary">No remediation recommendations were generated.</p>
        ) : (
          <ol className="space-y-2">
            {recommendations.map((r, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-sr-text">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sr-green/15 font-mono text-[11px] font-semibold text-sr-green">
                  {i + 1}
                </span>
                <span className="text-sr-text-secondary">{r}</span>
              </li>
            ))}
          </ol>
        )}
      </Section>

      {/* Analyst notes (from the case audit trail) */}
      {notes.length > 0 && (
        <Section icon={StickyNote} title="Analyst Notes" count={notes.length}>
          <ul className="space-y-2.5">
            {notes.map((n) => (
              <li key={n.audit_id} className="rounded-lg border border-sr-border bg-sr-elevated p-3">
                <p className="text-sm text-sr-text">{n.content}</p>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-sr-text-tertiary">
                  <span className="text-sr-accent">{n.author}</span>
                  <span className="font-mono">{n.created_at}</span>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Footer */}
      <footer className="border-t border-sr-border pt-3 text-center text-[10px] text-sr-text-tertiary">
        Generated by SecureRAG · {generatedAt} · Case {detail.case_id.slice(0, 8)} · Confidential — for authorized recipients only
      </footer>
    </div>
  )
}
