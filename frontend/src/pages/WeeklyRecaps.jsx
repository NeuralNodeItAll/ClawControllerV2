import { CalendarDays, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'

export default function WeeklyRecaps() {
  const [expanded, setExpanded] = useState(null)
  const recaps = [] // Will be populated from backend

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-[rgba(59,130,246,0.2)] flex items-center justify-center">
          <CalendarDays size={20} className="text-[var(--accent-blue)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Weekly Recaps</h1>
          <p className="text-sm text-[var(--text-muted)]">Auto-generated weekly summaries</p>
        </div>
      </div>

      {recaps.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <CalendarDays size={40} className="text-[var(--text-muted)] mx-auto mb-3" />
          <p className="text-sm text-[var(--text-muted)]">No recaps generated yet</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Recaps are auto-generated every Monday</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {recaps.map((r, i) => (
            <div key={i} className="glass-card p-5">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpanded(expanded === i ? null : i)}
              >
                <div>
                  <p className="text-sm font-bold text-white">{r.title}</p>
                  <p className="text-xs text-[var(--text-muted)]">{r.dateRange}</p>
                </div>
                {expanded === i ? <ChevronUp size={16} className="text-[var(--text-muted)]" /> : <ChevronDown size={16} className="text-[var(--text-muted)]" />}
              </div>
              {expanded === i && (
                <div className="mt-4 pt-4 border-t border-[var(--border-glass)] text-sm text-[var(--text-secondary)]">
                  {r.content}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
