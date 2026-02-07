import { X, Info } from 'lucide-react'
import { useState } from 'react'

export function InfoButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-8 h-8 rounded-full bg-[rgba(255,255,255,0.06)] border border-[var(--border-glass)] flex items-center justify-center text-[var(--text-muted)] hover:text-white hover:bg-[rgba(255,255,255,0.1)] transition-colors"
      title="Page info"
    >
      <Info size={15} />
    </button>
  )
}

export default function InfoModal({ open, onClose, title, icon, children }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="glass-card relative w-full max-w-lg max-h-[80vh] overflow-y-auto p-6 z-10 shadow-2xl border border-[var(--border-glass)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {icon}
            <h2 className="text-lg font-bold text-white">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[rgba(255,255,255,0.06)] flex items-center justify-center text-[var(--text-muted)] hover:text-white hover:bg-[rgba(255,255,255,0.1)]"
          >
            <X size={14} />
          </button>
        </div>
        <div className="text-sm text-[var(--text-secondary)] leading-relaxed space-y-3">
          {children}
        </div>
      </div>
    </div>
  )
}

export function useInfoModal() {
  const [open, setOpen] = useState(false)
  return { open, show: () => setOpen(true), hide: () => setOpen(false) }
}
