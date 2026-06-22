import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ReactFlow, Background, Controls, Panel, Handle, Position, MarkerType,
  useNodesState, useEdgesState,
  type Node as RFNode, type Edge as RFEdge, type ReactFlowInstance, type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  Share2, Loader2, AlertTriangle, FileText, Crosshair, Globe, Hash,
  ShieldAlert, Link as LinkIcon, AtSign, Fingerprint,
} from 'lucide-react'
import { fetchStats, fetchAttackGraph, ApiError } from '@/lib/api'
import type { EvidenceRow } from '@/lib/backend'
import { riskHex } from '@/lib/format'

/* ---------------------------------------------- backend graph shape (real data) */
interface GNode {
  id: string
  type: string // upload | ip | ipv6 | domain | url | hash | cve | email | technique
  label: string
  role?: string
  risk_level?: string
  tactic?: string
  confidence?: string
  [key: string]: unknown // React Flow node data must be a string-keyed record
}
interface GEdge {
  source: string
  target: string
  type: string // observed_in | maps_to | triggers | correlates_with
}
interface Graph {
  nodes: GNode[]
  edges: GEdge[]
}

type SRNode = RFNode<GNode>

/* ----------------------------------------------------------- edge visual language */
const EDGE_STYLE: Record<string, { color: string; width: number; dash?: string; animated: boolean; label: string }> = {
  observed_in: { color: '#3B82F6', width: 1.5, animated: false, label: 'observed in' },
  maps_to: { color: '#FF7A00', width: 2, animated: true, label: 'maps to' },
  triggers: { color: '#EF4444', width: 2, dash: '6 4', animated: true, label: 'triggers' },
  correlates_with: { color: '#8A8A8A', width: 1.25, dash: '2 4', animated: false, label: 'correlates with' },
}
const edgeStyleOf = (t: string) => EDGE_STYLE[t] ?? { color: '#5A5A5A', width: 1, animated: false, label: t }

const IOC_ICON: Record<string, typeof Globe> = {
  ip: Globe, ipv6: Globe, domain: LinkIcon, url: LinkIcon, hash: Hash, cve: ShieldAlert, email: AtSign,
}

// Friendly labels for the backend's correlation roles/categories, so a node
// reads as "Attacker" / "C2 Server" rather than the raw ATTACKER_IP token.
const ROLE_LABEL: Record<string, string> = {
  ATTACKER_IP: 'Attacker',
  C2_IP: 'C2 Server',
  INTERNAL_HOST: 'Internal Host',
  TARGET_HOST: 'Target Host',
  VICTIM: 'Victim',
  OBSERVED: 'Observed',
  VULNERABILITY: 'Vulnerability',
  MALWARE: 'Malware',
  DOMAIN: 'Domain',
  URL: 'URL',
}
const roleLabel = (r?: string) =>
  !r ? '' : ROLE_LABEL[r] ?? r.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())

/* ---------------------------------------------------- custom nodes (themed, mono) */
const HSTYLE: React.CSSProperties = { opacity: 0, width: 1, height: 1, minWidth: 1, minHeight: 1, border: 0, background: 'transparent' }
function NodeHandles() {
  return (
    <>
      <Handle id="tgt-top" type="target" position={Position.Top} style={HSTYLE} isConnectable={false} />
      <Handle id="src-top" type="source" position={Position.Top} style={HSTYLE} isConnectable={false} />
      <Handle id="tgt-bottom" type="target" position={Position.Bottom} style={HSTYLE} isConnectable={false} />
      <Handle id="src-bottom" type="source" position={Position.Bottom} style={HSTYLE} isConnectable={false} />
      <Handle id="tgt-left" type="target" position={Position.Left} style={HSTYLE} isConnectable={false} />
      <Handle id="src-left" type="source" position={Position.Left} style={HSTYLE} isConnectable={false} />
      <Handle id="tgt-right" type="target" position={Position.Right} style={HSTYLE} isConnectable={false} />
      <Handle id="src-right" type="source" position={Position.Right} style={HSTYLE} isConnectable={false} />
    </>
  )
}

