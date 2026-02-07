import Header from '../components/Header'
import AgentSidebar from '../components/AgentSidebar'
import KanbanBoard from '../components/KanbanBoard'
import LiveFeed from '../components/LiveFeed'
import InfoModal, { InfoButton, useInfoModal } from '../components/InfoModal'
import { Wrench } from 'lucide-react'

export default function Workshop() {
  const info = useInfoModal()

  return (
    <div>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Task Manager</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Manage agents, tasks, and live activity</p>
        </div>
        <InfoButton onClick={info.show} />
      </div>

      {/* V1 ClawController UI */}
      <Header />
      <main className="main">
        <AgentSidebar />
        <KanbanBoard />
        <div className="right-panel">
          <LiveFeed />
        </div>
      </main>

      <InfoModal
        open={info.open}
        onClose={info.hide}
        title="Task Manager"
        icon={<Wrench size={18} className="text-[var(--accent-blue)]" />}
      >
        <p>Task Manager is the <strong className="text-white">operational command center</strong> — the core of the whole system. This is where all work lives.</p>
        <p>The <strong className="text-white">Agent Sidebar</strong> on the left shows all your agents and their current status. Click an agent to filter the board by their assigned tasks.</p>
        <p>The <strong className="text-white">Kanban Board</strong> in the center organizes tasks into columns: Inbox, Assigned, In Progress, Review, and Done. Drag and drop tasks between columns or use the <strong className="text-white">@mention</strong> system to assign work to specific agents.</p>
        <p>The <strong className="text-white">Live Feed</strong> on the right shows real-time activity — task updates, agent status changes, and system events as they happen.</p>
        <p>Use the <strong className="text-white">New Task</strong> button in the header to create tasks, and <strong className="text-white">Manage Agents</strong> to add or configure your agent team.</p>
      </InfoModal>
    </div>
  )
}
