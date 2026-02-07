import { useState } from 'react'
import { FileText, Upload, Grid, List, Search } from 'lucide-react'

export default function Documents() {
  const [viewMode, setViewMode] = useState('grid')
  const [docs] = useState([])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Documents</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">DocuDigest — Upload, process, and browse documents</p>
      </div>

      {/* Upload Area */}
      <div className="glass-card p-8 mb-6 border-2 border-dashed border-[var(--border-glass)] text-center cursor-pointer hover:border-[var(--accent-blue)] transition-colors">
        <Upload size={32} className="text-[var(--text-muted)] mx-auto mb-3" />
        <p className="text-sm text-white font-medium">Drag & drop PDF files here</p>
        <p className="text-xs text-[var(--text-muted)] mt-1">or click to browse</p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search documents..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-[rgba(255,255,255,0.04)] border border-[var(--border-glass)] rounded-lg text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
            />
          </div>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-lg bg-[rgba(255,255,255,0.04)]">
          <button
            className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-white text-black' : 'text-[var(--text-muted)]'}`}
            onClick={() => setViewMode('grid')}
          >
            <Grid size={14} />
          </button>
          <button
            className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-white text-black' : 'text-[var(--text-muted)]'}`}
            onClick={() => setViewMode('list')}
          >
            <List size={14} />
          </button>
        </div>
      </div>

      {/* Document Library */}
      {docs.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <FileText size={40} className="text-[var(--text-muted)] mx-auto mb-3" />
          <p className="text-sm text-[var(--text-muted)]">No documents yet. Upload a PDF to get started.</p>
        </div>
      ) : (
        <div className={viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 gap-4' : 'flex flex-col gap-3'}>
          {docs.map(doc => (
            <div key={doc.id} className="glass-card p-4">
              <p className="text-sm font-medium text-white truncate">{doc.title}</p>
              <p className="text-xs text-[var(--text-muted)]">{doc.date}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
