import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router-dom'
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
import { BrewBriefing } from '@/components/brew-day/BrewBriefing'
import { BrewDayEnd } from '@/components/brew-day/BrewDayEnd'
import { MeasurementsPanel } from '@/components/batches/MeasurementsPanel'
import { StepCard } from '@/components/brew-day/StepCard'
import { StepOverview } from '@/components/brew-day/StepOverview'
import { boilElapsedSeconds, boilTiming, groupSteps } from '@/components/brew-day/stepMeta'
import { useAlertSound } from '@/hooks/useAlertSound'
import { formatDuration, useNowTick } from '@/hooks/useBrewTimer'
import { useWakeLock } from '@/hooks/useWakeLock'
import { fermentableUse } from '@/lib/brew-calc/gravity'
import { checklistProgress, stepGuide, type StepGuide } from '@/lib/brew-day/checklist'
import { startBlocker } from '@/lib/brew-day/order'
import { derivedOg, plannedMeasurements, type MeasurementKey } from '@/lib/brew-day/measurements'
import {
  blendedFermenter,
  scaleVolumes,
  SESSION_MEASUREMENT_LABELS,
  sessionRecipe,
  sessionVolumes,
  type SessionMeasurementKey,
} from '@/lib/brew-day/sessions'
import {
  getBatchSteps,
  isStepFinished,
  getBatchWithDetails,
  resetBatchStep,
  updateBatchSessionMeasurements,
  updateBatchStepChecklist,
  updateBatchStepNotes,
  updateBatchStepStatus,
  type BatchStep,
  type BatchStepType,
} from '@/lib/db/queries/batches'
import { getEquipmentProfile } from '@/lib/db/queries/equipmentProfiles'

/** Mesures à relever à chaque étape (comme dans Brewfather), comparées aux valeurs de la recette. */
const STEP_MEASUREMENTS: Partial<Record<BatchStepType, MeasurementKey[]>> = {
  mash: ['mashPh', 'mashTempReachedC'],
  'heat-to-boil': ['preBoilVolumeL', 'preBoilGravity'],
  cooling: ['postBoilVolumeL', 'postBoilGravity'],
  pitch: ['fermenterTopUpL', 'fermenterVolumeL', 'og'],
}

/** Brassin en plusieurs sessions : mesures propres à chaque session (le volume versé au fermenteur en plus). */
const SESSION_STEP_MEASUREMENTS: Partial<Record<BatchStepType, SessionMeasurementKey[]>> = {
  'heat-to-boil': ['preBoilVolumeL', 'preBoilGravity'],
  cooling: ['postBoilVolumeL', 'postBoilGravity', 'fermenterVolumeL'],
}

