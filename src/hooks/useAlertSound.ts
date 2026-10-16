import { useRef } from 'react'

/**
 * Alertes sonores Web Audio. Le contexte audio doit être débloqué par une
 * interaction utilisateur (contrainte des navigateurs) via `unlock()`, à
 * appeler par exemple au premier clic sur la page Brew Day.
 */
export function useAlertSound() {
  const audioCtxRef = useRef<AudioContext | null>(null)

  function unlock() {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext()
    } else if (audioCtxRef.current.state === 'suspended') {
      void audioCtxRef.current.resume()
    }
  }

  function play() {
    const ctx = audioCtxRef.current
    if (!ctx) return

    const beepTimes = [0, 0.5, 1.0]
    for (const offset of beepTimes) {
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      oscillator.frequency.value = 880
      oscillator.connect(gain)
      gain.connect(ctx.destination)
      const startTime = ctx.currentTime + offset
      gain.gain.setValueAtTime(0.3, startTime)
      oscillator.start(startTime)
      oscillator.stop(startTime + 0.35)
    }
  }

  return { unlock, play }
}
