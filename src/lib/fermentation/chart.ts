export interface ChartPoint {
  time: number
  value: number | null
}

const MIN_GAP_MS = 12 * 3600_000
const GAP_FACTOR = 10

/**
 * Série d'une courbe (densité ou température) : seulement les relevés qui ont une valeur, et
 * une coupure (valeur nulle) dans chaque trou anormal — plus de 12 h et de 10 fois l'écart
 * habituel — pour ne pas relier par une fausse pente un iSpindel resté muet plusieurs jours.
 */
export function seriesWithGaps(points: ChartPoint[]): ChartPoint[] {
  const known = points.filter((p) => p.value !== null && Number.isFinite(p.value)).sort((a, b) => a.time - b.time)
  if (known.length < 3) return known
  const steps = known.slice(1).map((p, i) => p.time - known[i].time).sort((a, b) => a - b)
  const median = steps[Math.floor(steps.length / 2)]
  const maxGap = Math.max(MIN_GAP_MS, GAP_FACTOR * median)
  const series: ChartPoint[] = [known[0]]
  for (let i = 1; i < known.length; i++) {
    const previous = known[i - 1]
    if (known[i].time - previous.time > maxGap) series.push({ time: previous.time + 1, value: null })
    series.push(known[i])
  }
  return series
}
