import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useMissionStore } from './store/useMissionStore'
import AppLayout from './components/AppLayout'
import Dashboard from './pages/Dashboard'
import Workshop from './pages/Workshop'
import Journal from './pages/Journal'
import Documents from './pages/Documents'
import Agents from './pages/Agents'
import Intelligence from './pages/Intelligence'
import WeeklyRecaps from './pages/WeeklyRecaps'
import Clients from './pages/Clients'
import CronJobs from './pages/CronJobs'
import ApiUsage from './pages/ApiUsage'
import './App.css'

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--bg-page)' }}>
      <div className="text-center">
        <div className="w-10 h-10 loading-spinner mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-white mb-1">Mission Control</h2>
        <p className="text-sm text-[var(--text-muted)]">Initializing systems...</p>
      </div>
    </div>
  )
}

function ErrorScreen({ error, onRetry }) {
  return (
    <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--bg-page)' }}>
      <div className="text-center max-w-sm">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-lg font-semibold text-white mb-2">Connection Failed</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-4">{error}</p>
        <button
          onClick={onRetry}
          className="px-4 py-2 text-sm rounded-lg bg-[var(--accent-blue)] text-white font-medium hover:brightness-110"
        >
          Retry Connection
        </button>
        <p className="text-xs text-[var(--text-muted)] mt-3">
          Make sure the backend is running at http://localhost:8000
        </p>
      </div>
    </div>
  )
}

function App() {
  const initialize = useMissionStore((s) => s.initialize)
  const connectWebSocket = useMissionStore((s) => s.connectWebSocket)
  const disconnectWebSocket = useMissionStore((s) => s.disconnectWebSocket)
  const refreshAgents = useMissionStore((s) => s.refreshAgents)
  const isLoading = useMissionStore((s) => s.isLoading)
  const isInitialized = useMissionStore((s) => s.isInitialized)
  const error = useMissionStore((s) => s.error)

  useEffect(() => {
    initialize()
    connectWebSocket()

    const agentRefreshInterval = setInterval(() => {
      refreshAgents()
    }, 30000)

    return () => {
      disconnectWebSocket()
      clearInterval(agentRefreshInterval)
    }
  }, [initialize, connectWebSocket, disconnectWebSocket, refreshAgents])

  if (isLoading && !isInitialized) return <LoadingScreen />
  if (error && !isInitialized) return <ErrorScreen error={error} onRetry={initialize} />

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/workshop" element={<Workshop />} />
          <Route path="/journal" element={<Journal />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/intelligence" element={<Intelligence />} />
          <Route path="/weekly-recaps" element={<WeeklyRecaps />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/cron-jobs" element={<CronJobs />} />
          <Route path="/api-usage" element={<ApiUsage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
