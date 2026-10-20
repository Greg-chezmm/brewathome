import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { RecipeValidate } from '@/pages/recipes/RecipeValidate'

const api = vi.hoisted(() => ({ createBatchFromRecipe: vi.fn() }))

vi.mock('@/lib/auth/AuthProvider', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('@/lib/db/queries/batches', () => ({
  CREATE_BATCH_PHASES: ['Lecture de la recette', 'Enregistrement du brassin', 'Génération des étapes du Brew Day', 'Finalisation'],
  createBatchFromRecipe: api.createBatchFromRecipe,
}))
vi.mock('@/lib/db/queries/recipes', () => ({
  getRecipeWithDetails: async () => ({ id: 'r1', name: 'Pale ale', equipmentProfileId: null }),
}))
vi.mock('@/lib/db/queries/equipmentProfiles', () => ({ getEquipmentProfile: async () => null }))
vi.mock('@/lib/brew-day/sessions', () => ({ exceedsKettle: () => false }))
vi.mock('@/components/batches/SessionsChoice', () => ({ SessionsChoice: () => null }))

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/recipes/r1/validate']}>
        <Routes>
          <Route path="/recipes/:recipeId/validate" element={<RecipeValidate />} />
          <Route path="/batches/:id" element={<p>Page du brassin</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Création du brassin', () => {
  beforeEach(() => vi.clearAllMocks())

  it('montre la phase en cours pendant la création', async () => {
    let finish: (id: string) => void = () => {}
    api.createBatchFromRecipe.mockImplementation(
      (...args: unknown[]) =>
        new Promise<string>((resolve) => {
          ;(args[5] as (phase: number) => void)(2)
          finish = resolve
        }),
    )
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Créer le brassin' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Génération des étapes du Brew Day… (étape 3/4)')
    finish('b1')
    expect(await screen.findByText('Page du brassin')).toBeInTheDocument()
  })

  it('explique l’échec et permet de réessayer', async () => {
    api.createBatchFromRecipe.mockRejectedValue(new Error('réseau coupé'))
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Créer le brassin' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Le brassin n’a pas pu être créé : réseau coupé')
    expect(screen.getByRole('button', { name: 'Créer le brassin' })).toBeEnabled()
  })
})
