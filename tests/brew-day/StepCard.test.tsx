import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { StepCard } from '@/components/brew-day/StepCard'
import type { BatchStep } from '@/lib/db/queries/batches'
import type { RecipeDetails } from '@/lib/db/queries/recipes'

const step = {
  id: 's1',
  stepType: 'mash',
  label: 'Empâtage à 67 °C',
  status: 'todo',
  plannedDurationMin: 60,
  checkedItems: [],
} as unknown as BatchStep

function renderCard(overrides: Partial<BatchStep>, now = Date.now()) {
  const onStart = vi.fn()
  const onStop = vi.fn()
  render(
    <StepCard
      step={{ ...step, ...overrides }}
      guide={{ checklist: [], tips: [] }}
      timing={{ triggerAtSeconds: null, isDue: false }}
      now={now}
      boilStarted={false}
      boilElapsedSeconds={0}
      recipe={{ mashSteps: [], mashTempC: 67 } as unknown as RecipeDetails}
      totalGrainKg={5}
      mashWaterL={15}
      onToggleItem={() => undefined}
      onStart={onStart}
      onStop={onStop}
    />,
  )
  return { onStart, onStop }
}

describe('StepCard — minuteur', () => {
  it('Démarrer est à côté de la durée prévue', () => {
    const { onStart } = renderCard({})
    expect(screen.getByText('Durée prévue : 60:00').parentElement).toContainElement(screen.getByText('Démarrer'))
    fireEvent.click(screen.getByText('Démarrer'))
    expect(onStart).toHaveBeenCalledOnce()
  })

  it('Arrêter est sous le compte à rebours', () => {
    const start = new Date('2026-10-17T10:00:00Z')
    const { onStop } = renderCard(
      { status: 'in-progress', actualStartAt: start.toISOString() },
      start.getTime() + 5 * 60_000,
    )
    expect(screen.getByText('restant').parentElement).toContainElement(screen.getByLabelText('Arrêter le minuteur'))
    fireEvent.click(screen.getByLabelText('Arrêter le minuteur'))
    expect(onStop).toHaveBeenCalledOnce()
    expect(screen.queryByText('Démarrer')).toBeNull()
  })
})
