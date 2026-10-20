import type { StepGroup } from '@/components/brew-day/stepMeta'

interface PhaseProgressProps {
  group: StepGroup
  activeId: string | null
  onSelect: (stepId: string) => void
}

/** Phase en cours (icône, libellé, position) et une pastille par étape de la phase. */
export function PhaseProgress({ group, activeId, onSelect }: PhaseProgressProps) {
  const position = group.steps.findIndex(({ step }) => step.id === activeId)
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <p className="shrink-0 text-sm font-semibold text-slate-800">
        {group.icon} {group.label}
        <span className="font-normal text-slate-400">
          {' '}
          · {position + 1}/{group.steps.length}
        </span>
      </p>
      <div className="flex flex-1 gap-1">
        {group.steps.map(({ step }) => (
          <button
            key={step.id}
            type="button"
            onClick={() => onSelect(step.id)}
            className={`h-1.5 flex-1 rounded-full ${
              step.id === activeId
                ? 'bg-indigo-500'
                : step.status === 'done'
                  ? 'bg-green-500'
                  : step.status === 'skipped'
                    ? 'bg-slate-400'
                    : 'bg-slate-200'
            }`}
            aria-label={step.label}
          />
        ))}
      </div>
    </div>
  )
}
