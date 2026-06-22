import { useCallback, useEffect, useRef, useState } from 'react'
import { Activity, AlertTriangle, Wifi, WifiOff, Database, Fingerprint, Loader2, Check, RefreshCw } from 'lucide-react'
import { fetchAlerts, ackAlert, fetchStats } from '@/lib/api'
import type { AlertRow } from '@/lib/backend'
import { normSeverity, sevHex } from '@/lib/format'

const POLL_MS = 10000

export default function LiveMonitoring() {
  const [alerts, setAlerts] = useState<AlertRow[]>([])
  const [readouts, setReadouts] = useState<Record<string, number>>({})
  const [state, setState] = useState<'connecting' | 'live' | 'offline'>('connecting')
  // Real poll-cycle telemetry (no fabricated metrics):
  const [nowMs, setNowMs] = useState(() => Date.now())   // 1s ticker → drives the countdown/ago display
  const [lastPollAt, setLastPollAt] = useState<number | null>(null)   // anchors "next refresh in Ns"
  const [lastSuccessAt, setLastSuccessAt] = useState<number | null>(null) // anchors "updated Ns ago"
  const [flashIds, setFlashIds] = useState<Set<number>>(new Set())    // genuinely-new alert_ids to highlight
  // Client-side filters over already-polled alerts — no extra requests, and the
  // D1 poll/countdown/flash/connection logic above is untouched.
  const [sevFilter, setSevFilter] = useState<string>('ALL')
  const [ackFilter, setAckFilter] = useState<'ALL' | 'UNACKED' | 'ACKED'>('ALL')
  const cursorRef = useRef(0)
  const firstLoadRef = useRef(true)
  const flashTimer = useRef<number | null>(null)

  const poll = useCallback(() => {
    setLastPollAt(Date.now())
    fetchAlerts(cursorRef.current, 50).then(
      (data) => {
        const fresh = data.alerts || []
        if (fresh.length) {
          setAlerts((prev) => [...fresh, ...prev].slice(0, 100))
          if (data.cursor) cursorRef.current = data.cursor
          // Highlight only alerts that are genuinely new this cycle — never on the
          // first load (cursor 0 returns everything), and existing rows never re-flash
          // because the cursor only returns alert_id > cursor.
          if (!firstLoadRef.current) {
            const ids = new Set(fresh.map((a) => a.alert_id))
            setFlashIds(ids)
            if (flashTimer.current) clearTimeout(flashTimer.current)
            flashTimer.current = window.setTimeout(() => setFlashIds(new Set()), 2500)
          }
        }
        firstLoadRef.current = false
        setState('live')
        setLastSuccessAt(Date.now())
      },
      () => setState('offline'), // failed poll → degraded; recovery flips back to 'live'
    )
  }, [])

  useEffect(() => {
    fetchStats().then((s) => setReadouts(s.readouts || {}), () => {})
    poll()
    const pollId = setInterval(() => { if (!document.hidden) poll() }, POLL_MS)
    const tickId = setInterval(() => setNowMs(Date.now()), 1000) // re-render once a second
    return () => {
      clearInterval(pollId)
      clearInterval(tickId)
      if (flashTimer.current) clearTimeout(flashTimer.current)
    }
  }, [poll])

  const ack = (id: number) => {
    setAlerts((prev) => prev.map((a) => (a.alert_id === id ? { ...a, acknowledged: true } : a)))
    ackAlert(id).catch(() =>
      setAlerts((prev) => prev.map((a) => (a.alert_id === id ? { ...a, acknowledged: false } : a))),
    )
  }

  const unacked = alerts.filter((a) => !a.acknowledged).length
  // Severity levels actually present in the polled data — no dead filter buttons.
  const severities = Array.from(new Set(alerts.map((a) => String(a.severity || '').toUpperCase()).filter(Boolean)))
    .sort((a, b) => (a === 'CRITICAL' ? -1 : b === 'CRITICAL' ? 1 : a.localeCompare(b)))
  const visibleAlerts = alerts.filter((a) => {
    const matchSev = sevFilter === 'ALL' || String(a.severity || '').toUpperCase() === sevFilter
    const matchAck = ackFilter === 'ALL' || (ackFilter === 'ACKED' ? a.acknowledged : !a.acknowledged)
    return matchSev && matchAck
  })
  const filtersActive = sevFilter !== 'ALL' || ackFilter !== 'ALL'
  const agoSec = lastSuccessAt != null ? Math.max(0, Math.floor((nowMs - lastSuccessAt) / 1000)) : null
  const nextInSec = lastPollAt != null ? Math.max(0, Math.ceil((lastPollAt + POLL_MS - nowMs) / 1000)) : null

  const conn = state === 'live'
    ? { Icon: Wifi, color: '#22C55E', label: 'Connected' }
    : state === 'offline'
      ? { Icon: WifiOff, color: '#EF4444', label: 'Connection lost — retrying' }
      : { Icon: Loader2, color: '#8A8A8A', label: 'Connecting…' }

  const metrics = [
    { icon: AlertTriangle, color: '#EF4444', label: 'Unacked Alerts', value: unacked },
    { icon: Activity, color: '#FF7A00', label: 'Alerts (session)', value: alerts.length },
    { icon: Database, color: '#14B8A6', label: 'Docs Indexed', value: readouts.docs_indexed ?? 0 },
    { icon: Fingerprint, color: '#3B82F6', label: 'IOCs Extracted', value: readouts.iocs_extracted ?? 0 },
  ]

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <conn.Icon size={16} style={{ color: conn.color }} className={state === 'connecting' ? 'animate-spin' : state === 'live' ? 'animate-pulse-dot' : ''} />
          <h2 className="font-display text-xl font-bold text-sr-text">Live Monitoring</h2>
          <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: conn.color }}>{conn.label}</span>
        </div>
        <div className="flex items-center gap-3 font-mono text-[11px] text-sr-text-tertiary">
          {agoSec != null && (
            <span>updated {agoSec === 0 ? 'just now' : `${agoSec}s ago`}</span>
          )}
          {state !== 'offline' && nextInSec != null && (
            <span className="flex items-center gap-1"><RefreshCw size={11} /> next refresh in {nextInSec}s</span>
          )}
          <span className="text-sr-text-tertiary/70">· polling every {POLL_MS / 1000}s</span>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-lg border border-sr-border bg-sr-surface p-5 card-shadow">
            <div className="mb-2 flex items-center gap-2">
              <m.icon size={14} style={{ color: m.color }} />
              <span className="text-[11px] uppercase tracking-wider text-sr-text-secondary">{m.label}</span>
            </div>
            <div className="font-mono text-2xl font-semibold text-sr-text">{m.value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* Live alert stream */}
      <div className="overflow-hidden rounded-lg border border-sr-border bg-sr-surface card-shadow">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sr-border p-5">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-sr-text">Live Alert Stream</h2>
            <span className="font-mono text-[11px] text-sr-text-tertiary">
              {filtersActive ? `${visibleAlerts.length} of ${alerts.length} · ` : ''}{unacked} unacked
            </span>
          </div>
          {/* Filters over already-polled data (no extra requests) */}
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterBtn active={sevFilter === 'ALL'} onClick={() => setSevFilter('ALL')}>All</FilterBtn>
            {severities.map((s) => (
              <FilterBtn key={s} active={sevFilter === s} onClick={() => setSevFilter(s)} color={sevHex(normSeverity(s))}>
                {s}
              </FilterBtn>
            ))}
            <span className="mx-1 h-4 w-px bg-sr-border" />
            <FilterBtn active={ackFilter === 'ALL'} onClick={() => setAckFilter('ALL')}>Any</FilterBtn>
            <FilterBtn active={ackFilter === 'UNACKED'} onClick={() => setAckFilter('UNACKED')}>Unacked</FilterBtn>
            <FilterBtn active={ackFilter === 'ACKED'} onClick={() => setAckFilter('ACKED')}>Ack'd</FilterBtn>
          </div>
        </div>
        <div className="max-h-[460px] overflow-y-auto">
          {state === 'connecting' && alerts.length === 0 && (
            <div className="flex items-center gap-2 px-5 py-8 text-sm text-sr-text-secondary">
              <Loader2 size={15} className="animate-spin" /> Connecting to alert feed…
            </div>
          )}
          {state !== 'connecting' && alerts.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-sr-text-tertiary">No alerts in the feed.</p>
          )}
          {alerts.length > 0 && visibleAlerts.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-sr-text-tertiary">No alerts match the current filter.</p>
          )}
          <table className="w-full">
            <tbody className="divide-y divide-sr-border">
              {visibleAlerts.map((a) => {
                const c = sevHex(normSeverity(a.severity))
                const isNew = flashIds.has(a.alert_id)
                return (
                  <tr
                    key={a.alert_id}
                    className={`transition-colors duration-1000 ${isNew ? 'bg-sr-accent/15' : ''} ${a.acknowledged ? 'opacity-50' : ''}`}
                  >
                    <td className="px-5 py-3"><span className="h-2 w-2 rounded-full" style={{ background: c, display: 'inline-block' }} /></td>
                    <td className="px-2 py-3"><span className="font-mono text-[11px] uppercase" style={{ color: c }}>{String(a.severity || '').toLowerCase()}</span></td>
                    <td className="px-2 py-3 font-mono text-[11px] text-sr-text-secondary">{a.alert_type}</td>
                    <td className="px-2 py-3 text-sm text-sr-text">{a.title}</td>
                    <td className="px-2 py-3 font-mono text-[11px] text-sr-text-tertiary">{a.created_at}</td>
                    <td className="px-5 py-3 text-right">
                      {a.acknowledged ? (
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] text-sr-green"><Check size={11} /> ACK'D</span>
                      ) : (
                        <button onClick={() => ack(a.alert_id)} className="rounded border border-sr-border px-2 py-0.5 font-mono text-[10px] text-sr-text-secondary hover:border-sr-accent hover:text-sr-accent">
                          ACK
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function FilterBtn({
  active, onClick, color, children,
}: {
  active: boolean
  onClick: () => void
  color?: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide transition-colors ${
        active
          ? 'border-sr-accent bg-sr-accent/10 text-sr-accent'
          : 'border-sr-border text-sr-text-secondary hover:border-sr-border-focus hover:text-sr-text'
      }`}
    >
      {color && <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: color }} />}
      {children}
    </button>
  )
}
