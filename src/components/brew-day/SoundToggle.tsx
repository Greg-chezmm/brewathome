import { Volume2, VolumeX } from 'lucide-react'

interface SoundToggleProps {
  enabled: boolean
  onToggle: () => void
}

/** Active ou coupe les alertes sonores des ajouts à l'ébullition. */
export function SoundToggle({ enabled, onToggle }: SoundToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium ${
        enabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
      }`}
      aria-label={enabled ? 'Couper les alertes sonores' : 'Activer les alertes sonores'}
    >
      {enabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
      <span className="hidden sm:inline">{enabled ? 'Alertes activées' : 'Activer les alertes'}</span>
    </button>
  )
}
