import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { FieldLabel } from '@/components/InfoTooltip'
import { updateDeviceGravityUnit, type Device, type DeviceGravityUnit } from '@/lib/db/queries/devices'
import { errorMessage } from '@/lib/errors'

const OPTIONS: { value: DeviceGravityUnit; label: string }[] = [
  { value: 'auto', label: 'Automatique (devinée)' },
  { value: 'sg', label: 'Densité (SG, ex. 1,048)' },
  { value: 'plato', label: '°Plato (ex. 12)' },
]

type Props = { device: Device }

/** Unité du polynôme de l'iSpindel : le firmware ne l'envoie pas, la régler évite toute confusion près de 0 °P. */
export function GravityUnitSetting({ device }: Props) {
  const queryClient = useQueryClient()
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  async function handleChange(unit: DeviceGravityUnit) {
    setIsSaving(true)
    setMessage(null)
    try {
      const count = await updateDeviceGravityUnit(device.id, unit)
      setMessage({ kind: 'ok', text: count > 0 ? `Unité enregistrée ✓ ${count} relevé(s) recalculé(s).` : 'Unité enregistrée ✓' })
      queryClient.invalidateQueries({ queryKey: ['devices'] })
      if (device.activeBatchId) queryClient.invalidateQueries({ queryKey: ['fermentation-readings', device.activeBatchId] })
    } catch (err) {
      setMessage({ kind: 'error', text: errorMessage(err) })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="mt-4">
      <FieldLabel hint="Unité dans laquelle le polynôme de l'iSpindel calcule la densité (celle choisie à la calibration). En automatique, une valeur entre 0,98 et 1,2 est lue comme une densité et tout le reste comme des °Plato : un Plato proche de 1 en fin de fermentation est alors mal lu. Changer l'unité recalcule aussi les relevés du brassin suivi.">
        Unité du polynôme
      </FieldLabel>
      <select
        aria-label="Unité du polynôme"
        value={device.gravityUnit}
        disabled={isSaving}
        onChange={(e) => handleChange(e.target.value as DeviceGravityUnit)}
        className="field-input max-w-xs"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {message && (
        <p role={message.kind === 'error' ? 'alert' : 'status'} className={`mt-1 text-sm ${message.kind === 'error' ? 'text-red-600' : 'text-slate-600'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
