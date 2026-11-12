import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, renderHook } from '@testing-library/react'
import { readSoundPreference, useAlertSound, useSoundSetting, writeSoundPreference } from '@/hooks/useAlertSound'

/** Faux AudioContext : compte les instances, comme le fait un navigateur qui exige un geste de l'utilisateur. */
const created = vi.hoisted(() => ({
  count: 0,
  resumed: 0,
  closed: 0,
  oscillators: 0,
  state: 'running' as 'running' | 'suspended',
  resumeRejects: false,
  hasClose: true,
  closeRejects: false,
}))
class FakeAudioContext {
  currentTime = 0
  destination = {}
  state = created.state
  close?: () => Promise<void>
  constructor() {
    created.count += 1
    if (created.hasClose) {
      this.close = () => {
        created.closed += 1
        return created.closeRejects ? Promise.reject(new Error('close refusé')) : Promise.resolve()
      }
    }
  }
  resume() {
    created.resumed += 1
    if (created.resumeRejects) return Promise.reject(new Error('resume refusé'))
    this.state = 'running'
    return Promise.resolve()
  }
  createOscillator() {
    created.oscillators += 1
    return { frequency: { value: 0 }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() }
  }
  createGain() {
    return { gain: { setValueAtTime: vi.fn() }, connect: vi.fn() }
  }
}

beforeEach(() => {
  localStorage.clear()
  created.count = 0
  created.resumed = 0
  created.state = 'running'
  created.closed = 0
  created.oscillators = 0
  created.resumeRejects = false
  created.hasClose = true
  created.closeRejects = false
  vi.stubGlobal('AudioContext', FakeAudioContext)
})
afterEach(() => vi.unstubAllGlobals())

const gesture = () => fireEvent.pointerDown(document.body)

describe('préférence du son', () => {
  it('est activée par défaut', () => {
    expect(readSoundPreference()).toBe(true)
  })

  it('se souvient d’un son coupé, puis réactivé', () => {
    writeSoundPreference(false)
    expect(readSoundPreference()).toBe(false)
    writeSoundPreference(true)
    expect(readSoundPreference()).toBe(true)
  })

  it('reste activée si le stockage du navigateur est inaccessible', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('stockage bloqué')
    })
    expect(readSoundPreference()).toBe(true)
    vi.restoreAllMocks()
  })
})

describe('useAlertSound.unlock', () => {
  it('ne plante pas sur un navigateur sans Web Audio', () => {
    vi.stubGlobal('AudioContext', undefined)
    const { result } = renderHook(() => useAlertSound())
    expect(() => act(() => result.current.unlock())).not.toThrow()
    expect(() => act(() => result.current.play())).not.toThrow()
  })

  it('reprend un contexte suspendu au lieu d’en créer un second', () => {
    created.state = 'suspended'
    const { result } = renderHook(() => useAlertSound())
    act(() => result.current.unlock())
    act(() => result.current.unlock())
    expect(created.count).toBe(1)
    expect(created.resumed).toBe(1)
  })
})

describe('useAlertSound.play', () => {
  it('renvoie false sans contexte audio', () => {
    const { result } = renderHook(() => useAlertSound())
    let played = true
    act(() => {
      played = result.current.play()
    })
    expect(played).toBe(false)
    expect(created.oscillators).toBe(0)
  })

  it('renvoie true et programme les bips sur un contexte actif', () => {
    const { result } = renderHook(() => useAlertSound())
    act(() => result.current.unlock())
    let played = false
    act(() => {
      played = result.current.play()
    })
    expect(played).toBe(true)
    expect(created.oscillators).toBe(3)
  })

  it('renvoie false sur un contexte suspendu, tente de le reprendre, puis réussit au rappel', async () => {
    created.state = 'suspended'
    const { result } = renderHook(() => useAlertSound())
    act(() => result.current.unlock())
    created.resumed = 0
    let first = true
    await act(async () => {
      first = result.current.play()
    })
    expect(first).toBe(false)
    expect(created.resumed).toBe(1)
    expect(created.oscillators).toBe(0)

    let second = false
    act(() => {
      second = result.current.play()
    })
    expect(second).toBe(true)
    expect(created.oscillators).toBe(3)
  })

  it('ne plante pas si la reprise du contexte est refusée', async () => {
    created.state = 'suspended'
    created.resumeRejects = true
    const { result } = renderHook(() => useAlertSound())
    act(() => result.current.unlock())
    let played = true
    await act(async () => {
      played = result.current.play()
      await Promise.resolve()
    })
    expect(played).toBe(false)
  })
})

describe('useAlertSound (démontage)', () => {
  it('ferme le contexte audio au démontage', () => {
    const { result, unmount } = renderHook(() => useAlertSound())
    act(() => result.current.unlock())
    unmount()
    expect(created.closed).toBe(1)
  })

  it('ne plante pas si close est absent', () => {
    created.hasClose = false
    const { result, unmount } = renderHook(() => useAlertSound())
    act(() => result.current.unlock())
    expect(() => unmount()).not.toThrow()
  })

  it('ne plante pas si close est refusé', async () => {
    created.closeRejects = true
    const { result, unmount } = renderHook(() => useAlertSound())
    act(() => result.current.unlock())
    expect(() => unmount()).not.toThrow()
    await Promise.resolve()
    expect(created.closed).toBe(1)
  })
})

describe('useSoundSetting', () => {
  it('démarre avec les alertes activées', () => {
    const { result } = renderHook(() => useSoundSetting())
    expect(result.current.soundEnabled).toBe(true)
  })

  it('respecte un son coupé lors d’une visite précédente', () => {
    writeSoundPreference(false)
    const { result } = renderHook(() => useSoundSetting())
    expect(result.current.soundEnabled).toBe(false)
  })

  it('débloque l’audio au premier geste, sans en créer un second ensuite', () => {
    renderHook(() => useSoundSetting())
    expect(created.count).toBe(0)

    gesture()
    expect(created.count).toBe(1)

    gesture()
    expect(created.count).toBe(1)
  })

  it('ne touche pas à l’audio si le son est coupé', () => {
    writeSoundPreference(false)
    renderHook(() => useSoundSetting())
    gesture()
    expect(created.count).toBe(0)
  })

  it('ne plante pas au premier geste sans Web Audio', () => {
    vi.stubGlobal('AudioContext', undefined)
    renderHook(() => useSoundSetting())
    expect(() => gesture()).not.toThrow()
  })

  it('couper le son le mémorise pour la prochaine visite', () => {
    const { result, unmount } = renderHook(() => useSoundSetting())
    act(() => result.current.toggleSound())
    expect(result.current.soundEnabled).toBe(false)
    unmount()

    const next = renderHook(() => useSoundSetting())
    expect(next.result.current.soundEnabled).toBe(false)
  })

  it('réactiver le son débloque l’audio tout de suite et le mémorise', () => {
    writeSoundPreference(false)
    const { result } = renderHook(() => useSoundSetting())
    act(() => result.current.toggleSound())
    expect(result.current.soundEnabled).toBe(true)
    expect(created.count).toBe(1)
    expect(readSoundPreference()).toBe(true)
  })
})
