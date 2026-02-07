import { useEffect, useState } from 'react'
import { useMissionStore } from '../store/useMissionStore'
import { syncOpenClawCrons, updateRecurringTask } from '../api'
import {
  Clock, Play, Pause, ToggleLeft, ToggleRight, ChevronDown, ChevronUp,
  RefreshCw, Loader2, Plus, Pencil, Trash2, X, Zap, Calendar
} from 'lucide-react'
import InfoModal, { InfoButton, useInfoModal } from '../components/InfoModal'

/* ── Edit / Create Modal ── */
function CronEditModal({ job, agents, onClose, onSave }) {
  const isNew = !job
  const [form, setForm] = useState({
    title: job?.title || '',
    description: job?.description || '',
    priority: job?.priority || 'NORMAL',
    schedule_type: job?.schedule_type || 'daily',
    schedule_value: job?.schedule_value || '',
    schedule_time: job?.schedule_time || '09:00',
    assignee_id: job?.assignee_id || '',
  })
  const [saving, setSaving] = useState(false)

  const update = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } catch (err) {
      console.error('Save failed:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="glass-modal-overlay" onClick={onClose}>
      <div className="glass-modal p-6" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">
            {isNew ? 'Create Cron Job' : 'Edit Cron Job'}
          </h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-white">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Title */}
          <div>
            <label className="text-label mb-1 block">Title</label>
            <input
              type="text"
              className="w-full px-3 py-2 text-sm rounded-lg bg-[rgba(255,255,255,0.06)] border border-[var(--border-glass)] text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
              placeholder="e.g. Daily standup report"
              value={form.title}
              onChange={e => update('title', e.target.value)}
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-label mb-1 block">Description</label>
            <textarea
              className="w-full px-3 py-2 text-sm rounded-lg bg-[rgba(255,255,255,0.06)] border border-[var(--border-glass)] text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)] resize-none"
              rows={3}
              placeholder="What should this job do?"
              value={form.description}
              onChange={e => update('description', e.target.value)}
            />
          </div>

          {/* Schedule Type + Value Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-label mb-1 block">Schedule Type</label>
              <select
                className="w-full px-3 py-2 text-sm rounded-lg bg-[rgba(255,255,255,0.06)] border border-[var(--border-glass)] text-white focus:outline-none focus:border-[var(--accent-blue)]"
                value={form.schedule_type}
                onChange={e => update('schedule_type', e.target.value)}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="hourly">Hourly</option>
                <option value="cron">Cron Expression</option>
              </select>
            </div>
            <div>
              <label className="text-label mb-1 block">
                {form.schedule_type === 'hourly' ? 'Every N hours' :
                 form.schedule_type === 'weekly' ? 'Days (0=Mon, 6=Sun)' :
                 form.schedule_type === 'cron' ? 'Cron Expression' : 'Time'}
              </label>
              {form.schedule_type === 'daily' ? (
                <input
                  type="time"
                  className="w-full px-3 py-2 text-sm rounded-lg bg-[rgba(255,255,255,0.06)] border border-[var(--border-glass)] text-white focus:outline-none focus:border-[var(--accent-blue)]"
                  value={form.schedule_time}
                  onChange={e => update('schedule_time', e.target.value)}
                />
              ) : form.schedule_type === 'hourly' ? (
                <input
                  type="number"
                  min="1"
                  max="24"
                  className="w-full px-3 py-2 text-sm rounded-lg bg-[rgba(255,255,255,0.06)] border border-[var(--border-glass)] text-white focus:outline-none focus:border-[var(--accent-blue)]"
                  placeholder="e.g. 4"
                  value={form.schedule_value}
                  onChange={e => update('schedule_value', e.target.value)}
                />
              ) : form.schedule_type === 'weekly' ? (
                <input
                  type="text"
                  className="w-full px-3 py-2 text-sm rounded-lg bg-[rgba(255,255,255,0.06)] border border-[var(--border-glass)] text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
                  placeholder="e.g. 0,2,4"
                  value={form.schedule_value}
                  onChange={e => update('schedule_value', e.target.value)}
                />
              ) : (
                <input
                  type="text"
                  className="w-full px-3 py-2 text-sm rounded-lg bg-[rgba(255,255,255,0.06)] border border-[var(--border-glass)] text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
                  placeholder="e.g. 0 9 * * 1-5"
                  value={form.schedule_value}
                  onChange={e => update('schedule_value', e.target.value)}
                />
              )}
            </div>
          </div>

          {/* Weekly time picker */}
          {form.schedule_type === 'weekly' && (
            <div>
              <label className="text-label mb-1 block">Time</label>
              <input
                type="time"
                className="w-full px-3 py-2 text-sm rounded-lg bg-[rgba(255,255,255,0.06)] border border-[var(--border-glass)] text-white focus:outline-none focus:border-[var(--accent-blue)]"
                value={form.schedule_time}
                onChange={e => update('schedule_time', e.target.value)}
              />
            </div>
          )}

          {/* Priority + Assignee Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-label mb-1 block">Priority</label>
              <select
                className="w-full px-3 py-2 text-sm rounded-lg bg-[rgba(255,255,255,0.06)] border border-[var(--border-glass)] text-white focus:outline-none focus:border-[var(--accent-blue)]"
                value={form.priority}
                onChange={e => update('priority', e.target.value)}
              >
                <option value="NORMAL">Normal</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
            <div>
              <label className="text-label mb-1 block">Assignee</label>
              <select
                className="w-full px-3 py-2 text-sm rounded-lg bg-[rgba(255,255,255,0.06)] border border-[var(--border-glass)] text-white focus:outline-none focus:border-[var(--accent-blue)]"
                value={form.assignee_id}
                onChange={e => update('assignee_id', e.target.value)}
              >
                <option value="">Unassigned</option>
                {agents.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg bg-[rgba(255,255,255,0.08)] text-white hover:bg-[rgba(255,255,255,0.12)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!form.title.trim() || saving}
              className="px-4 py-2 text-sm rounded-lg bg-[var(--accent-blue)] text-white font-medium hover:brightness-110 disabled:opacity-50"
            >
              {saving ? 'Saving...' : isNew ? 'Create' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Cron Job Card ── */
function CronJobCard({ job, onToggle, onEdit, onDelete, onTrigger }) {
  const [expanded, setExpanded] = useState(false)
  const [triggering, setTriggering] = useState(false)

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

  const handleTrigger = async () => {
    setTriggering(true)
    try {
      await onTrigger(job.id)
    } finally {
      setTriggering(false)
    }
  }

  return (
    <div className={`glass-card p-5 mb-3 ${!job.is_active ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-[rgba(139,92,246,0.2)] flex items-center justify-center flex-shrink-0">
          <Calendar size={18} className="text-[var(--accent-purple)]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white">{job.title}</h3>
            {job.priority === 'URGENT' && (
              <span className="badge text-[10px] bg-[rgba(239,68,68,0.15)] text-[var(--accent-red)]">Urgent</span>
            )}
          </div>
          {job.description && (
            <p className="text-xs text-[var(--text-secondary)] line-clamp-1 mt-0.5">{job.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-[var(--text-muted)]">
            <div className="flex items-center gap-1">
              <Clock size={11} />
              <span>{job.schedule_human || `${job.schedule_type} ${job.schedule_value || ''} ${job.schedule_time || ''}`}</span>
            </div>
            <span>&middot;</span>
            <span>Next: {nextRunText}</span>
            {job.run_count > 0 && (
              <>
                <span>&middot;</span>
                <span>{job.run_count} runs</span>
              </>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleTrigger}
            disabled={triggering || !job.is_active}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent-green)] hover:bg-[rgba(34,197,94,0.1)] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[var(--text-muted)]"
            title="Run Now"
          >
            {triggering ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          </button>
          <button
            onClick={() => onEdit(job)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent-blue)] hover:bg-[rgba(59,130,246,0.1)]"
            title="Edit"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => onToggle(job.id)}
            className="text-[var(--text-muted)] hover:text-white"
            title={job.is_active ? 'Pause' : 'Resume'}
          >
            {job.is_active ? <ToggleRight size={24} className="text-[var(--accent-green)]" /> : <ToggleLeft size={24} />}
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[var(--text-muted)] hover:text-white"
          >
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-[var(--border-glass)]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-label">Details</p>
            <button
              onClick={() => { if (confirm(`Delete "${job.title}"?`)) onDelete(job.id) }}
              className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--accent-red)]"
            >
              <Trash2 size={12} />
              Delete
            </button>
          </div>
          {job.description && (
            <p className="text-xs text-[var(--text-secondary)] mb-3">{job.description}</p>
          )}
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-[var(--text-muted)]">Runs</span>
              <p className="text-white font-medium">{job.run_count || 0}</p>
            </div>
            <div>
              <span className="text-[var(--text-muted)]">Last Run</span>
              <p className="text-white font-medium">
                {job.last_run_at ? new Date(job.last_run_at).toLocaleString() : 'Never'}
              </p>
            </div>
            <div>
              <span className="text-[var(--text-muted)]">Created</span>
              <p className="text-white font-medium">
                {job.created_at ? new Date(job.created_at).toLocaleDateString() : '—'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Main Page ── */
export default function CronJobs() {
  const recurringTasks = useMissionStore((s) => s.recurringTasks)
  const agents = useMissionStore((s) => s.agents)
  const toggleRecurringTask = useMissionStore((s) => s.toggleRecurringTask)
  const deleteRecurringTask = useMissionStore((s) => s.deleteRecurringTask)
  const triggerRecurringTask = useMissionStore((s) => s.triggerRecurringTask)
  const createRecurringTask = useMissionStore((s) => s.createRecurringTask)
  const refreshRecurringTasks = useMissionStore((s) => s.refreshRecurringTasks)

  const [syncing, setSyncing] = useState(false)
  const [editingJob, setEditingJob] = useState(null)   // job object or 'new'
  const info = useInfoModal()

  async function doSync() {
    setSyncing(true)
    try {
      await syncOpenClawCrons()
      await refreshRecurringTasks()
    } catch (e) {
      console.error('Cron sync failed:', e)
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    doSync()
  }, [])

  const handleSave = async (formData) => {
    if (editingJob === 'new') {
      await createRecurringTask({
        title: formData.title,
        description: formData.description || null,
        priority: formData.priority,
        scheduleType: formData.schedule_type,
        scheduleValue: formData.schedule_value || null,
        scheduleTime: formData.schedule_time || null,
        assignee_id: formData.assignee_id || null,
      })
      await refreshRecurringTasks()
    } else {
      await updateRecurringTask(editingJob.id, {
        title: formData.title,
        description: formData.description || null,
        priority: formData.priority,
        schedule_type: formData.schedule_type,
        schedule_value: formData.schedule_value || null,
        schedule_time: formData.schedule_time || null,
        assignee_id: formData.assignee_id || null,
      })
      await refreshRecurringTasks()
    }
  }

  const activeCount = recurringTasks.filter(t => t.is_active).length

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-[rgba(139,92,246,0.2)] flex items-center justify-center">
          <Clock size={20} className="text-[var(--accent-purple)]" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">Cron Jobs</h1>
          <p className="text-sm text-[var(--text-muted)]">
            {recurringTasks.length} jobs &middot; {activeCount} active
          </p>
        </div>
        <InfoButton onClick={info.show} />
        <button
          onClick={() => setEditingJob('new')}
          className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-[var(--accent-blue)] text-white font-medium hover:brightness-110"
        >
          <Plus size={14} />
          New Cron Job
        </button>
        <button
          onClick={doSync}
          disabled={syncing}
          className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-[rgba(255,255,255,0.06)] text-[var(--text-secondary)] hover:text-white hover:bg-[rgba(255,255,255,0.1)] disabled:opacity-50"
        >
          {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {syncing ? 'Syncing...' : 'Sync OpenClaw'}
        </button>
      </div>

      {syncing && recurringTasks.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Loader2 size={20} className="animate-spin mx-auto mb-2 text-[var(--accent-purple)]" />
          <p className="text-sm text-[var(--text-muted)]">Syncing cron jobs from OpenClaw agents...</p>
        </div>
      ) : recurringTasks.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Clock size={48} className="mx-auto mb-3 text-[var(--text-muted)] opacity-30" />
          <p className="text-sm text-[var(--text-muted)] mb-3">No cron jobs configured yet</p>
          <button
            onClick={() => setEditingJob('new')}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-[var(--accent-blue)] text-white font-medium hover:brightness-110"
          >
            <Plus size={14} />
            Create Your First Cron Job
          </button>
        </div>
      ) : (
        recurringTasks.map(job => (
          <CronJobCard
            key={job.id}
            job={job}
            onToggle={toggleRecurringTask}
            onEdit={setEditingJob}
            onDelete={deleteRecurringTask}
            onTrigger={triggerRecurringTask}
          />
        ))
      )}

      {/* Edit / Create Modal */}
      {editingJob && (
        <CronEditModal
          job={editingJob === 'new' ? null : editingJob}
          agents={agents}
          onClose={() => setEditingJob(null)}
          onSave={handleSave}
        />
      )}

      <InfoModal
        open={info.open}
        onClose={info.hide}
        title="Cron Jobs"
        icon={<Clock size={18} className="text-[var(--accent-purple)]" />}
      >
        <p>Cron Jobs is your <strong className="text-white">automation scheduler</strong>. Set up recurring tasks that the agent runs automatically — daily standups, competitor monitoring, report generation, health checks.</p>
        <p>Each cron job shows when it <strong className="text-white">last ran</strong> and a <strong className="text-white">countdown to the next run</strong>. Toggle jobs on/off with the switch, and expand to see execution history.</p>
        <p>Click <strong className="text-white">New Cron Job</strong> to create one manually, or use the <strong className="text-white">Sync OpenClaw</strong> button to pull in cron definitions from your remote agents.</p>
        <p>Use the <strong className="text-white">pencil icon</strong> to edit any job's schedule, title, or assignee. The <strong className="text-white">play button</strong> lets you manually trigger a run at any time.</p>
      </InfoModal>
    </div>
  )
}
