import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import { isStepFinished, type BatchStep } from '@/lib/db/queries/batches'

interface StepActionBarProps {
  step: BatchStep
  isFirst: boolean
  isLast: boolean
  onPrevious: () => void
  onNext: () => void
  onComplete: () => void
  onReset: () => void
}

/** Barre d'actions : collée en bas sur mobile, sous la carte sur PC. Démarrer / Arrêter sont dans la carte de l'étape. */
export function StepActionBar({ step, isFirst, isLast, onPrevious, onNext, onComplete, onReset }: StepActionBarProps) {
  const finished = isStepFinished(step.status)
  return (
    <div className="sticky bottom-0 z-10 -mx-4 border-t border-slate-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:-mx-6 sm:px-6 lg:mx-0 lg:mb-4 lg:ml-[344px] lg:rounded-3xl lg:border lg:px-4 lg:pb-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrevious}
          disabled={isFirst}
          className="rounded-full border border-slate-200 p-3 text-slate-600 disabled:opacity-30"
          aria-label="Étape précédente"
        >
          <ChevronLeft size={20} />
        </button>

        <div className="flex flex-1 gap-2">
          {!finished && (
            <button type="button" onClick={onComplete} className="btn-primary flex-1 py-3">
              Terminer
            </button>
          )}
          {finished && (
            <button type="button" onClick={onReset} className="btn-secondary flex-1 py-3">
              <RotateCcw size={16} /> {step.status === 'skipped' ? 'Reprendre cette étape' : 'Refaire cette étape'}
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onNext}
          disabled={isLast}
          className="rounded-full border border-slate-200 p-3 text-slate-600 disabled:opacity-30"
          aria-label="Étape suivante"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  )
}
