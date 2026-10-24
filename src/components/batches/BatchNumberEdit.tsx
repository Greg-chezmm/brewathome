import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { updateBatchNumber } from '@/lib/db/queries/batches'

/** Numéro du brassin, modifiable à la main (un numéro déjà pris est refusé). */
export function BatchNumberEdit({ batchId, batchNumber }: { batchId: string; batchNumber: number | null }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const number = Number.parseInt(value, 10)
    if (!Number.isInteger(number) || number < 1) {
      setError('Le numéro doit être un entier positif.')
      return
    }
    if (number === batchNumber) {
      setEditing(false)
      return
    }
    try {
      await updateBatchNumber(batchId, number)
      setError(null)
      setEditing(false)
      queryClient.invalidateQueries({ queryKey: ['batch', batchId] })
      queryClient.invalidateQueries({ queryKey: ['batches'] })
    } catch (e) {
      setError((e as Error).message)
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(batchNumber != null ? String(batchNumber) : '')
          setEditing(true)
        }}
        className="text-xs font-medium text-indigo-600 hover:underline"
      >
        Modifier le numéro
      </button>
    )
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1 text-xs text-slate-600">
        N°
        <input
          type="number"
          min={1}
          step={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="field-input w-20"
          aria-label="Numéro du brassin"
          autoFocus
        />
      </label>
      <button type="button" onClick={save} className="btn-secondary btn-sm">
        Enregistrer
      </button>
      <button type="button" onClick={() => { setEditing(false); setError(null) }} className="text-xs text-slate-500 hover:underline">
        Annuler
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-600">
          {error}
        </span>
      )}
    </span>
  )
}
