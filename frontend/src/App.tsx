import { Routes, Route, Navigate } from 'react-router'
import { useState } from 'react'
import Sidebar from '@/components/Sidebar'
import TopBar from '@/components/TopBar'
import LoginScreen from '@/components/LoginScreen'
import { useAuth } from '@/lib/auth'
import Dashboard from '@/pages/Dashboard'
import Query from '@/pages/Query'
import RetrievalEval from '@/pages/RetrievalEval'
import Upload from '@/pages/Upload'
import Investigations from '@/pages/Investigations'
import IOCExplorer from '@/pages/IOCExplorer'
import MITEMapping from '@/pages/MITEMapping'
import TimelineAnalysis from '@/pages/TimelineAnalysis'
import AttackGraph from '@/pages/AttackGraph'
import CaseManagement from '@/pages/CaseManagement'
import ThreatIntelligence from '@/pages/ThreatIntelligence'
import Reports from '@/pages/Reports'
import Settings from '@/pages/Settings'
import LiveMonitoring from '@/pages/LiveMonitoring'

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
        </main>
      </div>
    </div>
  )
}
