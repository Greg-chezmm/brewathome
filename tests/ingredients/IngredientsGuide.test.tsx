import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { IngredientsGuide } from '@/pages/ingredients/IngredientsGuide'

function renderGuide(path = '/ingredients') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <IngredientsGuide />
    </MemoryRouter>,
  )
}

describe('Page Ingrédients', () => {
  it('malts par catégorie, avec les céréales non maltées et leurs conseils', () => {
    renderGuide()
    expect(screen.getByRole('heading', { name: 'Céréales non maltées (riz, maïs, blé, avoine…)' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Flocons de riz' })).toBeInTheDocument()
  })

  it('levures par type, avec atténuation et DF attendue', () => {
    renderGuide('/ingredients?tab=yeasts')
    expect(screen.getByRole('heading', { name: 'Abbaye & trappiste' })).toBeInTheDocument()
    const us05 = screen.getByRole('heading', { name: 'SafAle US-05' }).closest('article')!
    // 78 % d'atténuation sur une DI de 1.050 : DF ≈ 1.011.
    expect(us05).toHaveTextContent('Atténuation ≈ 78 %')
    expect(us05).toHaveTextContent('DI 1.050 → DF ≈ 1.011')
    expect(us05).toHaveTextContent('Fermentis')
  })

  it('recherche sans accents, compte par onglet, et saut vers un remplaçant', () => {
    renderGuide('/ingredients?tab=hops')
    fireEvent.change(screen.getByLabelText('Rechercher un ingrédient'), { target: { value: 'abbaye' } })
    expect(screen.getByRole('button', { name: /^Levures\s*\(\d+\)$/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Levures/ }))
    const be256 = screen.getByRole('heading', { name: 'SafAle BE-256' }).closest('article')!

    // Un remplaçant mène à sa fiche.
    fireEvent.click(within(be256).getByRole('button', { name: 'WLP530 Abbey Ale' }))
    expect(screen.getByLabelText('Rechercher un ingrédient')).toHaveValue('WLP530 Abbey Ale')
    expect(screen.getByRole('heading', { name: 'WLP530 Abbey Ale' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'SafAle BE-256' })).not.toBeInTheDocument()

    // Remplaçant dans un autre onglet : malt → onglet malts.
    fireEvent.change(screen.getByLabelText('Rechercher un ingrédient'), { target: { value: 'epeautre' } })
    fireEvent.click(screen.getByRole('button', { name: /Malts & céréales/ }))
    expect(screen.getByRole('heading', { name: 'Malt d’épeautre' })).toBeInTheDocument()
  })
})
