import { Check, SkipForward } from 'lucide-react'
import { formatDuration } from '@/hooks/useBrewTimer'
import { isStepFinished, type BatchStep } from '@/lib/db/queries/batches'
import { STEP_ICONS, type BoilTiming, type StepGroup } from './stepMeta'

/** Vue d'ensemble du brassage : phases → étapes, avec état et avancement des checklists. */
export function StepOverview({
  groups,
  activeIndex,
  timingOf,
  checklistTotals,
  onSelect,
}: {
  groups: StepGroup[]
  activeIndex: number | null
  /** Moment de l'ajout par rapport à l'ébullition de la session de l'étape. */
  timingOf: (step: BatchStep) => BoilTiming
  /** Avancement de la checklist de chaque étape, par id d'étape. */
  checklistTotals: Map<string, { done: number; total: number }>
  onSelect: (index: number) => void
}) {
  return (
    <ol className="space-y-5">
      {groups.map((group, groupIndex) => {
        const doneCount = group.steps.filter(({ step }) => isStepFinished(step.status)).length
        return (
          <li key={group.key}>
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {groupIndex + 1} · {group.label}
              </p>
              {/* Une phase d'une seule étape : son propre état suffit. */}
              {group.steps.length > 1 && (
                <span className="text-xs text-slate-400">
                  {doneCount} / {group.steps.length} étapes
                </span>
              )}
            </div>
            <ul className="space-y-1">
              {group.steps.map(({ step, index }) => {
                const {
                  timing: { isDue, triggerAtSeconds },
                  boilStarted,
                  boilElapsedSeconds,
                } = timingOf(step)
                const active = index === activeIndex
                const progress = checklistTotals.get(step.id)
                return (
                  <li key={step.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(index)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                        active
                          ? 'bg-indigo-50 ring-2 ring-indigo-400'
                          : isDue
                            ? 'bg-red-50 ring-2 ring-red-400'
                            : 'hover:bg-slate-100'
                      }`}
                    >
                      <StatusDot status={step.status} icon={STEP_ICONS[step.stepType]} />
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block ${isStepFinished(step.status) ? 'text-slate-400 line-through decoration-slate-300' : 'text-slate-800'}`}
                        >
                          {step.label}
                        </span>
                        {triggerAtSeconds !== null && step.status === 'todo' && (
                          <span className={`block text-xs ${isDue ? 'font-semibold text-red-600' : 'text-slate-500'}`}>
                            {!boilStarted
                              ? `à ${step.triggerTimeMin} min de la fin`
                              : isDue
                                ? 'maintenant !'
                                : `dans ${formatDuration(triggerAtSeconds - boilElapsedSeconds)}`}
                          </span>
                        )}
                      </span>
                      {progress && progress.total > 0 && !isStepFinished(step.status) && (
                        <ChecklistDots done={progress.done} total={progress.total} />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </li>
        )
      })}
    </ol>
  )
}

/** Avancement de la checklist de l'étape : un point par case, plein quand elle est cochée. */
function ChecklistDots({ done, total }: { done: number; total: number }) {
  const label = `${done} case${done > 1 ? 's' : ''} cochée${done > 1 ? 's' : ''} sur ${total}`
  return (
    <span className="flex shrink-0 gap-1" role="img" aria-label={label} title={label}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`h-1.5 w-1.5 rounded-full ${i < done ? 'bg-green-500' : 'bg-slate-300'}`} />
      ))}
    </span>
  )
}

function StatusDot({ status, icon }: { status: BatchStep['status']; icon: string }) {
  if (status === 'skipped') {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500">
        <SkipForward size={14} />
      </span>
    )
  }
  if (status === 'done') {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-500 text-white">
        <Check size={16} strokeWidth={3} />
      </span>
    )
  }
  return (
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm ${
        status === 'in-progress' ? 'bg-indigo-500 ring-4 ring-indigo-100' : 'bg-slate-100'
      }`}
    >
      {icon}
    </span>
  )
}
