import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from 'recharts'

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCompact, formatCurrency, formatPercent } from '@/lib/format'

import type { SalesPoint } from '../types'

interface SalesAreaChartProps {
  data: SalesPoint[]
  currency: string
}

const SERIES = [
  { key: 'current', label: 'Este año', color: 'var(--chart-1)' },
  { key: 'previous', label: 'Año anterior', color: 'var(--chart-2)' },
] as const

export function SalesAreaChart({ data, currency }: SalesAreaChartProps) {
  const total = data.reduce((sum, p) => sum + p.current, 0)
  const previousTotal = data.reduce((sum, p) => sum + p.previous, 0)
  const growth = previousTotal ? ((total - previousTotal) / previousTotal) * 100 : 0

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="text-base">Ventas de los últimos 12 meses</CardTitle>
        <CardDescription>
          <span className="num font-medium text-foreground">{formatCurrency(total, currency)}</span> acumulado
          · <span className="num text-success">{formatPercent(growth)}</span> interanual
        </CardDescription>
        <CardAction className="hidden items-center gap-4 sm:flex">
          {SERIES.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-2.5 rounded-full" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </CardAction>
      </CardHeader>
      <CardContent className="h-[300px] px-2 sm:px-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
            <defs>
              {SERIES.map((s) => (
                <linearGradient key={s.key} id={`sales-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={s.key === 'current' ? 0.35 : 0.12} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={52}
              tickFormatter={(v: number) => formatCompact(v)}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 11, fontFamily: 'var(--font-mono)' }}
            />
            <Tooltip
              cursor={{ stroke: 'var(--brand)', strokeOpacity: 0.35, strokeDasharray: '4 4' }}
              content={(props) => <ChartTooltip {...props} currency={currency} />}
            />
            <Area
              type="monotone"
              dataKey="previous"
              name="Año anterior"
              stroke="var(--chart-2)"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              fill="url(#sales-previous)"
            />
            <Area
              type="monotone"
              dataKey="current"
              name="Este año"
              stroke="var(--chart-1)"
              strokeWidth={2.25}
              fill="url(#sales-current)"
              activeDot={{ r: 4.5, strokeWidth: 2, stroke: 'var(--card)' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

function ChartTooltip({ active, payload, label, currency }: TooltipContentProps & { currency: string }) {
  if (!active || !payload?.length) return null

  return (
    <div className="shadow-elevated min-w-44 rounded-lg border bg-popover/95 px-3 py-2.5 text-xs backdrop-blur">
      <p className="mb-1.5 font-medium">{label}</p>
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={String(entry.dataKey)} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2 rounded-full" style={{ background: entry.color }} />
              {entry.name}
            </span>
            <span className="num font-medium">{formatCurrency(Number(entry.value), currency)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SalesAreaChartSkeleton() {
  return (
    <Card className="gap-4">
      <CardHeader>
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-3.5 w-72" />
      </CardHeader>
      <CardContent className="h-[300px]">
        <Skeleton className="h-full w-full rounded-lg" />
      </CardContent>
    </Card>
  )
}
