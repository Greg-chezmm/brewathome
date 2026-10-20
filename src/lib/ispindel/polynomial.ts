export interface CalibrationPoint {
  /** Angle affiché par l'iSpindel (°). */
  tilt: number
  /** Densité mesurée au densimètre ou au réfractomètre, dans l'unité choisie (SG ou °P). */
  gravity: number
}

export interface PolynomialFit {
  degree: number
  /** Coefficients du terme constant au plus haut degré : c[0] + c[1]·tilt + c[2]·tilt² … */
  coefficients: number[]
  r2: number
  /** Plus grand écart absolu entre la courbe et un point mesuré. */
  maxError: number
}

export const MAX_DEGREE = 3

const SIGNIFICANT_DIGITS = 6
const SINGULAR_PIVOT = 1e-12

export function evaluatePolynomial(coefficients: number[], x: number): number {
  return coefficients.reduceRight((acc, c) => acc * x + c, 0)
}

/** Résolution de A·x = b par élimination de Gauss avec pivot partiel ; null si la matrice est singulière. */
function solveLinear(a: number[][], b: number[]): number[] | null {
  const n = b.length
  const m = a.map((row, i) => [...row, b[i]])
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let row = col + 1; row < n; row++) if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row
    if (Math.abs(m[pivot][col]) < SINGULAR_PIVOT) return null
    ;[m[col], m[pivot]] = [m[pivot], m[col]]
    for (let row = col + 1; row < n; row++) {
      const factor = m[row][col] / m[col][col]
      for (let k = col; k <= n; k++) m[row][k] -= factor * m[col][k]
    }
  }
  const x = new Array<number>(n).fill(0)
  for (let row = n - 1; row >= 0; row--) {
    let sum = m[row][n]
    for (let k = row + 1; k < n; k++) sum -= m[row][k] * x[k]
    x[row] = sum / m[row][row]
  }
  return x
}

/** Coefficients en u = (x − mean) / scale ramenés en x par composition polynomiale (Horner). */
function toRawCoefficients(inU: number[], mean: number, scale: number): number[] {
  const linear = [-mean / scale, 1 / scale]
  let result: number[] = [0]
  for (let i = inU.length - 1; i >= 0; i--) {
    const next = new Array<number>(result.length + 1).fill(0)
    result.forEach((c, k) => {
      next[k] += c * linear[0]
      next[k + 1] += c * linear[1]
    })
    next[0] += inU[i]
    result = next
  }
  return result.slice(0, inU.length)
}

/**
 * Moindres carrés polynomiaux. Les angles sont centrés et réduits avant la résolution (les puissances
 * d'angles proches de 50 donnent sinon des systèmes très mal conditionnés), puis les coefficients sont
 * ramenés en fonction de l'angle brut. Renvoie null s'il y a trop peu de points ou d'angles distincts.
 */
export function fitPolynomial(points: CalibrationPoint[], degree: number): PolynomialFit | null {
  if (!Number.isInteger(degree) || degree < 1 || degree > MAX_DEGREE) return null
  if (points.length < degree + 1) return null
  if (new Set(points.map((p) => p.tilt)).size < degree + 1) return null

  const mean = points.reduce((s, p) => s + p.tilt, 0) / points.length
  const variance = points.reduce((s, p) => s + (p.tilt - mean) ** 2, 0) / points.length
  const scale = Math.sqrt(variance) || 1
  const size = degree + 1
  const normal = Array.from({ length: size }, () => new Array<number>(size).fill(0))
  const rhs = new Array<number>(size).fill(0)
  for (const p of points) {
    const u = (p.tilt - mean) / scale
    for (let i = 0; i < size; i++) {
      rhs[i] += u ** i * p.gravity
      for (let j = 0; j < size; j++) normal[i][j] += u ** (i + j)
    }
  }
  const inU = solveLinear(normal, rhs)
  if (!inU) return null
  const coefficients = toRawCoefficients(inU, mean, scale)

  const average = points.reduce((s, p) => s + p.gravity, 0) / points.length
  const total = points.reduce((s, p) => s + (p.gravity - average) ** 2, 0)
  const residuals = points.map((p) => evaluatePolynomial(coefficients, p.tilt) - p.gravity)
  const residualSum = residuals.reduce((s, r) => s + r * r, 0)
  return {
    degree,
    coefficients,
    r2: total === 0 ? 1 : 1 - residualSum / total,
    maxError: Math.max(...residuals.map(Math.abs)),
  }
}

const significant = (value: number) => String(Number(value.toPrecision(SIGNIFICANT_DIGITS)))

/** Polynôme tel que l'attend le portail de l'iSpindel : `0.0004*tilt*tilt+0.12*tilt-5`. */
export function formatPolynomial(coefficients: number[]): string {
  let text = ''
  for (let degree = coefficients.length - 1; degree >= 0; degree--) {
    const value = Number(coefficients[degree].toPrecision(SIGNIFICANT_DIGITS))
    if (value === 0) continue
    const sign = value < 0 ? '-' : text ? '+' : ''
    text += `${sign}${significant(Math.abs(value))}${'*tilt'.repeat(degree)}`
  }
  return text || '0'
}

/** Fichier de points : liste d'objets {tilt, gravity}. */
export function serializeCalibrationPoints(points: CalibrationPoint[]): string {
  return JSON.stringify(points)
}

/** Relit un fichier de points, y compris l'ancien format `[[angle, densité], …]` de la page du projet iSpindel. */
export function parseCalibrationPoints(text: string): CalibrationPoint[] | null {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return null
  }
  if (!Array.isArray(data)) return null
  const points: CalibrationPoint[] = []
  for (const item of data) {
    let tilt: unknown
    let gravity: unknown
    if (Array.isArray(item)) [tilt, gravity] = item
    else if (item && typeof item === 'object') ({ tilt, gravity } = item as Record<string, unknown>)
    if (typeof tilt !== 'number' || typeof gravity !== 'number' || !Number.isFinite(tilt) || !Number.isFinite(gravity)) return null
    points.push({ tilt, gravity })
  }
  return points
}
