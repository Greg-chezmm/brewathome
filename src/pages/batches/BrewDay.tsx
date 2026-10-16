import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { GravityCorrectionTool } from '@/components/brew-day/GravityCorrectionTool'
import { StrikeWaterTool } from '@/components/brew-day/StrikeWaterTool'
import { useAlertSound } from '@/hooks/useAlertSound'
import { formatDuration, useElapsedSeconds } from '@/hooks/useBrewTimer'
import { useWakeLock } from '@/hooks/useWakeLock'
import {
  getBatchSteps,
  getBatchWithDetails,
  updateBatchStepStatus,
  type BatchStep,
} from '@/lib/db/queries/batches'

export function BrewDay() {
  const { batchId } = useParams<{ batchId: string }>()
  const queryClient = useQueryClient()
  const { unlock, play } = useAlertSound()
  const [soundEnabled, setSoundEnabled] = useState(false)
  const alertedStepIds = useRef(new Set<string>())

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
  const boilElapsedSeconds = useElapsedSeconds(boilStep?.actualStartAt ?? null)

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-stone-800">Brew Day — {batch.name}</h1>
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

      <ul className="space-y-2">
        {steps.map((step) => {
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
              className={`rounded-2xl border p-4 shadow-sm ${
                step.status === 'done'
                  ? 'border-stone-200 bg-stone-50 opacity-60'
                  : isDue
                    ? 'border-red-400 bg-red-50'
                    : step.status === 'in-progress'
                      ? 'border-amber-400 bg-amber-50'
                      : 'border-amber-200/70 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-stone-800">{step.label}</p>
                  {step.stepType === 'boil' && step.actualStartAt && (
                    <p className="text-sm text-stone-500">
                      Écoulé : {formatDuration(boilElapsedSeconds)} / {step.plannedDurationMin} min
                    </p>
                  )}
                  {step.stepType === 'hop-addition' && triggerAtSeconds !== null && boilStep?.actualStartAt && (
                    <p className={`text-sm ${isDue ? 'font-semibold text-red-700' : 'text-stone-500'}`}>
                      {isDue
                        ? 'À ajouter maintenant !'
                        : `Dans ${formatDuration(triggerAtSeconds - boilElapsedSeconds)}`}
                    </p>
                  )}
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
            </li>
          )
        })}
      </ul>

      <StrikeWaterTool
        defaultGrainWeightKg={batch.recipeSnapshot.fermentables
          .filter((f) => f.type === 'grain')
          .reduce((sum, f) => sum + f.amountKg, 0)}
      />

      <GravityCorrectionTool targetGravity={batch.recipeSnapshot.estOg ?? undefined} />
    </div>
  )
}
