import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Flame,
  ListChecks,
  RotateCcw,
  SkipForward,
  TriangleAlert,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { MeasurementsPanel } from '@/components/batches/MeasurementsPanel'
import { StepCard } from '@/components/brew-day/StepCard'
import { StepOverview } from '@/components/brew-day/StepOverview'
import { additionTiming, groupSteps } from '@/components/brew-day/stepMeta'
import { useAlertSound } from '@/hooks/useAlertSound'
import { formatDuration, useNowTick } from '@/hooks/useBrewTimer'
import { useWakeLock } from '@/hooks/useWakeLock'
import { calculateVolumes } from '@/lib/brew-calc/volumes'
import { checklistProgress, stepGuide, type StepGuide } from '@/lib/brew-day/checklist'
import { plannedMeasurements, type MeasurementKey } from '@/lib/brew-day/measurements'
import {
  getBatchSteps,
  isStepFinished,
  getBatchWithDetails,
  resetBatchStep,
  updateBatchStepChecklist,
  updateBatchStepStatus,
  type BatchStep,
  type BatchStepType,
} from '@/lib/db/queries/batches'
import { getEquipmentProfile } from '@/lib/db/queries/equipmentProfiles'

/** Mesures à relever à chaque étape (comme dans Brewfather), comparées aux valeurs de la recette. */
const STEP_MEASUREMENTS: Partial<Record<BatchStepType, MeasurementKey[]>> = {
  mash: ['mashPh'],
  'heat-to-boil': ['preBoilVolumeL', 'preBoilGravity'],
  cooling: ['postBoilVolumeL', 'postBoilGravity'],
  pitch: ['fermenterTopUpL', 'fermenterVolumeL', 'og'],
}

