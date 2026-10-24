import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ConnectionBadge } from '@/components/devices/ConnectionBadge'
import { useAuth } from '@/lib/auth/AuthProvider'
import { createDevice, listDevices, setDeviceActiveBatch } from '@/lib/db/queries/devices'

/**
 * Associe un iSpindel au brassin sans quitter le brassin : choix d'un appareil existant, ou création
 * de l'appareil sur place. La configuration du boîtier (adresse, calibration) reste sur la page Appareils.
 */
export function BatchDeviceLink({ batchId }: { batchId: string }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data: devices, dataUpdatedAt } = useQuery({ queryKey: ['devices'], queryFn: listDevices, refetchInterval: 30_000 })
  const [choice, setChoice] = useState('')
  const [name, setName] = useState('iSpindel')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!devices) return null

  const linked = devices.filter((d) => d.activeBatchId === batchId)
  // Seuls les appareils libres sont proposés : un iSpindel suit un seul brassin à la fois.
  const free = devices.filter((d) => d.activeBatchId === null)

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      queryClient.invalidateQueries({ queryKey: ['devices'] })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card space-y-3" aria-label="Appareil de suivi">
      <h3 className="text-sm font-semibold text-slate-700">📡 iSpindel de ce brassin</h3>

      {linked.map((device) => (
        <div key={device.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="flex items-center gap-2">
            <span className="font-medium text-slate-900">{device.name}</span>
            {device.type === 'ispindel' && <ConnectionBadge device={device} now={dataUpdatedAt} />}
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => setDeviceActiveBatch(device.id, null))}
            className="btn-secondary btn-sm"
          >
            Détacher
          </button>
        </div>
      ))}

      {linked.length === 0 && free.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <select value={choice} onChange={(e) => setChoice(e.target.value)} className="field-input w-auto" aria-label="Appareil à associer">
            <option value="">Choisir un appareil…</option>
            {free.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy || !choice}
            onClick={() => run(() => setDeviceActiveBatch(choice, batchId))}
            className="btn-secondary btn-sm"
          >
            Associer
          </button>
        </div>
      )}

      {linked.length === 0 && free.length === 0 && user && (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!name.trim()) return
            run(async () => {
              const device = await createDevice(user.id, 'ispindel', name.trim())
              await setDeviceActiveBatch(device.id, batchId)
            })
          }}
        >
          <input value={name} onChange={(e) => setName(e.target.value)} className="field-input w-48" aria-label="Nom de l'iSpindel" />
          <button type="submit" disabled={busy || !name.trim()} className="btn-secondary btn-sm">
            Créer et associer
          </button>
        </form>
      )}

      {linked.length === 0 && (
        <p className="text-xs text-slate-500">
          Une fois associé, les relevés de l'iSpindel arrivent dans l'onglet Fermentation.
        </p>
      )}
      {(linked.length > 0 || free.length > 0) && (
        <p className="text-xs text-slate-500">
          Adresse du serveur, calibration et firmware : <Link to="/devices" className="font-medium text-indigo-600 hover:underline">page Appareils</Link>.
        </p>
      )}
      {linked.length === 0 && free.length === 0 && (
        <p className="text-xs text-slate-500">
          {devices.length > 0 ? 'Tous vos appareils suivent déjà un brassin. ' : ''}Après création, recopiez l'adresse et le jeton dans le portail de l'iSpindel depuis la{' '}
          <Link to="/devices" className="font-medium text-indigo-600 hover:underline">page Appareils</Link>.
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </section>
  )
}
