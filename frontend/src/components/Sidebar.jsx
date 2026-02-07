import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, BookOpen, FileText, Users, Brain,
  CalendarDays, UserCircle, Clock, BarChart3, Wrench, Archive
} from 'lucide-react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/journal', icon: BookOpen, label: 'Journal' },
  { to: '/documents', icon: FileText, label: 'Documents' },
  { to: '/agents', icon: Users, label: 'Agents' },
  { to: '/intelligence', icon: Brain, label: 'Intelligence' },
  { to: '/weekly-recaps', icon: CalendarDays, label: 'Weekly Recaps' },
  { to: '/clients', icon: UserCircle, label: 'Clients' },
  { to: '/cron-jobs', icon: Clock, label: 'Cron Jobs' },
  { to: '/api-usage', icon: BarChart3, label: 'API Usage' },
]

const secondaryItems = [
  { to: '/workshop', icon: Wrench, label: 'Workshop' },
]

export default function Sidebar() {
  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-[rgba(59,130,246,0.15)] text-white border-l-2 border-[var(--accent-blue)]'
        : 'text-[var(--text-secondary)] hover:text-white hover:bg-[rgba(255,255,255,0.05)]'
    }`

  return (
    <aside
      className="fixed left-0 top-0 h-screen flex flex-col"
      style={{
        width: 220,
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-glass)',
        zIndex: 50,
      }}
    >
      {/* Header */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-full bg-[rgba(59,130,246,0.2)] flex items-center justify-center text-base">
            🎯
          </div>
          <span className="text-white font-bold text-[15px]">Mission Control</span>
        </div>
        <div className="flex items-center gap-2 ml-11">
          <span className="status-dot status-dot--green status-dot--pulse" />
          <span className="text-xs text-[var(--text-secondary)]">Online</span>
          <span className="text-xs text-[var(--text-muted)] ml-1">14:39</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 mt-1">
        <p className="text-label px-4 mb-2">NAVIGATION</p>
        <div className="flex flex-col gap-0.5">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} className={linkClass} end={to === '/'}>
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-0.5">
          {secondaryItems.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} className={linkClass}>
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </div>

        <div className="mt-6">
          <p className="text-label px-4 mb-2">RECENT PROCESSING</p>
          <p className="px-4 text-xs text-[var(--text-muted)]">No recent items</p>
        </div>

        <div className="mt-4 flex flex-col gap-0.5">
          <NavLink to="/index" className={linkClass}>
            <Archive size={18} />
            Index
          </NavLink>
        </div>
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-[var(--border-glass)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[rgba(139,92,246,0.2)] flex items-center justify-center text-base">
            🤖
          </div>
          <div>
            <div className="text-sm font-bold text-white">Jarvis</div>
            <div className="text-xs text-[var(--text-muted)]">Pro Plan</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
