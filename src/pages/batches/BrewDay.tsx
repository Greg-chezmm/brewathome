import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router-dom'
import { ListChecks, SkipForward } from 'lucide-react'
import { BrewBriefing } from '@/components/brew-day/BrewBriefing'
import { BrewDayBanners } from '@/components/brew-day/BrewDayBanners'
import { BrewDayEnd } from '@/components/brew-day/BrewDayEnd'
import { BrewDayLoadError } from '@/components/brew-day/BrewDayLoadError'
import { OverviewSheet } from '@/components/brew-day/OverviewSheet'
import { PhaseProgress } from '@/components/brew-day/PhaseProgress'
import { SessionTabs } from '@/components/brew-day/SessionTabs'
import { SoundToggle } from '@/components/brew-day/SoundToggle'
import { StepActionBar } from '@/components/brew-day/StepActionBar'
import { StepCard } from '@/components/brew-day/StepCard'
import { StepMeasurements } from '@/components/brew-day/StepMeasurements'
import { BatchDeviceLink } from '@/components/devices/BatchDeviceLink'
import { StepOverview } from '@/components/brew-day/StepOverview'
import { additionTiming, BOIL_TRIGGERED_STEP_TYPES, boilElapsedSeconds, boilStepFor, boilTiming, groupSteps } from '@/components/brew-day/stepMeta'
import { useSoundSetting } from '@/hooks/useAlertSound'
import { useBoilAlerts } from '@/hooks/useBoilAlerts'
import { useNowTick } from '@/hooks/useBrewTimer'
import { useStepActions } from '@/hooks/useStepActions'
import { useWakeLock } from '@/hooks/useWakeLock'
import { fermentableUse } from '@/lib/brew-calc/gravity'
import { checklistProgress, stepGuide, type StepGuide } from '@/lib/brew-day/checklist'
import { plannedMeasurements } from '@/lib/brew-day/measurements'
import {
  filterStepsBySession,
  initialActiveStep,
  nextUnfinishedStep,
  sessionFilterFromParam,
} from '@/lib/brew-day/navigation'
import { startBlocker } from '@/lib/brew-day/order'
import { scaleVolumes, sessionRecipe, sessionVolumes } from '@/lib/brew-day/sessions'
import { getBatchSteps, getBatchWithDetails, isStepFinished, type BatchDetails, type BatchStep } from '@/lib/db/queries/batches'
import { getEquipmentProfile } from '@/lib/db/queries/equipmentProfiles'

