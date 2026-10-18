import { useState } from 'react'
import { Check, ChevronDown, Lightbulb, Play, Square, StickyNote } from 'lucide-react'
import { firstMashTempC } from '@/lib/brew-day/steps'
import { GravityCorrectionTool } from '@/components/brew-day/GravityCorrectionTool'
import { StrikeWaterTool } from '@/components/brew-day/StrikeWaterTool'
import { formatDuration, formatDurationLong } from '@/hooks/useBrewTimer'
import type { StepGuide } from '@/lib/brew-day/checklist'
import type { BatchStep } from '@/lib/db/queries/batches'
import type { RecipeDetails } from '@/lib/db/queries/recipes'
import { STEP_ICONS, type AdditionTiming } from './stepMeta'

/** Carte de l'étape en cours : minuteur, checklist à cocher, outils et conseils. */
export function StepCard({
  step,
  guide,
  timing,
  now,
  boilStarted,
  boilElapsedSeconds,
  recipe,
  totalGrainKg,
  mashWaterL,
  onToggleItem,
  onSaveNotes,
  onStart,
  onStop,
  measurement,
}: {
  step: BatchStep
  guide: StepGuide
  timing: AdditionTiming
  now: number
  boilStarted: boolean
  boilElapsedSeconds: number
  recipe: RecipeDetails
  totalGrainKg: number
  mashWaterL: number | undefined
  onToggleItem: (itemId: string) => void
  /** Enregistre les notes libres de l'étape (à la perte du focus). */
  onSaveNotes: (notes: string) => void
  onStart: () => void
  onStop: () => void
  /** Densité à relever à cette étape (pré-ébullition, fin d'ébullition, DI), comparée à la recette. */
  measurement?: React.ReactNode
}) {
  const { triggerAtSeconds, isDue } = timing

  return (
    <div className="space-y-4">
      <div
        className={`rounded-3xl border-2 p-5 shadow-sm transition-colors ${
          step.status === 'done' || step.status === 'skipped'
            ? 'border-slate-200 bg-slate-50'
            : isDue
              ? 'border-red-400 bg-red-50'
              : step.status === 'in-progress'
                ? 'border-indigo-400 bg-white'
                : 'border-slate-200 bg-white'
        }`}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-2xl">
            {STEP_ICONS[step.stepType]}
          </span>
          <div className="min-w-0 pt-1">
            <h2 className="text-lg font-bold leading-snug text-slate-900">{step.label}</h2>
            {(guide.optional || step.status === 'skipped') && (
              <p className="mt-1 flex gap-1.5">
                {guide.optional && <span className="badge">Facultatif</span>}
                {step.status === 'skipped' && <span className="badge bg-slate-200 text-slate-600">Étape passée</span>}
              </p>
            )}
          </div>
        </div>

        <StepTimer step={step} now={now} onStart={onStart} onStop={onStop} />
        <StepProgressBar step={step} now={now} timing={timing} boilElapsedSeconds={boilElapsedSeconds} />

        {triggerAtSeconds !== null && step.status === 'todo' && (
          <p className={`mt-3 ${isDue ? 'text-2xl font-bold text-red-700' : 'text-sm text-slate-500'}`}>
            {!boilStarted
              ? `À ${step.triggerTimeMin} min de la fin de l'ébullition`
              : isDue
                ? step.stepType === 'chiller-sanitize'
                  ? '⚠ À faire maintenant !'
                  : '⚠ À ajouter maintenant !'
                : `Dans ${formatDuration(triggerAtSeconds - boilElapsedSeconds)}`}
          </p>
        )}

        {guide.checklist.length > 0 && (
          <ul className="mt-5 divide-y divide-slate-100 border-t border-slate-100">
            {guide.checklist.map((item) => {
              const checked = step.checkedItems.includes(item.id)
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onToggleItem(item.id)}
                    className="flex w-full items-start gap-3 py-3 text-left"
                  >
                    <span
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition-colors ${
                        checked ? 'border-green-500 bg-green-500 text-white' : 'border-slate-300 bg-white'
                      }`}
                    >
                      {checked && <Check size={16} strokeWidth={3} />}
                    </span>
                    <span className={checked ? 'text-slate-400 line-through decoration-slate-300' : 'text-slate-800'}>
                      {item.label}
                      {item.optional && <span className="ml-1.5 text-xs font-medium text-slate-400">facultatif</span>}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <NotesField step={step} onSave={onSaveNotes} />
      </div>

      {measurement}
      {guide.tips.length > 0 && (
        <div className="flex gap-3 rounded-3xl bg-amber-50 p-4 text-sm text-amber-900">
          <Lightbulb size={20} className="mt-0.5 shrink-0 text-amber-500" />
          <div className="space-y-2">
            {guide.tips.map((tip) => (
              <p key={tip}>{tip}</p>
            ))}
          </div>
        </div>
      )}

      {step.stepType === 'strike-water' && (
        <ToolPanel title="Calculer la température de l'eau">
          <StrikeWaterTool
            defaultTargetTempC={firstMashTempC(recipe)}
            defaultGrainWeightKg={totalGrainKg}
            defaultWaterVolumeL={mashWaterL}
            embedded
          />
        </ToolPanel>
      )}

      {(step.stepType === 'heat-to-boil' || step.stepType === 'cooling') && (
        <ToolPanel title="Corriger la densité">
          <GravityCorrectionTool targetGravity={recipe.estOg ?? undefined} />
        </ToolPanel>
      )}
    </div>
  )
}

/** Notes libres de l'étape : saisie locale, enregistrée à la perte du focus (le composant est remonté à chaque étape). */
function NotesField({ step, onSave }: { step: BatchStep; onSave: (notes: string) => void }) {
  const [value, setValue] = useState(step.notes ?? '')
  return (
    <div className="mt-5 border-t border-slate-100 pt-4">
      <label htmlFor={`notes-${step.id}`} className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-600">
        <StickyNote size={16} className="text-slate-400" /> Notes de l'étape
      </label>
      <textarea
        id={`notes-${step.id}`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => onSave(value)}
        rows={2}
        placeholder="Observations, écarts, idées pour la prochaine fois…"
        className="field-input w-full resize-y"
      />
    </div>
  )
}

function ToolPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-3xl border border-slate-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 font-semibold text-slate-700">
        {title}
        <ChevronDown size={18} className="text-slate-400 transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-5 pb-5">{children}</div>
    </details>
  )
}

/** Minuteur de l'étape, avec ses boutons Démarrer / Arrêter à portée de main. */
function StepTimer({ step, now, onStart, onStop }: { step: BatchStep; now: number; onStart: () => void; onStop: () => void }) {
  const fmt = step.stepType === 'dry-hop-addition' ? formatDurationLong : formatDuration

  if (step.status === 'done') {
    if (!step.actualStartAt || !step.actualEndAt) return null
    const totalSec = Math.max(
      0,
      Math.round((new Date(step.actualEndAt).getTime() - new Date(step.actualStartAt).getTime()) / 1000),
    )
    return <p className="mt-3 text-sm text-slate-400">Durée réelle : {fmt(totalSec)}</p>
  }

  if (step.status === 'todo') {
    return (
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {step.plannedDurationMin ? `Durée prévue : ${fmt(step.plannedDurationMin * 60)}` : 'Minuteur libre'}
        </p>
        <button type="button" onClick={onStart} className="btn-secondary shrink-0 py-2.5">
          <Play size={16} /> Démarrer
        </button>
      </div>
    )
  }

  if (step.status !== 'in-progress' || !step.actualStartAt) return null

  const stopButton = (
    <button
      type="button"
      onClick={onStop}
      className="mx-auto mt-3 flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
      aria-label="Arrêter le minuteur"
    >
      <Square size={14} /> Arrêter
    </button>
  )

  const elapsedSec = Math.max(0, Math.floor((now - new Date(step.actualStartAt).getTime()) / 1000))

  if (step.plannedDurationMin) {
    const remainingSec = step.plannedDurationMin * 60 - elapsedSec
    const overdue = remainingSec < 0
    return (
      <div className="mt-4 text-center">
        <span className={`font-mono text-6xl font-bold tabular-nums ${overdue ? 'text-red-600' : 'text-indigo-600'}`}>
          {overdue ? '+' : ''}
          {fmt(Math.abs(remainingSec))}
        </span>
        <p className="text-sm text-slate-500">{overdue ? 'de dépassement' : 'restant'}</p>
        {stopButton}
      </div>
    )
  }

  return (
    <div className="mt-4 text-center">
      <span className="font-mono text-6xl font-bold tabular-nums text-indigo-600">{fmt(elapsedSec)}</span>
      <p className="text-sm text-slate-500">écoulé</p>
      {stopButton}
    </div>
  )
}

function StepProgressBar({
  step,
  now,
  timing,
  boilElapsedSeconds,
}: {
  step: BatchStep
  now: number
  timing: AdditionTiming
  boilElapsedSeconds: number
}) {
  let percent = 0
  let overdue = false
  let indeterminate = false
  const done = step.status === 'done'

  if (done) {
    percent = 100
  } else if (step.status === 'in-progress' && step.actualStartAt) {
    const elapsedSec = Math.max(0, Math.floor((now - new Date(step.actualStartAt).getTime()) / 1000))
    if (step.plannedDurationMin) {
      percent = (elapsedSec / (step.plannedDurationMin * 60)) * 100
      overdue = elapsedSec > step.plannedDurationMin * 60
    } else {
      indeterminate = true
    }
  } else if (step.status === 'todo' && timing.triggerAtSeconds !== null && timing.triggerAtSeconds > 0) {
    percent = (boilElapsedSeconds / timing.triggerAtSeconds) * 100
    overdue = timing.isDue
  } else {
    return null
  }

  return (
    <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-200">
      {indeterminate ? (
        <div className="h-full w-1/3 animate-pulse rounded-full bg-indigo-400" />
      ) : (
        <div
          className={`h-full rounded-full transition-all duration-1000 ${
            done ? 'bg-slate-400' : overdue ? 'bg-red-500' : 'bg-indigo-500'
          }`}
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      )}
    </div>
  )
}
