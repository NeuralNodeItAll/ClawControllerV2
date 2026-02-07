import { useState } from 'react'
import { Brain, ExternalLink, Rocket, Settings } from 'lucide-react'

const sampleReports = []

export default function Intelligence() {
  const [selected, setSelected] = useState(null)
  const [showConfig, setShowConfig] = useState(false)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Intelligence</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Twitter/X Scout — Automated opportunity discovery</p>
        </div>
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-[rgba(255,255,255,0.06)] text-[var(--text-secondary)] hover:text-white"
        >
          <Settings size={14} />
          Configure
        </button>
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
          {sampleReports.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <Brain size={32} className="text-[var(--text-muted)] mx-auto mb-3" />
              <p className="text-sm text-[var(--text-muted)]">No intelligence reports yet</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">Configure the scout to start scanning</p>
            </div>
          ) : (
            sampleReports.map(r => (
              <div
                key={r.id}
                className={`glass-card p-4 cursor-pointer ${selected?.id === r.id ? 'border-[var(--accent-blue)]' : ''}`}
                onClick={() => setSelected(r)}
              >
                <p className="text-sm font-medium text-white truncate">{r.title}</p>
                <p className="text-xs text-[var(--text-muted)]">{r.source} &middot; {r.date}</p>
                <span className="badge bg-[rgba(59,130,246,0.15)] text-[var(--accent-blue)] mt-2">
                  {r.relevance}% relevant
                </span>
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
              <div className="mb-4">
                <p className="text-label mb-1">SNAPSHOT</p>
                <p className="text-sm text-[var(--text-secondary)]">{selected.snapshot}</p>
              </div>
              <div className="flex items-center gap-3">
                <a href={selected.url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 text-sm text-[var(--accent-blue)] hover:underline">
                  <ExternalLink size={12} /> Source
                </a>
                <button className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-[var(--accent-blue)] text-white font-medium hover:brightness-110">
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
    </div>
  )
}
