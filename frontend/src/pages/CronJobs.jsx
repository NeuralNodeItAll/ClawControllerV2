import { useEffect } from 'react'
import { useMissionStore } from '../store/useMissionStore'
import { Clock, Play, ToggleLeft, ToggleRight, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'

function CronJobCard({ job, onToggle }) {
  const [expanded, setExpanded] = useState(false)

  const nextRunText = job.next_run_at
    ? (() => {
        const diff = new Date(job.next_run_at) - new Date()
        if (diff < 0) return 'Overdue'
        const h = Math.floor(diff / 3600000)
        const m = Math.floor((diff % 3600000) / 60000)
        if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`
        return h > 0 ? `${h}h ${m}m` : `${m}m`
      })()
    : 'Not scheduled'

  return (
    <div className="glass-card p-5 mb-3">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-[rgba(245,158,11,0.2)] flex items-center justify-center flex-shrink-0">
          <Play size={18} className="text-[var(--accent-orange)]" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-white">{job.title}</h3>
          <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mt-0.5">{job.description}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-[var(--text-muted)]">
            <div className="flex items-center gap-1">
              <Clock size={11} />
              <span>{job.schedule_type} {job.schedule_value || ''} {job.schedule_time || ''}</span>
            </div>
            <span>&middot;</span>
            <span>Next: {nextRunText}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button onClick={() => onToggle(job.id)} className="text-[var(--text-muted)] hover:text-white">
            {job.is_active ? <ToggleRight size={24} className="text-[var(--accent-green)]" /> : <ToggleLeft size={24} />}
          </button>
          <button onClick={() => setExpanded(!expanded)} className="text-[var(--text-muted)] hover:text-white">
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="mt-4 pt-4 border-t border-[var(--border-glass)]">
          <p className="text-label mb-2">Execution History</p>
          <p className="text-xs text-[var(--text-muted)]">
            Runs: {job.run_count || 0} &middot; Last run: {job.last_run_at ? new Date(job.last_run_at).toLocaleString() : 'Never'}
          </p>
        </div>
      )}
    </div>
  )
}

export default function CronJobs() {
  const recurringTasks = useMissionStore((s) => s.recurringTasks)
  const toggleRecurringTask = useMissionStore((s) => s.toggleRecurringTask)
  const refreshRecurringTasks = useMissionStore((s) => s.refreshRecurringTasks)

  useEffect(() => {
    refreshRecurringTasks()
  }, [refreshRecurringTasks])

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-[rgba(139,92,246,0.2)] flex items-center justify-center">
          <Clock size={20} className="text-[var(--accent-purple)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Cron Jobs</h1>
          <p className="text-sm text-[var(--text-muted)]">Scheduled automation tasks</p>
        </div>
      </div>

      {recurringTasks.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <p className="text-sm text-[var(--text-muted)]">No cron jobs configured yet</p>
        </div>
      ) : (
        recurringTasks.map(job => (
          <CronJobCard key={job.id} job={job} onToggle={toggleRecurringTask} />
        ))
      )}
    </div>
  )
}
