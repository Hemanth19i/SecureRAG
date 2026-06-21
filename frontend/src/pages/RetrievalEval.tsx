import { useState } from 'react'
import {
  Gauge, Search, Loader2, AlertTriangle, Zap, Cpu, Database,
  FileText, FlaskConical, BookOpen, Info, Trophy,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { fetchRetrievalEval, ApiError } from '@/lib/api'
import type { RetrievalEvalResponse } from '@/lib/backend'

const SAMPLE = 'lateral movement and credential access on the domain controller'

/* ----------------------------------------------------------------- offline data */
// Recall@K / MRR are NOT produced by the live /retrieval/eval endpoint (its
// `recall_at_k` field is always null — the live store has no ground-truth
// labels). These are the REAL measured results of the offline harness
// `python eval/recall_eval.py`, transcribed verbatim from the benchmark table in
// README.md ("Results (corpus = 30, queries = 10)"). Source of truth: README.md
// — do NOT edit these numbers without updating that table. Nothing here is
// computed, estimated, or live.
const OFFLINE_BENCHMARK = {
  sourceFile: 'README.md',
  harness: 'eval/recall_eval.py',
  labeledSet: 'server/eval/eval_set.json',
  corpus: 30,
  queries: 10,
  reranker: 'cross-encoder/ms-marco-MiniLM-L-6-v2',
  configs: ['Semantic', 'Hybrid (BM25+RRF)', 'Hybrid + Rerank'] as const,
  rows: [
    { metric: 'Recall@1', values: [0.8, 0.8, 0.9], bestCol: 2 },
    { metric: 'Recall@3', values: [1.0, 1.0, 1.0], bestCol: -1 },
    { metric: 'Recall@5', values: [1.0, 1.0, 1.0], bestCol: -1 },
    { metric: 'MRR', values: [0.9, 0.9, 0.95], bestCol: 2 },
  ],
} as const

const METRIC_HELP: Record<string, string> = {
  'Recall@1': 'Share of queries whose relevant chunk was ranked #1. Higher is better.',
  'Recall@3': 'Share of queries whose relevant chunk appeared in the top 3. Higher is better.',
  'Recall@5': 'Share of queries whose relevant chunk appeared in the top 5. Higher is better.',
  MRR: 'Mean of 1/rank of the first relevant chunk (1.0 = always ranked #1). Higher is better.',
}

const TOP_K_OPTIONS = [3, 5, 10, 20]

/* ----------------------------------------------------------- latency card meta */
const LATENCY_META: { key: 'embed' | 'search' | 'total'; label: string; icon: typeof Cpu; blurb: string }[] = [
  { key: 'embed', label: 'Embed', icon: Cpu, blurb: 'Time to convert the query text into an embedding vector. Lower is better.' },
  { key: 'search', label: 'Vector search', icon: Database, blurb: 'Time for the vector store to find the nearest chunks. Lower is better.' },
  { key: 'total', label: 'Total', icon: Zap, blurb: 'End-to-end retrieval latency (embed + search). Lower is better.' },
]

export default function RetrievalEval() {
  const [query, setQuery] = useState('')
  const [topK, setTopK] = useState(5)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [data, setData] = useState<RetrievalEvalResponse | null>(null)
  const [error, setError] = useState('')

  const run = async (q?: string) => {
    const text = (q ?? query).trim()
    if (!text) return
    setQuery(text)
    setStatus('loading')
    setError('')
    try {
      const res = await fetchRetrievalEval(text, topK)
      setData(res)
      setStatus('ready')
    } catch (err) {
      setStatus('error')
      setError(err instanceof ApiError ? err.message : 'Request failed — is the backend running?')
    }
  }

  return (
    <div className="mx-auto max-w-[1100px] p-8 pb-16 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Gauge size={18} className="text-sr-accent" />
          <h1 className="font-display text-xl font-bold text-sr-text">RAG Evaluation</h1>
        </div>
        <p className="mt-1 text-sm text-sr-text-secondary">
          Instrumentation for the retrieval stack. Run a live query to measure embedding /
          search latency and inspect the ranked chunks, and review the offline retrieval-quality
          benchmark below.
        </p>
      </div>

      {/* Query input */}
      <div className="rounded-lg border border-sr-border bg-sr-surface p-4 card-shadow">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') run()
          }}
          rows={3}
          placeholder="e.g. failed SSH logins from an external IP…"
          className="w-full resize-none bg-transparent text-sm text-sr-text placeholder:text-sr-text-tertiary focus:outline-none"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => run(SAMPLE)}
            className="text-[11px] text-sr-text-tertiary hover:text-sr-accent transition-colors"
          >
            Try a sample query
          </button>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-[11px] text-sr-text-tertiary">
              top_k
              <select
                value={topK}
                onChange={(e) => setTopK(Number(e.target.value))}
                className="cursor-pointer rounded-md border border-sr-border bg-sr-surface px-2 py-1 text-xs text-sr-text focus:border-sr-accent focus:outline-none"
              >
                {TOP_K_OPTIONS.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </label>
            <span className="hidden sm:inline text-[10px] text-sr-text-tertiary font-mono">⌘/Ctrl + ↵</span>
            <Button
              onClick={() => run()}
              disabled={status === 'loading' || !query.trim()}
              className="bg-sr-accent text-white hover:bg-sr-accent-hover"
            >
              {status === 'loading' ? (
                <><Loader2 size={15} className="animate-spin" /> Running…</>
              ) : (
                <><Search size={15} /> Run evaluation</>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* ============================== LIVE SECTION ============================== */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sr-green opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-sr-green" />
          </span>
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-sr-text-secondary">
            Live retrieval metrics
          </h2>
          <Badge variant="outline" className="border-sr-green/40 text-[9px] uppercase tracking-wide text-sr-green">
            endpoint-backed · POST /retrieval/eval
          </Badge>
        </div>

        {status === 'error' && (
          <div className="flex items-center gap-2 rounded-lg border border-sr-red/30 bg-sr-red/10 px-4 py-3 text-sm text-sr-red">
            <AlertTriangle size={15} className="shrink-0" /> {error}
          </div>
        )}

        {status === 'loading' && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="h-24 rounded-lg border border-sr-border skeleton-shimmer" />
              <div className="h-24 rounded-lg border border-sr-border skeleton-shimmer" />
              <div className="h-24 rounded-lg border border-sr-border skeleton-shimmer" />
            </div>
            <div className="h-48 rounded-lg border border-sr-border skeleton-shimmer" />
          </div>
        )}

        {status === 'idle' && (
          <div className="rounded-lg border border-dashed border-sr-border bg-sr-surface px-5 py-8 text-center card-shadow">
            <Gauge size={22} className="mx-auto mb-2 text-sr-text-tertiary" />
            <p className="text-sm text-sr-text-tertiary">
              Run a query above to measure live retrieval latency and inspect the ranked chunks.
            </p>
          </div>
        )}

        {status === 'ready' && data && (
          <div className="space-y-6 animate-fade-in">
            {/* Latency cards */}
            <div className="grid gap-4 sm:grid-cols-3">
              {LATENCY_META.map(({ key, label, icon: Icon, blurb }) => (
                <div key={key} className="rounded-lg border border-sr-border bg-sr-surface p-4 card-shadow">
                  <div className="flex items-center gap-2">
                    <Icon size={14} className="text-sr-accent" />
                    <span className="text-xs font-medium text-sr-text">{label}</span>
                  </div>
                  <div className="mt-2 font-mono text-2xl font-bold text-sr-text">
                    {data.latency_ms[key].toFixed(2)}
                    <span className="ml-1 text-xs font-normal text-sr-text-tertiary">ms</span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-snug text-sr-text-tertiary">{blurb}</p>
                </div>
              ))}
            </div>

            {/* Ranked chunks */}
            <div className="rounded-lg border border-sr-border bg-sr-surface card-shadow overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 border-b border-sr-border bg-sr-elevated/50 px-5 py-3">
                <FileText size={15} className="text-sr-accent" />
                <span className="text-sm font-semibold text-sr-text">Ranked retrieved chunks</span>
                <span className="text-[11px] text-sr-text-tertiary">
                  {data.count} chunk{data.count === 1 ? '' : 's'} · top_k {data.top_k}
                </span>
              </div>

              {data.count === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-sr-text-tertiary">
                  No chunks retrieved — the live vector store is empty or nothing matched.
                  Ingest logs on the Ingest page, then run again.
                </p>
              ) : (
                <div className="divide-y divide-sr-border">
                  {data.results.map((r) => (
                    <div key={`${r.rank}-${r.chunk_id ?? 'na'}`} className="px-5 py-4">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sr-accent/15 font-mono text-xs font-bold text-sr-accent">
                            {r.rank}
                          </span>
                          <FileText size={13} className="shrink-0 text-sr-text-tertiary" />
                          <span className="truncate text-xs font-medium text-sr-text">
                            {r.source_file || 'unknown source'}
                          </span>
                          {r.chunk_id && (
                            <span className="truncate font-mono text-[10px] text-sr-text-tertiary" title={r.chunk_id}>
                              {r.chunk_id}
                            </span>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          {typeof r.similarity === 'number' && (
                            <div className="flex items-center gap-2" title="similarity = 1 / (1 + L2 distance)">
                              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-sr-elevated">
                                <div className="h-full rounded-full bg-sr-accent" style={{ width: `${Math.round(r.similarity * 100)}%` }} />
                              </div>
                              <span className="font-mono text-[10px] text-sr-text-secondary">
                                {r.similarity.toFixed(4)}
                              </span>
                            </div>
                          )}
                          {typeof r.distance === 'number' && (
                            <span className="font-mono text-[10px] text-sr-text-tertiary" title="ChromaDB L2 distance">
                              d={r.distance.toFixed(4)}
                            </span>
                          )}
                        </div>
                      </div>
                      {r.upload_id && (
                        <div className="mb-1.5 font-mono text-[10px] text-sr-text-tertiary">
                          upload {r.upload_id.slice(0, 8)}
                        </div>
                      )}
                      <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded border border-sr-border bg-sr-bg px-3 py-2 font-mono text-xs leading-relaxed text-sr-text-secondary">
                        {r.evidence}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ============================ OFFLINE SECTION ============================ */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <FlaskConical size={14} className="text-sr-text-secondary" />
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-sr-text-secondary">
            Offline benchmark metrics
          </h2>
          <Badge variant="outline" className="border-sr-border text-[9px] uppercase tracking-wide text-sr-text-tertiary">
            benchmark-backed · not live
          </Badge>
        </div>

        <div className="rounded-lg border border-sr-border bg-sr-surface card-shadow overflow-hidden">
          {/* Provenance banner */}
          <div className="flex items-start gap-2 border-b border-sr-border bg-sr-elevated/40 px-5 py-3">
            <BookOpen size={14} className="mt-0.5 shrink-0 text-sr-text-tertiary" />
            <p className="text-[11px] leading-relaxed text-sr-text-secondary">
              Recall@K and MRR are <span className="text-sr-text">not produced by the live endpoint</span>
              {' '}(its <code className="font-mono text-[10px] text-sr-text-tertiary">recall_at_k</code> field is always null).
              These are measured offline by the <code className="font-mono text-[10px] text-sr-text">{OFFLINE_BENCHMARK.harness}</code>
              {' '}harness against a labeled set. <span className="text-sr-text">Benchmark from recall_eval.py labeled-set evaluation</span> —
              source: <code className="font-mono text-[10px] text-sr-text">{OFFLINE_BENCHMARK.sourceFile}</code>.
            </p>
          </div>

          {/* Benchmark table */}
          <div className="overflow-x-auto px-5 py-4">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-sr-text-secondary">
                  <th className="py-2 pr-4">Metric</th>
                  {OFFLINE_BENCHMARK.configs.map((c) => (
                    <th key={c} className="py-2 pr-4 text-right font-medium">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-sr-border">
                {OFFLINE_BENCHMARK.rows.map((row) => (
                  <tr key={row.metric}>
                    <td className="py-2.5 pr-4">
                      <span className="font-mono text-xs font-semibold text-sr-text">{row.metric}</span>
                    </td>
                    {row.values.map((v, col) => {
                      const isBest = col === row.bestCol
                      return (
                        <td key={col} className="py-2.5 pr-4 text-right">
                          <span
                            className={`font-mono text-sm tabular-nums ${isBest ? 'font-bold text-sr-accent' : 'text-sr-text-secondary'}`}
                          >
                            {v.toFixed(2)}
                            {isBest && <Trophy size={11} className="ml-1 inline align-[-1px]" />}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Metric interpretation */}
          <div className="grid gap-px border-t border-sr-border bg-sr-border sm:grid-cols-2">
            {OFFLINE_BENCHMARK.rows.map((row) => (
              <div key={row.metric} className="flex items-start gap-2 bg-sr-surface px-5 py-3">
                <Info size={13} className="mt-0.5 shrink-0 text-sr-text-tertiary" />
                <p className="text-[11px] leading-snug text-sr-text-secondary">
                  <span className="font-mono font-semibold text-sr-text">{row.metric}</span>{' '}
                  {METRIC_HELP[row.metric]}
                </p>
              </div>
            ))}
          </div>

          {/* Methodology */}
          <div className="border-t border-sr-border bg-sr-elevated/30 px-5 py-3">
            <div className="mb-1 text-[9px] uppercase tracking-wider text-sr-text-tertiary">Methodology</div>
            <p className="text-[11px] leading-relaxed text-sr-text-secondary">
              Relevance = exact chunk-id match against the labeled target, measured on the real
              embedding + vector-store path over a labeled set of {OFFLINE_BENCHMARK.queries} queries
              ({OFFLINE_BENCHMARK.corpus}-chunk corpus, <code className="font-mono text-[10px] text-sr-text-tertiary">{OFFLINE_BENCHMARK.labeledSet}</code>).
              Reranker = <code className="font-mono text-[10px] text-sr-text-tertiary">{OFFLINE_BENCHMARK.reranker}</code> (CPU).
              Recall@3/@5 are saturated at this corpus size, so Recall@1 and MRR are the meaningful signals.
              Reproduce with <code className="font-mono text-[10px] text-sr-text-tertiary">python {OFFLINE_BENCHMARK.harness}</code>.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
