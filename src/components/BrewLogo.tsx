export function BrewLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" role="img" aria-label="BrewAtHome">
      <rect width="40" height="40" rx="10" fill="#78350f" />
      <path
        d="M11 14h14v13a4 4 0 0 1-4 4h-6a4 4 0 0 1-4-4V14Z"
        fill="#fcd34d"
        stroke="#451a03"
        strokeWidth="1.5"
      />
      <path d="M25 17h2.5a3 3 0 0 1 0 6H25" fill="none" stroke="#451a03" strokeWidth="1.5" />
      <path d="M11 14h14" stroke="#451a03" strokeWidth="1.5" />
      <path d="M13 19c1 1 2-1 3 0s2-1 3 0s2-1 3 0" stroke="#fffbeb" strokeWidth="1.2" fill="none" opacity="0.8" />
    </svg>
  )
}
