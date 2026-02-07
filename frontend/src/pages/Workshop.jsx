import { useState } from 'react'
import { useMissionStore } from '../store/useMissionStore'
import { Wrench, Clock, Loader, CheckCircle, X, Zap } from 'lucide-react'

/* ── Momentum Score Calculator ── */
function calcMomentum(task, doneTasks) {
  let score = 0
  // Skill adjacency (40%) — check tag overlap with recently done tasks
  const taskTags = task.tags || []
  if (doneTasks.length > 0 && taskTags.length > 0) {
    const recentTags = doneTasks.flatMap(t => t.tags || [])
    const overlap = taskTags.filter(t => recentTags.includes(t)).length
    score += Math.min(40, (overlap / Math.max(taskTags.length, 1)) * 40)
  }
  // Capability match (30%) — placeholder: always assume capable
  score += 30
  // Priority (20%)
  score += task.priority === 'Urgent' ? 20 : 10
  // Queue age (10%)
  if (task.createdAt) {
    const age = (Date.now() - new Date(task.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    score += Math.min(10, age * 2)
  }
  return Math.min(100, Math.round(score))
}

function MomentumBadge({ score }) {
  let color = 'var(--accent-red)'
  if (score >= 70) color = 'var(--accent-green)'
  else if (score >= 40) color = 'var(--accent-orange)'
  return (
    <span className="badge text-xs font-semibold" style={{ color, background: `${color}22` }}>
      &rarr;{score}%
    </span>
  )
}

/* ── Task Detail Modal ── */
function TaskDetailModal({ task, onClose }) {
  if (!task) return null
  const pct = task.status === 'DONE' ? 100 : task.status === 'IN PROGRESS' ? 50 : 0

  return (
    <div className="glass-modal-overlay" onClick={onClose}>
      <div className="glass-modal p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[rgba(34,197,94,0.2)] flex items-center justify-center">
              <CheckCircle size={16} className="text-[var(--accent-green)]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{task.title}</h2>
              <span className="text-xs font-medium text-[var(--accent-green)]">
                {task.status === 'DONE' ? 'Completed' : task.status}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-white">
            <X size={18} />
          </button>
        </div>

        {task.description && (
          <div className="mb-4">
            <p className="text-label mb-1">Description</p>
            <p className="text-sm text-[var(--text-secondary)]">{task.description}</p>
          </div>
        )}

        {(task.tags && task.tags.length > 0) && (
          <div className="mb-4">
            <p className="text-label mb-1">Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {task.tags.map((tag, i) => (
                <span key={i} className="badge bg-[rgba(59,130,246,0.15)] text-[var(--accent-blue)]">{tag}</span>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
          <div>
            <p className="text-label mb-0.5">Created</p>
            <p className="text-white">{task.createdAt ? new Date(task.createdAt).toLocaleDateString() : '—'}</p>
          </div>
          <div>
            <p className="text-label mb-0.5">Started</p>
            <p className="text-white">—</p>
          </div>
          <div>
            <p className="text-label mb-0.5">Completed</p>
            <p className="text-white">{task.completedAt ? new Date(task.completedAt).toLocaleDateString() : '—'}</p>
          </div>
        </div>

        <div className="mb-4">
          <p className="text-label mb-1">Progress</p>
          <div className="progress-bar">
            <div className="progress-bar-fill bg-[var(--accent-blue)]" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1">{pct}% complete</p>
        </div>

        {task.comments && task.comments.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={14} className="text-[var(--accent-orange)]" />
              <span className="text-sm font-semibold text-white">Activity Log</span>
            </div>
            <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto">
              {task.comments.map(c => (
                <div key={c.id} className="flex items-start gap-2">
                  <span className="status-dot status-dot--green mt-1.5" />
                  <div>
                    <p className="text-xs text-[var(--text-secondary)]">{c.text}</p>
                    <p className="text-xs text-[var(--text-muted)]">{c.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg bg-[rgba(255,255,255,0.08)] text-white hover:bg-[rgba(255,255,255,0.12)]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Workshop Task Card ── */
function WorkshopTaskCard({ task, momentum, onClick }) {
  return (
    <div
      className="glass-card p-4 cursor-pointer"
      onClick={() => onClick(task)}
    >
      <h3 className="text-sm font-semibold text-white mb-1 truncate">{task.title}</h3>
      {task.description && (
        <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mb-3">{task.description}</p>
      )}
      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        {(task.tags || []).map((tag, i) => {
          const colors = ['var(--accent-red)', 'var(--accent-orange)', 'var(--accent-blue)', 'var(--accent-green)']
          const c = colors[i % colors.length]
          return (
            <span key={i} className="badge text-[10px]" style={{ color: c, background: `${c}22` }}>
              {tag}
            </span>
          )
        })}
      </div>
      <div className="flex items-center justify-between">
        <MomentumBadge score={momentum} />
        {task.status !== 'DONE' && task.status !== 'IN PROGRESS' && (
          <button
            className="text-xs font-semibold text-[var(--accent-orange)] hover:text-[var(--accent-blue)]"
            onClick={e => { e.stopPropagation() }}
          >
            Start &rarr;
          </button>
        )}
      </div>
    </div>
  )
}

/* ── Column ── */
function Column({ title, count, color, children }) {
  return (
    <div className="flex flex-col min-h-0">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-semibold text-white">{title}</span>
        <span
          className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
          style={{ background: color }}
        >
          {count}
        </span>
      </div>
      <div className="flex flex-col gap-3 flex-1 overflow-y-auto pr-1">
        {children}
      </div>
    </div>
  )
}

export default function Workshop() {
  const tasks = useMissionStore((s) => s.tasks)
  const [viewMode, setViewMode] = useState('kanban')
  const [selectedTask, setSelectedTask] = useState(null)

  const doneTasks = tasks.filter(t => t.status === 'DONE')
  const queued = tasks
    .filter(t => t.status === 'INBOX' || t.status === 'ASSIGNED')
    .map(t => ({ ...t, _momentum: calcMomentum(t, doneTasks) }))
    .sort((a, b) => b._momentum - a._momentum)
  const active = tasks.filter(t => t.status === 'IN PROGRESS' || t.status === 'REVIEW')
  const done = doneTasks

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-full bg-[rgba(239,68,68,0.2)] flex items-center justify-center">
          <Wrench size={20} className="text-[var(--accent-orange)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Mission Control Workshop</h1>
          <p className="text-sm text-[var(--text-muted)]">Autonomous work queue & live progress</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="flex items-center gap-6 mt-6 mb-6">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-[var(--text-muted)]" />
          <span className="text-sm text-[var(--text-secondary)]">Queued</span>
          <span className="badge bg-[rgba(59,130,246,0.15)] text-[var(--accent-blue)] font-bold">{queued.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <Loader size={14} className="text-[var(--text-muted)]" />
          <span className="text-sm text-[var(--text-secondary)]">Active</span>
          <span className="badge bg-[rgba(245,158,11,0.15)] text-[var(--accent-orange)] font-bold">{active.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle size={14} className="text-[var(--text-muted)]" />
          <span className="text-sm text-[var(--text-secondary)]">Done</span>
          <span className="badge bg-[rgba(34,197,94,0.15)] text-[var(--accent-green)] font-bold">{done.length}</span>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex items-center gap-1 mb-6 p-1 rounded-lg bg-[rgba(255,255,255,0.04)] w-fit">
        <button
          className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${
            viewMode === 'kanban' ? 'bg-white text-black' : 'text-[var(--text-secondary)] hover:text-white'
          }`}
          onClick={() => setViewMode('kanban')}
        >
          Board
        </button>
        <button
          className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${
            viewMode === 'feed' ? 'bg-white text-black' : 'text-[var(--text-secondary)] hover:text-white'
          }`}
          onClick={() => setViewMode('feed')}
        >
          Live Feed
        </button>
      </div>

      {/* Kanban Board */}
      {viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6" style={{ minHeight: 400 }}>
          <Column title="Queued" count={queued.length} color="var(--accent-blue)">
            {queued.map(t => (
              <WorkshopTaskCard key={t.id} task={t} momentum={t._momentum} onClick={setSelectedTask} />
            ))}
          </Column>
          <Column title="Active" count={active.length} color="var(--accent-orange)">
            {active.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-[var(--text-muted)]">No active tasks</p>
                <p className="text-xs text-[var(--text-muted)] italic mt-1">I will auto-pickup from queue!</p>
              </div>
            ) : (
              active.map(t => (
                <WorkshopTaskCard key={t.id} task={t} momentum={calcMomentum(t, doneTasks)} onClick={setSelectedTask} />
              ))
            )}
          </Column>
          <Column title="Done" count={done.length} color="var(--accent-green)">
            {done.map(t => (
              <WorkshopTaskCard key={t.id} task={t} momentum={100} onClick={setSelectedTask} />
            ))}
          </Column>
        </div>
      ) : (
        <div className="glass-card p-5">
          <p className="text-sm text-[var(--text-muted)]">Live feed view coming soon</p>
        </div>
      )}

      {selectedTask && (
        <TaskDetailModal task={selectedTask} onClose={() => setSelectedTask(null)} />
      )}
    </div>
  )
}
