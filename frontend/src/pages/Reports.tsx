import { useState } from 'react'
import { FileText, Download, Copy, Loader2, AlertTriangle, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { fetchCases, fetchCase, fetchReport, ApiError } from '@/lib/api'
import type { CaseRow } from '@/lib/backend'
import { useApiData } from '@/lib/useApi'
import { normSeverity, sevHex } from '@/lib/format'

export default function Reports() {
  const { status, data, error, reload } = useApiData<CaseRow[]>(() => fetchCases())
  const cases = data ?? []

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [genStatus, setGenStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [report, setReport] = useState('')
  const [genError, setGenError] = useState('')

  const generate = async (c: CaseRow) => {
    setSelectedId(c.case_id)
    setGenStatus('loading')
    setGenError('')
    setReport('')
    try {
      // The case snapshot mirrors the /query response, which carries `analysis`
      // — exactly what POST /report needs.
      const detail = await fetchCase(c.case_id)
      const snapshot = detail.snapshot as { analysis?: unknown } | undefined
      const analysis = snapshot?.analysis
      if (!analysis) {
        setGenStatus('error')
        setGenError('This case has no analysis snapshot to generate a report from.')
        return
      }
      const text = await fetchReport(analysis)
      setReport(text)
      setGenStatus('ready')
    } catch (e) {
      setGenStatus('error')
      setGenError(e instanceof ApiError ? e.message : 'Report generation failed.')
    }
  }

  const download = () => {
    const blob = new Blob([report], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `report-${selectedId?.slice(0, 8) || 'case'}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const copy = () => {
    navigator.clipboard.writeText(report).then(() => toast.success('Report copied'))
  }

  return (
    <div className="mx-auto max-w-[1300px] p-8">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-sr-accent" />
          <h2 className="font-display text-xl font-bold text-sr-text">Reports</h2>
        </div>
        <p className="mt-1 text-sm text-sr-text-secondary">Generate an incident report from a saved investigation.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
        {/* Case list */}
        <div className="rounded-lg border border-sr-border bg-sr-surface card-shadow">
          <div className="border-b border-sr-border px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-sr-text-secondary">
            Saved cases ({cases.length})
          </div>
          <div className="max-h-[560px] divide-y divide-sr-border overflow-y-auto">
            {status === 'loading' && (
              <div className="flex items-center gap-2 px-4 py-5 text-sm text-sr-text-secondary">
                <Loader2 size={15} className="animate-spin" /> Loading…
              </div>
            )}
            {status === 'error' && (
              <div className="px-4 py-5 text-sm text-sr-red">
                <AlertTriangle size={14} className="mr-1 inline" /> {error}
                <button onClick={reload} className="ml-2 text-xs underline">Retry</button>
              </div>
            )}
            {status === 'ready' && cases.length === 0 && (
              <p className="px-4 py-6 text-center text-xs text-sr-text-tertiary">
                No cases yet. Save a query as a case to generate reports.
              </p>
            )}
            {cases.map((c) => {
              const sc = sevHex(normSeverity(c.severity))
              return (
                <button
                  key={c.case_id}
                  onClick={() => generate(c)}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-sr-elevated ${selectedId === c.case_id ? 'bg-sr-elevated' : ''}`}
                >
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: sc }} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-sr-text">{c.title}</div>
                    <div className="font-mono text-[10px] text-sr-text-tertiary">{c.case_id.slice(0, 8)} · {(c.created_at || '').slice(0, 10)}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Report viewer */}
        <div className="min-h-[400px] rounded-lg border border-sr-border bg-sr-surface card-shadow">
          {genStatus === 'idle' && (
            <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-2 text-sr-text-tertiary">
              <Sparkles size={24} />
              <p className="text-sm">Select a case to generate its incident report.</p>
            </div>
          )}
          {genStatus === 'loading' && (
            <div className="flex h-full min-h-[400px] items-center justify-center gap-2 text-sr-text-secondary">
              <Loader2 size={18} className="animate-spin" /> Generating report…
            </div>
          )}
          {genStatus === 'error' && (
            <div className="flex h-full min-h-[400px] items-center justify-center px-6 text-center text-sm text-sr-red">
              <span><AlertTriangle size={15} className="mr-1 inline" /> {genError}</span>
            </div>
          )}
          {genStatus === 'ready' && (
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-sr-border px-5 py-3">
                <span className="text-sm font-semibold text-sr-text">Incident Report</span>
                <div className="flex items-center gap-2">
                  <button onClick={copy} className="flex items-center gap-1.5 rounded border border-sr-border px-2.5 py-1 text-xs text-sr-text-secondary hover:text-sr-text">
                    <Copy size={12} /> Copy
                  </button>
                  <button onClick={download} className="flex items-center gap-1.5 rounded border border-sr-border px-2.5 py-1 text-xs text-sr-text-secondary hover:text-sr-text">
                    <Download size={12} /> Download
                  </button>
                </div>
              </div>
              <pre className="flex-1 overflow-auto whitespace-pre-wrap p-5 font-mono text-xs leading-relaxed text-sr-text">
                {report}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