function UploadNode({ data }: NodeProps<SRNode>) {
  return (
    <div className="rounded-md border-2 px-3 py-2 font-mono card-shadow" style={{ borderColor: '#22C55E', background: '#0B0B0B', width: 168 }} title={`Ingested log — ${data.label}`}>
      <NodeHandles />
      <div className="flex items-center gap-1.5">
        <FileText size={12} style={{ color: '#22C55E' }} />
        <span className="text-[9px] uppercase tracking-wider" style={{ color: '#22C55E' }}>upload</span>
      </div>
      <div className="mt-0.5 truncate text-[11px] text-sr-text" title={data.label}>{data.label}</div>
    </div>
  )
}

function IocNode({ data }: NodeProps<SRNode>) {
  const c = data.risk_level ? riskHex(data.risk_level) : '#5A5A5A'
  const Icon = IOC_ICON[data.type] ?? Fingerprint
  const role = roleLabel(data.role)
  // Rich hover tooltip: classification · type · risk · value.
  const tip = [role, (data.type || '').toUpperCase(), data.risk_level ? `${data.risk_level} risk` : '', data.label]
    .filter(Boolean).join(' · ')
  return (
    <div className="rounded-md border px-3 py-2 font-mono card-shadow" style={{ borderColor: `${c}aa`, background: '#0B0B0B', width: 176 }} title={tip}>
      <NodeHandles />
      <div className="flex items-center gap-1.5">
        <Icon size={12} style={{ color: c }} />
        <span className="text-[9px] uppercase tracking-wider text-sr-text-tertiary">{data.type}</span>
        {data.risk_level && <span className="ml-auto text-[9px] font-semibold uppercase" style={{ color: c }}>{data.risk_level}</span>}
      </div>
      <div className="mt-1 truncate text-[11px] text-sr-text" title={data.label}>{data.label}</div>
      {role && (
        <div
          className="mt-1.5 inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
          style={{ color: c, background: `${c}1f`, border: `1px solid ${c}55` }}
        >
          {role}
        </div>
      )}
    </div>
  )
}

function TechniqueNode({ data }: NodeProps<SRNode>) {
  const tip = [`MITRE ${data.label}`, data.tactic, data.confidence ? `${data.confidence} confidence` : '']
    .filter(Boolean).join(' · ')
  return (
    <div className="rounded-md border px-3 py-2 font-mono card-shadow" style={{ borderColor: '#FF7A00aa', background: '#0B0B0B', width: 150 }} title={tip}>
      <NodeHandles />
      <div className="flex items-center gap-1.5">
        <Crosshair size={12} style={{ color: '#FF7A00' }} />
        <span className="text-[9px] uppercase tracking-wider text-sr-text-tertiary">technique</span>
      </div>
      <div className="mt-0.5 text-[11px] font-semibold" style={{ color: '#FF7A00' }}>{data.label}</div>
      <div className="truncate text-[9px] text-sr-text-tertiary">{data.tactic}{data.confidence ? ` · ${data.confidence}` : ''}</div>
    </div>
  )
}

const nodeTypes = { upload: UploadNode, ioc: IocNode, technique: TechniqueNode }

/* ----------------------------------------------------------- layered layout build */
const layerOf = (t: string) => (t === 'upload' ? 0 : t === 'technique' ? 2 : 1)
const rfTypeOf = (t: string) => (t === 'upload' ? 'upload' : t === 'technique' ? 'technique' : 'ioc')

