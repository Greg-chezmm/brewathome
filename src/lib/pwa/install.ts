import { useSyncExternalStore } from 'react'

/** Événement Chrome / Edge / Android annonçant que l'app peut être installée (non typé par TypeScript). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null
let installed = false
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

/**
 * À appeler au démarrage, avant React : le navigateur n'émet `beforeinstallprompt` qu'une fois,
 * souvent avant le premier rendu. On le garde pour proposer l'installation depuis notre propre bouton.
 */
export function captureInstallPrompt(target: Window = window) {
  target.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt = event as BeforeInstallPromptEvent
    notify()
  })
  target.addEventListener('appinstalled', () => {
    deferredPrompt = null
    installed = true
    notify()
  })
}

/** L'app tourne-t-elle déjà installée (fenêtre à part, sans barre d'adresse) ? */
export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/** iPhone / iPad : pas de bouton d'installation possible, il faut passer par « Partager → Sur l'écran d'accueil ». */
export function isIos(userAgent = navigator.userAgent, touchPoints = navigator.maxTouchPoints): boolean {
  // Les iPad récents se présentent comme un Mac, mais tactile.
  return /iphone|ipad|ipod/i.test(userAgent) || (/macintosh/i.test(userAgent) && touchPoints > 1)
}

export type InstallMode = 'prompt' | 'ios' | null

function snapshot(): InstallMode {
  if (installed || isStandalone()) return null
  if (deferredPrompt) return 'prompt'
  return isIos() ? 'ios' : null
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Comment proposer l'installation ici : fenêtre du navigateur, explication iPhone, ou rien (déjà installée / navigateur incompatible). */
export function useInstallApp(): { mode: InstallMode; install: () => Promise<void> } {
  const mode = useSyncExternalStore(subscribe, snapshot, () => null)
  async function install() {
    if (!deferredPrompt) return
    const prompt = deferredPrompt
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    // Le même événement ne peut servir qu'une fois.
    deferredPrompt = null
    if (outcome === 'accepted') installed = true
    notify()
  }
  return { mode, install }
}
