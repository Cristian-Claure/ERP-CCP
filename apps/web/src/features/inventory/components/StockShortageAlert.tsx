import { TriangleAlert } from 'lucide-react'

import { formatQty } from '../format'
import type { StockShortage } from '../types'

/** Readable list for the 422 insufficient_stock error. */
export function StockShortageAlert({
  lines,
  title = 'Stock insuficiente',
}: {
  lines: StockShortage[]
  title?: string
}) {
  return (
    <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
      <p className="flex items-center gap-2 font-medium text-destructive">
        <TriangleAlert className="size-4" />
        {title}
      </p>
      <ul className="mt-2 space-y-1">
        {lines.map((line) => (
          <li
            key={`${line.product_id}-${line.warehouse_id}`}
            className="flex flex-wrap items-baseline gap-x-2 text-[13px]"
          >
            <span className="num text-xs text-muted-foreground">{line.sku}</span>
            <span className="font-medium">{line.product}</span>
            <span className="text-muted-foreground">en {line.warehouse}:</span>
            <span>
              disponible <span className="num font-semibold">{formatQty(line.available)}</span>, solicitado{' '}
              <span className="num font-semibold text-destructive">{formatQty(line.requested)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
