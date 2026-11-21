import {
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  ClipboardList,
  HandCoins,
  type LucideIcon,
  Wallet,
} from 'lucide-react'
import { useId } from 'react'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'

import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatInteger, formatPercent } from '@/lib/format'
import { cn } from 'cn'

import type { Kpi, KpiKey } from '../types'

const ICONS: Record<KpiKey, { icon: LucideIcon; color: string }> = {
  monthly_sales: { icon: Wallet, color: 'var(--chart-1)' },
  receivables: { icon: HandCoins, color: 'var(--chart-2)' },
  low_stock: { icon: Boxes, color: 'var(--chart-5)' },
  pending_orders: { icon: ClipboardList, color: 'var(--chart-3)' },
}

interface KpiCardProps {
  kpi: Kpi
  currency: string
}

export function KpiCard({ kpi, currency }: KpiCardProps) {
  const gradientId = useId()
  const { icon: Icon, color } = ICONS[kpi.key]
  const isUp = kpi.delta >= 0
  const isGood = isUp === kpi.higherIsBetter
  const value = kpi.format === 'currency' ? formatCurrency(kpi.value, currency) : formatInteger(kpi.value)

  return (
    <Card className="group relative gap-0 overflow-hidden p-5 transition-colors hover:border-brand/30">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[13px] font-medium text-muted-foreground">{kpi.label}</p>
          <p className="num text-[26px] leading-tight font-semibold tracking-tight">{value}</p>
        </div>
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-xl border"
          style={{
            background: `color-mix(in oklab, ${color} 14%, transparent)`,
            borderColor: `color-mix(in oklab, ${color} 30%, transparent)`,
          }}
        >
          <Icon className="size-[18px]" style={{ color }} />
        </span>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span
            className={cn(
              'num inline-flex w-fit items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold',
              isGood ? 'bg-success/12 text-success' : 'bg-destructive/12 text-destructive',
            )}
          >
            {isUp ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {formatPercent(kpi.delta)}
          </span>
          <span className="text-xs text-muted-foreground">{kpi.hint}</span>
        </div>
        <div className="h-10 w-24" aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={kpi.trend.map((v, i) => ({ i, v }))}
              margin={{ top: 2, right: 0, bottom: 0, left: 0 }}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={color}
                strokeWidth={1.75}
                fill={`url(#${gradientId})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  )
}

export function KpiCardSkeleton() {
  return (
    <Card className="gap-0 p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-2.5">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-7 w-36" />
        </div>
        <Skeleton className="size-10 rounded-xl" />
      </div>
      <div className="mt-5 flex items-end justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-10 w-24" />
      </div>
    </Card>
  )
}
