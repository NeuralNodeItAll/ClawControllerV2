import { DollarSign, TrendingUp, Shield, Zap, PieChart } from 'lucide-react'
import { useState } from 'react'

function StatCard({ icon: Icon, iconColor, iconBg, value, label, sub }) {
  return (
    <div className="glass-card p-5 flex items-center gap-4">
      <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: iconBg }}>
        <Icon size={22} style={{ color: iconColor }} />
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-sm text-[var(--text-secondary)]">{label}</p>
      </div>
    </div>
  )
}

export default function ApiUsage() {
  const [view, setView] = useState('today')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">API Usage & Metrics</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Real-time financial and token intelligence</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <StatCard
          icon={DollarSign}
          iconColor="var(--accent-blue)"
          iconBg="rgba(59,130,246,0.15)"
          value="$0.00"
          label="Real-time session costs"
        />
        <StatCard
          icon={TrendingUp}
          iconColor="var(--accent-pink)"
          iconBg="rgba(236,72,153,0.15)"
          value="$0.03"
          label="Total spend last 7 days"
        />
      </div>

      {/* View Toggle */}
      <div className="flex items-center gap-1 mb-6 p-1 rounded-lg bg-[rgba(255,255,255,0.04)] w-fit">
        <button
          className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${
            view === 'today' ? 'bg-white text-black' : 'text-[var(--text-secondary)] hover:text-white'
          }`}
          onClick={() => setView('today')}
        >
          Today
        </button>
        <button
          className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${
            view === 'history' ? 'bg-white text-black' : 'text-[var(--text-secondary)] hover:text-white'
          }`}
          onClick={() => setView('history')}
        >
          History
        </button>
      </div>

      <div className="glass-card p-6 mb-6">
        <p className="text-sm text-[var(--text-muted)] text-center">No session data detected today.</p>
      </div>

      {/* Intelligence */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={16} className="text-[var(--accent-orange)]" />
          <span className="text-white font-semibold text-sm">Intelligence</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="glass-card p-4 flex items-start gap-3 border-l-2 border-[var(--accent-blue)]">
            <Shield size={18} className="text-[var(--accent-blue)] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-white">Data Integrity</p>
              <p className="text-xs text-[var(--text-secondary)]">Code discard leads actual turn telemetry</p>
            </div>
          </div>
          <div className="glass-card p-4 flex items-start gap-3 border-l-2 border-[var(--accent-green)]">
            <Zap size={18} className="text-[var(--accent-green)] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-white">Efficiency</p>
              <p className="text-xs text-[var(--text-secondary)]">Sonnet 3 Flash optimized for heartbeats</p>
            </div>
          </div>
        </div>
      </div>

      {/* Spend Distribution */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <PieChart size={16} className="text-[var(--accent-purple)]" />
          <span className="text-white font-semibold text-sm">Spend Distribution</span>
        </div>
        <div className="glass-card p-6">
          <p className="text-sm text-[var(--text-muted)] text-center">No spend data available yet</p>
        </div>
      </div>
    </div>
  )
}