export function BrewDay() {
  const { batchId } = useParams<{ batchId: string }>()
  const queryClient = useQueryClient()
  const { unlock, play } = useAlertSound()
  const [soundEnabled, setSoundEnabled] = useState(false)
  const alertedStepIds = useRef(new Set<string>())
  const now = useNowTick()
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [overviewOpen, setOverviewOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
  const boilElapsedSeconds = boilStep?.actualStartAt
    ? Math.max(0, Math.floor((now - new Date(boilStep.actualStartAt).getTime()) / 1000))
    : 0

  const recipe = batch?.recipeSnapshot
  const totalGrainKg = recipe
    ? recipe.fermentables.filter((f) => f.type === 'grain').reduce((sum, f) => sum + f.amountKg, 0)
    : 0
  const volumes = recipe && equipmentProfile ? calculateVolumes(recipe.targetVolumeL, totalGrainKg, recipe.boilTimeMin, equipmentProfile) : null

  const planned = useMemo(() => (recipe ? plannedMeasurements(recipe, equipmentProfile) : null), [recipe, equipmentProfile])

  const guides = useMemo(() => {
    const map = new Map<string, StepGuide>()
    if (!recipe || !steps) return map
    const method = equipmentProfile?.method ?? (recipe.type === 'biab' ? 'biab' : recipe.type)
    for (const step of steps) map.set(step.id, stepGuide(step, { recipe, volumes, method }))
    return map
  }, [recipe, steps, volumes, equipmentProfile])

  useEffect(() => {
    if (!soundEnabled || !boilStep || !steps) return
    for (const step of steps) {
      if (additionTiming(step, boilStep, boilElapsedSeconds).isDue && !alertedStepIds.current.has(step.id)) {
        alertedStepIds.current.add(step.id)
        play()
        document.title = `⏰ ${step.label} — BrewAtHome`
      }
    }
  }, [boilElapsedSeconds, boilStep, steps, soundEnabled, play])

  useEffect(() => {
    if (activeIndex !== null || !steps || steps.length === 0) return
    const firstNotDone = steps.findIndex((s) => !isStepFinished(s.status))
    setActiveIndex(firstNotDone === -1 ? steps.length - 1 : firstNotDone)
  }, [steps, activeIndex])

  async function run(action: () => Promise<void>) {
    setError(null)
    try {
      await action()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      queryClient.invalidateQueries({ queryKey: ['batch-steps', batchId] })
    }
  }

  function startStep(step: BatchStep) {
    return run(() => updateBatchStepStatus(step.id, 'in-progress', { actualStartAt: new Date().toISOString() }))
  }

  async function completeStep(step: BatchStep, index: number) {
    await run(() => updateBatchStepStatus(step.id, 'done', { actualEndAt: new Date().toISOString() }))
    document.title = 'BrewAtHome'
    goToNextUnfinished(index)
  }

  async function skipStep(step: BatchStep, index: number) {
    await run(() => updateBatchStepStatus(step.id, 'skipped'))
    goToNextUnfinished(index)
  }

  // Enchaîne sur la prochaine étape ni terminée ni passée.
  function goToNextUnfinished(index: number) {
    const next = steps?.findIndex((s, i) => i > index && !isStepFinished(s.status)) ?? -1
    if (next !== -1) setActiveIndex(next)
  }

  function resetStep(step: BatchStep) {
    alertedStepIds.current.delete(step.id)
    document.title = 'BrewAtHome'
    return run(() => resetBatchStep(step.id))
  }

  function toggleItem(step: BatchStep, itemId: string) {
    const checkedItems = step.checkedItems.includes(itemId)
      ? step.checkedItems.filter((id) => id !== itemId)
      : [...step.checkedItems, itemId]
    // Mise à jour optimiste : la case réagit immédiatement, même avec un réseau lent.
    queryClient.setQueryData<BatchStep[]>(['batch-steps', batchId], (old) =>
      old?.map((s) => (s.id === step.id ? { ...s, checkedItems } : s)),
    )
    return run(() => updateBatchStepChecklist(step.id, checkedItems))
  }

  function selectStep(index: number) {
    setActiveIndex(index)
    setOverviewOpen(false)
  }

  if (!batch || !steps || !recipe) return <p className="p-4 text-slate-500">Chargement…</p>

  const groups = groupSteps(steps)
  const activeStep = activeIndex !== null ? steps[activeIndex] : undefined
  const activeMeasurements = activeStep ? STEP_MEASUREMENTS[activeStep.stepType] : undefined
  const activeGroup = groups.find((g) => g.steps.some(({ index }) => index === activeIndex))
  const positionInGroup = activeGroup ? activeGroup.steps.findIndex(({ index }) => index === activeIndex) : -1
  const checklistTotals = new Map(
    steps.map((s) => [s.id, checklistProgress(guides.get(s.id) ?? { checklist: [], tips: [] }, s)]),
  )
  const dueSteps = steps
    .map((step, index) => ({ step, index }))
    .filter(({ step }) => additionTiming(step, boilStep, boilElapsedSeconds).isDue)
  const boilRunning = boilStep?.status === 'in-progress' && !!boilStep.actualStartAt
  const boilRemainingSec = boilRunning ? (boilStep.plannedDurationMin ?? 0) * 60 - boilElapsedSeconds : 0
  const allDone = steps.every((s) => isStepFinished(s.status))

  const overview = (
    <StepOverview
      groups={groups}
      activeIndex={activeIndex}
      boilStep={boilStep}
      boilElapsedSeconds={boilElapsedSeconds}
      checklistTotals={checklistTotals}
      onSelect={selectStep}
    />
  )

  const soundButton = (
    <button
      type="button"
      onClick={() => {
        if (soundEnabled) {
          setSoundEnabled(false)
          return
        }
        unlock()
        play()
        setSoundEnabled(true)
      }}
      className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium ${
        soundEnabled ? 'bg-green-500/15 text-green-600 lg:text-green-700' : 'bg-white/10 text-slate-200 lg:bg-slate-100 lg:text-slate-600'
      }`}
      aria-label={soundEnabled ? 'Couper les alertes sonores' : 'Activer les alertes sonores'}
    >
      {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
      <span className="hidden sm:inline">{soundEnabled ? 'Alertes activées' : 'Activer les alertes'}</span>
    </button>
  )

  return (
    <div className="flex min-h-dvh flex-col lg:min-h-0">
      {/* En-tête */}
      <header className="sticky top-0 z-20 bg-slate-900 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white lg:static lg:rounded-3xl lg:px-6 lg:py-5">
        <div className="flex items-center gap-2">
          <Link to={`/batches/${batchId}`} className="-ml-2 rounded-full p-2 text-slate-300 hover:bg-white/10" aria-label="Retour au brassin">
            <ChevronLeft size={22} />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-indigo-300">Brew Day</p>
            <h1 className="truncate font-bold">{batch.name}</h1>
          </div>
          {soundButton}
          <button
            type="button"
            onClick={() => setOverviewOpen(true)}
            className="rounded-full bg-white/10 p-2 text-slate-200 lg:hidden"
            aria-label="Voir toutes les étapes"
          >
            <ListChecks size={20} />
          </button>
        </div>
        {activeGroup && (
          <div className="mt-3 flex items-center gap-3">
            <p className="shrink-0 text-sm font-semibold">
              {activeGroup.icon} {activeGroup.label}
              <span className="font-normal text-slate-400">
                {' '}
                · {positionInGroup + 1}/{activeGroup.steps.length}
              </span>
            </p>
            <div className="flex flex-1 gap-1">
              {activeGroup.steps.map(({ step, index }) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`h-1.5 flex-1 rounded-full ${
                    index === activeIndex
                      ? 'bg-indigo-400'
                      : step.status === 'done'
                        ? 'bg-green-500'
                        : step.status === 'skipped'
                          ? 'bg-slate-500'
                          : 'bg-white/20'
                  }`}
                  aria-label={step.label}
                />
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Bandeaux : ajouts à faire maintenant, ébullition en cours ailleurs */}
      <div className="space-y-2 px-4 pt-3 lg:px-0 lg:pt-4">
        {dueSteps.map(({ step, index }) => (
          <button
            key={step.id}
            type="button"
            onClick={() => setActiveIndex(index)}
            className="flex w-full animate-pulse items-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-left font-semibold text-white"
          >
            <TriangleAlert size={20} className="shrink-0" />
            <span className="flex-1">Maintenant : {step.label}</span>
            <ChevronRight size={18} />
          </button>
        ))}
        {boilRunning && activeStep?.id !== boilStep.id && (
          <button
            type="button"
            onClick={() => setActiveIndex(steps.indexOf(boilStep))}
            className="flex w-full items-center gap-2 rounded-2xl bg-orange-100 px-4 py-2.5 text-left text-sm font-medium text-orange-900"
          >
            <Flame size={18} className="shrink-0 text-orange-500" />
            <span className="flex-1">Ébullition</span>
            <span className="font-mono font-bold tabular-nums">
              {boilRemainingSec < 0 ? '+' : ''}
              {formatDuration(Math.abs(boilRemainingSec))}
            </span>
          </button>
        )}
        {error && <p className="rounded-2xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
      </div>

      <div className="flex-1 px-4 py-4 lg:grid lg:grid-cols-[320px_1fr] lg:gap-6 lg:px-0">
        {/* Vue d'ensemble permanente — PC */}
        <aside className="hidden lg:block">
          <div className="sticky top-6 max-h-[calc(100dvh-3rem)] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-4">
            {overview}
          </div>
        </aside>

        <section className="min-w-0 space-y-4">
          {activeStep && (
            <StepCard
              key={activeStep.id}
              step={activeStep}
              guide={guides.get(activeStep.id) ?? { checklist: [], tips: [] }}
              timing={additionTiming(activeStep, boilStep, boilElapsedSeconds)}
              now={now}
              boilStarted={!!boilStep?.actualStartAt}
              boilElapsedSeconds={boilElapsedSeconds}
              recipe={recipe}
              totalGrainKg={totalGrainKg}
              mashWaterL={volumes?.mashWaterL}
              onToggleItem={(itemId) => toggleItem(activeStep, itemId)}
              onStart={() => startStep(activeStep)}
              onStop={() => resetStep(activeStep)}
              measurement={
                activeMeasurements && batch && planned ? (
                  <MeasurementsPanel
                    batchId={batch.id}
                    fields={activeMeasurements}
                    measured={batch.measurements}
                    planned={planned}
                    recipe={recipe}
                    equipment={equipmentProfile}
                    title="Mesures de l'étape"
                  />
                ) : undefined
              }
            />
          )}

          {activeStep?.status === 'todo' && activeIndex !== null && (
            <button
              type="button"
              onClick={() => skipStep(activeStep, activeIndex)}
              className="mx-auto flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100"
            >
              <SkipForward size={16} /> Passer cette étape
            </button>
          )}

          {allDone && (
            <div className="rounded-3xl bg-indigo-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-400">Étape suivante · Fermentation</p>
              <p className="mt-1 font-semibold text-slate-800">Brassage terminé, place au suivi de fermentation.</p>
              <Link to={`/batches/${batchId}/fermentation`} className="btn-primary mt-3">
                Suivi de fermentation →
              </Link>
            </div>
          )}
        </section>
      </div>

      {/* Barre d'actions : collée en bas sur mobile, sous la carte sur PC */}
      {activeStep && activeIndex !== null && (
        <div className="sticky bottom-0 z-10 border-t border-slate-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:ml-[344px] lg:rounded-3xl lg:border lg:pb-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveIndex(Math.max(0, activeIndex - 1))}
              disabled={activeIndex === 0}
              className="rounded-full border border-slate-200 p-3 text-slate-600 disabled:opacity-30"
              aria-label="Étape précédente"
            >
              <ChevronLeft size={20} />
            </button>

            <div className="flex flex-1 gap-2">
              {/* Démarrer / Arrêter sont sous le minuteur, dans la carte de l'étape. */}
              {!isStepFinished(activeStep.status) && (
                <button type="button" onClick={() => completeStep(activeStep, activeIndex)} className="btn-primary flex-1 py-3">
                  Terminer
                </button>
              )}
              {isStepFinished(activeStep.status) && (
                <button type="button" onClick={() => resetStep(activeStep)} className="btn-secondary flex-1 py-3">
                  <RotateCcw size={16} /> {activeStep.status === 'skipped' ? 'Reprendre cette étape' : 'Refaire cette étape'}
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setActiveIndex(Math.min(steps.length - 1, activeIndex + 1))}
              disabled={activeIndex === steps.length - 1}
              className="rounded-full border border-slate-200 p-3 text-slate-600 disabled:opacity-30"
              aria-label="Étape suivante"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Vue d'ensemble en panneau — mobile */}
      {overviewOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setOverviewOpen(false)}>
          <div className="absolute inset-0 bg-slate-900/50" />
          <div
            className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="font-bold text-slate-900">Toutes les étapes</p>
              <button type="button" onClick={() => setOverviewOpen(false)} className="rounded-full p-1 text-slate-400" aria-label="Fermer">
                <X size={22} />
              </button>
            </div>
            {overview}
          </div>
        </div>
      )}
    </div>
  )
}
