import type { ReactNode } from 'react'
import { X } from 'lucide-react'

interface OverviewSheetProps {
  onClose: () => void
  children: ReactNode
}

/** Vue d'ensemble des étapes en panneau coulissant — mobile. */
export function OverviewSheet({ onClose, children }: OverviewSheetProps) {
  return (
    <div className="fixed inset-0 z-40 lg:hidden" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/50" />
      <div
        className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="font-bold text-slate-900">Toutes les étapes</p>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-slate-400" aria-label="Fermer">
            <X size={22} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