export function BrewDay() {
  const { batchId } = useParams<{ batchId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const { soundEnabled, toggleSound, play } = useSoundSetting()
  const now = useNowTick()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overviewOpen, setOverviewOpen] = useState(false)

  useWakeLock(true)

  const batchQuery = useQuery({
    queryKey: ['batch', batchId],
    queryFn: () => getBatchWithDetails(batchId!),
    enabled: !!batchId,
  })
  const { data: batch } = batchQuery
  const stepsQuery = useQuery({
    queryKey: ['batch-steps', batchId],
    queryFn: () => getBatchSteps(batchId!),
    enabled: !!batchId,
    refetchInterval: 5000,
  })
  const { data: steps } = stepsQuery
  const equipmentProfileId = batch?.recipeSnapshot.equipmentProfileId
  const { data: equipmentProfile } = useQuery({
    queryKey: ['equipment-profile', equipmentProfileId],
    queryFn: () => getEquipmentProfile(equipmentProfileId!),
    enabled: !!equipmentProfileId,
  })

  // Brassin en plusieurs sessions : la session suivie est dans l'URL (?session=2), un onglet par session possible.
  const brewSessions = batch?.brewSessions ?? 1
  const sessionFilter = sessionFilterFromParam(searchParams.get('session'), brewSessions)
  const visibleSteps = useMemo(
    () => (steps ? filterStepsBySession(steps, sessionFilter) : undefined),
    [steps, sessionFilter],
  )

  const recipe = batch?.recipeSnapshot
  // Étapes d'une session : sa part de la recette et ses volumes ; étapes communes : toute la journée.
  const part = useMemo(() => (recipe ? sessionRecipe(recipe, brewSessions) : undefined), [recipe, brewSessions])
  const partVolumes = useMemo(
    () => (recipe ? sessionVolumes(recipe, brewSessions, equipmentProfile) : null),
    [recipe, brewSessions, equipmentProfile],
  )
  const dayVolumes = partVolumes ? scaleVolumes(partVolumes, brewSessions) : null
  const partGrainKg = part
    ? part.fermentables.filter((f) => f.type === 'grain' && fermentableUse(f) === 'mash').reduce((sum, f) => sum + f.amountKg, 0)
    : 0

  const planned = useMemo(
    () => (recipe ? plannedMeasurements(recipe, equipmentProfile, brewSessions) : null),
    [recipe, equipmentProfile, brewSessions],
  )
  const plannedSession = useMemo(
    () => (part && brewSessions > 1 ? plannedMeasurements(part, equipmentProfile) : null),
    [part, equipmentProfile, brewSessions],
  )

  const guides = useMemo(() => {
    const map = new Map<string, StepGuide>()
    if (!recipe || !part || !steps) return map
    const method = equipmentProfile?.method ?? (recipe.type === 'biab' ? 'biab' : recipe.type)
    for (const step of steps) {
      const inSession = step.session != null
      map.set(
        step.id,
        stepGuide(step, {
          recipe: inSession ? part : recipe,
          volumes: inSession ? partVolumes : dayVolumes,
          method,
          sessions: brewSessions,
        }),
      )
    }
    return map
  }, [recipe, part, steps, partVolumes, dayVolumes, equipmentProfile, brewSessions])

  const { forget } = useBoilAlerts(steps, now, soundEnabled, play)

  // Étape affichée : la première pas encore faite de la session suivie (ou de toutes).
  useEffect(() => {
    if (!visibleSteps || visibleSteps.length === 0) return
    if (activeId !== null && visibleSteps.some((s) => s.id === activeId)) return
    setActiveId(initialActiveStep(visibleSteps)!.id)
  }, [visibleSteps, activeId])

  function showSession(session: number | null) {
    setSearchParams(session === null ? {} : { session: String(session) }, { replace: true })
  }

  /** Affiche une étape, en passant sur sa session si l'onglet en suit une autre. */
  function goToStep(step: BatchStep) {
    if (sessionFilter !== null && step.session != null && step.session !== sessionFilter) showSession(step.session)
    setActiveId(step.id)
    setOverviewOpen(false)
  }

  function goToNextUnfinished(step: BatchStep) {
    // Un ajout fait pendant l'ébullition ramène à l'ébullition tant qu'elle court : on ne passe à la suite qu'en la terminant.
    const boil = steps && BOIL_TRIGGERED_STEP_TYPES.includes(step.stepType) ? boilStepFor(steps, step) : undefined
    if (boil?.status === 'in-progress') {
      setActiveId(boil.id)
      return
    }
    const next = visibleSteps ? nextUnfinishedStep(visibleSteps, step) : null
    if (next) setActiveId(next.id)
  }

  const { error, startStep, completeStep, skipStep, resetStep, toggleItem, saveStepNotes } = useStepActions({
    batchId,
    onAdvance: goToNextUnfinished,
    onReset: (step) => forget(step.id),
  })

  const loadError = batchQuery.error ?? stepsQuery.error
  if (loadError && (!batch || !steps)) {
    return (
      <BrewDayLoadError
        message={loadError.message}
        onRetry={() => {
          if (batchQuery.isError) void batchQuery.refetch()
          if (stepsQuery.isError) void stepsQuery.refetch()
        }}
      />
    )
  }

  if (!batch || !steps || !visibleSteps || !recipe || !part) return <p className="text-slate-500">Chargement…</p>

  const groups = groupSteps(visibleSteps)
  const activeIndex = visibleSteps.findIndex((s) => s.id === activeId)
  const activeStep = activeIndex !== -1 ? visibleSteps[activeIndex] : undefined
  const activeGroup = groups.find((g) => g.steps.some(({ step }) => step.id === activeId))
  const checklistTotals = new Map(
    steps.map((s) => [s.id, checklistProgress(guides.get(s.id) ?? { checklist: [], tips: [] }, s)]),
  )
  // Ajouts à faire et ébullitions en cours : toutes sessions confondues.
  const dueSteps = steps.filter((step) => boilTiming(steps, step, now).timing.isDue)
  // Les minuteurs principaux (empâtage, ébullition) restent visibles pendant les sous-étapes ; l'ébullition tant que l'ébullition court, ou que des ajouts en dépendent encore (même terminée).
  // Une phase est close dès que l'étape qui la suit (chauffe pour l'empâtage, refroidissement pour l'ébullition) est entamée.
  const phaseEnded = (s: BatchStep) => {
    const next = s.stepType === 'mash' ? 'heat-to-boil' : 'cooling'
    return steps.some(
      (a) =>
        a.stepType === next &&
        (a.session == null || (s.session ?? null) === a.session) &&
        (!!a.actualStartAt || isStepFinished(a.status)),
    )
  }
  const runningBoils = steps.filter(
    (s) =>
      (s.stepType === 'boil' || s.stepType === 'mash') &&
      !!s.actualStartAt &&
      s.id !== activeStep?.id &&
      !phaseEnded(s) &&
      (s.status === 'in-progress' ||
        (s.stepType === 'boil' &&
          // Ébullition terminée plus tôt pour passer aux ajouts : elle reste affichée jusqu'au bout de sa durée prévue.
          (boilElapsedSeconds(s, now) < (s.plannedDurationMin ?? 0) * 60 ||
            steps.some(
              (a) =>
                (a.session ?? null) === (s.session ?? null) &&
                !isStepFinished(a.status) &&
                additionTiming(a, s, 0).triggerAtSeconds !== null,
            )))),
  )
  const stepMeasured = activeStep && stepMeasurement(batch, activeStep)
  const allDone = steps.every((s) => isStepFinished(s.status))
  const activeInSession = activeStep?.session != null
  const activeTiming = activeStep ? boilTiming(steps, activeStep, now) : undefined

  const overview = (
    <StepOverview
      groups={groups}
      activeIndex={activeIndex === -1 ? null : activeIndex}
      timingOf={(step) => boilTiming(steps, step, now)}
      checklistTotals={checklistTotals}
      onSelect={(index) => goToStep(visibleSteps[index])}
    />
  )

  return (
    <div className="flex flex-col">
      {brewSessions > 1 && <SessionTabs brewSessions={brewSessions} sessionFilter={sessionFilter} onSelect={showSession} />}

      {/* Phase en cours, alertes sonores, liste des étapes (sous les onglets du brassin) */}
      <div className="flex items-center gap-3">
        {activeGroup && <PhaseProgress group={activeGroup} activeId={activeId} onSelect={setActiveId} />}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <SoundToggle enabled={soundEnabled} onToggle={toggleSound} />
          <button
            type="button"
            onClick={() => setOverviewOpen(true)}
            className="rounded-full bg-slate-100 p-2 text-slate-600 lg:hidden"
            aria-label="Voir toutes les étapes"
          >
            <ListChecks size={20} />
          </button>
        </div>
      </div>

      <BrewDayBanners
        dueSteps={dueSteps}
        runningBoils={runningBoils}
        brewSessions={brewSessions}
        now={now}
        error={error}
        onGoToStep={goToStep}
      />

      <div className="flex-1 py-4 lg:grid lg:grid-cols-[320px_1fr] lg:gap-6">
        {/* Vue d'ensemble permanente — PC */}
        <aside className="hidden lg:block">
          <div className="sticky top-6 max-h-[calc(100dvh-3rem)] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-4">
            {overview}
          </div>
        </aside>

        <section className="min-w-0 space-y-4">
          <BrewBriefing steps={steps} />
          {activeStep && activeTiming && (
            <StepCard
              key={activeStep.id}
              step={activeStep}
              guide={guides.get(activeStep.id) ?? { checklist: [], tips: [] }}
              timing={activeTiming.timing}
              now={now}
              boilStarted={activeTiming.boilStarted}
              boilElapsedSeconds={activeTiming.boilElapsedSeconds}
              recipe={activeInSession ? part : recipe}
              totalGrainKg={partGrainKg}
              mashWaterL={partVolumes?.mashWaterL}
              onToggleItem={(itemId) => toggleItem(activeStep, itemId)}
              onSaveNotes={(notes) => saveStepNotes(activeStep, notes)}
              startBlockedBy={startBlocker(steps, activeStep)?.label ?? null}
              onStart={() => startStep(activeStep)}
              onStop={() => resetStep(activeStep)}
              measuredGravity={stepMeasured?.gravity}
              measuredVolumeL={stepMeasured?.volumeL}
              measurement={
                <>
                  <StepMeasurements
                    batch={batch}
                    step={activeStep}
                    recipe={recipe}
                    part={part}
                    planned={planned}
                    plannedSession={plannedSession}
                    equipment={equipmentProfile}
                    brewSessions={brewSessions}
                  />
                  {activeStep.stepType === 'pitch' && <BatchDeviceLink batchId={batch.id} />}
                </>
              }
            />
          )}

          {activeStep?.status === 'todo' && (
            <button
              type="button"
              onClick={() => skipStep(activeStep)}
              className="mx-auto flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100"
            >
              <SkipForward size={16} /> Passer cette étape
            </button>
          )}

          {allDone && <BrewDayEnd batchId={batch.id} fermentationSteps={recipe.fermentationSteps} />}
        </section>
      </div>

      {activeStep && (
        <StepActionBar
          step={activeStep}
          isFirst={activeIndex === 0}
          isLast={activeIndex === visibleSteps.length - 1}
          onPrevious={() => setActiveId(visibleSteps[Math.max(0, activeIndex - 1)].id)}
          onNext={() => setActiveId(visibleSteps[Math.min(visibleSteps.length - 1, activeIndex + 1)].id)}
          onComplete={() => {
            // Ébullition en cours avec du temps et des ajouts à venir : elle reste en cours, on passe juste à l'ajout suivant.
            const boilRunning =
              activeStep.stepType === 'boil' &&
              activeStep.status === 'in-progress' &&
              boilElapsedSeconds(activeStep, now) < (activeStep.plannedDurationMin ?? 0) * 60 &&
              steps.some(
                (a) =>
                  (a.session ?? null) === (activeStep.session ?? null) &&
                  !isStepFinished(a.status) &&
                  additionTiming(a, activeStep, 0).triggerAtSeconds !== null,
              )
            if (boilRunning) goToNextUnfinished(activeStep)
            else void completeStep(activeStep)
          }}
          onReset={() => resetStep(activeStep)}
        />
      )}

      {overviewOpen && <OverviewSheet onClose={() => setOverviewOpen(false)}>{overview}</OverviewSheet>}
    </div>
  )
}

/** Densité et volume déjà saisis pour l'étape (chauffe : pré-ébullition ; refroidissement : fin d'ébullition). */
function stepMeasurement(batch: BatchDetails, step: BatchStep) {
  const m = { ...batch.measurements, ...(step.session != null ? batch.sessionMeasurements[step.session - 1] : {}) }
  if (step.stepType === 'heat-to-boil') return { gravity: m.preBoilGravity, volumeL: m.preBoilVolumeL }
  if (step.stepType === 'cooling') return { gravity: m.postBoilGravity, volumeL: m.postBoilVolumeL }
  return null
}
