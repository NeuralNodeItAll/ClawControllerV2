import { DollarSign, TrendingUp, Shield, Zap, PieChart, BarChart3 } from 'lucide-react'
import { useState, useEffect } from 'react'
import { fetchTodayUsage, fetchWeeklyUsage } from '../api'
import InfoModal, { InfoButton, useInfoModal } from '../components/InfoModal'

function StatCard({ icon: Icon, iconColor, iconBg, value, label }) {
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
  const info = useInfoModal()
  const [today, setToday] = useState({ total_cost: '$0.00', tokens_in: 0, tokens_out: 0, sessions: 0 })
  const [weekly, setWeekly] = useState({ total_cost: '$0.00', sessions: 0 })

  useEffect(() => {
    fetchTodayUsage().then(setToday).catch(console.error)
    fetchWeeklyUsage().then(setWeekly).catch(console.error)
  }, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">API Usage & Metrics</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Real-time financial and token intelligence</p>
        </div>
        <InfoButton onClick={info.show} />
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <StatCard
          icon={DollarSign}
          iconColor="var(--accent-blue)"
          iconBg="rgba(59,130,246,0.15)"
          value={today.total_cost}
          label={`Today's spend (${today.sessions} session${today.sessions !== 1 ? 's' : ''})`}
        />
        <StatCard
          icon={TrendingUp}
          iconColor="var(--accent-pink)"
          iconBg="rgba(236,72,153,0.15)"
          value={weekly.total_cost}
          label={`7-day rolling (${weekly.sessions} session${weekly.sessions !== 1 ? 's' : ''})`}
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

      {view === 'today' ? (
        <div className="glass-card p-6 mb-6">
          {today.sessions > 0 ? (
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-label mb-1">TOKENS IN</p>
                <p className="text-xl font-bold text-white">{today.tokens_in.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-label mb-1">TOKENS OUT</p>
                <p className="text-xl font-bold text-white">{today.tokens_out.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-label mb-1">SESSIONS</p>
                <p className="text-xl font-bold text-white">{today.sessions}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)] text-center">No session data detected today. Send a message to an agent to start tracking.</p>
          )}
        </div>
      ) : (
        <div className="glass-card p-6 mb-6">
          {weekly.sessions > 0 ? (
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-label mb-1">TOTAL SPEND</p>
                <p className="text-xl font-bold text-white">{weekly.total_cost}</p>
              </div>
              <div>
                <p className="text-label mb-1">SESSIONS</p>
                <p className="text-xl font-bold text-white">{weekly.sessions}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)] text-center">No usage data in the last 7 days.</p>
          )}
        </div>
      )}

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
              <p className="text-xs text-[var(--text-secondary)]">
                {today.sessions > 0
                  ? `${today.sessions} API calls logged today with token tracking active`
                  : 'No API activity yet — usage tracking activates on first agent interaction'}
              </p>
            </div>
          </div>
          <div className="glass-card p-4 flex items-start gap-3 border-l-2 border-[var(--accent-green)]">
            <Zap size={18} className="text-[var(--accent-green)] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-white">Efficiency</p>
              <p className="text-xs text-[var(--text-secondary)]">
                {today.tokens_in > 0
                  ? `Avg ${Math.round(today.tokens_out / today.sessions)} tokens/response — optimized for cost`
                  : 'Agent uses Haiku for heartbeats, Sonnet for complex tasks'}
              </p>
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
          {weekly.sessions > 0 ? (
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-[var(--text-secondary)]">Agent Chat</span>
                  <span className="text-xs text-white">{weekly.total_cost}</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-bar-fill bg-[var(--accent-blue)]" style={{ width: '100%' }} />
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)] text-center">No spend data available yet</p>
          )}
        </div>
      </div>

      <InfoModal
        open={info.open}
        onClose={info.hide}
        title="API Usage"
        icon={<BarChart3 size={18} className="text-[var(--accent-blue)]" />}
      >
        <p>API Usage is your <strong className="text-white">cost dashboard</strong>. Running an AI agent 24/7 costs money in API tokens, and this page tracks exactly how much.</p>
        <p>You see <strong className="text-white">today's spend</strong> and a <strong className="text-white">7-day rolling total</strong> at the top. The Intelligence section gives you AI-generated insights about spending patterns.</p>
        <p>The <strong className="text-white">Spend Distribution</strong> section breaks down costs by model, agent, and task type.</p>
        <p>Usage is automatically logged every time you interact with an agent through chat.</p>
      </InfoModal>
    </div>
  )
}
