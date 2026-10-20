import { evaluatePolynomial, type CalibrationPoint, type PolynomialFit } from '@/lib/ispindel/polynomial'

const WIDTH = 520
const HEIGHT = 320
const PAD = { left: 48, right: 12, top: 12, bottom: 32 }
const CURVE_STEPS = 60
const TICKS = 5

const FIT_COLORS: Record<number, string> = { 1: '#f59e0b', 2: '#4f46e5', 3: '#10b981' }

/** Points mesurés et courbes d'ajustement (angle en abscisse, densité en ordonnée). */
export function CalibrationChart({
  points,
  fits,
  gravityLabel,
}: {
  points: CalibrationPoint[]
  fits: PolynomialFit[]
  gravityLabel: string
}) {
  if (points.length === 0) return null
  const tilts = points.map((p) => p.tilt)
  const minTilt = Math.min(...tilts)
  const maxTilt = Math.max(...tilts)
  const tiltSpan = maxTilt - minTilt || 1

  const curves = fits.map((fit) => ({
    fit,
    values: Array.from({ length: CURVE_STEPS + 1 }, (_, i) => {
      const tilt = minTilt + (tiltSpan * i) / CURVE_STEPS
      return { tilt, gravity: evaluatePolynomial(fit.coefficients, tilt) }
    }),
  }))
  const gravities = [...points.map((p) => p.gravity), ...curves.flatMap((c) => c.values.map((v) => v.gravity))]
  const minGravity = Math.min(...gravities)
  const maxGravity = Math.max(...gravities)
  const gravitySpan = maxGravity - minGravity || 1

  const x = (tilt: number) => PAD.left + ((tilt - minTilt) / tiltSpan) * (WIDTH - PAD.left - PAD.right)
  const y = (gravity: number) => HEIGHT - PAD.bottom - ((gravity - minGravity) / gravitySpan) * (HEIGHT - PAD.top - PAD.bottom)
  const ticks = Array.from({ length: TICKS }, (_, i) => i / (TICKS - 1))

  return (
    <figure>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Courbes de calibration : densité selon l'angle"
        className="w-full max-w-xl"
      >
        {ticks.map((t) => (
          <g key={t} className="text-slate-400">
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(minGravity + t * gravitySpan)} y2={y(minGravity + t * gravitySpan)} stroke="currentColor" strokeOpacity={0.25} />
            <text x={PAD.left - 6} y={y(minGravity + t * gravitySpan) + 4} textAnchor="end" fontSize={11} fill="currentColor">
              {(minGravity + t * gravitySpan).toFixed(maxGravity > 2 ? 1 : 3)}
            </text>
            <text x={x(minTilt + t * tiltSpan)} y={HEIGHT - PAD.bottom + 16} textAnchor="middle" fontSize={11} fill="currentColor">
              {(minTilt + t * tiltSpan).toFixed(0)}°
            </text>
          </g>
        ))}
        {curves.map(({ fit, values }) => (
          <polyline
            key={fit.degree}
            fill="none"
            stroke={FIT_COLORS[fit.degree]}
            strokeWidth={2}
            points={values.map((v) => `${x(v.tilt)},${y(v.gravity)}`).join(' ')}
          />
        ))}
        {points.map((p) => (
          <circle key={`${p.tilt}-${p.gravity}`} cx={x(p.tilt)} cy={y(p.gravity)} r={4} fill="#0f172a" />
        ))}
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-x-4 text-xs text-slate-500">
        <span>Axe vertical : {gravityLabel}</span>
        {fits.map((fit) => (
          <span key={fit.degree} className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-4" style={{ background: FIT_COLORS[fit.degree] }} />
            degré {fit.degree}
          </span>
        ))}
      </figcaption>
    </figure>
  )
}
