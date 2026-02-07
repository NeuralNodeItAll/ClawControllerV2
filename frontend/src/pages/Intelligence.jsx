import { useState, useEffect } from 'react'
import { Brain, ExternalLink, Rocket, Settings, Loader2 } from 'lucide-react'
import { fetchIntelligenceReports, createIntelligenceReport } from '../api'
import { useMissionStore } from '../store/useMissionStore'
import InfoModal, { InfoButton, useInfoModal } from '../components/InfoModal'

export default function Intelligence() {
  const [reports, setReports] = useState([])
  const [selected, setSelected] = useState(null)
  const [showConfig, setShowConfig] = useState(false)
  const [loading, setLoading] = useState(true)
  const info = useInfoModal()

  useEffect(() => {
    fetchIntelligenceReports()
      .then(setReports)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleDeploy = async (report) => {
    try {
      const createTask = useMissionStore.getState().createTask
      await createTask({
        title: report.title,
        description: `Deployed from Intelligence report:\n\n${report.summary || ''}\n\n${report.snapshot || ''}`,
        tags: ['intelligence', 'deployed'],
      })
      alert('Deployed to Workshop!')
    } catch (e) {
      console.error('Deploy failed:', e)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Intelligence</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Twitter/X Scout — Automated opportunity discovery</p>
        </div>
        <div className="flex items-center gap-2">
          <InfoButton onClick={info.show} />
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-[rgba(255,255,255,0.06)] text-[var(--text-secondary)] hover:text-white"
          >
            <Settings size={14} />
            Configure
          </button>
        </div>
      </div>

      {showConfig && (
        <div className="glass-card p-5 mb-6">
          <p className="text-label mb-3">SCOUT CONFIGURATION</p>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs text-[var(--text-secondary)] block mb-1">Business Goals</label>
              <textarea
                placeholder="Describe your business context..."
                className="w-full p-3 text-sm bg-[rgba(255,255,255,0.04)] border border-[var(--border-glass)] rounded-lg text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)] resize-none h-20"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--text-secondary)] block mb-1">Keywords</label>
                <input
                  type="text"
                  placeholder="AI, automation, SaaS..."
                  className="w-full p-2.5 text-sm bg-[rgba(255,255,255,0.04)] border border-[var(--border-glass)] rounded-lg text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--text-secondary)] block mb-1">Scan Frequency</label>
                <select className="w-full p-2.5 text-sm bg-[rgba(255,255,255,0.04)] border border-[var(--border-glass)] rounded-lg text-white focus:outline-none focus:border-[var(--accent-blue)]">
                  <option value="24h">Every 24 hours</option>
                  <option value="12h">Every 12 hours</option>
                  <option value="6h">Every 6 hours</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inbox Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" style={{ minHeight: 400 }}>
        {/* Report List */}
        <div className="md:col-span-1 flex flex-col gap-2">
          {loading ? (
            <div className="glass-card p-8 text-center">
              <Loader2 size={20} className="animate-spin mx-auto mb-2 text-[var(--accent-purple)]" />
              <p className="text-sm text-[var(--text-muted)]">Loading reports...</p>
            </div>
          ) : reports.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <Brain size={32} className="text-[var(--text-muted)] mx-auto mb-3" />
              <p className="text-sm text-[var(--text-muted)]">No intelligence reports yet</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">Configure the scout to start scanning</p>
            </div>
          ) : (
            reports.map(r => (
              <div
                key={r.id}
                className={`glass-card p-4 cursor-pointer transition-colors ${selected?.id === r.id ? 'border border-[var(--accent-blue)]' : 'hover:bg-[rgba(255,255,255,0.03)]'}`}
                onClick={() => setSelected(r)}
              >
                <p className="text-sm font-medium text-white truncate">{r.title}</p>
                <p className="text-xs text-[var(--text-muted)]">{r.source || 'Unknown'} &middot; {new Date(r.created_at).toLocaleDateString()}</p>
                {r.relevance_score > 0 && (
                  <span className="badge bg-[rgba(59,130,246,0.15)] text-[var(--accent-blue)] mt-2">
                    {r.relevance_score}% relevant
                  </span>
                )}
              </div>
            ))
          )}
        </div>

        {/* Detail Panel */}
        <div className="md:col-span-2">
          {selected ? (
            <div className="glass-card p-6">
              <h2 className="text-lg font-bold text-white mb-2">{selected.title}</h2>
              <p className="text-sm text-[var(--text-secondary)] mb-4">{selected.summary}</p>
              {selected.snapshot && (
                <div className="mb-4">
                  <p className="text-label mb-1">SNAPSHOT</p>
                  <p className="text-sm text-[var(--text-secondary)]">{selected.snapshot}</p>
                </div>
              )}
              <div className="flex items-center gap-3">
                {selected.source_url && (
                  <a href={selected.source_url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 text-sm text-[var(--accent-blue)] hover:underline">
                    <ExternalLink size={12} /> Source
                  </a>
                )}
                <button
                  onClick={() => handleDeploy(selected)}
                  className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-[var(--accent-blue)] text-white font-medium hover:brightness-110"
                >
                  <Rocket size={14} />
                  Deploy to Workshop
                </button>
              </div>
            </div>
          ) : (
            <div className="glass-card p-12 text-center flex items-center justify-center" style={{ minHeight: 300 }}>
              <p className="text-sm text-[var(--text-muted)]">Select a report to view details</p>
            </div>
          )}
        </div>
      </div>

      <InfoModal
        open={info.open}
        onClose={info.hide}
        title="Intelligence"
        icon={<Brain size={18} className="text-[var(--accent-purple)]" />}
      >
        <p>Intelligence is your <strong className="text-white">autonomous research feed</strong>. The agent scans Twitter/X on a schedule looking for use cases, tools, strategies, and trends relevant to your business.</p>
        <p>It presents findings in an email-inbox style layout — list of reports on the left, detail view on the right. Each report includes the agent's analysis of how that finding could be applied to your specific situation.</p>
        <p>The killer feature is the <strong className="text-white">"Deploy to Workshop"</strong> button — if you see an intelligence report you like, one click turns it into a queued task that the agent will eventually build.</p>
        <p>Configure it with your <strong className="text-white">business goals and keywords</strong>, and the agent does the scouting.</p>
      </InfoModal>
    </div>
  )
}
