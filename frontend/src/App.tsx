import { Routes, Route, Navigate } from 'react-router'
import { useState, lazy, Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import TopBar from '@/components/TopBar'
import LoginScreen from '@/components/LoginScreen'
import ErrorBoundary from '@/components/ErrorBoundary'
import { useAuth } from '@/lib/auth'

// Routes are lazy-loaded so heavy, route-specific dependencies (React Flow on
// Attack Graph, Recharts on the Dashboard, three.js in the hero) are split into
// per-route chunks instead of one large initial bundle. Behavior is unchanged.
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Query = lazy(() => import('@/pages/Query'))
const RetrievalEval = lazy(() => import('@/pages/RetrievalEval'))
const Upload = lazy(() => import('@/pages/Upload'))
const Investigations = lazy(() => import('@/pages/Investigations'))
const IOCExplorer = lazy(() => import('@/pages/IOCExplorer'))
const MITEMapping = lazy(() => import('@/pages/MITEMapping'))
const TimelineAnalysis = lazy(() => import('@/pages/TimelineAnalysis'))
const AttackGraph = lazy(() => import('@/pages/AttackGraph'))
const CaseManagement = lazy(() => import('@/pages/CaseManagement'))
const ThreatIntelligence = lazy(() => import('@/pages/ThreatIntelligence'))
const Reports = lazy(() => import('@/pages/Reports'))
const Settings = lazy(() => import('@/pages/Settings'))
const LiveMonitoring = lazy(() => import('@/pages/LiveMonitoring'))

function RouteFallback() {
  return (
    <div className="flex h-full min-h-[60vh] items-center justify-center text-sr-text-secondary">
      <Loader2 size={20} className="animate-spin" />
    </div>
  )
}

export default function App() {
  const { isAuthenticated } = useAuth()
  const [currentPage, setCurrentPage] = useState('Dashboard')

  // Auth gate: with no token, the login screen owns the whole viewport.
  if (!isAuthenticated) return <LoginScreen />

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-sr-bg">
      <Sidebar currentPage={currentPage} onPageChange={setCurrentPage} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar pageTitle={currentPage} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <ErrorBoundary>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/query" element={<Query />} />
                <Route path="/retrieval-eval" element={<RetrievalEval />} />
                <Route path="/upload" element={<Upload />} />
                <Route path="/investigations" element={<Investigations />} />
                <Route path="/ioc-explorer" element={<IOCExplorer />} />
                <Route path="/mitre" element={<MITEMapping />} />
                <Route path="/timeline" element={<TimelineAnalysis />} />
                <Route path="/attack-graph" element={<AttackGraph />} />
                <Route path="/cases" element={<CaseManagement />} />
                <Route path="/ioc-enrichment" element={<ThreatIntelligence />} />
                {/* Backward-compat: old route redirects to the renamed one (no 404s). */}
                <Route path="/threat-intel" element={<Navigate to="/ioc-enrichment" replace />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/monitoring" element={<LiveMonitoring />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
