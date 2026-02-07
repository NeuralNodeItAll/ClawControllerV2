import { useState } from 'react'
import { useMissionStore } from '../store/useMissionStore'
import {
  Settings, ArrowRight, Clock, Zap, GitCommit,
  Activity, CheckCircle, Wifi
} from 'lucide-react'

function StatusPopover({ onClose }) {
  return (
    <div className="glass-popover p-5 w-[360px] absolute top-full left-0 mt-2 z-50 shadow-2xl">
      <div className="flex items-center gap-2 mb-1">
        <span className="status-dot status-dot--orange" />
        <span className="text-white font-semibold text-sm">Idle</span>
      </div>
      <p className="text-xs text-[var(--text-secondary)] mb-4">Jarvis Agent Status</p>

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
      {showPopover && <StatusPopover onClose={() => setShowPopover(false)} />}
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
          <span className="text-label">WORKSHOP</span>
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
          View Workshop &rarr;
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
  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Mission Control</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Real-time overview of all systems</p>
      </div>

      {/* Status Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatusCard />
        <WorkshopCard />
        <ClientsCard />
      </div>

      {/* Live Activity */}
      <LiveActivitySection />

      {/* Recent Commits */}
      <RecentCommitsSection />
    </div>
  )
}
