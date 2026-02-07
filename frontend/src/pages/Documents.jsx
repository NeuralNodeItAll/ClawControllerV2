import { useState, useEffect, useCallback } from 'react'
import { FileText, Upload, Grid, List, Search, Loader2, Trash2, Eye, X, CheckCircle, AlertCircle } from 'lucide-react'
import { fetchDocuments, uploadDocument, deleteDocument, searchDocuments } from '../api'
import InfoModal, { InfoButton, useInfoModal } from '../components/InfoModal'

function DocumentPreviewModal({ doc, onClose }) {
  if (!doc) return null
  return (
    <div className="glass-modal-overlay" onClick={onClose}>
      <div className="glass-modal p-6" style={{ maxWidth: 700, maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <FileText size={20} className="text-[var(--accent-blue)] flex-shrink-0" />
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-white truncate">{doc.title}</h2>
              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <span>{doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : 'Unknown size'}</span>
                <span>&middot;</span>
                <span className={doc.status === 'ready' ? 'text-[var(--accent-green)]' : 'text-[var(--accent-orange)]'}>
                  {doc.status}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-white flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        {doc.tags && doc.tags.length > 0 && (
          <div className="flex gap-1.5 mb-4 flex-wrap">
            {doc.tags.map((tag, i) => (
              <span key={i} className="badge bg-[rgba(59,130,246,0.15)] text-[var(--accent-blue)] text-[10px]">{tag}</span>
            ))}
          </div>
        )}

        <div
          className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap overflow-y-auto leading-relaxed"
          style={{ maxHeight: 'calc(80vh - 180px)' }}
        >
          {doc.content_text || 'No extracted text available.'}
        </div>
      </div>
    </div>
  )
}

export default function Documents() {
  const [viewMode, setViewMode] = useState('grid')
  const [docs, setDocs] = useState([])
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [previewDoc, setPreviewDoc] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const info = useInfoModal()

  const loadDocs = useCallback(async () => {
    try {
      const data = await fetchDocuments()
      setDocs(data)
    } catch (e) {
      console.error('Failed to fetch documents:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadDocs() }, [loadDocs])

  const handleUpload = async (files) => {
    if (!files?.length) return
    setUploading(true)
    setUploadError(null)

    for (const file of files) {
      try {
        const ext = file.name.split('.').pop()?.toLowerCase() || ''
        await uploadDocument(file, [ext])
      } catch (err) {
        setUploadError(err.message || 'Upload failed')
        console.error('Upload failed:', err)
      }
    }

    await loadDocs()
    setUploading(false)
  }

  const handleFileInput = (e) => {
    handleUpload(Array.from(e.target.files || []))
    e.target.value = '' // reset so same file can be re-uploaded
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    handleUpload(Array.from(e.dataTransfer.files || []))
  }

  const handleDelete = async (docId, docTitle) => {
    if (!confirm(`Delete "${docTitle}"?`)) return
    try {
      await deleteDocument(docId)
      setDocs(prev => prev.filter(d => d.id !== docId))
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  const handlePreview = async (doc) => {
    // If we already have content_text from the list, use it; otherwise fetch full doc
    if (doc.content_text) {
      setPreviewDoc(doc)
    } else {
      try {
        const { fetchDocument } = await import('../api')
        const full = await fetchDocument(doc.id)
        setPreviewDoc(full)
      } catch (e) {
        console.error('Failed to load document:', e)
      }
    }
  }

  // Debounced search
  useEffect(() => {
    if (!search || search.length < 2) {
      setSearchResults(null)
      return
    }
    const timer = setTimeout(async () => {
      try {
        const result = await searchDocuments(search)
        setSearchResults(result)
      } catch (e) {
        setSearchResults(null)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const displayDocs = searchResults ? searchResults.results : (
    search ? docs.filter(d => d.title.toLowerCase().includes(search.toLowerCase())) : docs
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Documents</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Upload, process, and browse documents</p>
        </div>
        <InfoButton onClick={info.show} />
      </div>

      {/* Upload Area */}
      <label
        className={`glass-card p-8 mb-6 border-2 border-dashed text-center cursor-pointer transition-colors block ${
          dragOver
            ? 'border-[var(--accent-blue)] bg-[rgba(59,130,246,0.05)]'
            : 'border-[var(--border-glass)] hover:border-[var(--accent-blue)]'
        }`}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
      >
        {uploading ? (
          <>
            <Loader2 size={32} className="text-[var(--accent-blue)] mx-auto mb-3 animate-spin" />
            <p className="text-sm text-white font-medium">Processing file...</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Extracting text content</p>
          </>
        ) : (
          <>
            <Upload size={32} className="text-[var(--text-muted)] mx-auto mb-3" />
            <p className="text-sm text-white font-medium">Drag & drop files here</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              PDF, TXT, MD, CSV, JSON, HTML &middot; Max 50MB
            </p>
          </>
        )}
        <input
          type="file"
          accept=".pdf,.txt,.md,.csv,.json,.html,.doc,.docx"
          multiple
          className="hidden"
          onChange={handleFileInput}
          disabled={uploading}
        />
      </label>

      {/* Upload Error */}
      {uploadError && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)]">
          <AlertCircle size={16} className="text-[var(--accent-red)] flex-shrink-0" />
          <span className="text-sm text-[var(--accent-red)]">{uploadError}</span>
          <button onClick={() => setUploadError(null)} className="ml-auto text-[var(--text-muted)] hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search documents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-[rgba(255,255,255,0.04)] border border-[var(--border-glass)] rounded-lg text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)]">
            {searchResults ? `${searchResults.count} result${searchResults.count !== 1 ? 's' : ''}` : `${docs.length} doc${docs.length !== 1 ? 's' : ''}`}
          </span>
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
      </div>

      {/* Document Library */}
      {loading ? (
        <div className="glass-card p-12 text-center">
          <Loader2 size={24} className="animate-spin mx-auto mb-2 text-[var(--accent-blue)]" />
          <p className="text-sm text-[var(--text-muted)]">Loading documents...</p>
        </div>
      ) : displayDocs.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <FileText size={40} className="text-[var(--text-muted)] mx-auto mb-3" />
          <p className="text-sm text-[var(--text-muted)]">
            {search ? 'No documents match your search.' : 'No documents yet. Upload a file to get started.'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {displayDocs.map(doc => (
            <div key={doc.id} className="glass-card p-4 group">
              <div className="flex items-center gap-2 mb-2">
                <FileText size={16} className="text-[var(--accent-blue)] flex-shrink-0" />
                <p className="text-sm font-medium text-white truncate flex-1">{doc.title}</p>
                {/* Action buttons */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handlePreview(doc)}
                    className="w-6 h-6 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent-blue)] hover:bg-[rgba(59,130,246,0.1)]"
                    title="Preview"
                  >
                    <Eye size={12} />
                  </button>
                  <button
                    onClick={() => handleDelete(doc.id, doc.title)}
                    className="w-6 h-6 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent-red)] hover:bg-[rgba(239,68,68,0.1)]"
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              {doc.summary && <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mb-2">{doc.summary}</p>}
              {/* Search excerpt */}
              {doc.excerpt && (
                <p className="text-xs text-[var(--text-secondary)] line-clamp-3 mb-2 italic">{doc.excerpt}</p>
              )}
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {(doc.tags || []).slice(0, 2).map((tag, i) => (
                    <span key={i} className="badge bg-[rgba(59,130,246,0.15)] text-[var(--accent-blue)] text-[10px]">{tag}</span>
                  ))}
                </div>
                <span className={`text-[10px] font-medium flex items-center gap-1 ${doc.status === 'ready' ? 'text-[var(--accent-green)]' : doc.status === 'error' ? 'text-[var(--accent-red)]' : 'text-[var(--accent-orange)]'}`}>
                  {doc.status === 'ready' && <CheckCircle size={10} />}
                  {doc.status === 'error' && <AlertCircle size={10} />}
                  {doc.status}
                </span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-[10px] text-[var(--text-muted)]">{new Date(doc.created_at).toLocaleDateString()}</p>
                {doc.file_size > 0 && (
                  <p className="text-[10px] text-[var(--text-muted)]">{(doc.file_size / 1024).toFixed(1)} KB</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {displayDocs.map(doc => (
            <div key={doc.id} className="glass-card p-4 flex items-center gap-3 group">
              <FileText size={16} className="text-[var(--accent-blue)] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{doc.title}</p>
                {doc.excerpt ? (
                  <p className="text-xs text-[var(--text-secondary)] truncate italic">{doc.excerpt}</p>
                ) : doc.summary ? (
                  <p className="text-xs text-[var(--text-secondary)] truncate">{doc.summary}</p>
                ) : null}
              </div>
              {doc.file_size > 0 && (
                <span className="text-xs text-[var(--text-muted)]">{(doc.file_size / 1024).toFixed(1)} KB</span>
              )}
              <span className={`text-xs flex items-center gap-1 ${doc.status === 'ready' ? 'text-[var(--accent-green)]' : doc.status === 'error' ? 'text-[var(--accent-red)]' : 'text-[var(--accent-orange)]'}`}>
                {doc.status === 'ready' && <CheckCircle size={10} />}
                {doc.status}
              </span>
              <span className="text-xs text-[var(--text-muted)]">{new Date(doc.created_at).toLocaleDateString()}</span>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handlePreview(doc)}
                  className="w-7 h-7 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent-blue)] hover:bg-[rgba(59,130,246,0.1)]"
                  title="Preview"
                >
                  <Eye size={14} />
                </button>
                <button
                  onClick={() => handleDelete(doc.id, doc.title)}
                  className="w-7 h-7 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent-red)] hover:bg-[rgba(239,68,68,0.1)]"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {previewDoc && (
        <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
      )}

      <InfoModal
        open={info.open}
        onClose={info.hide}
        title="Documents"
        icon={<FileText size={18} className="text-[var(--accent-blue)]" />}
      >
        <p>Documents is your <strong className="text-white">document library</strong>. Upload PDFs, text files, markdown, and more — the system extracts the text content and stores it for your agents to reference.</p>
        <p>When your agent is working on a task, it can <strong className="text-white">query any document by ID</strong> through the ClawController API to pull in the full text as context. This works from Slack, cron jobs, or any trigger.</p>
        <p>Use the <strong className="text-white">search bar</strong> to search across all extracted text — it finds matching documents and shows excerpts around the match.</p>
        <p>Click the <strong className="text-white">eye icon</strong> on any document to preview the extracted text and verify it was processed correctly.</p>
      </InfoModal>
    </div>
  )
}
