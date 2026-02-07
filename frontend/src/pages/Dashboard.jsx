import { useState } from 'react'
import { useMissionStore } from '../store/useMissionStore'
import InfoModal, { InfoButton, useInfoModal } from '../components/InfoModal'
import {
  Settings, ArrowRight, Clock, Zap, GitCommit,
  Activity, CheckCircle, LayoutDashboard
} from 'lucide-react'

function StatusPopover({ onClose, agentName }) {
  return (
    <div className="glass-popover p-5 w-[360px] absolute top-full left-0 mt-2 z-50 shadow-2xl">
      <div className="flex items-center gap-2 mb-1">
        <span className="status-dot status-dot--orange" />
        <span className="text-white font-semibold text-sm">Idle</span>
      </div>
      <p className="text-xs text-[var(--text-secondary)] mb-4">{agentName} Agent Status</p>

      <div className="mb-3">
        <p className="text-label mb-1">Current Activity</p>
        <p className="text-sm text-[var(--text-secondary)]">No activity today</p>
      </div>

      <div className="mb-4">
        <p className="text-label mb-1">Bandwidth Use</p>
        <div className="flex items-center gap-2">
          <span className="text-sm text-white">0%</span>
          <div className="progress-bar flex-1">
            <div className="progress-bar-fill bg-[var(--accent-blue)]" style={{ width: '0%' }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-label mb-1">NEXT CHECK</p>
          <p className="text-xl font-bold text-white">42s</p>
          <p className="text-xs text-[var(--text-muted)]">30m interval</p>
        </div>
        <div>
          <p className="text-label mb-1">LOAD</p>
          <p className="text-xl font-bold text-white">Low</p>
          <p className="text-xs text-[var(--text-muted)]">50 BPM</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-1">
        <span className="status-dot status-dot--green" />
        <span className="text-sm text-[var(--accent-green)]">Available for new tasks</span>
      </div>
      <p className="text-xs text-[var(--text-muted)]">Last active: 8:45:42 AM</p>
    </div>
  )
}

function StatusCard() {
  const [showPopover, setShowPopover] = useState(false)
  const agents = useMissionStore((s) => s.agents)
  const leadAgent = agents.find(a => a.role === 'LEAD') || agents[0]
  const agentName = leadAgent?.name || 'Agent'

  return (
    <div className="relative">
      <div
        className="glass-card p-5 cursor-pointer"
        onClick={() => setShowPopover(!showPopover)}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="status-dot status-dot--green status-dot--pulse" />
            <span className="text-label">STATUS</span>
          </div>
          <Settings size={14} className="text-[var(--text-muted)]" />
        </div>
        <p className="text-2xl font-bold text-white mb-1">Online</p>
        <p className="text-sm text-[var(--text-secondary)]">Ready and waiting for tasks</p>
        <div className="flex items-center gap-2 mt-3 text-xs text-[var(--text-muted)]">
          <Clock size={12} />
          <span>14:39</span>
          <span>(30m)</span>
        </div>
      </div>
      {showPopover && <StatusPopover onClose={() => setShowPopover(false)} agentName={agentName} />}
    </div>
  )
}

function WorkshopCard() {
  const tasks = useMissionStore((s) => s.tasks)
  const queued = tasks.filter(t => t.status === 'INBOX' || t.status === 'ASSIGNED').length
  const active = tasks.filter(t => t.status === 'IN PROGRESS').length
  const done = tasks.filter(t => t.status === 'DONE').length
  const total = tasks.length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="status-dot status-dot--purple" />
          <span className="text-label">TASKS</span>
        </div>
        <ArrowRight size={14} className="text-[var(--text-muted)]" />
      </div>
      <p className="text-2xl font-bold text-white mb-1">{active} active</p>
      <p className="text-sm text-[var(--text-secondary)]">{queued} queued &middot; {pct}% done</p>
    </div>
  )
}

function ClientsCard() {
  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="status-dot status-dot--blue" />
          <span className="text-label">CLIENTS</span>
        </div>
      </div>
      <p className="text-4xl font-bold text-white mb-1">1</p>
      <p className="text-sm text-[var(--text-secondary)]">No recent activity</p>
    </div>
  )
}

function LiveActivitySection() {
  const liveFeed = useMissionStore((s) => s.liveFeed)
  const items = liveFeed.slice(0, 10)

  return (
    <div className="glass-card p-5 mt-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-[var(--accent-orange)]" />
          <span className="text-white font-semibold text-sm">Live Activity</span>
        </div>
        <a href="/workshop" className="text-xs text-[var(--accent-blue)] hover:underline">
          View Task Manager &rarr;
        </a>
      </div>
      <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto">
        {items.length === 0 && (
          <p className="text-sm text-[var(--text-muted)]">No activity yet</p>
        )}
        {items.map((item) => (
          <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-[rgba(255,255,255,0.03)]">
            <div className="mt-1">
              {item.type === 'status' ? (
                <Activity size={14} className="text-[var(--accent-orange)]" />
              ) : (
                <CheckCircle size={14} className="text-[var(--accent-green)]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{item.title}</p>
              <p className="text-xs text-[var(--text-secondary)] truncate">{item.detail}</p>
            </div>
            <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">{item.timestamp}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RecentCommitsSection() {
  return (
    <div className="glass-card p-5 mt-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <GitCommit size={16} className="text-[var(--accent-orange)]" />
          <span className="text-white font-semibold text-sm">Recent Commits</span>
        </div>
        <span className="badge bg-[rgba(255,255,255,0.06)] text-[var(--text-muted)]">0 total</span>
      </div>
      <p className="text-sm text-[var(--text-muted)]">No commits tracked yet</p>
    </div>
  )
}

export default function Dashboard() {
  const info = useInfoModal()

  return (
    <div>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Mission Control</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Real-time overview of all systems</p>
        </div>
        <InfoButton onClick={info.show} />
      </div>

      {/* V2 Status Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatusCard />
        <WorkshopCard />
        <ClientsCard />
      </div>

      {/* Live Activity */}
      <LiveActivitySection />

      {/* Recent Commits */}
      <RecentCommitsSection />

      <InfoModal
        open={info.open}
        onClose={info.hide}
        title="Dashboard"
        icon={<LayoutDashboard size={18} className="text-[var(--accent-blue)]" />}
      >
        <p>Dashboard is your home base. You open Mission Control and this is what you see first — a <strong className="text-white">real-time snapshot of everything</strong>.</p>
        <p>The three status cards at the top tell you instantly: is your agent online, how many tasks are queued vs done, and how many clients are connected.</p>
        <p>The <strong className="text-white">Live Activity</strong> feed below is like a heartbeat monitor — you can see what the agent is doing right now or did recently. Below that, <strong className="text-white">Recent Commits</strong> shows actual code the agent has pushed to your repos.</p>
        <p>Check this page first thing in the morning to see what happened overnight, or glance at it throughout the day to make sure things are running smoothly.</p>
        <p>Clicking the <strong className="text-white">STATUS card</strong> gives you a detailed popover with bandwidth, load, next heartbeat check, and whether the agent is available for new work.</p>
      </InfoModal>
    </div>
  )
}
