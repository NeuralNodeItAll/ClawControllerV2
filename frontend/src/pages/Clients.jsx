import { UserCircle, Plus, Settings, Trash2, X } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { fetchClients, createClient, deleteClient as apiDeleteClient } from '../api'
import InfoModal, { InfoButton, useInfoModal } from '../components/InfoModal'

function AddClientModal({ onClose, onCreated }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [context, setContext] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      await createClient({ name: name.trim(), description: description.trim() || null, context: context.trim() || null })
      onCreated()
      onClose()
    } catch (err) {
      console.error('Failed to create client:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="glass-card relative w-full max-w-md p-6 z-10 shadow-2xl border border-[var(--border-glass)]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Add Client</h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-white"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="text-xs text-[var(--text-secondary)] block mb-1">Client Name *</label>
            <input
              value={name} onChange={e => setName(e.target.value)} autoFocus
              className="w-full p-2.5 text-sm bg-[rgba(255,255,255,0.04)] border border-[var(--border-glass)] rounded-lg text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
              placeholder="e.g. Acme Corp"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--text-secondary)] block mb-1">Description</label>
            <input
              value={description} onChange={e => setDescription(e.target.value)}
              className="w-full p-2.5 text-sm bg-[rgba(255,255,255,0.04)] border border-[var(--border-glass)] rounded-lg text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
              placeholder="Brief description"
            />
          </div>
          <div>
            <label className="text-xs text-[var(--text-secondary)] block mb-1">Business Context</label>
            <textarea
              value={context} onChange={e => setContext(e.target.value)}
              className="w-full p-2.5 text-sm bg-[rgba(255,255,255,0.04)] border border-[var(--border-glass)] rounded-lg text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)] resize-none h-20"
              placeholder="Brand voice, goals, history..."
            />
          </div>
          <button
            type="submit" disabled={!name.trim() || saving}
            className="px-4 py-2 text-sm rounded-lg bg-[var(--accent-blue)] text-white font-medium hover:brightness-110 disabled:opacity-50 mt-1"
          >
            {saving ? 'Creating...' : 'Add Client'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function Clients() {
  const [clients, setClients] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const info = useInfoModal()

  const loadClients = useCallback(async () => {
    try {
      const data = await fetchClients()
      setClients(data)
    } catch (e) {
      console.error('Failed to fetch clients:', e)
    }
  }, [])

  useEffect(() => { loadClients() }, [loadClients])

  const handleDelete = async (id) => {
    if (!confirm('Delete this client?')) return
    try {
      await apiDeleteClient(id)
      loadClients()
    } catch (e) {
      console.error('Failed to delete client:', e)
    }
  }

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
        <div className="flex items-center gap-2">
          <InfoButton onClick={info.show} />
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-[var(--accent-blue)] text-white font-medium hover:brightness-110"
          >
            <Plus size={14} />
            Add Client
          </button>
        </div>
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
                <div className="flex items-center gap-2">
                  <span className={`status-dot ${c.is_active ? 'status-dot--green' : ''}`} />
                  <span className="text-sm font-bold text-white">{c.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleDelete(c.id)} className="text-[var(--text-muted)] hover:text-[var(--accent-red)]">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {c.description && <p className="text-xs text-[var(--text-secondary)] mb-1">{c.description}</p>}
              {c.context && <p className="text-xs text-[var(--text-muted)] line-clamp-2">{c.context}</p>}
              <p className="text-[10px] text-[var(--text-muted)] mt-2">Added {new Date(c.created_at).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}

      {showAdd && <AddClientModal onClose={() => setShowAdd(false)} onCreated={loadClients} />}

      <InfoModal
        open={info.open}
        onClose={info.hide}
        title="Clients"
        icon={<UserCircle size={18} className="text-[var(--accent-green)]" />}
      >
        <p>Clients is for managing the <strong className="text-white">people or channels you serve</strong>. Each client lives here with their connected channels, activity history, and client-specific context.</p>
        <p>The agent uses this context when doing work for a particular client, so it knows their <strong className="text-white">brand voice, goals, and history</strong>.</p>
        <p>Use this to see at a glance which clients have recent activity, add new clients, and configure what the agent knows about each one.</p>
      </InfoModal>
    </div>
  )
}
