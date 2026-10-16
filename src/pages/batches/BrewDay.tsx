import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { GravityCorrectionTool } from '@/components/brew-day/GravityCorrectionTool'
import { StrikeWaterTool } from '@/components/brew-day/StrikeWaterTool'
import { useAlertSound } from '@/hooks/useAlertSound'
import { formatDuration, formatDurationLong, useNowTick } from '@/hooks/useBrewTimer'
import { useWakeLock } from '@/hooks/useWakeLock'
import { calculateVolumes } from '@/lib/brew-calc/volumes'
import {
  getBatchSteps,
  getBatchWithDetails,
  resetBatchStep,
  updateBatchStepStatus,
  type BatchStep,
  type BatchStepType,
} from '@/lib/db/queries/batches'
import { getEquipmentProfile } from '@/lib/db/queries/equipmentProfiles'
import type { Fermentable } from '@/lib/brew-calc/types'

const STEP_ICONS: Record<BatchStepType, string> = {
  'strike-water': '🔥',
  mash: '🌾',
  'mash-step': '🌡️',
  'sparge-water': '🔥',
  sparge: '💧',
  'heat-to-boil': '🔥',
  boil: '🔥',
  'hop-addition': '🌿',
  'other-addition': '➕',
  whirlpool: '🌀',
  cooling: '❄️',
  'dry-hop-addition': '🧊',
}

/** Étapes dont le déclenchement se calcule par rapport au compte à rebours d'ébullition. */
const BOIL_TRIGGERED_STEP_TYPES: BatchStepType[] = ['hop-addition', 'other-addition']

