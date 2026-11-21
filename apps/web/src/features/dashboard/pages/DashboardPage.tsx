import { CalendarDays, RefreshCw } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/hooks'
import { useInventoryDashboard } from '@/features/inventory/hooks'
import { useSalesDashboard } from '@/features/sales/hooks'
import type { SalesDashboard } from '@/features/sales/types'

import { InventoryValuationCard, LowStockCard } from '../components/InventoryWidgets'
import { KpiCard, KpiCardSkeleton } from '../components/KpiCard'
import {
  DailySalesChart,
  TopCustomersCard,
  TopProductsCard,
  WidgetSkeleton,
} from '../components/SalesWidgets'
import { useDashboardSummary } from '../hooks'
import type { Kpi } from '../types'

function greeting(date = new Date()): string {
  const hour = date.getHours()
  if (hour < 12) return 'Buenos días'
  if (hour < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

const todayLabel = new Intl.DateTimeFormat('es-BO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
}).format(new Date())

const prevMonthName = (() => {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return new Intl.DateTimeFormat('es-BO', { month: 'long' }).format(d)
})()

/** Weekly totals of the last 8 weeks (sparkline of the monthly sales KPI). */
function weeklyTrend(daily: SalesDashboard['daily']): number[] {
  const last = daily.slice(-56)
  return Array.from({ length: 8 }, (_, w) =>
    last.slice(w * 7, w * 7 + 7).reduce((s, d) => s + Number(d.total), 0),
  )
}

export function DashboardPage() {
  const { user, can } = useAuth()
  const canInventory = can('inventory.view')
  const canSales = can('sales.view')
  const sales = useSalesDashboard(canSales)
  const inventory = useInventoryDashboard(canInventory)
  // Only the "pending orders" KPI is still a demo (Purchases arrives in Phase 3).
  const demo = useDashboardSummary()

  const kpis: (Kpi | null)[] = []
  if (canSales) {
    const s = sales.data
    if (s) {
      const current = Number(s.month.current.total)
      const previous = Number(s.month.previous.total)
      kpis.push({
        key: 'monthly_sales',
        label: 'Ventas del mes',
        value: current,
        format: 'currency',
        delta: previous > 0 ? ((current - previous) / previous) * 100 : null,
        higherIsBetter: true,
        hint: `${s.month.current.count} ventas · vs. mismo período de ${prevMonthName}`,
        trend: weeklyTrend(s.daily),
        source: 'live',
      })
      if (s.receivables) {
        kpis.push({
          key: 'receivables',
          label: 'Cuentas por cobrar',
          value: Number(s.receivables.total),
          format: 'currency',
          delta: null,
          higherIsBetter: false,
          hint: `${s.receivables.customers_with_debt} clientes · vencido ${new Intl.NumberFormat('es-BO', {
            style: 'currency',
            currency: 'BOB',
            maximumFractionDigits: 0,
          }).format(Number(s.receivables.overdue))}`,
          source: 'live',
        })
      }
    } else {
      kpis.push(null, null)
    }
  }
  if (canInventory) {
    kpis.push(
      inventory.data
        ? {
            key: 'low_stock',
            label: 'Bajo stock mínimo',
            value: inventory.data.low_stock.count,
            format: 'integer',
            delta: null,
            higherIsBetter: false,
            hint: inventory.data.low_stock.count === 1 ? 'producto a reponer' : 'productos a reponer',
            source: 'live',
          }
        : null,
    )
  }
  const pending = demo.data?.kpis.find((k) => k.key === 'pending_orders')
  kpis.push(pending ?? null)

  const refresh = () => {
    void sales.refetch()
    void inventory.refetch()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${greeting()}, ${user?.name.split(' ')[0] ?? ''}`}
        description={
          <>
            Resumen de <span className="font-medium text-foreground">{user?.company.legal_name}</span>
          </>
        }
        actions={
          <>
            <span className="hidden items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs text-muted-foreground capitalize sm:inline-flex">
              <CalendarDays className="size-3.5" />
              {todayLabel}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={sales.isFetching || inventory.isFetching}
            >
              <RefreshCw className={sales.isFetching || inventory.isFetching ? 'animate-spin' : undefined} />
              Actualizar
            </Button>
          </>
        }
      />

      <section aria-label="Indicadores clave" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi, i) =>
          kpi ? <KpiCard key={kpi.key} kpi={kpi} currency="BOB" /> : <KpiCardSkeleton key={i} />,
        )}
      </section>

      {canSales && (
        <div className="grid gap-4 xl:grid-cols-3">
          <div className={canInventory ? 'xl:col-span-2' : 'xl:col-span-3'}>
            {sales.data ? <DailySalesChart daily={sales.data.daily} /> : <WidgetSkeleton />}
          </div>
          {canInventory && <InventoryValuationCard data={inventory.data?.valuation} />}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {canSales &&
          (sales.data ? (
            <>
              <TopCustomersCard items={sales.data.top_customers} />
              <TopProductsCard data={sales.data.top_products} />
            </>
          ) : (
            <>
              <WidgetSkeleton height={220} />
              <WidgetSkeleton height={220} />
            </>
          ))}
        {!canSales && canInventory && <InventoryValuationCard data={inventory.data?.valuation} />}
        {canInventory && <LowStockCard data={inventory.data?.low_stock} />}
      </div>
    </div>
  )
}
