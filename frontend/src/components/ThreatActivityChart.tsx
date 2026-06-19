import { useEffect, useRef } from 'react'
import Chart from 'chart.js/auto'

interface ChartData {
  labels: string[]
  alerts: number[]
  resolved: number[]
}

interface Props {
  data: ChartData
}

export default function ThreatActivityChart({ data }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (chartRef.current) {
      chartRef.current.destroy()
    }

    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [
          {
            label: 'Alerts',
            data: data.alerts,
            borderColor: '#FF7A00',
            backgroundColor: 'rgba(255, 122, 0, 0.08)',
            fill: true,
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: '#FF7A00',
            pointBorderColor: '#FF7A00',
            pointHoverRadius: 5,
          },
          {
            label: 'Resolved',
            data: data.resolved,
            borderColor: '#22C55E',
            backgroundColor: 'rgba(34, 197, 94, 0.06)',
            fill: true,
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: '#22C55E',
            pointBorderColor: '#22C55E',
            pointHoverRadius: 5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            labels: {
              color: '#8A8A8A',
              font: { family: 'Inter', size: 11 },
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 16,
            },
          },
          tooltip: {
            backgroundColor: '#0B0B0B',
            titleColor: '#F5F5F5',
            bodyColor: '#8A8A8A',
            borderColor: '#1A1A1A',
            borderWidth: 1,
            padding: 12,
            titleFont: { family: 'Inter', size: 12, weight: 600 },
            bodyFont: { family: 'JetBrains Mono', size: 11 },
            displayColors: true,
            boxPadding: 4,
          },
        },
        scales: {
          x: {
            grid: { color: '#1A1A1A', lineWidth: 1 },
            ticks: {
              color: '#555555',
              font: { family: 'Inter', size: 11 },
            },
            border: { display: false },
          },
          y: {
            grid: { color: '#1A1A1A', lineWidth: 1 },
            ticks: {
              color: '#555555',
              font: { family: 'JetBrains Mono', size: 10 },
              padding: 8,
            },
            border: { display: false },
            beginAtZero: true,
          },
        },
      },
    })

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy()
        chartRef.current = null
      }
    }
  }, [data])

  return (
    <div className="w-full h-full min-h-[280px]">
      <canvas ref={canvasRef} />
    </div>
  )
}
