import { Trophy, Users } from 'lucide-react'
import { Link } from 'react-router'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from 'recharts'

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { SalesDashboard } from '@/features/sales/types'
import { formatCompact, formatCurrency } from '@/lib/format'

const shortDate = new Intl.DateTimeFormat('es-BO', { day: 'numeric', month: 'short' })
const longDate = new Intl.DateTimeFormat('es-BO', { weekday: 'long', day: 'numeric', month: 'long' })
const parse = (d: string) => new Date(`${d}T00:00:00`)

/** Daily sales (posted invoices + sales notes) of the last 90 days. */
export function DailySalesChart({ daily }: { daily: SalesDashboard['daily'] }) {
  const data = daily.map((d) => ({ date: d.date, total: Number(d.total), count: d.count }))
  const total = data.reduce((s, d) => s + d.total, 0)
  const avg = total / Math.max(data.length, 1)
  const best = data.reduce((m, d) => (d.total > m.total ? d : m), data[0] ?? { date: '', total: 0, count: 0 })

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="text-base">Ventas diarias · últimos 90 días</CardTitle>
        <CardDescription>
          <span className="num font-medium text-foreground">{formatCurrency(total)}</span> en el período ·
          promedio <span className="num">{formatCurrency(avg)}</span> por día
        </CardDescription>
        {best?.date && (
          <CardAction className="hidden text-right text-xs text-muted-foreground sm:block">
            Mejor día
            <span className="num block font-medium text-foreground">{formatCurrency(best.total)}</span>
            <span className="capitalize">{shortDate.format(parse(best.date))}</span>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="h-[280px] px-2 sm:px-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 4 }} barCategoryGap={1}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              minTickGap={28}
              tickFormatter={(d: string) => shortDate.format(parse(d))}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={48}
              tickFormatter={(v: number) => formatCompact(v)}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
            />
            <Tooltip
              cursor={{ fill: 'var(--brand)', fillOpacity: 0.08 }}
              content={(p) => <DayTooltip {...p} />}
            />
            <Bar dataKey="total" name="Ventas" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

function DayTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload as { date: string; total: number; count: number }
  return (
    <div className="shadow-elevated min-w-44 rounded-lg border bg-popover/95 px-3 py-2.5 text-xs backdrop-blur">
      <p className="mb-1 font-medium capitalize">{longDate.format(parse(p.date))}</p>
      <p className="num text-sm font-semibold">{formatCurrency(p.total)}</p>
      <p className="text-muted-foreground">
        {p.count} {p.count === 1 ? 'venta' : 'ventas'}
      </p>
    </div>
  )
}

export function TopCustomersCard({ items }: { items: SalesDashboard['top_customers'] }) {
  const max = Math.max(...items.map((i) => Number(i.total)), 1)
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="size-4 text-brand-accent" /> Top 5 clientes
        </CardTitle>
        <CardDescription>Ventas de los últimos 90 días</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin ventas en el período.</p>
        ) : (
          <ol className="space-y-3">
            {items.map((c, i) => (
              <li key={c.customer_id} className="space-y-1">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <Link to={`/ventas/clientes/${c.customer_id}`} className="min-w-0 truncate hover:underline">
                    <span className="num mr-2 text-xs text-muted-foreground">{i + 1}</span>
                    {c.name}
                  </Link>
                  <span className="num shrink-0 font-medium">{formatCurrency(Number(c.total))}</span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${(Number(c.total) / max) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {c.city ?? '—'} · {c.count} {c.count === 1 ? 'venta' : 'ventas'}
                </p>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}

export function TopProductsCard({ data }: { data: SalesDashboard['top_products'] }) {
  const byMargin = data.metric === 'margin'
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="size-4 text-brand-accent" /> Top 5 productos{' '}
          {byMargin ? 'por margen' : 'por ingreso'}
        </CardTitle>
        <CardDescription>Últimos 90 días{byMargin ? ' · margen sobre el neto sin IVA' : ''}</CardDescription>
      </CardHeader>
      <CardContent>
        {data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin ventas en el período.</p>
        ) : (
          <ul className="divide-y">
            {data.items.map((p) => (
              <li
                key={p.product_id}
                className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
              >
                <Link to={`/inventario/productos/${p.product_id}`} className="min-w-0 hover:underline">
                  <span className="block truncate text-sm">{p.name}</span>
                  <span className="num text-xs text-muted-foreground">{p.sku}</span>
                </Link>
                <span className="shrink-0 text-right">
                  <span className="num block text-sm font-medium">
                    {formatCurrency(Number(byMargin ? p.margin : p.revenue))}
                  </span>
                  {byMargin && p.margin_pct && (
                    <span className="num text-xs text-success">{p.margin_pct.replace('.', ',')} %</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export function WidgetSkeleton({ height = 280 }: { height?: number }) {
  return (
    <Card className="gap-4">
      <CardHeader>
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3.5 w-64" />
      </CardHeader>
      <CardContent style={{ height }}>
        <Skeleton className="h-full w-full rounded-lg" />
      </CardContent>
    </Card>
  )
}
