import type { Device } from '@/lib/db/queries/devices'

const DEFAULT_INTERVAL_S = 900

/** Connecté si le dernier envoi date de moins de deux intervalles (+ 1 min de marge pour le Wi-Fi). */
function connectionStatus(lastSeenAt: string | null, intervalS: number | undefined, now: number) {
  if (!lastSeenAt) return { connected: false, ageSec: null }
  const ageSec = Math.max(0, Math.round((now - new Date(lastSeenAt).getTime()) / 1000))
  return { connected: ageSec <= 2 * (intervalS ?? DEFAULT_INTERVAL_S) + 60, ageSec }
}

function formatAge(sec: number): string {
  if (sec < 60) return "à l'instant"
  if (sec < 3600) return `il y a ${Math.floor(sec / 60)} min`
  if (sec < 86400) return `il y a ${Math.floor(sec / 3600)} h`
  return `il y a ${Math.floor(sec / 86400)} j`
}

/** Statut de connexion d'un iSpindel : vert si un envoi récent, orange sinon, gris s'il n'a jamais rien envoyé. */
export function ConnectionBadge({ device, now }: { device: Device; now: number }) {
  const { connected, ageSec } = connectionStatus(device.lastSeenAt, device.settings.intervalS, now)
  const tone = connected ? 'bg-green-500' : ageSec === null ? 'bg-slate-300' : 'bg-amber-500'
  const text = connected
    ? `Connecté · dernier signal ${formatAge(ageSec!)}`
    : ageSec === null
      ? 'Jamais connecté'
      : `Pas de signal depuis ${formatAge(ageSec).replace('il y a ', '')}`
  return (
    <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
      <span className={`h-2.5 w-2.5 rounded-full ${tone}`} />
      {text}
      {connected && !device.activeBatchId && (
        <span className="text-xs text-slate-400">— aucun brassin suivi : mesures non enregistrées</span>
      )}
    </p>
  )
}
