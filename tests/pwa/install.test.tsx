import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { InstallAppButton } from '@/components/InstallAppButton'
import { captureInstallPrompt, isIos } from '@/lib/pwa/install'

describe("Installer l'application", () => {
  it('reconnaît iPhone et iPad (y compris un iPad qui se dit Mac)', () => {
    expect(isIos('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5)).toBe(true)
    expect(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true)
    expect(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false)
    expect(isIos('Mozilla/5.0 (Linux; Android 15)', 5)).toBe(false)
  })

  it('rien tant que le navigateur ne propose pas l’installation, puis ouvre sa fenêtre', async () => {
    captureInstallPrompt(window)
    render(<InstallAppButton className="" />)
    expect(screen.queryByRole('button', { name: "Installer l'application" })).not.toBeInTheDocument()

    const prompt = vi.fn(async () => {})
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted' as const }),
    })
    act(() => {
      window.dispatchEvent(event)
    })
    // Le bandeau automatique du navigateur est remplacé par notre bouton.
    expect(event.defaultPrevented).toBe(true)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: "Installer l'application" }))
    })
    expect(prompt).toHaveBeenCalledOnce()
    // Installée : le bouton disparaît.
    expect(screen.queryByRole('button', { name: "Installer l'application" })).not.toBeInTheDocument()
  })
})
