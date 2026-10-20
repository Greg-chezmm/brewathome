import { useEffect, useRef } from 'react'

/** Garde l'écran allumé tant que `enabled` est vrai (ré-acquis après changement d'onglet). */
export function useWakeLock(enabled: boolean) {
  const lockRef = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return

    let cancelled = false

    async function acquire() {
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (cancelled) {
          // Démonté pendant la requête : le nettoyage est déjà passé, ce verrou ne serait jamais libéré.
          lock.release().catch(() => {})
          return
        }
        lockRef.current?.release().catch(() => {})
        lockRef.current = lock
      } catch {
        // Permission refusée ou appareil en économie d'énergie : on continue
        // sans wake lock, les alertes sonores restent le filet de secours
        // principal tant que l'onglet est au premier plan.
      }
    }

    acquire()

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible' && !cancelled) {
        acquire()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      lockRef.current?.release().catch(() => {})
      lockRef.current = null
    }
  }, [enabled])
}