function build(graph: Graph): { nodes: SRNode[]; edges: RFEdge[] } {
  const byLayer: Record<number, GNode[]> = { 0: [], 1: [], 2: [] }
  graph.nodes.forEach((n) => byLayer[layerOf(n.type)].push(n))

  const COL = 230
  const ROW = 200
  const pos: Record<string, { x: number; y: number; layer: number }> = {}
  ;[0, 1, 2].forEach((layer) => {
    const arr = byLayer[layer]
    arr.forEach((n, i) => {
      const x = (i - (arr.length - 1) / 2) * COL
      pos[n.id] = { x, y: layer * ROW, layer }
    })
  })

  const nodes: SRNode[] = graph.nodes.map((n) => ({
    id: n.id,
    type: rfTypeOf(n.type),
    position: { x: pos[n.id].x, y: pos[n.id].y },
    data: n,
  }))

  const edges: RFEdge[] = graph.edges
    .filter((e) => pos[e.source] && pos[e.target])
    .map((e, i) => {
      const s = pos[e.source]
      const t = pos[e.target]
      let sourceHandle: string, targetHandle: string
      if (s.layer < t.layer) { sourceHandle = 'src-bottom'; targetHandle = 'tgt-top' }
      else if (s.layer > t.layer) { sourceHandle = 'src-top'; targetHandle = 'tgt-bottom' }
      else if (s.x <= t.x) { sourceHandle = 'src-right'; targetHandle = 'tgt-left' }
      else { sourceHandle = 'src-left'; targetHandle = 'tgt-right' }
      const st = edgeStyleOf(e.type)
      return {
        id: `e${i}`,
        source: e.source,
        target: e.target,
        sourceHandle,
        targetHandle,
        type: 'smoothstep',
        animated: st.animated,
        style: { stroke: st.color, strokeWidth: st.width, strokeDasharray: st.dash },
        markerEnd: { type: MarkerType.ArrowClosed, color: st.color, width: 14, height: 14 },
        data: { kind: e.type },
      }
    })

  return { nodes, edges }
}

