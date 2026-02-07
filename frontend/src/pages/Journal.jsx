import { useMissionStore } from '../store/useMissionStore'
import { BookOpen, Filter, Activity, CheckCircle, MessageSquare } from 'lucide-react'
import { useState } from 'react'

const typeIcons = {
  task: Activity,
  status: CheckCircle,
  comment: MessageSquare,
  announcement: Activity,
}

export default function Journal() {
  const liveFeed = useMissionStore((s) => s.liveFeed)
  const [filter, setFilter] = useState('all')

  const filtered = filter === 'all'
    ? liveFeed
    : liveFeed.filter(f => f.type === filter)

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-[rgba(245,158,11,0.2)] flex items-center justify-center">
          <BookOpen size={20} className="text-[var(--accent-orange)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Journal</h1>
          <p className="text-sm text-[var(--text-muted)]">Chronological activity log</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-6">
        <Filter size={14} className="text-[var(--text-muted)]" />
        {['all', 'task', 'status', 'comment'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs rounded-md font-medium capitalize transition-colors ${
              filter === f
                ? 'bg-[var(--accent-blue)] text-white'
                : 'text-[var(--text-secondary)] hover:text-white bg-[rgba(255,255,255,0.04)]'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Activity List */}
      <div className="flex flex-col gap-1">
        {filtered.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <p className="text-sm text-[var(--text-muted)]">No activity logged yet</p>
          </div>
        ) : (
          filtered.map(item => {
            const Icon = typeIcons[item.type] || Activity
            return (
              <div key={item.id} className="flex items-start gap-3 p-4 rounded-lg hover:bg-[rgba(255,255,255,0.03)]">
                <Icon size={14} className="text-[var(--accent-blue)] mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white">{item.title}</p>
                  <p className="text-xs text-[var(--text-secondary)] truncate">{item.detail}</p>
                </div>
                <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">{item.timestamp}</span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
