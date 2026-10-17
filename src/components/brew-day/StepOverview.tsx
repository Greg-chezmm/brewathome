import { Check, SkipForward } from 'lucide-react'
import { isStepFinished, type BatchStep } from '@/lib/db/queries/batches'
import { additionTiming, STEP_ICONS, type StepGroup } from './stepMeta'

/** Vue d'ensemble du brassage : phases → étapes, avec état et avancement des checklists. */
export function StepOverview({
  groups,
  activeIndex,
  boilStep,
  boilElapsedSeconds,
  checklistTotals,
  onSelect,
}: {
  groups: StepGroup[]
  activeIndex: number | null
  boilStep: BatchStep | undefined
  boilElapsedSeconds: number
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
              <span className="text-xs text-slate-400">
                {doneCount}/{group.steps.length}
              </span>
            </div>
            <ul className="space-y-1">
              {group.steps.map(({ step, index }) => {
                const { isDue } = additionTiming(step, boilStep, boilElapsedSeconds)
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
                      <span
                        className={`min-w-0 flex-1 ${isStepFinished(step.status) ? 'text-slate-400 line-through decoration-slate-300' : 'text-slate-800'}`}
                      >
                        {step.label}
                      </span>
                      {progress && progress.total > 0 && !isStepFinished(step.status) && (
                        <span className="shrink-0 text-xs tabular-nums text-slate-400">
                          {progress.done}/{progress.total}
                        </span>
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
