import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { GravityCorrectionTool } from '@/components/brew-day/GravityCorrectionTool'
import { StrikeWaterTool } from '@/components/brew-day/StrikeWaterTool'
import { useAlertSound } from '@/hooks/useAlertSound'
import { formatDuration, useNowTick } from '@/hooks/useBrewTimer'
import { useWakeLock } from '@/hooks/useWakeLock'
import {
  getBatchSteps,
  getBatchWithDetails,
  updateBatchStepStatus,
  type BatchStep,
  type BatchStepType,
} from '@/lib/db/queries/batches'

const STEP_ICONS: Record<BatchStepType, string> = {
  mash: '🌾',
  'mash-step': '🌡️',
  boil: '🔥',
  'hop-addition': '🌿',
  whirlpool: '🌀',
  cooling: '❄️',
}

export function BrewDay() {
  const { batchId } = useParams<{ batchId: string }>()
  const queryClient = useQueryClient()
  const { unlock, play } = useAlertSound()
  const [soundEnabled, setSoundEnabled] = useState(false)
  const alertedStepIds = useRef(new Set<string>())
  const now = useNowTick()

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

  const boilStep = steps?.find((s) => s.stepType === 'boil')
  const boilElapsedSeconds =
    boilStep?.actualStartAt !== undefined && boilStep?.actualStartAt !== null
      ? Math.max(0, Math.floor((now - new Date(boilStep.actualStartAt).getTime()) / 1000))
      : 0

  useEffect(() => {
    if (!soundEnabled || !boilStep || !steps) return
    const boilRemainingPlanned = boilStep.plannedDurationMin ?? 0
    for (const step of steps) {
      if (step.stepType !== 'hop-addition' || step.status !== 'todo' || step.triggerTimeMin === null) continue
      const triggerAtSeconds = (boilRemainingPlanned - step.triggerTimeMin) * 60
      const isDue = boilStep.actualStartAt !== null && boilElapsedSeconds >= triggerAtSeconds
      if (isDue && !alertedStepIds.current.has(step.id)) {
        alertedStepIds.current.add(step.id)
        play()
        document.title = `⏰ ${step.label} — BrewAtHome`
      }
    }
  }, [boilElapsedSeconds, boilStep, steps, soundEnabled, play])

  async function startStep(step: BatchStep) {
    await updateBatchStepStatus(step.id, 'in-progress', { actualStartAt: new Date().toISOString() })
    queryClient.invalidateQueries({ queryKey: ['batch-steps', batchId] })
  }

  async function completeStep(step: BatchStep) {
    await updateBatchStepStatus(step.id, 'done', { actualEndAt: new Date().toISOString() })
    document.title = 'BrewAtHome'
    queryClient.invalidateQueries({ queryKey: ['batch-steps', batchId] })
  }

  if (!batch || !steps) return <p className="text-stone-500">Chargement…</p>

  const totalGrainKg = batch.recipeSnapshot.fermentables
    .filter((f) => f.type === 'grain')
    .reduce((sum, f) => sum + f.amountKg, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-stone-800">Brew Day</h1>
          <p className="text-stone-500">{batch.name}</p>
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

      <ol className="space-y-3">
        {steps.map((step, index) => {
          const boilRemainingPlanned = boilStep?.plannedDurationMin ?? 0
          const triggerAtSeconds =
            step.stepType === 'hop-addition' && step.triggerTimeMin !== null
              ? (boilRemainingPlanned - step.triggerTimeMin) * 60
              : null
          const isDue =
            step.stepType === 'hop-addition' &&
            step.status === 'todo' &&
            boilStep?.actualStartAt &&
            triggerAtSeconds !== null &&
            boilElapsedSeconds >= triggerAtSeconds

          return (
            <li
              key={step.id}
              className={`rounded-2xl border-2 p-4 shadow-sm transition-colors sm:p-5 ${
                step.status === 'done'
                  ? 'border-stone-200 bg-stone-50 opacity-60'
                  : isDue
                    ? 'border-red-400 bg-red-50'
                    : step.status === 'in-progress'
                      ? 'border-amber-400 bg-amber-50'
                      : 'border-amber-200/70 bg-white'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-lg">
                    {STEP_ICONS[step.stepType]}
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Étape {index + 1}</p>
                    <p className="font-semibold text-stone-800">{step.label}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {step.status === 'todo' && (
                    <button onClick={() => startStep(step)} className="btn-secondary btn-sm">
                      Démarrer
                    </button>
                  )}
                  {step.status !== 'done' && (
                    <button onClick={() => completeStep(step)} className="btn-primary btn-sm">
                      Terminer
                    </button>
                  )}
                </div>
              </div>

              <StepTimer step={step} now={now} />
              <StepProgressBar step={step} now={now} isDue={!!isDue} triggerAtSeconds={triggerAtSeconds} boilElapsedSeconds={boilElapsedSeconds} />

              {step.stepType === 'hop-addition' && triggerAtSeconds !== null && boilStep?.actualStartAt && (
                <p
                  className={`mt-2 ${
                    isDue ? 'font-mono text-2xl font-bold text-red-700' : 'text-sm text-stone-500'
                  }`}
                >
                  {isDue ? '⚠ À ajouter maintenant !' : `Dans ${formatDuration(triggerAtSeconds - boilElapsedSeconds)}`}
                </p>
              )}

              {step.stepType === 'mash' && (
                <div className="mt-4 border-t border-amber-200/60 pt-4">
                  <StrikeWaterTool defaultGrainWeightKg={totalGrainKg} embedded />
                </div>
              )}
            </li>
          )
        })}
      </ol>

      <GravityCorrectionTool targetGravity={batch.recipeSnapshot.estOg ?? undefined} />
    </div>
  )
}

function StepTimer({ step, now }: { step: BatchStep; now: number }) {
  if (step.status === 'done') {
    if (!step.actualStartAt || !step.actualEndAt) return null
    const totalSec = Math.max(
      0,
      Math.round((new Date(step.actualEndAt).getTime() - new Date(step.actualStartAt).getTime()) / 1000),
    )
    return <p className="mt-2 text-sm text-stone-400">Durée réelle : {formatDuration(totalSec)}</p>
  }

  if (step.status !== 'in-progress' || !step.actualStartAt) return null

  const elapsedSec = Math.max(0, Math.floor((now - new Date(step.actualStartAt).getTime()) / 1000))

  if (step.plannedDurationMin) {
    const remainingSec = step.plannedDurationMin * 60 - elapsedSec
    const overdue = remainingSec < 0
    return (
      <div className="mt-2 flex items-baseline gap-2">
        <span
          className={`font-mono text-4xl font-bold tabular-nums ${overdue ? 'text-red-600' : 'text-amber-900'}`}
        >
          {overdue ? '+' : ''}
          {formatDuration(Math.abs(remainingSec))}
        </span>
        <span className="text-sm text-stone-500">{overdue ? 'de dépassement' : 'restant'}</span>
      </div>
    )
  }

  return (
    <div className="mt-2 flex items-baseline gap-2">
      <span className="font-mono text-4xl font-bold tabular-nums text-amber-900">{formatDuration(elapsedSec)}</span>
      <span className="text-sm text-stone-500">écoulé</span>
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
    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-stone-200">
      {indeterminate ? (
        <div className="h-full w-1/3 animate-pulse rounded-full bg-amber-400" />
      ) : (
        <div
          className={`h-full rounded-full transition-all duration-1000 ${
            done ? 'bg-stone-400' : overdue ? 'bg-red-500' : 'bg-amber-500'
          }`}
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      )}
    </div>
  )
}
