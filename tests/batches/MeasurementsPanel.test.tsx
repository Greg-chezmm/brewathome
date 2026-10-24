import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MeasurementsPanel } from '@/components/batches/MeasurementsPanel'
import { MEASUREMENTS, type MeasurementKey, type MeasurementValues } from '@/lib/brew-day/measurements'
import type { RecipeDetails } from '@/lib/db/queries/recipes'

vi.mock('@/lib/supabase/client', () => ({ supabase: {} }))

const recipe = {
  id: 'r1',
  name: 'Pale ale',
  targetVolumeL: 10,
  mashEfficiencyPercent: 75,
  fermentables: [],
  hops: [],
  yeasts: [],
} as unknown as RecipeDetails

const noMeasurements = Object.fromEntries(Object.keys(MEASUREMENTS).map((k) => [k, null])) as MeasurementValues
const measuredWith = (values: Partial<MeasurementValues>): MeasurementValues => ({ ...noMeasurements, ...values })

const FIELDS: MeasurementKey[] = ['mashPh', 'preBoilVolumeL']
const PH = MEASUREMENTS.mashPh.label
const VOLUME = MEASUREMENTS.preBoilVolumeL.label

function setup(measured: MeasurementValues) {
  const onSave = vi.fn(async () => {})
  const client = new QueryClient()
  const panel = (current: MeasurementValues) => (
    <QueryClientProvider client={client}>
      <MeasurementsPanel
        batchId="b1"
        fields={FIELDS}
        measured={current}
        planned={noMeasurements}
        recipe={recipe}
        equipment={null}
        onSave={onSave}
      />
    </QueryClientProvider>
  )
  const view = render(panel(measured))
  // Simule un autre appareil qui enregistre : le brassin rechargé apporte de nouvelles mesures.
  const otherDeviceSaves = (next: MeasurementValues) => view.rerender(panel(next))
  return { onSave, unmount: view.unmount, otherDeviceSaves }
}

describe('MeasurementsPanel : écritures concurrentes entre appareils', () => {
  it('suit la valeur enregistrée ailleurs au lieu de garder un brouillon périmé', () => {
    const { otherDeviceSaves } = setup(measuredWith({}))
    expect(screen.getByLabelText(PH)).toHaveValue(null)

    otherDeviceSaves(measuredWith({ mashPh: 5.4 }))

    expect(screen.getByLabelText(PH)).toHaveValue(5.4)
    expect(screen.queryByText(/Non enregistré/)).not.toBeInTheDocument()
  })

  it('n’écrase pas, en quittant l’étape, une mesure saisie sur un autre appareil', () => {
    const { onSave, otherDeviceSaves, unmount } = setup(measuredWith({}))

    otherDeviceSaves(measuredWith({ mashPh: 5.4 }))
    unmount()

    expect(onSave).not.toHaveBeenCalled()
  })

  it('sauvegarde toujours à la sortie ce que l’utilisateur a saisi', () => {
    const { onSave, unmount } = setup(measuredWith({}))

    fireEvent.change(screen.getByLabelText(VOLUME), { target: { value: '12.5' } })
    expect(screen.getByText(/Non enregistré/)).toBeInTheDocument()
    unmount()

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({ preBoilVolumeL: 12.5 })
  })

  it('ne sauvegarde à la sortie que les champs saisis, pas ceux changés ailleurs', () => {
    const { onSave, otherDeviceSaves, unmount } = setup(measuredWith({}))

    fireEvent.change(screen.getByLabelText(VOLUME), { target: { value: '12.5' } })
    otherDeviceSaves(measuredWith({ mashPh: 5.4 }))
    unmount()

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({ preBoilVolumeL: 12.5 })
  })

  it('une fois enregistré, un champ redevient celui du brassin et ne réécrit plus l’autre appareil', async () => {
    const { onSave, otherDeviceSaves, unmount } = setup(measuredWith({}))

    fireEvent.change(screen.getByLabelText(PH), { target: { value: '5.2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ mashPh: 5.2 }))

    // L'autre appareil corrige ensuite le pH ; cet onglet doit afficher la nouvelle valeur.
    otherDeviceSaves(measuredWith({ mashPh: 5.5 }))
    await waitFor(() => expect(screen.getByLabelText(PH)).toHaveValue(5.5))
    unmount()

    expect(onSave).toHaveBeenCalledTimes(1)
  })
})