export function BrewDay() {
  const { batchId } = useParams<{ batchId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const { unlock, play } = useAlertSound()
  const [soundEnabled, setSoundEnabled] = useState(false)
  const alertedStepIds = useRef(new Set<string>())
  const now = useNowTick()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overviewOpen, setOverviewOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
  const sessionParam = Number(searchParams.get('session'))
  const sessionFilter = brewSessions > 1 && sessionParam >= 1 && sessionParam <= brewSessions ? sessionParam : null
  const visibleSteps = useMemo(
    () => steps?.filter((s) => sessionFilter === null || s.session == null || s.session === sessionFilter),
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

  // Alertes de toutes les sessions, même celles d'un autre onglet : un ajout oublié coûte plus qu'un bip en double.
  useEffect(() => {
    if (!soundEnabled || !steps) return
    for (const step of steps) {
      if (boilTiming(steps, step, now).timing.isDue && !alertedStepIds.current.has(step.id)) {
        alertedStepIds.current.add(step.id)
        play()
        document.title = `⏰ ${step.label} — BrewAtHome`
      }
    }
  }, [now, steps, soundEnabled, play])

  // Étape affichée : la première pas encore faite de la session suivie (ou de toutes).
  useEffect(() => {
    if (!visibleSteps || visibleSteps.length === 0) return
    if (activeId !== null && visibleSteps.some((s) => s.id === activeId)) return
    const firstNotDone = visibleSteps.find((s) => !isStepFinished(s.status))
    setActiveId((firstNotDone ?? visibleSteps[visibleSteps.length - 1]).id)
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

  /** Exécute une écriture ; renvoie false si elle a échoué (l'erreur est alors affichée). */
  async function run(action: () => Promise<void>): Promise<boolean> {
    setError(null)
    try {
      await action()
      return true
    } catch (err) {
      setError((err as Error).message)
      return false
    } finally {
      queryClient.invalidateQueries({ queryKey: ['batch-steps', batchId] })
    }
  }

  function startStep(step: BatchStep) {
    return run(() => updateBatchStepStatus(step.id, 'in-progress', { actualStartAt: new Date().toISOString() }))
  }

  async function completeStep(step: BatchStep) {
    if (!(await run(() => updateBatchStepStatus(step.id, 'done', { actualEndAt: new Date().toISOString() })))) return
    document.title = 'BrewAtHome'
    goToNextUnfinished(step)
  }

  async function skipStep(step: BatchStep) {
    if (!(await run(() => updateBatchStepStatus(step.id, 'skipped')))) return
    goToNextUnfinished(step)
  }

  // Enchaîne sur la prochaine étape ni terminée ni passée : de la même session d'abord, puis dans l'ordre de la journée.
  function goToNextUnfinished(step: BatchStep) {
    if (!visibleSteps) return
    const index = visibleSteps.findIndex((s) => s.id === step.id)
    const after = visibleSteps.filter((s, i) => i > index && s.id !== step.id && !isStepFinished(s.status))
    const next = (step.session != null && after.find((s) => s.session === step.session)) || after[0]
    if (next) setActiveId(next.id)
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

  function saveStepNotes(step: BatchStep, notes: string) {
    const value = notes.trim() === '' ? null : notes
    if (value === step.notes) return
    // Mise à jour optimiste : le refetch toutes les 5 s ne doit pas effacer la note tout juste saisie.
    queryClient.setQueryData<BatchStep[]>(['batch-steps', batchId], (old) =>
      old?.map((s) => (s.id === step.id ? { ...s, notes: value } : s)),
    )
    return run(() => updateBatchStepNotes(step.id, value))
  }

  const loadError = batchQuery.error ?? stepsQuery.error
  if (loadError && (!batch || !steps)) {
    return (
      <div role="alert" className="space-y-3 rounded-2xl bg-red-50 p-4 text-red-700">
        <p>Impossible de charger le Brew Day : {loadError.message}</p>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            if (batchQuery.isError) void batchQuery.refetch()
            if (stepsQuery.isError) void stepsQuery.refetch()
          }}
        >
          Réessayer
        </button>
      </div>
    )
  }

  if (!batch || !steps || !visibleSteps || !recipe || !part) return <p className="text-slate-500">Chargement…</p>

  const groups = groupSteps(visibleSteps)
  const activeIndex = visibleSteps.findIndex((s) => s.id === activeId)
  const activeStep = activeIndex !== -1 ? visibleSteps[activeIndex] : undefined
  const activeGroup = groups.find((g) => g.steps.some(({ step }) => step.id === activeId))
  const positionInGroup = activeGroup ? activeGroup.steps.findIndex(({ step }) => step.id === activeId) : -1
  const checklistTotals = new Map(
    steps.map((s) => [s.id, checklistProgress(guides.get(s.id) ?? { checklist: [], tips: [] }, s)]),
  )
  // Ajouts à faire et ébullitions en cours : toutes sessions confondues.
  const dueSteps = steps.filter((step) => boilTiming(steps, step, now).timing.isDue)
  const runningBoils = steps.filter(
    (s) => s.stepType === 'boil' && s.status === 'in-progress' && !!s.actualStartAt && s.id !== activeStep?.id,
  )
  const allDone = steps.every((s) => isStepFinished(s.status))
  const activeInSession = activeStep?.session != null
  const activeSessionIndex = activeStep?.session != null ? activeStep.session - 1 : null
  const sessionFields = activeStep && activeInSession ? SESSION_STEP_MEASUREMENTS[activeStep.stepType] : undefined
  const batchFields = activeStep && !sessionFields ? STEP_MEASUREMENTS[activeStep.stepType] : undefined
  // DI et volume du fermenteur rempli par les sessions, proposés à l'ensemencement.
  const blend = brewSessions > 1 ? blendedFermenter(batch.sessionMeasurements, batch.measurements.fermenterTopUpL) : null
  // Session unique : DI déduite de la densité de fin d'ébullition (et de l'appoint d'eau enregistré).
  // Jamais proposée si la DI est déjà saisie : la mesure au densimètre prime.
  const endOfBoilOg = batch.measurements.og != null ? null : derivedOg(
    batch.measurements.postBoilGravity,
    batch.measurements.fermenterVolumeL,
    batch.measurements.fermenterTopUpL,
  )
  const endOfBoilOgLabel = (batch.measurements.fermenterTopUpL ?? 0) > 0 ? "Fin d'ébullition, avec appoint" : "Fin d'ébullition"

  const overview = (
    <StepOverview
      groups={groups}
      activeIndex={activeIndex === -1 ? null : activeIndex}
      timingOf={(step) => boilTiming(steps, step, now)}
      checklistTotals={checklistTotals}
      onSelect={(index) => goToStep(visibleSteps[index])}
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
        soundEnabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
      }`}
      aria-label={soundEnabled ? 'Couper les alertes sonores' : 'Activer les alertes sonores'}
    >
      {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
      <span className="hidden sm:inline">{soundEnabled ? 'Alertes activées' : 'Activer les alertes'}</span>
    </button>
  )

  let measurement: React.ReactNode = undefined
  if (activeStep && sessionFields && activeSessionIndex !== null && plannedSession) {
    measurement = (
      <MeasurementsPanel
        batchId={batch.id}
        fields={sessionFields}
        measured={{ ...batch.measurements, ...batch.sessionMeasurements[activeSessionIndex] }}
        planned={plannedSession}
        recipe={part}
        equipment={equipmentProfile}
        labels={SESSION_MEASUREMENT_LABELS}
        title={`Mesures de la session ${activeStep.session}`}
        onSave={(changes) => updateBatchSessionMeasurements(batch.id, activeSessionIndex, changes)}
      />
    )
  } else if (activeStep && batchFields && planned) {
    measurement = (
      <MeasurementsPanel
        batchId={batch.id}
        fields={batchFields}
        measured={batch.measurements}
        planned={planned}
        recipe={recipe}
        equipment={equipmentProfile}
        title="Mesures de l'étape"
        suggestions={
          activeStep.stepType === 'pitch' && blend
            ? {
                og: { value: blend.og, label: 'Mélange des sessions' },
                fermenterVolumeL: { value: blend.volumeL, label: 'Versé par les sessions' },
              }
            : activeStep.stepType === 'pitch' && endOfBoilOg != null
              ? { og: { value: endOfBoilOg, label: endOfBoilOgLabel } }
              : undefined
        }
      />
    )
  }

  return (
    <div className="flex flex-col">
      {/* Session suivie : un onglet par session, ou toutes à la suite */}
      {brewSessions > 1 && (
        <div className="mb-3 flex items-center gap-1 self-start rounded-full bg-slate-100 p-1 text-sm" role="group" aria-label="Session suivie">
          {[null, ...Array.from({ length: brewSessions }, (_, i) => i + 1)].map((session) => (
            <button
              key={session ?? 'all'}
              type="button"
              onClick={() => showSession(session)}
              aria-pressed={sessionFilter === session}
              className={`rounded-full px-3 py-1.5 font-medium ${
                sessionFilter === session ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'
              }`}
            >
              {session === null ? 'Toutes' : `Session ${session}`}
            </button>
          ))}
        </div>
      )}

      {/* Phase en cours, alertes sonores, liste des étapes (sous les onglets du brassin) */}
      <div className="flex items-center gap-3">
        {activeGroup && (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <p className="shrink-0 text-sm font-semibold text-slate-800">
              {activeGroup.icon} {activeGroup.label}
              <span className="font-normal text-slate-400">
                {' '}
                · {positionInGroup + 1}/{activeGroup.steps.length}
              </span>
            </p>
            <div className="flex flex-1 gap-1">
              {activeGroup.steps.map(({ step }) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setActiveId(step.id)}
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
        )}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {soundButton}
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

      {/* Bandeaux : ajouts à faire maintenant, ébullitions en cours ailleurs */}
      <div className="space-y-2 pt-3">
        {dueSteps.map((step) => (
          <button
            key={step.id}
            type="button"
            onClick={() => goToStep(step)}
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
          const remainingSec = (boil.plannedDurationMin ?? 0) * 60 - boilElapsedSeconds(boil, now)
          return (
            <button
              key={boil.id}
              type="button"
              onClick={() => goToStep(boil)}
              className="flex w-full items-center gap-2 rounded-2xl bg-orange-100 px-4 py-2.5 text-left text-sm font-medium text-orange-900"
            >
              <Flame size={18} className="shrink-0 text-orange-500" />
              <span className="flex-1">Ébullition{boil.session != null && brewSessions > 1 ? ` · session ${boil.session}` : ''}</span>
              <span className="font-mono font-bold tabular-nums">
                {remainingSec < 0 ? '+' : ''}
                {formatDuration(Math.abs(remainingSec))}
              </span>
            </button>
          )
        })}
        {error && <p className="rounded-2xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
      </div>

      <div className="flex-1 py-4 lg:grid lg:grid-cols-[320px_1fr] lg:gap-6">
        {/* Vue d'ensemble permanente — PC */}
        <aside className="hidden lg:block">
          <div className="sticky top-6 max-h-[calc(100dvh-3rem)] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-4">
            {overview}
          </div>
        </aside>

        <section className="min-w-0 space-y-4">
          <BrewBriefing steps={steps} />
          {activeStep && (
            <StepCard
              key={activeStep.id}
              step={activeStep}
              guide={guides.get(activeStep.id) ?? { checklist: [], tips: [] }}
              timing={boilTiming(steps, activeStep, now).timing}
              now={now}
              boilStarted={boilTiming(steps, activeStep, now).boilStarted}
              boilElapsedSeconds={boilTiming(steps, activeStep, now).boilElapsedSeconds}
              recipe={activeInSession ? part : recipe}
              totalGrainKg={partGrainKg}
              mashWaterL={partVolumes?.mashWaterL}
              onToggleItem={(itemId) => toggleItem(activeStep, itemId)}
              onSaveNotes={(notes) => saveStepNotes(activeStep, notes)}
              startBlockedBy={startBlocker(steps, activeStep)?.label ?? null}
              onStart={() => startStep(activeStep)}
              onStop={() => resetStep(activeStep)}
              measurement={measurement}
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

      {/* Barre d'actions : collée en bas sur mobile, sous la carte sur PC */}
      {activeStep && (
        <div className="sticky bottom-0 z-10 -mx-4 border-t border-slate-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:-mx-6 sm:px-6 lg:mx-0 lg:mb-4 lg:ml-[344px] lg:rounded-3xl lg:border lg:px-4 lg:pb-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveId(visibleSteps[Math.max(0, activeIndex - 1)].id)}
              disabled={activeIndex === 0}
              className="rounded-full border border-slate-200 p-3 text-slate-600 disabled:opacity-30"
              aria-label="Étape précédente"
            >
              <ChevronLeft size={20} />
            </button>

            <div className="flex flex-1 gap-2">
              {/* Démarrer / Arrêter sont sous le minuteur, dans la carte de l'étape. */}
              {!isStepFinished(activeStep.status) && (
                <button type="button" onClick={() => completeStep(activeStep)} className="btn-primary flex-1 py-3">
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
              onClick={() => setActiveId(visibleSteps[Math.min(visibleSteps.length - 1, activeIndex + 1)].id)}
              disabled={activeIndex === visibleSteps.length - 1}
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
