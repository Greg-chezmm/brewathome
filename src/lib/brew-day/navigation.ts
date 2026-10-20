import { isStepFinished, type BatchStep } from '@/lib/db/queries/batches'

/** Session suivie, lue dans l'URL (?session=2) : null = toutes, ou si le brassin n'a qu'une session / valeur invalide. */
export function sessionFilterFromParam(rawParam: string | null, brewSessions: number): number | null {
  const param = Number(rawParam)
  return brewSessions > 1 && param >= 1 && param <= brewSessions ? param : null
}

/** Étapes de la session suivie, plus les étapes communes à toutes les sessions. */
export function filterStepsBySession(steps: BatchStep[], sessionFilter: number | null): BatchStep[] {
  return steps.filter((s) => sessionFilter === null || s.session == null || s.session === sessionFilter)
}

/** Étape à afficher d'emblée : la première pas encore faite, à défaut la dernière. Null sans étape. */
export function initialActiveStep(visibleSteps: BatchStep[]): BatchStep | null {
  if (visibleSteps.length === 0) return null
  return visibleSteps.find((s) => !isStepFinished(s.status)) ?? visibleSteps[visibleSteps.length - 1]
}

/** Prochaine étape ni terminée ni passée : de la même session d'abord, puis dans l'ordre de la journée. */
export function nextUnfinishedStep(visibleSteps: BatchStep[], step: BatchStep): BatchStep | null {
  const index = visibleSteps.findIndex((s) => s.id === step.id)
  const after = visibleSteps.filter((s, i) => i > index && s.id !== step.id && !isStepFinished(s.status))
  return (step.session != null && after.find((s) => s.session === step.session)) || after[0] || null
}
