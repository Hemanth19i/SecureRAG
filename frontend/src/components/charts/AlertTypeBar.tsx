import { useNavigate } from 'react-router'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList, ResponsiveContainer } from 'recharts'
import { Activity, ArrowRight } from 'lucide-react'
import type { AlertRow } from '@/lib/backend'

interface Props {
  alerts: AlertRow[]
}

interface TipPayload {
  active?: boolean
  payload?: Array<{ value: number; payload: { type: string } }>
}

const AXIS_TICK = { fontSize: 11, fontFamily: 'JetBrains Mono, monospace', fill: '#8A8A8A' }

function BarTip({ active, payload }: TipPayload) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div className="rounded border border-sr-border bg-sr-surface px-2.5 py-1.5 font-mono text-[11px] card-shadow">
      <span className="text-sr-text">{p.payload.type}</span>{' '}
      <span className="text-sr-accent">{p.value}</span>
    </div>
  )
}

export default function AlertTypeBar({ alerts }: Props) {
  const navigate = useNavigate()

  // Real counts straight from /alerts — group by alert_type (categorical, not
  // severity → single accent bars, no severity palette).
  const counts: Record<string, number> = {}
  for (const a of alerts || []) {
    const t = a.alert_type || 'UNKNOWN'
    counts[t] = (counts[t] || 0) + 1
  }
  const data = Object.entries(counts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
  const total = data.reduce((s, d) => s + d.count, 0)

  return (
    <div className="flex flex-col rounded-lg border border-sr-border bg-sr-surface card-shadow">
      <div className="flex items-center gap-2 border-b border-sr-border px-5 py-3">
        <Activity size={15} className="text-sr-accent" />
        <h2 className="text-sm font-semibold text-sr-text">Alert Type Distribution</h2>
        <span className="ml-auto font-mono text-[11px] text-sr-text-tertiary">{total} alerts</span>
      </div>

      {total === 0 ? (
        <div className="flex flex-1 items-center justify-center px-5 py-10">
          <p className="text-center text-xs text-sr-text-tertiary">No alerts yet — ingest logs to generate detections.</p>
        </div>
      ) : (
        <div className="flex-1 p-5 pl-2">
          <ResponsiveContainer width="100%" height={Math.max(140, data.length * 56)}>
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 36, left: 8, bottom: 0 }}>
              <CartesianGrid horizontal={false} stroke="#1A1A1A" />
              <XAxis type="number" allowDecimals={false} stroke="#2A2A2A" tick={AXIS_TICK} />
              <YAxis
                type="category"
                dataKey="type"
                width={148}
                stroke="#2A2A2A"
                tick={AXIS_TICK}
                tickLine={false}
              />
              <Tooltip cursor={{ fill: '#11111188' }} content={<BarTip />} />
              <Bar dataKey="count" fill="#FF7A00" radius={[0, 3, 3, 0]} barSize={20}>
                <LabelList
                  dataKey="count"
                  position="right"
                  style={{ fill: '#F5F5F5', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <button
        onClick={() => navigate('/monitoring')}
        className="flex items-center gap-1 border-t border-sr-border px-5 py-2.5 text-left text-xs text-sr-accent transition-colors hover:bg-sr-elevated hover:text-sr-accent-hover"
      >
        View Live Monitoring <ArrowRight size={12} />
      </button>
    </div>
  )
}
