import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useWakeLock } from '@/hooks/useWakeLock'

function fakeSentinel() {
  return { release: vi.fn(async () => {}) }
}

/** Requête de verrou que le test résout à la main, pour simuler une réponse lente. */
function deferredRequest() {
  let resolve!: (sentinel: ReturnType<typeof fakeSentinel>) => void
  const promise = new Promise<ReturnType<typeof fakeSentinel>>((r) => (resolve = r))
  return { promise, resolve }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('useWakeLock', () => {
  const request = vi.fn()

  beforeEach(() => {
    request.mockReset()
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true })
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  })

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'wakeLock')
  })

  it('demande le verrou d’écran et le libère au démontage', async () => {
    const sentinel = fakeSentinel()
    request.mockResolvedValue(sentinel)
    const { unmount } = renderHook(() => useWakeLock(true))
    await flush()
    expect(request).toHaveBeenCalledWith('screen')
    unmount()
    expect(sentinel.release).toHaveBeenCalledTimes(1)
  })

  it('ne demande rien quand il est désactivé', async () => {
    renderHook(() => useWakeLock(false))
    await flush()
    expect(request).not.toHaveBeenCalled()
  })

  it('libère un verrou obtenu après le démontage, au lieu de le garder pour toujours', async () => {
    const pending = deferredRequest()
    request.mockReturnValue(pending.promise)
    const { unmount } = renderHook(() => useWakeLock(true))
    unmount()

    const lateSentinel = fakeSentinel()
    pending.resolve(lateSentinel)
    await flush()

    expect(lateSentinel.release).toHaveBeenCalledTimes(1)
  })

  it('libère l’ancien verrou quand le retour sur l’onglet en obtient un nouveau', async () => {
    const first = fakeSentinel()
    const second = fakeSentinel()
    request.mockResolvedValueOnce(first).mockResolvedValueOnce(second)
    const { unmount } = renderHook(() => useWakeLock(true))
    await flush()

    document.dispatchEvent(new Event('visibilitychange'))
    await flush()

    expect(request).toHaveBeenCalledTimes(2)
    expect(first.release).toHaveBeenCalledTimes(1)
    expect(second.release).not.toHaveBeenCalled()

    unmount()
    expect(second.release).toHaveBeenCalledTimes(1)
  })

  it('continue sans verrou si la demande est refusée', async () => {
    request.mockRejectedValue(new Error('NotAllowedError'))
    const { unmount } = renderHook(() => useWakeLock(true))
    await flush()
    expect(() => unmount()).not.toThrow()
  })
})
