import { ArrowRight, PackageCheck, Warehouse } from 'lucide-react'
import { Link } from 'react-router'

import { EmptyState } from '@/components/feedback/EmptyState'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatQty } from '@/features/inventory/format'
import type { InventoryDashboard } from '@/features/inventory/types'
import { formatCurrency } from '@/lib/format'

const BAR_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

/** Real inventory valuation per warehouse (sum of stock_balances.total_value). */
export function InventoryValuationCard({ data }: { data: InventoryDashboard['valuation'] | undefined }) {
  const total = Number(data?.total ?? 0)

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="text-base">Valorización de inventario</CardTitle>
        <CardDescription>Al costo promedio, por almacén</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {!data ? (
          <Skeleton className="h-44 w-full" />
        ) : (
          <>
            <div>
              <p className="num text-3xl font-semibold tracking-tight">{formatCurrency(total)}</p>
              <p className="text-xs text-muted-foreground">Total en {data.warehouses.length} almacenes</p>
            </div>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
              {data.warehouses.map((w, i) => (
                <span
                  key={w.warehouse_id}
                  style={{
                    width: total ? `${(Number(w.value) / total) * 100}%` : 0,
                    background: BAR_COLORS[i % BAR_COLORS.length],
                  }}
                />
              ))}
            </div>
            <ul className="flex flex-col gap-3">
              {data.warehouses.map((w, i) => {
                const share = total ? (Number(w.value) / total) * 100 : 0
                return (
                  <li key={w.warehouse_id} className="flex items-center gap-3">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: BAR_COLORS[i % BAR_COLORS.length] }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">{w.name}</p>
                      <p className="text-xs text-muted-foreground">{w.products} productos con stock</p>
                    </div>
                    <div className="text-right">
                      <p className="num text-[13px] font-medium">{formatCurrency(Number(w.value))}</p>
                      <p className="num text-xs text-muted-foreground">
                        {share.toFixed(1).replace('.', ',')}%
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export function LowStockCard({ data }: { data: InventoryDashboard['low_stock'] | undefined }) {
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="text-base">Productos a reponer</CardTitle>
        <CardDescription>Stock total por debajo del mínimo</CardDescription>
        <CardAction>
          <Button asChild variant="ghost" size="sm">
            <Link to="/inventario/productos?f_below_min=1">
              Ver todos <ArrowRight />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {!data ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : data.items.length === 0 ? (
          <EmptyState
            icon={PackageCheck}
            title="Todo en orden"
            description="Ningún producto está bajo su stock mínimo."
            className="border-0 py-8"
          />
        ) : (
          <ul className="flex flex-col divide-y">
            {data.items.map((item) => {
              const pct = Math.min(100, (Number(item.stock) / Number(item.min_stock)) * 100)
              return (
                <li key={item.id}>
                  <Link
                    to={`/inventario/productos/${item.id}`}
                    className="group flex items-center gap-3 py-2.5"
                  >
                    <Warehouse className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium group-hover:text-brand-accent">
                        {item.name}
                      </p>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={pct === 0 ? 'h-full w-full bg-destructive/30' : 'h-full bg-warning'}
                          style={{ width: pct === 0 ? undefined : `${pct}%` }}
                        />
                      </div>
                    </div>
                    <div className="num text-right text-xs">
                      <span
                        className={
                          Number(item.stock) === 0
                            ? 'font-semibold text-destructive'
                            : 'font-semibold text-warning'
                        }
                      >
                        {formatQty(item.stock)}
                      </span>
                      <span className="text-muted-foreground"> / {formatQty(item.min_stock, item.unit)}</span>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
