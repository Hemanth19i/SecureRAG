import { useNavigate } from 'react-router'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { Fingerprint, ArrowRight } from 'lucide-react'
import type { Correlation } from '@/lib/backend'

// IOC types are categories, NOT severities — use a brand/monochrome ramp
// (accent + teal + greys), never the severity palette. Ordered by descending
// slice size so the dominant type gets the accent.
const SLICE_COLORS = ['#FF7A00', '#14B8A6', '#9A9A9A', '#6A6A6A', '#454545', '#FF9940']

interface Props {
  details: Correlation['details']
}

interface TipPayload {
  active?: boolean
  payload?: Array<{ value: number; payload: { type: string; pct: number } }>
}

function DonutTip({ active, payload }: TipPayload) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div className="rounded border border-sr-border bg-sr-surface px-2.5 py-1.5 font-mono text-[11px] card-shadow">
      <span className="uppercase text-sr-text">{p.payload.type}</span>{' '}
      <span className="text-sr-accent">{p.value}</span>
      <span className="text-sr-text-tertiary"> · {p.payload.pct}%</span>
    </div>
  )
}

export default function IocTypeDonut({ details }: Props) {
  const navigate = useNavigate()

  // Real counts straight from /correlate — group correlated indicators by type.
  const counts: Record<string, number> = {}
  for (const d of Object.values(details || {})) {
    const t = (d.type || 'unknown').toLowerCase()
    counts[t] = (counts[t] || 0) + 1
  }
  const totalRaw = Object.values(counts).reduce((s, n) => s + n, 0)
  const data = Object.entries(counts)
    .map(([type, count]) => ({ type, count, pct: totalRaw ? Math.round((count / totalRaw) * 100) : 0 }))
    .sort((a, b) => b.count - a.count)
  const total = data.reduce((s, d) => s + d.count, 0)

  return (
    <div className="flex flex-col rounded-lg border border-sr-border bg-sr-surface card-shadow">
      <div className="flex items-center gap-2 border-b border-sr-border px-5 py-3">
        <Fingerprint size={15} className="text-sr-accent" />
        <h2 className="text-sm font-semibold text-sr-text">IOC Type Distribution</h2>
        <span className="ml-auto font-mono text-[11px] text-sr-text-tertiary">{total} indicators</span>
      </div>

      {total === 0 ? (
        <div className="flex flex-1 items-center justify-center px-5 py-10">
          <p className="text-center text-xs text-sr-text-tertiary">No correlated indicators yet — ingest logs to populate the correlation engine.</p>
        </div>
      ) : (
        <div className="flex flex-1 items-center gap-4 p-5">
          {/* Donut */}
          <div className="relative h-[170px] w-[170px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="count"
                  nameKey="type"
                  innerRadius={52}
                  outerRadius={80}
                  paddingAngle={2}
                  stroke="#0B0B0B"
                  strokeWidth={2}
                  startAngle={90}
                  endAngle={-270}
                >
                  {data.map((d, i) => (
                    <Cell key={d.type} fill={SLICE_COLORS[i % SLICE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<DonutTip />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center total */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-2xl font-semibold text-sr-text">{total}</span>
              <span className="text-[9px] uppercase tracking-wider text-sr-text-tertiary">IOCs</span>
            </div>
          </div>

          {/* Legend with real per-type counts */}
          <ul className="flex-1 space-y-1.5">
            {data.map((d, i) => (
              <li key={d.type} className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: SLICE_COLORS[i % SLICE_COLORS.length] }} />
                <span className="font-mono uppercase text-sr-text-secondary">{d.type}</span>
                <span className="ml-auto font-mono font-semibold text-sr-text">{d.count}</span>
                <span className="w-9 text-right font-mono text-[10px] text-sr-text-tertiary">
                  {d.pct}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={() => navigate('/ioc-explorer')}
        className="flex items-center gap-1 border-t border-sr-border px-5 py-2.5 text-left text-xs text-sr-accent transition-colors hover:bg-sr-elevated hover:text-sr-accent-hover"
      >
        View IOC Explorer <ArrowRight size={12} />
      </button>
    </div>
  )
}
