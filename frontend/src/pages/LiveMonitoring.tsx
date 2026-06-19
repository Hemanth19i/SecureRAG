import { useCallback, useEffect, useRef, useState } from 'react'
import { Activity, AlertTriangle, Wifi, Database, Fingerprint, Loader2, Check } from 'lucide-react'
import { fetchAlerts, ackAlert, fetchStats } from '@/lib/api'
import type { AlertRow } from '@/lib/backend'
import { normSeverity, sevHex } from '@/lib/format'

const POLL_MS = 10000

export default function LiveMonitoring() {
  const [alerts, setAlerts] = useState<AlertRow[]>([])
  const [readouts, setReadouts] = useState<Record<string, number>>({})
  const [state, setState] = useState<'connecting' | 'live' | 'offline'>('connecting')
  const [lastRefresh, setLastRefresh] = useState<string>('')
  const cursorRef = useRef(0)

  const poll = useCallback(() => {
    fetchAlerts(cursorRef.current, 50).then(
      (data) => {
        const fresh = data.alerts || []
        if (fresh.length) {
          setAlerts((prev) => [...fresh, ...prev].slice(0, 100))
          if (data.cursor) cursorRef.current = data.cursor
        }
        setState('live')
        setLastRefresh(new Date().toLocaleTimeString())
      },
      () => setState('offline'),
    )
  }, [])

  useEffect(() => {
    fetchStats().then((s) => setReadouts(s.readouts || {}), () => {})
    poll()
    const id = setInterval(() => {
      if (!document.hidden) poll()
    }, POLL_MS)
    return () => clearInterval(id)
  }, [poll])

  const ack = (id: number) => {
    setAlerts((prev) => prev.map((a) => (a.alert_id === id ? { ...a, acknowledged: true } : a)))
    ackAlert(id).catch(() =>
      setAlerts((prev) => prev.map((a) => (a.alert_id === id ? { ...a, acknowledged: false } : a))),
    )
  }

  const unacked = alerts.filter((a) => !a.acknowledged).length

  const metrics = [
    { icon: AlertTriangle, color: '#EF4444', label: 'Unacked Alerts', value: unacked },
    { icon: Activity, color: '#FF7A00', label: 'Alerts (session)', value: alerts.length },
    { icon: Database, color: '#14B8A6', label: 'Docs Indexed', value: readouts.docs_indexed ?? 0 },
    { icon: Fingerprint, color: '#3B82F6', label: 'IOCs Extracted', value: readouts.iocs_extracted ?? 0 },
  ]

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wifi size={16} className={state === 'live' ? 'text-sr-green animate-pulse-dot' : 'text-sr-text-tertiary'} />
          <h2 className="font-display text-xl font-bold text-sr-text">Live Monitoring</h2>
          <span className={`text-[11px] font-mono uppercase ${state === 'live' ? 'text-sr-green' : state === 'offline' ? 'text-sr-red' : 'text-sr-text-tertiary'}`}>
            {state}
          </span>
        </div>
        <span className="font-mono text-[11px] text-sr-text-tertiary">
          {lastRefresh ? `last refresh ${lastRefresh}` : '…'} · polling {POLL_MS / 1000}s
        </span>
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
        <div className="flex items-center justify-between border-b border-sr-border p-5">
          <h2 className="text-sm font-semibold text-sr-text">Live Alert Stream</h2>
          <span className="font-mono text-[11px] text-sr-text-tertiary">{unacked} unacked</span>
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
          <table className="w-full">
            <tbody className="divide-y divide-sr-border">
              {alerts.map((a) => {
                const c = sevHex(normSeverity(a.severity))
                return (
                  <tr key={a.alert_id} className={a.acknowledged ? 'opacity-50' : ''}>
                    <td className="px-5 py-3">
                      <span className="h-2 w-2 rounded-full" style={{ background: c, display: 'inline-block' }} />
                    </td>
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
