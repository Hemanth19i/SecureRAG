import { useState } from 'react'
import { FileText, Download, Eye, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Printer } from 'lucide-react'
import { reports } from '@/data/demo'
import { chartData } from '@/data/demo'
import Chart from 'chart.js/auto'
import { useEffect, useRef } from 'react'

const typeColors: Record<string, { bg: string; text: string }> = {
  Executive: { bg: 'bg-sr-blue/15', text: 'text-sr-blue' },
  Technical: { bg: 'bg-sr-accent/15', text: 'text-sr-accent' },
  IOC: { bg: 'bg-sr-green/15', text: 'text-sr-green' },
  Campaign: { bg: 'bg-sr-red/15', text: 'text-sr-red' },
}

function ReportChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (chartRef.current) chartRef.current.destroy()

    chartRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: chartData.labels,
        datasets: [{
          label: 'Threat Detections',
          data: chartData.alerts,
          backgroundColor: 'rgba(255, 122, 0, 0.7)',
          borderColor: '#FF7A00',
          borderWidth: 1,
          borderRadius: 3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          x: {
            grid: { color: '#1A1A1A' },
            ticks: { color: '#8A8A8A', font: { size: 10 } },
            border: { display: false },
          },
          y: {
            grid: { color: '#1A1A1A' },
            ticks: { color: '#555555', font: { size: 10 } },
            border: { display: false },
          },
        },
      },
    })

    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null } }
  }, [])

  return <div className="w-full h-48"><canvas ref={canvasRef} /></div>
}

