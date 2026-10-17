import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/AuthProvider'
import {
  createDevice,
  deleteDevice,
  listDevices,
  setDeviceActiveBatch,
  type DeviceType,
} from '@/lib/db/queries/devices'
import { listBatches } from '@/lib/db/queries/batches'
import { FieldLabel, InfoTooltip } from '@/components/InfoTooltip'

const SUPABASE_FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ispindel`

export function DevicesList() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data: devices, isLoading } = useQuery({ queryKey: ['devices'], queryFn: listDevices })
  const { data: batches } = useQuery({ queryKey: ['batches'], queryFn: listBatches })
  const [name, setName] = useState('')
  const [type, setType] = useState<DeviceType>('ispindel')
  const [creating, setCreating] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

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

  async function handleCopy(url: string, deviceId: string) {
    await navigator.clipboard.writeText(url)
    setCopiedId(deviceId)
    setTimeout(() => setCopiedId(null), 2000)
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
            cuisine »).
          </li>
          <li>
            Une URL unique apparaît sous l'appareil, avec un token qui lui est propre — copiez-la en entier (bouton
            « Copier »).
          </li>
          <li>
            Sur l'iSpindel : maintenez le bouton reset pour le faire entrer en mode configuration Wi-Fi (il crée son
            propre point d'accès, ex. <code>iSpindel-XXXX</code>), connectez-vous dessus avec votre téléphone/PC.
          </li>
          <li>
            Dans le portail de configuration qui s'ouvre : choisissez votre réseau Wi-Fi habituel, puis dans la
            champ <strong>Service Type</strong>, sélectionnez <strong>HTTPS Post</strong> (pas « HTTP » : le serveur
            n'accepte que l'HTTPS et l'iSpindel ne suit pas la redirection). Collez l'URL copiée à l'étape 2 dans le
            champ URL du serveur et laissez « Token » vide. Enregistrez — l'iSpindel redémarre.
          </li>
          <li>
            Pas de « HTTPS Post » dans la liste ? Le firmware est trop ancien : mettez-le à jour (version 7 ou plus).
            L'iSpindel n'envoie qu'à un seul service : il ne transmettra plus à Brewfather ou ailleurs.
          </li>
          <li>
            Plongez l'iSpindel dans le fermenteur, puis sur la page Appareils ci-dessous, choisissez le{' '}
            <strong>brassin à suivre</strong> dans le menu déroulant de l'appareil.
          </li>
          <li>
            Les mesures arrivent automatiquement (toutes les ~15 min par défaut) dans le graphique de la page{' '}
            <strong>Suivi de fermentation</strong> du brassin.
          </li>
        </ol>
        <p className="mt-3 text-xs text-slate-500">
          Important : ceci ne fonctionne que si l'Edge Function Supabase <code>ispindel</code> a été déployée côté
          serveur (une seule fois, voir la documentation technique) — sans ça, l'URL ne répondra pas et aucune
          mesure ne sera enregistrée.
        </p>
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
                {device.type === 'ispindel' && (
                  <div className="mt-2 space-y-1 text-xs text-slate-500">
                    <div className="flex items-center">
                      <span className="font-medium text-slate-600">URL à configurer sur l'iSpindel</span>
                      <InfoTooltip text="Dans la config Wi-Fi de l'iSpindel (portail au démarrage) : Service Type = HTTPS Post, et collez cette URL complète dans le champ URL (Token vide). Le token identifie l'appareil, pas besoin d'en-tête d'authentification." />
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="block flex-1 overflow-x-auto rounded bg-slate-100 px-2 py-1">
                        {SUPABASE_FUNCTIONS_URL}?token={device.apiToken}
                      </code>
                      <button
                        type="button"
                        onClick={() => handleCopy(`${SUPABASE_FUNCTIONS_URL}?token=${device.apiToken}`, device.id)}
                        className="btn-secondary btn-sm shrink-0"
                      >
                        {copiedId === device.id ? 'Copié ✓' : 'Copier'}
                      </button>
                    </div>
                  </div>
                )}
                <div className="mt-3 flex items-center gap-2">
                  <FieldLabel>Brassin suivi</FieldLabel>
                </div>
                <select
                  value={device.activeBatchId ?? ''}
                  onChange={(e) => handleAssign(device.id, e.target.value)}
                  className="field-input mt-1 max-w-xs"
                >
                  <option value="">— Aucun —</option>
                  {activeBatches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <button onClick={() => handleDelete(device.id)} className="btn-danger shrink-0">
                Supprimer
              </button>
            </div>
          </li>
        ))}
        {devices && devices.length === 0 && (
          <p className="text-sm text-slate-500">Aucun appareil pour l'instant.</p>
        )}
      </ul>
    </div>
  )
}
