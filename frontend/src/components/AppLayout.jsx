import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function AppLayout() {
  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-page)' }}>
      <Sidebar />
      <main className="flex-1 ml-[220px] p-8 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
