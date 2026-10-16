import { srmToCssColor } from '@/lib/brew-calc/color'

export function BeerGlass({ srm, size = 72 }: { srm: number | null | undefined; size?: number }) {
  const color = srm !== null && srm !== undefined ? srmToCssColor(srm) : '#e7e5e4'
  const fillTopY = 22
  const fillHeight = 70

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 64"
      className="shrink-0"
      role="img"
      aria-label={srm !== null && srm !== undefined ? `Couleur de la bière : ${srm.toFixed(1)} SRM` : 'Couleur non estimée'}
    >
      <defs>
        <clipPath id="beer-glass-clip">
          <path d="M8 6 L40 6 L36 60 L12 60 Z" />
        </clipPath>
        <linearGradient id="beer-glass-sheen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="0.25" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Liquide */}
      <g clipPath="url(#beer-glass-clip)">
        <rect x="6" y={fillTopY} width="36" height={fillHeight} fill={color} />
        {/* mousse */}
        <ellipse cx="24" cy={fillTopY} rx="16" ry="3" fill="#fffaf0" opacity="0.9" />
      </g>

      {/* Reflet de verre */}
      <path d="M8 6 L40 6 L36 60 L12 60 Z" fill="url(#beer-glass-sheen)" clipPath="url(#beer-glass-clip)" />

      {/* Contour du verre */}
      <path
        d="M8 6 L40 6 L36 60 L12 60 Z"
        fill="none"
        stroke="#a8a29e"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Bourrelet du bord */}
      <path d="M7 6 L41 6" stroke="#a8a29e" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
