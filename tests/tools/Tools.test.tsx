import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Tools } from '@/pages/tools/Tools'
import { primingSugarGrams } from '@/lib/brew-calc/carbonation'
import { calculateCellsNeededBillions, dryYeastForCells } from '@/lib/brew-calc/yeast'

function renderTools(search = '') {
  render(
    <MemoryRouter initialEntries={[`/tools${search}`]}>
      <Tools />
    </MemoryRouter>,
  )
}

const fr = (value: number, digits = 1) => value.toLocaleString('fr-FR', { maximumFractionDigits: digits })

beforeEach(() => localStorage.clear())

describe('Outils', () => {
  it('pré-remplit levure et resucrage avec les valeurs du brassin', () => {
    renderTools('?volume=10.8&og=1.105&yeast=ale&form=dry')
    const cells = calculateCellsNeededBillions(10.8, 1.105, 'ale')
    const { sachets } = dryYeastForCells(cells)
    expect(screen.getByText(`${fr(cells, 0)} milliards de cellules à ensemencer.`)).toBeInTheDocument()
    expect(screen.getByText(`${sachets} sachets`)).toBeInTheDocument()
    expect(screen.getByText(`${Math.round(primingSugarGrams(2.4, 20, 10.8))} g`)).toBeInTheDocument()
  })

  it('levure liquide : sachets selon l’âge, starter conseillé au-delà de deux', () => {
    renderTools('?volume=20&og=1.080&yeast=lager&form=liquid')
    expect(screen.getByText(/vitalité estimée 76 %/)).toBeInTheDocument()
    expect(screen.getByText(/un starter la veille/)).toBeInTheDocument()
  })

  it('resucrage : les préréglages changent la quantité, le dextrose en demande plus', () => {
    renderTools('?volume=20')
    expect(screen.getByText('123 g')).toBeInTheDocument()
    fireEvent.click(screen.getByText(/Blanche, weizen/))
    expect(screen.getByText(`${Math.round(primingSugarGrams(3.4, 20, 20))} g`)).toBeInTheDocument()
    fireEvent.change(screen.getByDisplayValue('Saccharose (sucre blanc)'), { target: { value: 'dextrose' } })
    expect(screen.getByText(`${Math.round(primingSugarGrams(3.4, 20, 20, 'dextrose'))} g`)).toBeInTheDocument()
  })

  it('sels : profil obtenu, rapport sulfates/chlorures, eau de départ mémorisée', () => {
    renderTools()
    fireEvent.change(screen.getByLabelText('Calcium (Ca)'), { target: { value: '40' } })
    // 5 g de gypse dans 25 L : +46,6 ppm de calcium, +111,5 ppm de sulfates.
    fireEvent.change(screen.getByLabelText('Gypse (CaSO4·2H2O) (g)'), { target: { value: '5' } })
    fireEvent.change(screen.getByLabelText('Chlorure de calcium (CaCl2·2H2O) (g)'), { target: { value: '2' } })
    const calciumRow = screen.getByText('Calcium (Ca)', { selector: 'td' }).closest('tr')!
    expect(calciumRow).toHaveTextContent(/40\s*108/)
    expect(screen.getByText(/Rapport sulfates\/chlorures : 2,89 \(amertume mise en avant/)).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('brewathome.tools.source-water')!).calcium).toBe('40')
  })
})