/* ------------------------------------------------------------------------ page */
export default function AttackGraph() {
  const [uploads, setUploads] = useState<EvidenceRow[]>([])
  const [uploadId, setUploadId] = useState('')
  const [graph, setGraph] = useState<Graph | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [error, setError] = useState('')

  const [nodes, setNodes, onNodesChange] = useNodesState<SRNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<RFEdge>([])
  const rf = useRef<ReactFlowInstance<SRNode, RFEdge> | null>(null)

  useEffect(() => {
    fetchStats().then(
      (s) => {
        setUploads(s.evidence || [])
        if (s.evidence?.[0]) setUploadId(s.evidence[0].upload_id)
      },
      () => setError('Could not load uploads'),
    )
  }, [])

  const loadGraph = useCallback((id: string) => {
    setStatus('loading'); setError('')
    fetchAttackGraph(id).then(
      (g) => { setGraph(g as Graph); setStatus('ready') },
      (e) => { setStatus('error'); setError(e instanceof ApiError ? e.message : 'Could not build attack graph') },
    )
  }, [])

  useEffect(() => {
    if (uploadId) loadGraph(uploadId)
  }, [uploadId, loadGraph])

  // Rebuild the flow when the graph changes, then auto-fit the complete graph.
  useEffect(() => {
    if (!graph) return
    const built = build(graph)
    setNodes(built.nodes)
    setEdges(built.edges)
    const id = requestAnimationFrame(() => rf.current?.fitView({ padding: 0.2, duration: 300 }))
    return () => cancelAnimationFrame(id)
  }, [graph, setNodes, setEdges])

  const gNodes = graph?.nodes ?? []
  const gEdges = graph?.edges ?? []
  const nodeTypeCounts = gNodes.reduce<Record<string, number>>((a, n) => { a[n.type] = (a[n.type] || 0) + 1; return a }, {})
  const edgeTypeCounts = gEdges.reduce<Record<string, number>>((a, e) => { a[e.type] = (a[e.type] || 0) + 1; return a }, {})
  const presentEdgeTypes = Object.keys(edgeTypeCounts)

  return (
    <div className="mx-auto flex h-full max-w-[1500px] flex-col p-8">
      {/* Header + upload picker */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
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

      {/* States */}
      {uploads.length === 0 && status !== 'loading' && (
        <EmptyState>No uploads yet — ingest a log on the Ingest page to build an attack graph.</EmptyState>
      )}
      {status === 'loading' && (
        <div className="flex items-center gap-2 text-sm text-sr-text-secondary"><Loader2 size={15} className="animate-spin" /> Building attack graph…</div>
      )}
      {status === 'error' && (
        <div className="flex items-center gap-2 rounded-lg border border-sr-red/30 bg-sr-red/10 px-4 py-3 text-sm text-sr-red"><AlertTriangle size={15} /> {error}</div>
      )}
      {status === 'ready' && gNodes.length === 0 && (
        <EmptyState>This upload produced no graph nodes (no IOCs or techniques were extracted).</EmptyState>
      )}

      {/* Graph */}
      {status === 'ready' && gNodes.length > 0 && (
        <div className="relative flex-1 overflow-hidden rounded-lg border border-sr-border bg-sr-bg card-shadow" style={{ minHeight: 460 }}>
          <ReactFlow
            colorMode="dark"
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onInit={(inst) => { rf.current = inst }}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.2}
            maxZoom={2}
            nodesConnectable={false}
            elementsSelectable
            proOptions={{ hideAttribution: true }}
            style={{ background: '#050505' }}
          >
            <Background color="#1A1A1A" gap={22} size={1} />
            <Controls showInteractive={false} className="!border-sr-border" />

            {/* Summary panel */}
            <Panel position="top-left" className="!m-3">
              <div className="rounded-lg border border-sr-border bg-sr-surface/95 p-3 text-xs backdrop-blur card-shadow">
                <div className="mb-2 flex items-center gap-4 font-mono">
                  <span className="text-sr-text"><span className="text-sr-accent">{gNodes.length}</span> nodes</span>
                  <span className="text-sr-text"><span className="text-sr-accent">{gEdges.length}</span> edges</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                  <div>
                    <div className="mb-0.5 text-[9px] uppercase tracking-wider text-sr-text-tertiary">by node type</div>
                    {Object.entries(nodeTypeCounts).map(([t, n]) => (
                      <div key={t} className="flex justify-between gap-3 font-mono text-[10px] text-sr-text-secondary"><span>{t}</span><span>{n}</span></div>
                    ))}
                  </div>
                  <div>
                    <div className="mb-0.5 text-[9px] uppercase tracking-wider text-sr-text-tertiary">by edge type</div>
                    {Object.entries(edgeTypeCounts).map(([t, n]) => (
                      <div key={t} className="flex justify-between gap-3 font-mono text-[10px] text-sr-text-secondary"><span>{edgeStyleOf(t).label}</span><span>{n}</span></div>
                    ))}
                  </div>
                </div>
              </div>
            </Panel>

            {/* Legend — derived from edge types actually present */}
            {presentEdgeTypes.length > 0 && (
              <Panel position="bottom-right" className="!m-3">
                <div className="rounded-lg border border-sr-border bg-sr-surface/95 p-3 backdrop-blur card-shadow">
                  <div className="mb-1.5 text-[9px] uppercase tracking-wider text-sr-text-tertiary">edges</div>
                  <div className="space-y-1">
                    {presentEdgeTypes.map((t) => {
                      const st = edgeStyleOf(t)
                      return (
                        <div key={t} className="flex items-center gap-2">
                          <svg width="26" height="6" className="shrink-0">
                            <line x1="0" y1="3" x2="26" y2="3" stroke={st.color} strokeWidth={st.width} strokeDasharray={st.dash} />
                          </svg>
                          <span className="font-mono text-[10px] text-sr-text-secondary">{st.label}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </Panel>
            )}

            {/* Nodes-but-no-edges notice */}
            {gEdges.length === 0 && (
              <Panel position="top-right" className="!m-3">
                <div className="rounded border border-sr-yellow/30 bg-sr-yellow/10 px-3 py-1.5 text-[11px] text-sr-yellow">
                  No relationships for this upload — showing nodes only.
                </div>
              </Panel>
            )}
          </ReactFlow>
        </div>
      )}
    </div>
  )
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center rounded-lg border border-sr-border bg-sr-surface card-shadow" style={{ minHeight: 360 }}>
      <p className="max-w-md px-6 text-center text-sm text-sr-text-tertiary">{children}</p>
    </div>
  )
}
