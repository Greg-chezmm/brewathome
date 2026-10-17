import { useState } from 'react'
import { Download, Share, SquarePlus, X } from 'lucide-react'
import { useInstallApp } from '@/lib/pwa/install'

/**
 * « Installer l'application » : icône sur l'écran d'accueil / le bureau, ouverture plein écran sans barre d'adresse.
 * Rien n'est affiché si l'app est déjà installée ou si le navigateur ne sait pas l'installer.
 */
export function InstallAppButton({ className }: { className: string }) {
  const { mode, install } = useInstallApp()
  const [iosHelpOpen, setIosHelpOpen] = useState(false)
  if (!mode) return null

  return (
    <>
      <button type="button" onClick={() => (mode === 'prompt' ? void install() : setIosHelpOpen(true))} className={className}>
        <Download size={18} />
        Installer l'application
      </button>
      {iosHelpOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4" onClick={() => setIosHelpOpen(false)}>
          <div
            role="dialog"
            aria-label="Installer sur iPhone"
            className="w-full max-w-sm rounded-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-slate-700 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="font-semibold text-slate-900">Installer sur l'iPhone</p>
              <button type="button" onClick={() => setIosHelpOpen(false)} className="rounded-full p-1 text-slate-400" aria-label="Fermer">
                <X size={20} />
              </button>
            </div>
            <ol className="space-y-3 text-sm">
              <li className="flex items-center gap-3">
                <span className="rounded-lg bg-slate-100 p-1.5 text-indigo-600">
                  <Share size={18} />
                </span>
                Dans Safari, touche le bouton Partager.
              </li>
              <li className="flex items-center gap-3">
                <span className="rounded-lg bg-slate-100 p-1.5 text-indigo-600">
                  <SquarePlus size={18} />
                </span>
                Choisis « Sur l'écran d'accueil », puis « Ajouter ».
              </li>
            </ol>
            <p className="mt-3 text-xs text-slate-500">BrewAtHome s'ouvrira ensuite comme une app, en plein écran.</p>
          </div>
        </div>
      )}
    </>
  )
}