export default function Reports() {
  const [selectedReport, setSelectedReport] = useState<typeof reports[0] | null>(null)
  const [currentPage, setCurrentPage] = useState(0)

  if (selectedReport) {
    return (
      <div className="h-full flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-sr-border bg-sr-surface shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setSelectedReport(null); setCurrentPage(0) }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-sr-elevated border border-sr-border text-xs text-sr-text-secondary hover:text-sr-text transition-colors"
            >
              <ChevronLeft size={12} /> Back
            </button>
            <span className="text-sm font-medium text-sr-text">{selectedReport.title}</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-1.5 rounded hover:bg-sr-elevated text-sr-text-tertiary hover:text-sr-text transition-colors">
              <ZoomOut size={14} />
            </button>
            <span className="text-xs text-sr-text-secondary">100%</span>
            <button className="p-1.5 rounded hover:bg-sr-elevated text-sr-text-tertiary hover:text-sr-text transition-colors">
              <ZoomIn size={14} />
            </button>
            <div className="w-px h-4 bg-sr-border mx-1" />
            <button className="p-1.5 rounded hover:bg-sr-elevated text-sr-text-tertiary hover:text-sr-text transition-colors">
              <Printer size={14} />
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-sr-accent text-xs text-sr-text font-medium hover:bg-sr-accent-hover transition-colors">
              <Download size={12} /> PDF
            </button>
          </div>
        </div>

        {/* Viewer */}
        <div className="flex-1 flex overflow-hidden">
          {/* Thumbnails */}
          <div className="w-44 bg-sr-surface border-r border-sr-border overflow-y-auto p-3 space-y-2 shrink-0">
            {[0, 1, 2, 3, 4].map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-full aspect-[3/4] bg-sr-elevated border rounded overflow-hidden transition-colors ${
                  currentPage === page ? 'border-sr-accent' : 'border-sr-border hover:border-sr-border-focus'
                }`}
              >
                <div className="w-full h-full p-2 scale-50 origin-top-left" style={{ width: '200%' }}>
                  {page === 0 && (
                    <div className="flex flex-col items-center justify-center h-full">
                      <div className="text-lg font-display font-bold text-sr-text text-center leading-tight">{selectedReport.title}</div>
                      <div className="text-xs text-sr-text-secondary mt-2">{selectedReport.date}</div>
                      <div className="text-[10px] text-sr-text-tertiary mt-1">{selectedReport.type} Report</div>
                    </div>
                  )}
                  {page === 1 && (
                    <div>
                      <div className="text-xs font-semibold text-sr-text mb-1">Executive Summary</div>
                      <div className="w-full h-8 bg-sr-surface rounded mb-1" />
                      <div className="w-3/4 h-4 bg-sr-surface rounded" />
                    </div>
                  )}
                  {page > 1 && (
                    <div>
                      <div className="w-full h-6 bg-sr-surface rounded mb-1" />
                      <div className="w-full h-4 bg-sr-surface rounded mb-0.5" />
                      <div className="w-5/6 h-4 bg-sr-surface rounded mb-0.5" />
                      <div className="w-4/5 h-4 bg-sr-surface rounded" />
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Page Content */}
          <div className="flex-1 overflow-y-auto bg-sr-bg p-8">
            <div className="max-w-3xl mx-auto bg-sr-surface border border-sr-border rounded-lg p-12 min-h-[800px] card-shadow">
              {currentPage === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="text-[10px] text-sr-text-tertiary uppercase tracking-widest mb-6">SecureRAG Intelligence</div>
                  <h1 className="text-3xl font-display font-bold text-sr-text leading-tight mb-4">{selectedReport.title}</h1>
                  <div className="text-sm text-sr-text-secondary mb-2">{selectedReport.type} Report</div>
                  <div className="text-xs text-sr-text-tertiary font-mono">{selectedReport.date}</div>
                  <div className="mt-8 px-4 py-2 bg-sr-elevated border border-sr-border rounded text-xs text-sr-text-tertiary">
                    CLASSIFICATION: TLP:AMBER
                  </div>
                  <div className="mt-4 text-xs text-sr-text-tertiary">
                    Author: {selectedReport.author} | {selectedReport.pages} pages
                  </div>
                </div>
              )}

              {currentPage === 1 && (
                <div>
                  <h2 className="text-xl font-display font-bold text-sr-text mb-6">Executive Summary</h2>
                  <p className="text-sm text-sr-text-secondary leading-relaxed mb-6">
                    This report provides an analysis of threat activity observed during the reporting period.
                    Key findings include increased sophistication in attack techniques, with notable shifts
                    in adversary tactics targeting cloud infrastructure and supply chain dependencies.
                  </p>
                  <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="p-4 bg-sr-elevated rounded border border-sr-border text-center">
                      <div className="text-2xl font-mono font-semibold text-sr-red">23</div>
                      <div className="text-[10px] text-sr-text-secondary mt-1">Critical Alerts</div>
                    </div>
                    <div className="p-4 bg-sr-elevated rounded border border-sr-border text-center">
                      <div className="text-2xl font-mono font-semibold text-sr-accent">156</div>
                      <div className="text-[10px] text-sr-text-secondary mt-1">Investigations</div>
                    </div>
                    <div className="p-4 bg-sr-elevated rounded border border-sr-border text-center">
                      <div className="text-2xl font-mono font-semibold text-sr-green">89%</div>
                      <div className="text-[10px] text-sr-text-secondary mt-1">Resolution Rate</div>
                    </div>
                  </div>
                  <ReportChart />
                </div>
              )}

              {currentPage >= 2 && (
                <div>
                  <h2 className="text-lg font-display font-bold text-sr-text mb-4">
                    {currentPage === 2 ? 'Threat Actor Analysis' : currentPage === 3 ? 'Technical Indicators' : 'Recommendations'}
                  </h2>
                  <div className="space-y-3">
                    <p className="text-sm text-sr-text-secondary leading-relaxed">
                      Analysis of the threat landscape during this period reveals persistent targeting
                      of financial services infrastructure by sophisticated threat actors. The observed
                      TTPs align with known APT groups, with notable modifications to evade detection.
                    </p>
                    <div className="p-4 bg-sr-elevated rounded border border-sr-border">
                      <div className="text-xs font-mono text-sr-accent mb-2">Key Finding #{currentPage - 1}</div>
                      <p className="text-sm text-sr-text">
                        Multi-stage attack chains involving initial access via spear-phishing,
                        followed by credential harvesting and lateral movement using SMB protocols.
                      </p>
                    </div>
                    <div className="p-4 bg-sr-elevated rounded border border-sr-border">
                      <div className="text-xs font-mono text-sr-accent mb-2">Indicators</div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs font-mono text-sr-text-secondary">
                          <span className="text-sr-text-tertiary">IP:</span>
                          <span>185.220.101.47</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-mono text-sr-text-secondary">
                          <span className="text-sr-text-tertiary">Hash:</span>
                          <span>a3b8c9d2e1f4056789abcdef01234567</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-mono text-sr-text-secondary">
                          <span className="text-sr-text-tertiary">Domain:</span>
                          <span>paypal-security.com</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-sr-text-secondary leading-relaxed">
                      Organizations are advised to implement enhanced email filtering, enable
                      multi-factor authentication, and monitor for anomalous SMB traffic patterns.
                    </p>
                  </div>
                </div>
              )}

              {/* Page Navigation */}
              <div className="flex items-center justify-between mt-12 pt-4 border-t border-sr-border">
                <button
                  onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  className="flex items-center gap-1 text-xs text-sr-text-secondary hover:text-sr-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={12} /> Previous
                </button>
                <span className="text-xs text-sr-text-tertiary font-mono">
                  Page {currentPage + 1} of 5
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(4, p + 1))}
                  disabled={currentPage === 4}
                  className="flex items-center gap-1 text-xs text-sr-text-secondary hover:text-sr-text disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Next <ChevronRight size={12} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-display font-bold text-sr-text">Reports</h2>
        <button className="flex items-center gap-2 px-4 py-2 bg-sr-accent text-sr-text rounded-md text-sm font-medium hover:bg-sr-accent-hover transition-colors">
          <FileText size={14} /> Generate Report
        </button>
      </div>

      {/* Report Grid */}
      <div className="grid grid-cols-3 gap-4">
        {reports.map(report => {
          const colors = typeColors[report.type] || typeColors.Technical
          return (
            <div
              key={report.id}
              onClick={() => setSelectedReport(report)}
              className="bg-sr-surface border border-sr-border rounded-lg p-5 card-shadow hover:border-sr-border-focus transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-3">
                <FileText size={20} className="text-sr-accent" />
                <span className={`text-[10px] px-2 py-0.5 rounded ${colors.bg} ${colors.text} font-medium`}>
                  {report.type}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-sr-text mb-2 group-hover:text-sr-accent transition-colors leading-snug">
                {report.title}
              </h3>
              <div className="flex items-center justify-between text-[11px] text-sr-text-tertiary">
                <span>{report.author}</span>
                <span>{report.date}</span>
              </div>
              <div className="mt-3 pt-3 border-t border-sr-border flex items-center justify-between">
                <span className="text-[11px] text-sr-text-secondary">{report.pages} pages</span>
                <div className="flex items-center gap-1">
                  <button className="p-1.5 rounded hover:bg-sr-elevated text-sr-text-tertiary hover:text-sr-text transition-colors">
                    <Eye size={12} />
                  </button>
                  <button className="p-1.5 rounded hover:bg-sr-elevated text-sr-text-tertiary hover:text-sr-text transition-colors">
                    <Download size={12} />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
