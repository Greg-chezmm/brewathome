import { useCallback, useEffect, useRef, useState } from 'react'

const SOUND_PREFERENCE_KEY = 'brewathome.alert-sound'

/** Alertes sonores activées par défaut ; seul un « Couper » explicite est mémorisé. */
export function readSoundPreference(): boolean {
  try {
    return localStorage.getItem(SOUND_PREFERENCE_KEY) !== 'off'
  } catch {
    return true
  }
}

export function writeSoundPreference(enabled: boolean) {
  try {
    localStorage.setItem(SOUND_PREFERENCE_KEY, enabled ? 'on' : 'off')
  } catch {
    // Stockage indisponible (navigation privée…) : la préférence n'est simplement pas gardée.
  }
}

/**
 * Alertes sonores Web Audio. Le contexte audio doit être débloqué par une
 * interaction utilisateur (contrainte des navigateurs) via `unlock()`, à
 * appeler par exemple au premier clic sur la page Brew Day.
 */
export function useAlertSound() {
  const audioCtxRef = useRef<AudioContext | null>(null)

  const unlock = useCallback(() => {
    // Navigateur sans Web Audio : pas de son, mais pas d'erreur non plus.
    if (typeof AudioContext === 'undefined') return
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext()
      } else if (audioCtxRef.current.state === 'suspended') {
        void audioCtxRef.current.resume()
      }
    } catch {
      audioCtxRef.current = null
    }
  }, [])

  const play = useCallback(() => {
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
  }, [])

  return { unlock, play }
}

/**
 * Réglage des alertes du Brew Day : actives d'office, préférence mémorisée. L'audio est débloqué au premier
 * toucher de la page (et à chacun des suivants, qui reprend un contexte suspendu par le navigateur).
 */
export function useSoundSetting() {
  const { unlock, play } = useAlertSound()
  const [soundEnabled, setSoundEnabled] = useState(readSoundPreference)

  useEffect(() => {
    if (!soundEnabled) return
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [soundEnabled, unlock])

  const toggleSound = useCallback(() => {
    if (soundEnabled) {
      setSoundEnabled(false)
      writeSoundPreference(false)
      return
    }
    unlock()
    play()
    setSoundEnabled(true)
    writeSoundPreference(true)
  }, [soundEnabled, unlock, play])

  return { soundEnabled, toggleSound, play }
}
