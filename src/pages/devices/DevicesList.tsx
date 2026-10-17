import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/AuthProvider'
import {
  createDevice,
  deleteDevice,
  listDevices,
  setDeviceActiveBatch,
  updateDeviceSettings,
  type Device,
  type DeviceType,
  type ISpindelSettings,
} from '@/lib/db/queries/devices'
import { listBatches } from '@/lib/db/queries/batches'
import { FieldLabel, InfoTooltip } from '@/components/InfoTooltip'

// L'iSpindel (service « HTTPS Post », firmware 6.6+) demande l'adresse du serveur et le chemin dans deux champs.
const ISPINDEL_SERVER = import.meta.env.VITE_SUPABASE_URL as string
const ISPINDEL_PATH = '/functions/v1/ispindel'
const FIRMWARE_VERSION = '7.3.3'
const FIRMWARE_URL = `https://github.com/universam1/iSpindel/releases/download/${FIRMWARE_VERSION}/firmware.bin`
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

export function DevicesList() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  // Relu toutes les 30 s pour que le statut « connecté » suive les envois de l'iSpindel.
  const {
    data: devices,
    isLoading,
    dataUpdatedAt,
  } = useQuery({ queryKey: ['devices'], queryFn: listDevices, refetchInterval: 30_000 })
  const { data: batches } = useQuery({ queryKey: ['batches'], queryFn: listBatches })
  const [name, setName] = useState('')
  const [type, setType] = useState<DeviceType>('ispindel')
  const [creating, setCreating] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const activeBatches = batches?.filter((b) => b.status !== 'completed') ?? []

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !name.trim()) return
    setCreating(true)
    try {
      await createDevice(user.id, type, name.trim())
      setName('')
      queryClient.invalidateQueries({ queryKey: ['devices'] })
    } finally {
      setCreating(false)
    }
  }

  async function handleAssign(deviceId: string, batchId: string) {
    await setDeviceActiveBatch(deviceId, batchId || null)
    queryClient.invalidateQueries({ queryKey: ['devices'] })
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cet appareil ?')) return
    await deleteDevice(id)
    queryClient.invalidateQueries({ queryKey: ['devices'] })
  }

  async function handleCopy(text: string, key: string) {
    await navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Appareils connectés</h1>
        <p className="text-slate-600">
          Associez un iSpindel à un brassin pour recevoir automatiquement densité et température dans le graphique
          de fermentation.
        </p>
      </div>

      <details className="card-tinted">
        <summary className="cursor-pointer font-semibold text-slate-900">
          Comment connecter un iSpindel ? (marche à suivre complète)
        </summary>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-700">
          <li>
            Ci-dessous, ajoutez un appareil de type <strong>iSpindel</strong> et donnez-lui un nom (ex : « iSpindel
            cuisine »). Ses champs de configuration apparaissent sous l'appareil, avec un token qui lui est propre.
          </li>
          <li>
            Sur l'iSpindel : maintenez le bouton reset pour le faire entrer en mode configuration Wi-Fi (il crée son
            propre point d'accès, ex. <code>iSpindel-XXXX</code>), connectez-vous dessus avec votre téléphone et ouvrez{' '}
            <code>192.168.4.1</code>.
          </li>
          <li>
            Ouvrez la page <strong>Info</strong> et lisez la version du firmware. Il faut la <strong>6.6 ou plus</strong>{' '}
            pour le service « HTTPS Post » : le serveur n'accepte que l'HTTPS, et en simple « HTTP » l'iSpindel ne suit
            pas la redirection, les mesures sont perdues.
          </li>
          <li>
            Firmware plus ancien (ex. 6.5.1) : mettez-le à jour.
            <ol className="mt-1 list-[lower-alpha] space-y-1 pl-5">
              <li>
                Recopiez d'abord vos réglages dans le bloc <strong>Réglages de l'iSpindel</strong> de l'appareil
                ci-dessous (polynôme, facteur batterie, intervalle) : le passage en version 7 efface toute la
                configuration. Notez aussi l'angle (tilt) affiché sur la page Info, iSpindel dans l'eau du robinet.
              </li>
              <li>
                Téléchargez le firmware {FIRMWARE_VERSION} <strong>pendant que le téléphone est encore sur votre Wi-Fi
                habituel</strong> (sur le point d'accès de l'iSpindel, il n'a plus Internet) :{' '}
                <a href={FIRMWARE_URL} className="font-medium text-indigo-600 underline">
                  firmware.bin
                </a>{' '}
                (environ 580 Ko).
              </li>
              <li>
                Reconnectez-vous au portail, page <strong>Maintenance</strong> : choisissez <code>firmware.bin</code>{' '}
                dans le formulaire « Firmware Update », puis <strong>update</strong>. Ne débranchez rien jusqu'au
                redémarrage. Le lien « github.com/universam1 » de cette page n'est qu'un lien vers le projet.
              </li>
              <li>
                Après la mise à jour, la page Info doit afficher {FIRMWARE_VERSION}. Remesurez l'angle dans la même
                eau : s'il a bougé de plus de 0,5°, la calibration est à refaire.
              </li>
            </ol>
          </li>
          <li>
            Dans <strong>Configuration</strong> : choisissez votre réseau Wi-Fi, ressaisissez vos réglages, puis
            remplissez <strong>Service Type</strong>, <strong>Server Address</strong> et <strong>Path / URI</strong>{' '}
            avec les valeurs affichées sous l'appareil (boutons « Copier ») et laissez <strong>Token</strong> vide.
            Enregistrez (save) — l'iSpindel redémarre.
          </li>
          <li>L'iSpindel n'envoie qu'à un seul service : il ne transmettra plus à Brewfather ou ailleurs.</li>
          <li>
            Plongez l'iSpindel dans le fermenteur, puis choisissez le <strong>brassin suivi</strong> dans le menu
            déroulant de l'appareil : sans brassin, les mesures reçues sont ignorées.
          </li>
          <li>
            Les mesures arrivent automatiquement (toutes les ~15 min par défaut) dans le graphique de la page{' '}
            <strong>Suivi de fermentation</strong> du brassin.
          </li>
        </ol>
      </details>

      <form onSubmit={handleCreate} className="card flex flex-wrap items-end gap-3">
        <div>
          <FieldLabel>Nom</FieldLabel>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="iSpindel Cuisine"
            required
            className="field-input"
          />
        </div>
        <div>
          <FieldLabel>Type</FieldLabel>
          <select value={type} onChange={(e) => setType(e.target.value as DeviceType)} className="field-input">
            <option value="ispindel">iSpindel</option>
            <option value="tilt">Tilt (saisie manuelle)</option>
          </select>
        </div>
        <button type="submit" disabled={creating} className="btn-primary">
          {creating ? 'Ajout…' : 'Ajouter un appareil'}
        </button>
      </form>

      {isLoading && <p className="text-slate-500">Chargement…</p>}

      <ul className="space-y-3">
        {devices?.map((device) => (
          <li key={device.id} className="card">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="font-semibold text-slate-900">
                  {device.name} <span className="badge ml-1">{device.type}</span>
                </h2>
                {device.type === 'ispindel' && <ConnectionBadge device={device} now={dataUpdatedAt} />}
              </div>
              <button onClick={() => handleDelete(device.id)} className="btn-danger shrink-0">
                Supprimer
              </button>
            </div>

            {device.type === 'ispindel' && (
              <div className="mt-3">
                <div className="flex items-center">
                  <span className="text-xs font-medium text-slate-600">À remplir dans la configuration de l'iSpindel</span>
                  <InfoTooltip text="Portail de l'iSpindel (192.168.4.1) → Configuration. Le token dans le chemin identifie l'appareil : gardez-le pour vous." />
                </div>
                <dl className="mt-1 divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
                  <ConfigRow label="Service Type" value="HTTPS Post" />
                  <ConfigRow
                    label="Server Address"
                    value={ISPINDEL_SERVER}
                    copied={copiedKey === `${device.id}:server`}
                    onCopy={() => handleCopy(ISPINDEL_SERVER, `${device.id}:server`)}
                  />
                  <ConfigRow
                    label="Path / URI"
                    value={`${ISPINDEL_PATH}?token=${device.apiToken}`}
                    copied={copiedKey === `${device.id}:path`}
                    onCopy={() => handleCopy(`${ISPINDEL_PATH}?token=${device.apiToken}`, `${device.id}:path`)}
                  />
                  <ConfigRow label="Token" value="(laisser vide)" muted />
                </dl>
              </div>
            )}

            <div className="mt-4">
              <FieldLabel>Brassin suivi</FieldLabel>
              <select
                value={device.activeBatchId ?? ''}
                onChange={(e) => handleAssign(device.id, e.target.value)}
                className="field-input max-w-xs"
              >
                <option value="">— Aucun —</option>
                {activeBatches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {device.type === 'ispindel' && <ISpindelSettingsForm device={device} />}
          </li>
        ))}
        {devices && devices.length === 0 && (
          <p className="text-sm text-slate-500">Aucun appareil pour l'instant.</p>
        )}
      </ul>
    </div>
  )
}

function ConnectionBadge({ device, now }: { device: Device; now: number }) {
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

function ConfigRow({
  label,
  value,
  muted,
  copied,
  onCopy,
}: {
  label: string
  value: string
  muted?: boolean
  copied?: boolean
  onCopy?: () => void
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <dt className="w-28 shrink-0 text-xs font-semibold text-slate-500">{label}</dt>
      <dd className={`min-w-0 flex-1 break-all font-mono text-xs ${muted ? 'text-slate-400' : 'text-slate-800'}`}>
        {value}
      </dd>
      {onCopy && (
        <button type="button" onClick={onCopy} className="btn-secondary btn-sm shrink-0" aria-label={`Copier ${label}`}>
          {copied ? 'Copié ✓' : 'Copier'}
        </button>
      )}
    </div>
  )
}

type SettingsForm = Record<keyof ISpindelSettings, string>

function toForm(s: ISpindelSettings): SettingsForm {
  const str = (v: string | number | undefined) => (v === undefined ? '' : String(v))
  return {
    firmware: str(s.firmware),
    polynomial: str(s.polynomial),
    batteryFactor: str(s.batteryFactor),
    intervalS: str(s.intervalS),
    tiltInWater: str(s.tiltInWater),
  }
}

function fromForm(f: SettingsForm): ISpindelSettings {
  // Virgule acceptée : le portail de l'iSpindel affiche « 191,80 ».
  const num = (v: string) => {
    const n = Number.parseFloat(v.replace(',', '.'))
    return Number.isFinite(n) ? n : undefined
  }
  const text = (v: string) => v.trim() || undefined
  return {
    firmware: text(f.firmware),
    polynomial: text(f.polynomial),
    batteryFactor: num(f.batteryFactor),
    intervalS: num(f.intervalS),
    tiltInWater: num(f.tiltInWater),
  }
}

/** Mémo des réglages saisis dans le portail : la mise à jour du firmware les efface. */
function ISpindelSettingsForm({ device }: { device: Device }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState(() => toForm(device.settings))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const set = (key: keyof ISpindelSettings) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [key]: e.target.value })
    setMessage(null)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await updateDeviceSettings(device.id, fromForm(form))
      setMessage('Réglages enregistrés ✓')
      queryClient.invalidateQueries({ queryKey: ['devices'] })
    } catch (err) {
      setMessage((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <details className="mt-4 rounded-xl border border-slate-200" open={!!device.settings.polynomial}>
      <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-slate-700">
        Réglages de l'iSpindel (mémo)
      </summary>
      <form onSubmit={handleSave} className="space-y-3 px-3 pb-3">
        <p className="text-xs text-slate-500">
          Recopiez ici les valeurs de la page Configuration de l'iSpindel : une mise à jour du firmware les efface, il
          suffira de les ressaisir.
        </p>
        <div>
          <FieldLabel hint="Champ « Polynominal » (Gravity conversion) : la calibration angle → densité de votre iSpindel. À recopier tel quel.">
            Polynôme
          </FieldLabel>
          <input value={form.polynomial} onChange={set('polynomial')} aria-label="Polynôme" className="field-input font-mono text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <FieldLabel hint="Version affichée sur la page Info du portail.">Firmware</FieldLabel>
            <input value={form.firmware} onChange={set('firmware')} aria-label="Firmware" placeholder={FIRMWARE_VERSION} className="field-input" />
          </div>
          <div>
            <FieldLabel hint="« Battery conversion factor » : calibre l'affichage de la tension de la batterie (191,8 par défaut).">
              Facteur batterie
            </FieldLabel>
            <input value={form.batteryFactor} onChange={set('batteryFactor')} aria-label="Facteur batterie" inputMode="decimal" className="field-input" />
          </div>
          <div>
            <FieldLabel hint="« Update Interval » : secondes entre deux mesures (900 = 15 min). Plus court use la batterie plus vite.">
              Intervalle (s)
            </FieldLabel>
            <input value={form.intervalS} onChange={set('intervalS')} aria-label="Intervalle (s)" inputMode="numeric" className="field-input" />
          </div>
          <div>
            <FieldLabel hint="Angle (tilt) affiché sur la page Info, iSpindel dans l'eau du robinet. Après une mise à jour du firmware, remesurez : plus de 0,5° d'écart = calibration à refaire.">
              Angle dans l'eau (°)
            </FieldLabel>
            <input value={form.tiltInWater} onChange={set('tiltInWater')} aria-label="Angle dans l'eau (°)" inputMode="decimal" className="field-input" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className="btn-primary btn-sm">
            {saving ? 'Enregistrement…' : 'Enregistrer les réglages'}
          </button>
          {message && <span className="text-sm text-slate-600">{message}</span>}
        </div>
      </form>
    </details>
  )
}