export function BrewDay() {
  const { batchId } = useParams<{ batchId: string }>()
  const queryClient = useQueryClient()
  const { unlock, play } = useAlertSound()
  const [soundEnabled, setSoundEnabled] = useState(false)
  const alertedStepIds = useRef(new Set<string>())
  const now = useNowTick()
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  useWakeLock(true)

  const { data: batch } = useQuery({
    queryKey: ['batch', batchId],
    queryFn: () => getBatchWithDetails(batchId!),
    enabled: !!batchId,
  })
  const { data: steps } = useQuery({
    queryKey: ['batch-steps', batchId],
    queryFn: () => getBatchSteps(batchId!),
    enabled: !!batchId,
    refetchInterval: 5000,
  })
  const equipmentProfileId = batch?.recipeSnapshot.equipmentProfileId
  const { data: equipmentProfile } = useQuery({
    queryKey: ['equipment-profile', equipmentProfileId],
    queryFn: () => getEquipmentProfile(equipmentProfileId!),
    enabled: !!equipmentProfileId,
  })

  const boilStep = steps?.find((s) => s.stepType === 'boil')
  const boilElapsedSeconds =
    boilStep?.actualStartAt !== undefined && boilStep?.actualStartAt !== null
      ? Math.max(0, Math.floor((now - new Date(boilStep.actualStartAt).getTime()) / 1000))
      : 0

  useEffect(() => {
    if (!soundEnabled || !boilStep || !steps) return
    const boilRemainingPlanned = boilStep.plannedDurationMin ?? 0
    for (const step of steps) {
      if (!BOIL_TRIGGERED_STEP_TYPES.includes(step.stepType) || step.status !== 'todo' || step.triggerTimeMin === null)
        continue
      const triggerAtSeconds = (boilRemainingPlanned - step.triggerTimeMin) * 60
      const isDue = boilStep.actualStartAt !== null && boilElapsedSeconds >= triggerAtSeconds
      if (isDue && !alertedStepIds.current.has(step.id)) {
        alertedStepIds.current.add(step.id)
        play()
        document.title = `⏰ ${step.label} — BrewAtHome`
      }
    }
  }, [boilElapsedSeconds, boilStep, steps, soundEnabled, play])

  useEffect(() => {
    if (activeIndex !== null || !steps || steps.length === 0) return
    const firstNotDone = steps.findIndex((s) => s.status !== 'done')
    setActiveIndex(firstNotDone === -1 ? steps.length - 1 : firstNotDone)
  }, [steps, activeIndex])

  async function startStep(step: BatchStep) {
    await updateBatchStepStatus(step.id, 'in-progress', { actualStartAt: new Date().toISOString() })
    queryClient.invalidateQueries({ queryKey: ['batch-steps', batchId] })
  }

  async function completeStep(step: BatchStep) {
    await updateBatchStepStatus(step.id, 'done', { actualEndAt: new Date().toISOString() })
    document.title = 'BrewAtHome'
    queryClient.invalidateQueries({ queryKey: ['batch-steps', batchId] })
  }

  async function resetStep(step: BatchStep) {
    alertedStepIds.current.delete(step.id)
    await resetBatchStep(step.id)
    document.title = 'BrewAtHome'
    queryClient.invalidateQueries({ queryKey: ['batch-steps', batchId] })
  }

  if (!batch || !steps) return <p className="text-slate-500">Chargement…</p>

  const grainFermentables = batch.recipeSnapshot.fermentables.filter((f) => f.type === 'grain')
  const totalGrainKg = grainFermentables.reduce((sum, f) => sum + f.amountKg, 0)
  const mashWaterL = equipmentProfile
    ? calculateVolumes(batch.recipeSnapshot.targetVolumeL, totalGrainKg, equipmentProfile).mashWaterL
    : undefined
  const activeStep = activeIndex !== null ? steps[activeIndex] : undefined

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Brew Day</h1>
          <p className="text-slate-500">{batch.name}</p>
        </div>
        {!soundEnabled && (
          <button
            onClick={() => {
              unlock()
              play()
              setSoundEnabled(true)
            }}
            className="btn-primary"
          >
            🔊 Activer les alertes sonores
          </button>
        )}
        {soundEnabled && <span className="badge-ok">🔊 Alertes sonores activées</span>}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {steps.map((step, index) => {
          const boilRemainingPlanned = boilStep?.plannedDurationMin ?? 0
          const triggerAtSeconds =
            BOIL_TRIGGERED_STEP_TYPES.includes(step.stepType) && step.triggerTimeMin !== null
              ? (boilRemainingPlanned - step.triggerTimeMin) * 60
              : null
          const isDue =
            BOIL_TRIGGERED_STEP_TYPES.includes(step.stepType) &&
            step.status === 'todo' &&
            boilStep?.actualStartAt &&
            triggerAtSeconds !== null &&
            boilElapsedSeconds >= triggerAtSeconds
          const active = index === activeIndex

          return (
            <button
              key={step.id}
              onClick={() => setActiveIndex(index)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : step.status === 'done'
                    ? 'border-green-200 bg-green-50 text-green-700'
                    : isDue
                      ? 'border-red-400 bg-red-50 text-red-700'
                      : 'border-slate-200 bg-white text-slate-500'
              }`}
            >
              <span>{STEP_ICONS[step.stepType]}</span>
              {step.status === 'done' && <span>✓</span>}
              <span className="whitespace-nowrap">{step.label}</span>
            </button>
          )
        })}
      </div>

      {activeStep && (
        <ActiveStepCard
          key={activeStep.id}
          step={activeStep}
          now={now}
          boilStep={boilStep}
          boilElapsedSeconds={boilElapsedSeconds}
          totalGrainKg={totalGrainKg}
          mashWaterL={mashWaterL}
          grainFermentables={grainFermentables}
          onStart={startStep}
          onComplete={completeStep}
          onReset={resetStep}
        />
      )}

      <div className="flex justify-between">
        <button
          onClick={() => setActiveIndex((i) => Math.max(0, (i ?? 0) - 1))}
          disabled={activeIndex === null || activeIndex === 0}
          className="btn-secondary btn-sm disabled:opacity-40"
        >
          ← Étape précédente
        </button>
        <button
          onClick={() => setActiveIndex((i) => Math.min(steps.length - 1, (i ?? 0) + 1))}
          disabled={activeIndex === null || activeIndex === steps.length - 1}
          className="btn-secondary btn-sm disabled:opacity-40"
        >
          Étape suivante →
        </button>
      </div>

      <GravityCorrectionTool targetGravity={batch.recipeSnapshot.estOg ?? undefined} />
    </div>
  )
}

function ActiveStepCard({
  step,
  now,
  boilStep,
  boilElapsedSeconds,
  totalGrainKg,
  mashWaterL,
  grainFermentables,
  onStart,
  onComplete,
  onReset,
}: {
  step: BatchStep
  now: number
  boilStep: BatchStep | undefined
  boilElapsedSeconds: number
  totalGrainKg: number
  mashWaterL: number | undefined
  grainFermentables: Fermentable[]
  onStart: (step: BatchStep) => void
  onComplete: (step: BatchStep) => void
  onReset: (step: BatchStep) => void
}) {
  const boilRemainingPlanned = boilStep?.plannedDurationMin ?? 0
  const triggerAtSeconds =
    BOIL_TRIGGERED_STEP_TYPES.includes(step.stepType) && step.triggerTimeMin !== null
      ? (boilRemainingPlanned - step.triggerTimeMin) * 60
      : null
  const isDue =
    BOIL_TRIGGERED_STEP_TYPES.includes(step.stepType) &&
    step.status === 'todo' &&
    !!boilStep?.actualStartAt &&
    triggerAtSeconds !== null &&
    boilElapsedSeconds >= triggerAtSeconds

  return (
    <div
      className={`rounded-2xl border-2 p-4 shadow-sm transition-colors sm:p-5 ${
        step.status === 'done'
          ? 'border-slate-200 bg-slate-50'
          : isDue
            ? 'border-red-400 bg-red-50'
            : step.status === 'in-progress'
              ? 'border-indigo-400 bg-indigo-50'
              : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-lg">
            {STEP_ICONS[step.stepType]}
          </span>
          <p className="font-semibold text-slate-800">{step.label}</p>
        </div>
        <div className="flex gap-2">
          {step.status === 'todo' && (
            <button onClick={() => onStart(step)} className="btn-secondary btn-sm">
              Démarrer
            </button>
          )}
          {step.status === 'in-progress' && (
            <button onClick={() => onReset(step)} className="btn-secondary btn-sm">
              Arrêter
            </button>
          )}
          {step.status !== 'done' && (
            <button onClick={() => onComplete(step)} className="btn-primary btn-sm">
              Terminer
            </button>
          )}
          {step.status === 'done' && (
            <button onClick={() => onReset(step)} className="btn-secondary btn-sm">
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      <StepTimer step={step} now={now} />
      <StepProgressBar step={step} now={now} isDue={isDue} triggerAtSeconds={triggerAtSeconds} boilElapsedSeconds={boilElapsedSeconds} />

      {BOIL_TRIGGERED_STEP_TYPES.includes(step.stepType) && triggerAtSeconds !== null && boilStep?.actualStartAt && (
        <p className={`mt-2 ${isDue ? 'font-mono text-2xl font-bold text-red-700' : 'text-sm text-slate-500'}`}>
          {isDue ? '⚠ À ajouter maintenant !' : `Dans ${formatDuration(triggerAtSeconds - boilElapsedSeconds)}`}
        </p>
      )}

      {step.stepType === 'strike-water' && (
        <div className="mt-4 border-t border-slate-200 pt-4">
          <StrikeWaterTool defaultGrainWeightKg={totalGrainKg} defaultWaterVolumeL={mashWaterL} embedded />
        </div>
      )}

      {step.stepType === 'mash' && grainFermentables.length > 0 && (
        <div className="mt-4 border-t border-slate-200 pt-4">
          <p className="mb-1.5 text-sm font-medium text-slate-600">Grain à ajouter :</p>
          <ul className="space-y-1 text-sm text-slate-700">
            {grainFermentables.map((f, i) => (
              <li key={i}>
                <span className="font-semibold text-slate-800">{f.amountKg} kg</span> — {f.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {step.stepType === 'sparge-water' && (
        <p className="mt-3 text-sm text-slate-500">
          Peut chauffer pendant la fin de l'empâtage pour être prête à temps pour le rinçage.
        </p>
      )}
    </div>
  )
}

function StepTimer({ step, now }: { step: BatchStep; now: number }) {
  const fmt = step.stepType === 'dry-hop-addition' ? formatDurationLong : formatDuration

  if (step.status === 'done') {
    if (!step.actualStartAt || !step.actualEndAt) return null
    const totalSec = Math.max(
      0,
      Math.round((new Date(step.actualEndAt).getTime() - new Date(step.actualStartAt).getTime()) / 1000),
    )
    return <p className="mt-2 text-sm text-slate-400">Durée réelle : {fmt(totalSec)}</p>
  }

  if (step.status !== 'in-progress' || !step.actualStartAt) return null

  const elapsedSec = Math.max(0, Math.floor((now - new Date(step.actualStartAt).getTime()) / 1000))

  if (step.plannedDurationMin) {
    const remainingSec = step.plannedDurationMin * 60 - elapsedSec
    const overdue = remainingSec < 0
    return (
      <div className="mt-2 flex items-baseline gap-2">
        <span
          className={`font-mono text-4xl font-bold tabular-nums ${overdue ? 'text-red-600' : 'text-indigo-600'}`}
        >
          {overdue ? '+' : ''}
          {fmt(Math.abs(remainingSec))}
        </span>
        <span className="text-sm text-slate-500">{overdue ? 'de dépassement' : 'restant'}</span>
      </div>
    )
  }

  return (
    <div className="mt-2 flex items-baseline gap-2">
      <span className="font-mono text-4xl font-bold tabular-nums text-indigo-600">{fmt(elapsedSec)}</span>
      <span className="text-sm text-slate-500">écoulé</span>
    </div>
  )
}

function StepProgressBar({
  step,
  now,
  isDue,
  triggerAtSeconds,
  boilElapsedSeconds,
}: {
  step: BatchStep
  now: number
  isDue: boolean
  triggerAtSeconds: number | null
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
  } else if (step.stepType === 'hop-addition' && step.status === 'todo' && triggerAtSeconds !== null && triggerAtSeconds > 0) {
    percent = (boilElapsedSeconds / triggerAtSeconds) * 100
    overdue = isDue
  }

  return (
    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
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
