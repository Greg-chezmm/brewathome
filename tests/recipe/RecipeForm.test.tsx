import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { EMPTY_RECIPE_FORM, RecipeForm, type RecipeFormValue } from '@/components/recipe/RecipeForm'

vi.mock('@/lib/db/queries/equipmentProfiles', () => ({ listEquipmentProfiles: async () => [] }))
vi.mock('@/lib/db/queries/ingredientHistory', () => ({
  getIngredientHistory: async () => ({
    fermentables: [],
    hops: [{ name: 'Magnum 2020', alphaAcidPercent: 11.2, note: 'Déjà utilisé dans vos recettes.' }],
    yeasts: [],
  }),
}))

const recipe: RecipeFormValue = {
  ...EMPTY_RECIPE_FORM,
  name: 'Pale Ale',
  fermentables: [
    { name: 'Pale Ale', type: 'grain', amountKg: 4.5, colorLovibond: 3, yieldPercent: 80 },
    { name: 'Crystal 60', type: 'grain', amountKg: 0.5, colorLovibond: 60, yieldPercent: 74 },
  ],
  hops: [{ name: 'Cascade', amountG: 30, alphaAcidPercent: 6.5, timeMin: 60, use: 'boil', form: 'pellet' }],
  yeasts: [{ name: 'SafAle US-05', type: 'dry', style: 'ale', attenuationPercent: 81 }],
}

function Harness() {
  const [value, setValue] = useState(recipe)
  return (
    <QueryClientProvider client={new QueryClient()}>
      <RecipeForm value={value} onChange={setValue} onSubmit={() => undefined} saving={false} submitLabel="Enregistrer" />
    </QueryClientProvider>
  )
}

describe('RecipeForm', () => {
  it('montre ce qu’apporte chaque ingrédient', () => {
    render(<Harness />)
    expect(screen.getByText('90 % du grain')).toBeInTheDocument()
    expect(screen.getAllByText(/% de la couleur$/)).toHaveLength(2)
    expect(screen.getByText(/^[0-9,]+ IBU$/)).toBeInTheDocument()
    expect(screen.getByText(/DF estimée/)).toBeInTheDocument()
    // Fiche de la bibliothèque sous un ingrédient connu.
    expect(screen.getByText(/Pamplemousse, fleurs/)).toBeInTheDocument()
  })

  it('reprend l’acide alpha d’un houblon choisi dans la bibliothèque, et l’amertume suit', () => {
    render(<Harness />)
    const ibuBefore = screen.getByText(/^[0-9,]+ IBU$/).textContent
    fireEvent.change(screen.getByDisplayValue('Cascade'), { target: { value: 'Magnum' } })
    expect(screen.getByDisplayValue('13')).toBeInTheDocument()
    expect(screen.getByText(/^[0-9,]+ IBU$/).textContent).not.toBe(ibuBefore)
  })

  it('n’affiche que les champs utiles selon l’usage du houblon', () => {
    render(<Harness />)
    const usage = screen.getByDisplayValue('Ébullition')
    const card = usage.closest('li')!
    expect(within(card).queryByText('Durée (jours)')).toBeNull()
    fireEvent.change(usage, { target: { value: 'dry-hop' } })
    expect(within(card).getByText('Durée (jours)')).toBeInTheDocument()
    expect(within(card).queryByText('Temps (min)')).toBeNull()
    expect(within(card).getByText('Arômes, pas d’amertume')).toBeInTheDocument()
  })

  it('un champ vidé pendant la saisie ne fait pas planter le calcul', () => {
    render(<Harness />)
    fireEvent.change(screen.getByDisplayValue('4.5'), { target: { value: '' } })
    expect(screen.getByText('0 % du grain')).toBeInTheDocument()
  })
})
