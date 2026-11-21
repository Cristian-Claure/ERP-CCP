import { formatCurrency } from '@/lib/format'

import { AGING_BUCKETS } from '../format'
import type { Aging } from '../types'

/** Stacked bar of the open debt by days past due, with its legend. */
export function AgingBar({ aging, compact = false }: { aging: Aging; compact?: boolean }) {
  const total = Number(aging.total)

  if (total <= 0) {
    return <p className="text-sm text-muted-foreground">Sin deuda pendiente.</p>
  }

  return (
    <div className="space-y-3">
      <div
        className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label="Antigüedad de la deuda"
      >
        {AGING_BUCKETS.map((b) => {
          const value = Number(aging[b.key])
          if (value <= 0) return null
          return (
            <div
              key={b.key}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{ width: `${(value / total) * 100}%`, background: b.color }}
              title={`${b.label}: ${formatCurrency(value)}`}
            />
          )
        })}
      </div>
      <dl
        className={
          compact
            ? 'grid grid-cols-2 gap-x-4 gap-y-1 text-xs'
            : 'grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-5'
        }
      >
        {AGING_BUCKETS.map((b) => (
          <div key={b.key} className="flex flex-col">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-2 rounded-full" style={{ background: b.color }} aria-hidden />
              {b.label}
            </dt>
            <dd className="num font-medium">{formatCurrency(Number(aging[b.key]))}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
