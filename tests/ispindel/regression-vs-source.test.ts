import { describe, expect, it } from 'vitest'
import { correctGravityForTemperature } from '@/lib/brew-calc/gravity-correction'
import { platoToSg } from '@/lib/brew-calc/gravity-input'
import { sgToPlato } from '@/lib/brew-calc/yeast'
import { fitPolynomial } from '@/lib/ispindel/polynomial'

// Valeurs de référence produites par le code de la page source (calibration.htm : regression-js + BrewMath)
// exécuté sur ces mêmes points : la page du projet iSpindel fait foi.
const POINTS = [
  [25, 1.0],
  [32, 4.1],
  [40, 7.9],
  [47, 11.2],
  [55, 15.4],
  [63, 20.1],
].map(([tilt, gravity]) => ({ tilt, gravity }))

const SOURCE = {
  1: { eq: [-11.854548450889945, 0.4993408042188537], r2: 0.9974372807409401 },
  2: { eq: [-7.96821398040654, 0.3055829737624901, 0.002204187661152169], r2: 0.9998520622975902 },
  3: {
    eq: [-11.548148038622633, 0.5783433284568169, -0.004318509602565256, 0.00004937581641822397],
    r2: 0.9999683943263166,
  },
} as const

describe('non-régression face à la page source calibration.htm', () => {
  for (const degree of [1, 2, 3] as const) {
    it(`degré ${degree} : mêmes coefficients et même R²`, () => {
      const fit = fitPolynomial(POINTS, degree)!
      SOURCE[degree].eq.forEach((expected, i) => expect(fit.coefficients[i]).toBeCloseTo(expected, 9))
      expect(fit.r2).toBeCloseTo(SOURCE[degree].r2, 10)
    })
  }

  it('conversions : Plato → SG, SG → Plato, correction de température, réfractomètre', () => {
    expect(platoToSg(12.5)).toBeCloseTo(1.0504835076519858, 12)
    expect(sgToPlato(1.05)).toBeCloseTo(12.387647125000058, 9)
    expect(correctGravityForTemperature(1.05, 30, 20)).toBeCloseTo(1.0526044557208447, 12)
    expect(platoToSg(12 / 1.04)).toBeCloseTo(1.046441535179445, 12)
  })
})
