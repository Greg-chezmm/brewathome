import { useEffect, useRef } from 'react'
import { boilTiming } from '@/components/brew-day/stepMeta'
import type { BatchStep } from '@/lib/db/queries/batches'

const FERMENTATION_STEP_TYPES: BatchStep['stepType'][] = ['dry-hop-addition', 'other-fermentation-addition']

/**
 * Alerte sonore (et titre de l'onglet) quand un ajout de l'ébullition arrive à échéance.
 * Toutes les sessions comptent, même celles d'un autre onglet : un ajout oublié coûte plus qu'un bip en double.
 * Le titre change une fois par alerte ; le son, lui, est retenté à chaque tic tant que `play()` renvoie `false`
 * (audio suspendu par le navigateur) : une alerte muette ne doit pas passer pour émise.
 * Renvoie `forget(stepId)` pour ré-armer l'alerte d'une étape remise à zéro.
 */
export function useBoilAlerts(steps: BatchStep[] | undefined, now: number, enabled: boolean, play: () => boolean) {
  const titledKeys = useRef(new Set<string>())
  const soundedKeys = useRef(new Set<string>())

  // Rend son titre à l'onglet en quittant le Brew Day (déclaré avant l'effet d'alerte : il capture le titre d'origine).
  useEffect(() => {
    const originalTitle = document.title
    return () => {
      document.title = originalTitle
    }
  }, [])

  useEffect(() => {
    if (!enabled || !steps) return
    const alert = (key: string, title: string) => {
      if (!titledKeys.current.has(key)) {
        titledKeys.current.add(key)
        document.title = title
      }
      if (!soundedKeys.current.has(key) && play()) soundedKeys.current.add(key)
    }
    for (const step of steps) {
      if (boilTiming(steps, step, now).timing.isDue) alert(step.id, `⏰ ${step.label} — BrewAtHome`)
      // Minuteur arrivé à zéro : l'étape suivante peut commencer (les étapes de fermentation se comptent en jours, hors Brew Day).
      if (
        step.status === 'in-progress' &&
        step.actualStartAt &&
        step.plannedDurationMin &&
        !FERMENTATION_STEP_TYPES.includes(step.stepType) &&
        now - new Date(step.actualStartAt).getTime() >= step.plannedDurationMin * 60_000
      ) {
        alert(`end:${step.id}`, `⏰ Minuteur terminé : ${step.label} — BrewAtHome`)
      }
    }
  }, [now, steps, enabled, play])

  return {
    forget: (stepId: string) => {
      for (const keys of [titledKeys.current, soundedKeys.current]) {
        keys.delete(stepId)
        keys.delete(`end:${stepId}`)
      }
    },
  }
}
