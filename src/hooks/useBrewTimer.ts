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

export function formatDuration(totalSeconds: number): string {
  const sign = totalSeconds < 0 ? '-' : ''
  const abs = Math.abs(totalSeconds)
  const minutes = Math.floor(abs / 60)
  const seconds = abs % 60
  return `${sign}${minutes}:${seconds.toString().padStart(2, '0')}`
}
