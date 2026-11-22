import { DebtStatusBadge } from '@/features/sales/components/Badges'
import { formatCurrency } from '@/lib/format'
import { cn } from 'cn'

import { useAtlasStore } from '../store'
import type { AtlasCustomer } from '../types'
import { panel } from './AtlasHud'

/** Tooltip that follows the pointer over a column/hexbin (one customer or a group). */
export function HoverTooltip({ byId }: { byId: Map<number, AtlasCustomer> }) {
  const hover = useAtlasStore((s) => s.hover)
  if (!hover) return null

  const members = hover.customerIds.map((id) => byId.get(id)).filter((c): c is AtlasCustomer => !!c)
  if (!members.length) return null
  const total = members.reduce((s, c) => s + Number(c.sales_total), 0)
  const single = members.length === 1 ? members[0] : null
  const left = Math.min(hover.x + 16, window.innerWidth - 260)

  return (
    <div
      className={cn(panel, 'pointer-events-none fixed z-50 w-60 p-3 text-xs')}
      style={{ left, top: Math.max(hover.y - 12, 8) }}
      role="tooltip"
    >
      {single ? (
        <>
          <p className="truncate text-sm font-semibold">{single.name}</p>
          <p className="text-muted-foreground">{[single.city, single.country].filter(Boolean).join(' · ')}</p>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-muted-foreground">Ventas</span>
            <span className="num font-medium">{formatCurrency(Number(single.sales_total))}</span>
          </div>
          {single.receivables && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Saldo</span>
                <span className="num">{formatCurrency(Number(single.receivables.balance))}</span>
              </div>
              <DebtStatusBadge status={single.receivables.debt_status} className="mt-2" />
            </>
          )}
          <p className="mt-2 text-[10px] text-muted-foreground">Clic para ver el detalle</p>
        </>
      ) : (
        <>
          <p className="text-sm font-semibold">{members.length} clientes</p>
          <p className="truncate text-muted-foreground">
            {[...new Set(members.map((m) => m.city).filter(Boolean))].slice(0, 3).join(', ')}
          </p>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-muted-foreground">Ventas</span>
            <span className="num font-medium">{formatCurrency(total)}</span>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">Clic para acercar</p>
        </>
      )}
    </div>
  )
}
