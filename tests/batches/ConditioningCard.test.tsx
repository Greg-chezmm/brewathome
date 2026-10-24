import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ updateBatchConditioning: vi.fn(async () => undefined) }))

vi.mock('@/lib/supabase/client', () => ({ supabase: {} }))
vi.mock('@/lib/db/queries/batches', () => ({ updateBatchConditioning: api.updateBatchConditioning }))

const { ConditioningCard } = await import('@/components/batches/ConditioningCard')

function renderCard(props: { conditioningStart?: string | null; conditioningDays?: number | null; today?: string; suggestedStart?: string | null }) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ConditioningCard
        batchId="b1"
        conditioningStart={props.conditioningStart ?? null}
        conditioningDays={props.conditioningDays ?? null}
        today={props.today ?? '2026-11-09'}
        suggestedStart={props.suggestedStart ?? null}
      />
    </QueryClientProvider>,
  )
}

describe('ConditioningCard', () => {
  beforeEach(() => api.updateBatchConditioning.mockClear())

  it('invite à saisir la début du conditionnement tant qu’elle manque', () => {
    renderCard({})
    expect(screen.getByText(/Renseigne la début du conditionnement/)).toBeInTheDocument()
  })

  it('annonce la date « prête à boire » avec la durée par défaut de 21 jours', () => {
    renderCard({ conditioningStart: '2026-10-24' })
    expect(screen.getByText('Prête à boire dans 5 jours (14/11/2026)')).toBeInTheDocument()
  })

  it('respecte une durée personnalisée', () => {
    renderCard({ conditioningStart: '2026-10-24', conditioningDays: 14 })
    expect(screen.getByText('Prête à boire depuis 2 jours (07/11/2026)')).toBeInTheDocument()
    expect(screen.getByLabelText('Durée de conditionnement (jours)')).toHaveValue(14)
  })

  it('recalcule en direct quand on change la date', () => {
    renderCard({ conditioningStart: '2026-10-24' })
    fireEvent.change(screen.getByLabelText('Début du conditionnement'), { target: { value: '2026-11-01' } })
    expect(screen.getByText('Prête à boire dans 13 jours (22/11/2026)')).toBeInTheDocument()
  })

  it('enregistre la date et la durée, la durée vide valant « par défaut »', async () => {
    renderCard({})
    fireEvent.change(screen.getByLabelText('Début du conditionnement'), { target: { value: '2026-10-24' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le conditionnement' }))
    await waitFor(() => expect(api.updateBatchConditioning).toHaveBeenCalledWith('b1', { conditioningStart: '2026-10-24', conditioningDays: null }))
  })

  it('enregistre une durée saisie', async () => {
    renderCard({ conditioningStart: '2026-10-24' })
    fireEvent.change(screen.getByLabelText('Durée de conditionnement (jours)'), { target: { value: '28' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le conditionnement' }))
    await waitFor(() => expect(api.updateBatchConditioning).toHaveBeenCalledWith('b1', { conditioningStart: '2026-10-24', conditioningDays: 28 }))
  })

  it('refuse une durée hors 1 à 365 jours', () => {
    renderCard({ conditioningStart: '2026-10-24' })
    fireEvent.change(screen.getByLabelText('Durée de conditionnement (jours)'), { target: { value: '400' } })
    expect(screen.getByRole('button', { name: 'Enregistrer le conditionnement' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Durée de conditionnement (jours)'), { target: { value: '0' } })
    expect(screen.getByRole('button', { name: 'Enregistrer le conditionnement' })).toBeDisabled()
  })

  it('affiche l’erreur d’enregistrement', async () => {
    api.updateBatchConditioning.mockRejectedValueOnce(new Error('hors ligne'))
    renderCard({ conditioningStart: '2026-10-24' })
    fireEvent.change(screen.getByLabelText('Début du conditionnement'), { target: { value: '2026-10-25' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le conditionnement' }))
    expect(await screen.findByText('hors ligne')).toBeInTheDocument()
  })

  describe('date modifiable, avec une suggestion non contraignante', () => {
    it('propose la fin de fermentation prévue sans rien remplir d’office', () => {
      renderCard({ suggestedStart: '2026-11-04' })
      expect(screen.getByLabelText('Début du conditionnement')).toHaveValue('')
      expect(screen.getByRole('button', { name: /Fin de fermentation prévue : 04\/11\/2026/ })).toBeInTheDocument()
    })

    it('un clic sur la suggestion remplit la date, qu’on peut ensuite changer librement', () => {
      renderCard({ suggestedStart: '2026-11-04' })
      fireEvent.click(screen.getByRole('button', { name: /Fin de fermentation prévue/ }))
      expect(screen.getByLabelText('Début du conditionnement')).toHaveValue('2026-11-04')
      fireEvent.change(screen.getByLabelText('Début du conditionnement'), { target: { value: '2026-11-12' } })
      expect(screen.getByLabelText('Début du conditionnement')).toHaveValue('2026-11-12')
      expect(screen.getByText('Prête à boire dans 24 jours (03/12/2026)')).toBeInTheDocument()
    })

    it('la date déjà enregistrée prime sur la suggestion (fermentation plus longue que prévu)', () => {
      renderCard({ conditioningStart: '2026-11-10', suggestedStart: '2026-11-04' })
      expect(screen.getByLabelText('Début du conditionnement')).toHaveValue('2026-11-10')
    })

    it('offre « Aujourd’hui » pour démarrer le conditionnement maintenant', () => {
      renderCard({ today: '2026-11-09' })
      fireEvent.click(screen.getByRole('button', { name: 'Aujourd’hui' }))
      expect(screen.getByLabelText('Début du conditionnement')).toHaveValue('2026-11-09')
    })

    it('n’affiche pas de suggestion sans plan de fermentation', () => {
      renderCard({})
      expect(screen.queryByRole('button', { name: /Fin de fermentation prévue/ })).toBeNull()
    })
  })
})
