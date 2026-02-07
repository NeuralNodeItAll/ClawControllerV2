import { useMissionStore } from '../store/useMissionStore'
import { Users, Plus, Crown } from 'lucide-react'
import InfoModal, { InfoButton, useInfoModal } from '../components/InfoModal'

function AgentCard({ agent, isLead }) {
  const statusColor = {
    WORKING: 'var(--accent-orange)',
    IDLE: 'var(--accent-green)',
    STANDBY: 'var(--accent-blue)',
    OFFLINE: 'var(--text-muted)',
  }[agent.status] || 'var(--text-muted)'

  const statusDotClass = {
    WORKING: 'status-dot--orange',
    IDLE: 'status-dot--green',
    STANDBY: 'status-dot--blue',
    OFFLINE: '',
  }[agent.status] || ''

  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 rounded-full bg-[rgba(255,255,255,0.08)] flex items-center justify-center text-2xl">
          {agent.avatar || agent.emoji || '\u{1F916}'}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">{agent.name}</span>
            {isLead && <Crown size={12} className="text-[var(--accent-orange)]" />}
          </div>
          <p className="text-xs text-[var(--text-secondary)]">{agent.roleLabel || agent.role}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`status-dot ${statusDotClass}`} />
          <span className="text-xs" style={{ color: statusColor }}>{agent.status}</span>
        </div>
      </div>
      {agent.description && (
        <p className="text-xs text-[var(--text-secondary)] line-clamp-2">{agent.description}</p>
      )}
    </div>
  )
}

export default function Agents() {
  const agents = useMissionStore((s) => s.agents)
  const openAgentManagement = useMissionStore((s) => s.openAgentManagement)
  const lead = agents.find(a => a.roleLabel === 'Lead' || a.role === 'LEAD')
  const subAgents = agents.filter(a => a !== lead)
  const info = useInfoModal()

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[rgba(59,130,246,0.2)] flex items-center justify-center">
            <Users size={20} className="text-[var(--accent-blue)]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Agents</h1>
            <p className="text-sm text-[var(--text-muted)]">Agent roster & management</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <InfoButton onClick={info.show} />
          <button
            onClick={openAgentManagement}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-[var(--accent-blue)] text-white font-medium hover:brightness-110"
          >
            <Plus size={14} />
            Create Agent
          </button>
        </div>
      </div>

      {/* Commander */}
      {lead && (
        <div className="mb-6">
          <p className="text-label mb-3">COMMANDER</p>
          <AgentCard agent={lead} isLead />
        </div>
      )}

      {/* Sub-agents */}
      <div>
        <p className="text-label mb-3">SUB-AGENTS</p>
        {subAgents.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <p className="text-sm text-[var(--text-muted)]">No sub-agents configured</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subAgents.map(a => (
              <AgentCard key={a.id} agent={a} />
            ))}
          </div>
        )}
      </div>

      <InfoModal
        open={info.open}
        onClose={info.hide}
        title="Agents"
        icon={<Users size={18} className="text-[var(--accent-blue)]" />}
      >
        <p>Agents is your <strong className="text-white">team roster</strong>. Your main agent is the Commander, and below it you see sub-agents with different specializations.</p>
        <p>Use this page to see who's doing what, <strong className="text-white">create new sub-agents</strong> by describing what you need in plain English ("I need an agent that monitors competitor pricing and alerts me to changes"), and edit each agent's personality and behavior via their SOUL.md file.</p>
        <p>Think of it like your <strong className="text-white">org chart for AI employees</strong>. Each agent has its own role, status, and capabilities.</p>
        <p>Click "Create Agent" to add a new specialized sub-agent to your team.</p>
      </InfoModal>
    </div>
  )
}
