import { CalendarDays, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import { fetchRecaps } from '../api'
import InfoModal, { InfoButton, useInfoModal } from '../components/InfoModal'

export default function WeeklyRecaps() {
  const [expanded, setExpanded] = useState(null)
  const [recaps, setRecaps] = useState([])
  const [loading, setLoading] = useState(true)
  const info = useInfoModal()

  useEffect(() => {
    fetchRecaps()
      .then(setRecaps)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-[rgba(59,130,246,0.2)] flex items-center justify-center">
          <CalendarDays size={20} className="text-[var(--accent-blue)]" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">Weekly Recaps</h1>
          <p className="text-sm text-[var(--text-muted)]">Auto-generated weekly summaries</p>
        </div>
        <InfoButton onClick={info.show} />
      </div>

      {loading ? (
        <div className="glass-card p-12 text-center">
          <Loader2 size={24} className="animate-spin mx-auto mb-2 text-[var(--accent-blue)]" />
          <p className="text-sm text-[var(--text-muted)]">Loading recaps...</p>
        </div>
      ) : recaps.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <CalendarDays size={40} className="text-[var(--text-muted)] mx-auto mb-3" />
          <p className="text-sm text-[var(--text-muted)]">No recaps generated yet</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Recaps are auto-generated every Monday</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {recaps.map((r, i) => (
            <div key={r.id} className="glass-card p-5">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpanded(expanded === i ? null : i)}
              >
                <div>
                  <p className="text-sm font-bold text-white">{r.title}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {new Date(r.week_start).toLocaleDateString()} — {new Date(r.week_end).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                    <span>{r.tasks_completed} tasks</span>
                    <span>&middot;</span>
                    <span>{r.commits_count} commits</span>
                    <span>&middot;</span>
                    <span>{r.total_spend}</span>
                  </div>
                  {expanded === i ? <ChevronUp size={16} className="text-[var(--text-muted)]" /> : <ChevronDown size={16} className="text-[var(--text-muted)]" />}
                </div>
              </div>
              {expanded === i && (
                <div className="mt-4 pt-4 border-t border-[var(--border-glass)] text-sm text-[var(--text-secondary)] whitespace-pre-wrap">
                  {r.content || 'No details available.'}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <InfoModal
        open={info.open}
        onClose={info.hide}
        title="Weekly Recaps"
        icon={<CalendarDays size={18} className="text-[var(--accent-blue)]" />}
      >
        <p>Weekly Recaps is your <strong className="text-white">Friday summary</strong>. The agent automatically compiles a weekly report covering everything: tasks completed, commits pushed, documents processed, intelligence gathered, API costs, and agent performance.</p>
        <p>Use this the way a manager uses a weekly standup — to see the <strong className="text-white">big picture</strong> of what got accomplished, whether you're making progress on your goals, and if anything needs attention.</p>
        <p>Past recaps are archived so you can look back and see your <strong className="text-white">trajectory over weeks and months</strong>.</p>
      </InfoModal>
    </div>
  )
}
