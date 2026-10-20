import { ChevronRight, Flame, TriangleAlert } from 'lucide-react'
import { boilElapsedSeconds } from '@/components/brew-day/stepMeta'
import { formatDuration } from '@/hooks/useBrewTimer'
import type { BatchStep } from '@/lib/db/queries/batches'

interface BrewDayBannersProps {
  /** Ajouts à faire maintenant, toutes sessions confondues. */
  dueSteps: BatchStep[]
  /** Minuteurs principaux (empâtage, ébullition) en cours ailleurs que sur l'étape affichée. */
  runningBoils: BatchStep[]
  brewSessions: number
  now: number
  error: string | null
  onGoToStep: (step: BatchStep) => void
}

/** Bandeaux : ajouts à faire maintenant, ébullitions en cours ailleurs, erreur d'écriture. */
export function BrewDayBanners({ dueSteps, runningBoils, brewSessions, now, error, onGoToStep }: BrewDayBannersProps) {
  return (
    <div className="space-y-2 pt-3">
      {dueSteps.map((step) => (
        <button
          key={step.id}
          type="button"
          onClick={() => onGoToStep(step)}
          className="flex w-full animate-pulse items-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-left font-semibold text-white"
        >
          <TriangleAlert size={20} className="shrink-0" />
          <span className="flex-1">
            Maintenant{step.session != null && brewSessions > 1 ? ` (session ${step.session})` : ''} : {step.label}
          </span>
          <ChevronRight size={18} />
        </button>
      ))}
      {runningBoils.map((boil) => {
        // Minuteur principal de la phase (empâtage ou ébullition), gardé à l'écran pendant ses sous-étapes.
        const remainingSec = (boil.plannedDurationMin ?? 0) * 60 - boilElapsedSeconds(boil, now)
        return (
          <button
            key={boil.id}
            type="button"
            onClick={() => onGoToStep(boil)}
            className="flex w-full items-center gap-2 rounded-2xl bg-orange-100 px-4 py-2.5 text-left text-sm font-medium text-orange-900"
          >
            <Flame size={18} className="shrink-0 text-orange-500" />
            <span className="flex-1">{boil.stepType === 'mash' ? 'Empâtage' : 'Ébullition'}{boil.session != null && brewSessions > 1 ? ` · session ${boil.session}` : ''}</span>
            <span className="font-mono font-bold tabular-nums">
              {remainingSec < 0 ? '+' : ''}
              {formatDuration(Math.abs(remainingSec))}
            </span>
          </button>
        )
      })}
      {error && <p className="rounded-2xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
    </div>
  )
}
