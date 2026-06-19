import { useEffect, useState } from 'react'
import { Share2, Loader2, AlertTriangle, FileText, Fingerprint, Crosshair, ArrowRight } from 'lucide-react'
import { fetchStats, fetchAttackGraph, ApiError } from '@/lib/api'
import type { EvidenceRow } from '@/lib/backend'
import { riskHex } from '@/lib/format'

interface GraphNode {
  id: string
  type: string
  label: string
  role?: string
  risk_level?: string
  tactic?: string
  confidence?: string
}
interface GraphEdge {
  source: string
  target: string
  type: string
}
interface Graph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export default function AttackGraph() {
  const [uploads, setUploads] = useState<EvidenceRow[]>([])
  const [uploadId, setUploadId] = useState<string>('')
  const [graph, setGraph] = useState<Graph | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    fetchStats().then(
      (s) => {
        setUploads(s.evidence || [])
        if (s.evidence?.[0]) setUploadId(s.evidence[0].upload_id)
      },
      () => setError('Could not load uploads'),
    )
  }, [])

  useEffect(() => {
    if (!uploadId) return
    setStatus('loading')
    setError('')
    fetchAttackGraph(uploadId).then(
      (g) => {
        setGraph(g as Graph)
        setStatus('ready')
      },
      (e) => {
        setStatus('error')
        setError(e instanceof ApiError ? e.message : 'Could not build attack graph')
      },
    )
  }, [uploadId])

  const nodes = graph?.nodes ?? []
  const edges = graph?.edges ?? []
  const uploadNodes = nodes.filter((n) => n.type === 'upload')
  const techNodes = nodes.filter((n) => n.type === 'technique')
  const iocNodes = nodes.filter((n) => n.type !== 'upload' && n.type !== 'technique')
  const edgeCounts = edges.reduce<Record<string, number>>((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1
    return acc
  }, {})

  return (
    <div className="mx-auto max-w-[1400px] p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Share2 size={18} className="text-sr-accent" />
            <h2 className="font-display text-xl font-bold text-sr-text">Attack Graph</h2>
          </div>
          <p className="mt-1 text-sm text-sr-text-secondary">Indicators and ATT&CK techniques linked for one ingested upload.</p>
        </div>
        <select
          value={uploadId}
          onChange={(e) => setUploadId(e.target.value)}
          className="cursor-pointer rounded-md border border-sr-border bg-sr-surface px-3 py-2 text-sm text-sr-text focus:border-sr-accent focus:outline-none"
        >
          {uploads.length === 0 && <option value="">No uploads</option>}
          {uploads.map((u) => (
            <option key={u.upload_id} value={u.upload_id}>{u.filename} ({u.upload_id.slice(0, 8)})</option>
          ))}
        </select>
      </div>

      {status === 'loading' && (
        <div className="flex items-center gap-2 text-sm text-sr-text-secondary">
          <Loader2 size={15} className="animate-spin" /> Building attack graph…
        </div>
      )}
      {status === 'error' && (
        <div className="flex items-center gap-2 rounded-lg border border-sr-red/30 bg-sr-red/10 px-4 py-3 text-sm text-sr-red">
          <AlertTriangle size={15} /> {error}
        </div>
      )}
      {status === 'ready' && nodes.length === 0 && (
        <div className="rounded-lg border border-sr-border bg-sr-surface px-5 py-10 text-center text-sm text-sr-text-tertiary card-shadow">
          No graph data for this upload.
        </div>
      )}

      {status === 'ready' && nodes.length > 0 && (
        <>
          <div className="mb-5 flex flex-wrap gap-2 text-[11px] text-sr-text-secondary">
            <span className="rounded border border-sr-border bg-sr-surface px-2.5 py-1 font-mono">{nodes.length} nodes</span>
            <span className="rounded border border-sr-border bg-sr-surface px-2.5 py-1 font-mono">{edges.length} edges</span>
            {Object.entries(edgeCounts).map(([t, n]) => (
              <span key={t} className="rounded border border-sr-border bg-sr-surface px-2.5 py-1 font-mono">{n} {t}</span>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {/* Upload */}
            <Column icon={<FileText size={14} className="text-sr-green" />} title="Source" count={uploadNodes.length}>
              {uploadNodes.map((n) => (
                <div key={n.id} className="rounded border border-sr-green/30 bg-sr-green/5 px-3 py-2.5">
                  <div className="font-mono text-sm text-sr-text">{n.label}</div>
                  <div className="text-[10px] uppercase text-sr-text-tertiary">upload</div>
                </div>
              ))}
            </Column>

            {/* IOCs */}
            <Column icon={<Fingerprint size={14} className="text-sr-accent" />} title="Indicators" count={iocNodes.length}>
              {iocNodes.length === 0 && <Empty />}
              {iocNodes.map((n) => {
                const c = n.risk_level ? riskHex(n.risk_level) : '#2A2A2A'
                return (
                  <div key={n.id} className="rounded border bg-sr-elevated px-3 py-2" style={{ borderColor: `${c}66` }}>
                    <div className="truncate font-mono text-xs text-sr-text">{n.label}</div>
                    <div className="flex items-center gap-2 text-[10px] text-sr-text-tertiary">
                      <span className="uppercase">{n.type}</span>
                      {n.role && <span>· {n.role}</span>}
                      {n.risk_level && <span className="font-semibold" style={{ color: c }}>· {n.risk_level}</span>}
                    </div>
                  </div>
                )
              })}
            </Column>

            {/* Techniques (kill-chain order) */}
            <Column icon={<Crosshair size={14} className="text-sr-red" />} title="Techniques" count={techNodes.length}>
              {techNodes.length === 0 && <Empty />}
              {techNodes.map((n, i) => (
                <div key={n.id} className="relative rounded border border-sr-border bg-sr-elevated px-3 py-2">
                  {i > 0 && (
                    <ArrowRight size={11} className="absolute -top-[9px] left-1/2 -translate-x-1/2 rotate-90 text-sr-text-tertiary" />
                  )}
                  <div className="font-mono text-xs text-sr-accent">{n.label}</div>
                  <div className="flex items-center gap-2 text-[10px] text-sr-text-tertiary">
                    {n.tactic && <span>{n.tactic}</span>}
                    {n.confidence && <span className="uppercase">· {n.confidence}</span>}
                  </div>
                </div>
              ))}
            </Column>
          </div>
        </>
      )}
    </div>
  )
}

function Column({ icon, title, count, children }: { icon: React.ReactNode; title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-sr-border bg-sr-surface card-shadow">
      <div className="flex items-center gap-2 border-b border-sr-border px-4 py-3">
        {icon}
        <span className="text-sm font-semibold text-sr-text">{title}</span>
        <span className="ml-auto rounded-full bg-sr-elevated px-1.5 py-0.5 font-mono text-[11px] text-sr-text-secondary">{count}</span>
      </div>
      <div className="space-y-2 p-3">{children}</div>
    </div>
  )
}

function Empty() {
  return <p className="px-1 py-4 text-center text-xs text-sr-text-tertiary">None</p>
}
