import { useId } from 'react'

import { cn } from 'cn'

interface LogoProps {
  className?: string
  title?: string
}

/** CCP mark: hexagon, open "C" and central node. Inline so the gradient id is unique per instance. */
export function Logo({ className, title = 'CCP' }: LogoProps) {
  const id = useId()
  const gradient = `ccp-g-${id}`
  const shine = `ccp-s-${id}`

  return (
    <svg viewBox="0 0 64 64" role="img" aria-label={title} className={cn('size-8 shrink-0', className)}>
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366F1" />
          <stop offset="1" stopColor="#22D3EE" />
        </linearGradient>
        <linearGradient id={shine} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".22" />
          <stop offset=".55" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M32 4 L56.2 18 L56.2 46 L32 60 L7.8 46 L7.8 18 Z" fill={`url(#${gradient})`} />
      <path d="M32 4 L56.2 18 L56.2 46 L32 60 L7.8 46 L7.8 18 Z" fill={`url(#${shine})`} />
      <path
        d="M40.5 23 A12 12 0 1 0 40.5 41"
        fill="none"
        stroke="#fff"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="44" cy="32" r="3.5" fill="#fff" />
    </svg>
  )
}

interface WordmarkProps {
  className?: string
  showTagline?: boolean
}

export function Wordmark({ className, showTagline = false }: WordmarkProps) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <Logo />
      <div className="flex flex-col leading-none">
        <span className="text-[17px] font-extrabold tracking-wide">CCP</span>
        {showTagline && (
          <span className="mt-1 text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Control Central de Procesos
          </span>
        )}
      </div>
    </div>
  )
}
