import { useCallback, useEffect, useState } from 'react'
import {
  X, Loader2, AlertTriangle, FileText, ShieldCheck, UserCog,
  StickyNote, Link2, Plus, History, CheckCircle2, ArrowRight, FlagTriangleRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import {
  fetchCase, updateCase, addCaseNote, linkCaseEvidence, ApiError,
} from '@/lib/api'
import type { CaseDetail, CaseAuditEntry } from '@/lib/backend'
import { useAuth } from '@/lib/auth'
import { normSeverity, sevHex } from '@/lib/format'

const STATUSES = ['OPEN', 'IN_PROGRESS', 'CONTAINED', 'CLOSED'] as const
const STATUS_COLOR: Record<string, string> = {
  OPEN: '#3B82F6', IN_PROGRESS: '#EAB308', CONTAINED: '#FF7A00', CLOSED: '#22C55E',
}
const statusLabel = (s: string) => (s || '').replace('_', ' ')

function StatusPill({ status }: { status: string }) {
  const c = STATUS_COLOR[String(status || '').toUpperCase()] || '#8A8A8A'
  return (
    <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      style={{ color: c, backgroundColor: `${c}1f`, border: `1px solid ${c}40` }}>
      {statusLabel(String(status || '').toUpperCase()) || 'UNKNOWN'}
    </span>
  )
}

// --- audit entry presentation -------------------------------------------------
function parseContent(content: string | null): unknown {
  if (!content) return null
  const t = content.trim()
  if (t.startsWith('{') || t.startsWith('[')) {
    try { return JSON.parse(t) } catch { return content }
  }
  return content
}

function auditMeta(entry: CaseAuditEntry): { icon: React.ReactNode; text: string; color: string } {
  const d = parseContent(entry.content) as Record<string, unknown> | string | null
  const get = (k: string) => (d && typeof d === 'object' ? (d as Record<string, unknown>)[k] : undefined)
  switch (entry.entry_type) {
    case 'created':
      return { icon: <FlagTriangleRight size={13} />, color: '#3B82F6',
        text: `Case created${get('severity') ? ` · ${get('severity')}` : ''}` }
    case 'status_change': {
      const field = String(get('field') || 'status')
      return { icon: <ArrowRight size={13} />, color: '#FF7A00',
        text: `${field === 'severity' ? 'Severity' : 'Status'} ${statusLabel(String(get('from') ?? '—'))} → ${statusLabel(String(get('to') ?? '—'))}` }
    }
    case 'assignment':
      return { icon: <UserCog size={13} />, color: '#A855F7',
        text: `Assigned ${get('from') ? `${get('from')} → ` : 'to '}${get('to') || '—'}` }
    case 'note':
      return { icon: <StickyNote size={13} />, color: '#8A8A8A',
        text: typeof d === 'string' ? d : String(entry.content || '') }
    case 'evidence_linked':
      return { icon: <Link2 size={13} />, color: '#22C55E',
        text: `Linked evidence (${get('evidence_type') || 'snapshot'})` }
    default:
      return { icon: <History size={13} />, color: '#8A8A8A', text: String(entry.content || entry.entry_type) }
  }
}

interface Props {
  caseId: string | null
  onClose: () => void
  onChanged?: () => void // notify parent list to refresh (status/severity may have changed)
}

export default function CaseDetailDrawer({ caseId, onClose, onChanged }: Props) {
  const { role } = useAuth()
  const isAdmin = role === 'ADMIN'
  const [data, setData] = useState<CaseDetail | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const [note, setNote] = useState('')
  const [assignee, setAssignee] = useState('')
  const [evType, setEvType] = useState('ioc')
  const [evValue, setEvValue] = useState('')

  const load = useCallback(async (id: string) => {
    setStatus('loading'); setError('')
    try {
      setData(await fetchCase(id))
      setStatus('ready')
    } catch (e) {
      setStatus('error')
      setError(e instanceof ApiError ? e.message : 'Failed to load case')
    }
  }, [])

  useEffect(() => {
    if (caseId) load(caseId)
    else { setData(null); setStatus('idle') }
  }, [caseId, load])

  // Run a mutation, then re-fetch the case so the audit trail / fields refresh.
  const act = async (label: string, fn: () => Promise<unknown>, ok: string) => {
    if (!caseId) return
    setBusy(label)
    try {
      await fn()
      await load(caseId)
      onChanged?.()
      toast.success(ok)
    } catch (e) {
      const msg = e instanceof ApiError
        ? (e.status === 403 ? `Not permitted for role ${role || 'unknown'}` : e.message)
        : 'Action failed'
      toast.error(msg)
    } finally {
      setBusy(null)
    }
  }

  const changeStatus = (s: string) =>
    act(`status:${s}`, () => updateCase(caseId!, { status: s }), `Status → ${statusLabel(s)}`)
  const reassign = () => {
    if (!assignee.trim()) return
    act('assign', () => updateCase(caseId!, { assigned_to: assignee.trim() }), 'Case reassigned')
      .then(() => setAssignee(''))
  }
  const submitNote = () => {
    if (!note.trim()) return
    act('note', () => addCaseNote(caseId!, note.trim()), 'Note added').then(() => setNote(''))
  }
  const linkEvidence = () => {
    if (!evValue.trim()) return
    act('evidence', () => linkCaseEvidence(caseId!, { evidence_type: evType, payload: { value: evValue.trim() } }), 'Evidence linked')
      .then(() => setEvValue(''))
  }
  const linkSnapshot = () =>
    act('snapshot', () => linkCaseEvidence(caseId!, { snapshot: data!.snapshot }), 'Snapshot linked as evidence')

  if (!caseId) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 flex h-full w-[480px] flex-col border-l border-sr-border bg-sr-surface animate-slide-in-right">
        {status === 'loading' || !data ? (
          <div className="flex h-full items-center justify-center text-sr-text-secondary">
            {status === 'error'
              ? <span className="flex items-center gap-2 text-sm text-sr-red"><AlertTriangle size={15} /> {error}</span>
              : <Loader2 size={18} className="animate-spin" />}
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-sr-border p-5">
              <div className="min-w-0">
                <span className="font-mono text-xs text-sr-accent">{data.case_id.slice(0, 8)}</span>
                <h2 className="mt-0.5 truncate text-base font-semibold text-sr-text">{data.title}</h2>
                <div className="mt-1.5 flex items-center gap-2">
                  <StatusPill status={data.status} />
                  <span className="flex items-center gap-1.5 text-xs capitalize text-sr-text-secondary">
                    <span className="h-2 w-2 rounded-full" style={{ background: sevHex(normSeverity(data.severity)) }} />
                    {String(data.severity || '').toLowerCase()}
                  </span>
                  <span className="text-[11px] text-sr-text-tertiary">· {data.assigned_to || data.created_by}</span>
                </div>
              </div>
              <button onClick={onClose} className="rounded p-1.5 text-sr-text-tertiary hover:bg-sr-elevated hover:text-sr-text">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto p-5">
              {/* Status actions */}
              <div>
                <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-sr-text-secondary">Status</h3>
                <div className="flex flex-wrap gap-1.5">
                  {STATUSES.map((s) => {
                    const current = String(data.status || '').toUpperCase() === s
                    const closeBlocked = s === 'CLOSED' && !isAdmin
                    const c = STATUS_COLOR[s]
                    return (
                      <button
                        key={s}
                        disabled={current || closeBlocked || busy !== null}
                        onClick={() => changeStatus(s)}
                        title={closeBlocked ? 'Only ADMIN can close a case' : undefined}
                        className="rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-40"
                        style={current
                          ? { color: c, backgroundColor: `${c}1f`, borderColor: `${c}66` }
                          : { color: '#8A8A8A', borderColor: '#1A1A1A' }}
                      >
                        {busy === `status:${s}` ? <Loader2 size={12} className="animate-spin" /> : statusLabel(s)}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Assign (ADMIN only) */}
              {isAdmin && (
                <div>
                  <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-sr-text-secondary">
                    <UserCog size={12} /> Assign
                  </h3>
                  <div className="flex gap-2">
                    <Input
                      value={assignee}
                      onChange={(e) => setAssignee(e.target.value)}
                      placeholder={data.assigned_to || 'username'}
                      className="h-8 border-sr-border bg-sr-elevated text-sm"
                    />
                    <Button size="sm" variant="outline" disabled={!assignee.trim() || busy !== null}
                      onClick={reassign} className="border-sr-border">
                      {busy === 'assign' ? <Loader2 size={13} className="animate-spin" /> : 'Assign'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Add note */}
              <div>
                <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-sr-text-secondary">
                  <StickyNote size={12} /> Add note
                </h3>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Investigation note…"
                  className="w-full resize-none rounded-md border border-sr-border bg-sr-elevated p-2.5 text-sm text-sr-text placeholder:text-sr-text-tertiary focus:border-sr-accent focus:outline-none"
                />
                <div className="mt-2 flex justify-end">
                  <Button size="sm" disabled={!note.trim() || busy !== null} onClick={submitNote}
                    className="bg-sr-accent text-white hover:bg-sr-accent-hover">
                    {busy === 'note' ? <Loader2 size={13} className="animate-spin" /> : <><Plus size={13} /> Add note</>}
                  </Button>
                </div>
              </div>

              {/* Link evidence */}
              <div>
                <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-sr-text-secondary">
                  <Link2 size={12} /> Link evidence
                </h3>
                <div className="flex gap-2">
                  <select value={evType} onChange={(e) => setEvType(e.target.value)}
                    className="h-8 rounded-md border border-sr-border bg-sr-elevated px-2 text-xs text-sr-text focus:border-sr-accent focus:outline-none">
                    <option value="ioc">IOC</option>
                    <option value="technique">Technique</option>
                    <option value="reference">Reference</option>
                  </select>
                  <Input value={evValue} onChange={(e) => setEvValue(e.target.value)}
                    placeholder="value (e.g. 1.2.3.4 / T1110)"
                    className="h-8 border-sr-border bg-sr-elevated text-sm" />
                  <Button size="sm" variant="outline" disabled={!evValue.trim() || busy !== null}
                    onClick={linkEvidence} className="border-sr-border">
                    {busy === 'evidence' ? <Loader2 size={13} className="animate-spin" /> : 'Link'}
                  </Button>
                </div>
                {data.snapshot != null && (
                  <button onClick={linkSnapshot} disabled={busy !== null}
                    className="mt-2 text-[11px] text-sr-accent hover:text-sr-accent-hover disabled:opacity-50">
                    {busy === 'snapshot' ? 'Linking…' : '+ Link this case’s query snapshot as evidence'}
                  </button>
                )}
              </div>

              {/* Audit trail — centerpiece */}
              <div className="rounded-lg border border-sr-accent/30 bg-sr-accent/5">
                <div className="flex items-center gap-2 border-b border-sr-border px-4 py-2.5">
                  <History size={14} className="text-sr-accent" />
                  <span className="text-sm font-semibold text-sr-text">Audit Trail</span>
                  <span className="text-[11px] text-sr-text-tertiary">{data.audit?.length ?? 0} entries · append-only</span>
                </div>
                <div className="p-4">
                  {(data.audit?.length ?? 0) === 0 ? (
                    <p className="text-xs text-sr-text-tertiary">No audit entries yet.</p>
                  ) : (
                    <ol className="space-y-0">
                      {data.audit.map((entry, i) => {
                        const m = auditMeta(entry)
                        const last = i === data.audit.length - 1
                        return (
                          <li key={entry.audit_id ?? i} className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border"
                                style={{ borderColor: `${m.color}66`, color: m.color, background: `${m.color}10` }}>
                                {m.icon}
                              </span>
                              {!last && <span className="w-px flex-1 bg-sr-border" />}
                            </div>
                            <div className="pb-4 min-w-0">
                              <div className="text-sm text-sr-text">{m.text}</div>
                              <div className="mt-0.5 flex items-center gap-2 text-[10px] text-sr-text-tertiary">
                                <span className="text-sr-accent">{entry.author}</span>
                                <span className="font-mono">{entry.created_at}</span>
                              </div>
                            </div>
                          </li>
                        )
                      })}
                    </ol>
                  )}
                </div>
              </div>

              {/* Linked evidence */}
              <div>
                <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-sr-text-secondary">
                  <ShieldCheck size={12} /> Linked Evidence ({data.evidence?.length ?? 0})
                </h3>
                {(data.evidence?.length ?? 0) === 0 ? (
                  <p className="text-xs text-sr-text-tertiary">No evidence linked.</p>
                ) : (
                  <div className="space-y-1.5">
                    {data.evidence.map((ev) => (
                      <div key={ev.evidence_id} className="flex items-center gap-2 rounded border border-sr-border bg-sr-elevated px-3 py-2">
                        <FileText size={12} className="shrink-0 text-sr-accent" />
                        <span className="text-xs text-sr-text">{ev.evidence_type}</span>
                        <span className="truncate font-mono text-[10px] text-sr-text-tertiary">
                          {typeof ev.payload === 'object' ? JSON.stringify(ev.payload) : String(ev.payload)}
                        </span>
                        <span className="ml-auto shrink-0 font-mono text-[10px] text-sr-text-tertiary">{ev.created_at}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Context */}
              {(data.query || data.summary) && (
                <div className="rounded-lg border border-sr-border bg-sr-elevated p-3">
                  {data.query && <p className="text-xs text-sr-text"><span className="text-sr-text-tertiary">Query: </span>{data.query}</p>}
                  {data.summary && <p className="mt-1 text-xs text-sr-text-secondary">{data.summary}</p>}
                </div>
              )}

              <div className="flex items-center gap-1.5 pb-2 text-[10px] text-sr-text-tertiary">
                <CheckCircle2 size={11} className="text-sr-green" /> Every action above writes an immutable audit entry.
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
