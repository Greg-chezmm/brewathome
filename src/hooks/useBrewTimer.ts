import { useEffect, useState } from 'react'

/**
 * Secondes écoulées depuis `startAtIso`, recalculées par différence de
 * timestamps (pas de `setInterval` cumulatif qui dérive) et rafraîchies
 * chaque seconde pour l'affichage.
 */
export function useElapsedSeconds(startAtIso: string | null): number {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!startAtIso) {
      setElapsed(0)
      return
    }
    const startMs = new Date(startAtIso).getTime()
    function tick() {
      setElapsed(Math.max(0, Math.floor((Date.now() - startMs) / 1000)))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startAtIso])

  return elapsed
}

/** "Horloge" partagée, rafraîchie chaque seconde, pour dériver l'état de
 * plusieurs chronomètres (un par étape) sans empiler un hook par élément de
 * liste (ce qui violerait les règles des hooks React dans un .map). */
export function useNowTick(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

export function formatDuration(totalSeconds: number): string {
  const sign = totalSeconds < 0 ? '-' : ''
  const abs = Math.abs(totalSeconds)
  const minutes = Math.floor(abs / 60)
  const seconds = abs % 60
  return `${sign}${minutes}:${seconds.toString().padStart(2, '0')}`
}

/**
 * Format jours/heures/minutes pour les durées longues (houblonnage à froid,
 * plusieurs jours) — `formatDuration` en M:SS serait illisible sur ces échelles.
 */
export function formatDurationLong(totalSeconds: number): string {
  const sign = totalSeconds < 0 ? '-' : ''
  const abs = Math.abs(totalSeconds)
  const totalMinutes = Math.floor(abs / 60)
  const days = Math.floor(totalMinutes / (24 * 60))
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return `${sign}${days} j ${hours} h`
  if (hours > 0) return `${sign}${hours} h ${minutes} min`
  return `${sign}${minutes} min`
}
