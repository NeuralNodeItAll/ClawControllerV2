import { UserCircle, Plus, Settings } from 'lucide-react'
import { useState } from 'react'

export default function Clients() {
  const [clients] = useState([])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[rgba(34,197,94,0.2)] flex items-center justify-center">
            <UserCircle size={20} className="text-[var(--accent-green)]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Clients</h1>
            <p className="text-sm text-[var(--text-muted)]">Connected channels & client management</p>
          </div>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-[var(--accent-blue)] text-white font-medium hover:brightness-110">
          <Plus size={14} />
          Add Client
        </button>
      </div>

      {clients.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <UserCircle size={40} className="text-[var(--text-muted)] mx-auto mb-3" />
          <p className="text-sm text-[var(--text-muted)]">No clients connected yet</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Add a client to start tracking activity</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {clients.map(c => (
            <div key={c.id} className="glass-card p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-white">{c.name}</span>
                <Settings size={14} className="text-[var(--text-muted)]" />
              </div>
              <p className="text-xs text-[var(--text-secondary)]">{c.activity}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
