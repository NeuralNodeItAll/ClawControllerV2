import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TaskModal from './TaskModal'
import AnnouncementModal from './AnnouncementModal'
import NewTaskModal from './NewTaskModal'
import RecurringTasksPanel from './RecurringTasksPanel'
import AgentManagement from './AgentManagement'
import ChatWidget from './ChatWidget'

export default function AppLayout() {
  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-page)' }}>
      <Sidebar />
      <main className="flex-1 ml-[220px] p-8 overflow-y-auto">
        <Outlet />
      </main>

      {/* Global modals and widgets — available on every page */}
      <TaskModal />
      <AnnouncementModal />
      <NewTaskModal />
      <RecurringTasksPanel />
      <AgentManagement />
      <ChatWidget />
    </div>
  )
}
