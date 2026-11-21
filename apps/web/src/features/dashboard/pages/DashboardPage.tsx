import { CalendarDays, RefreshCw, TriangleAlert } from 'lucide-react'

import { EmptyState } from '@/components/feedback/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/hooks'
import { useInventoryDashboard } from '@/features/inventory/hooks'

import { InventoryValuationCard, LowStockCard } from '../components/InventoryWidgets'
import { KpiCard, KpiCardSkeleton } from '../components/KpiCard'
import { RecentOperationsTable, RecentOperationsTableSkeleton } from '../components/RecentOperationsTable'
import { SalesAreaChart, SalesAreaChartSkeleton } from '../components/SalesAreaChart'
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

export function DashboardPage() {
  const { user, can } = useAuth()
  const { data, isPending, isError, refetch, isFetching } = useDashboardSummary()
  const canInventory = can('inventory.view')
  const inventory = useInventoryDashboard(canInventory)

  // Low-stock KPI comes from the real inventory API; the rest stay demo until their modules exist.
  const kpis: Kpi[] | undefined = data?.kpis.map((kpi) =>
    kpi.key === 'low_stock' && inventory.data
      ? {
          ...kpi,
          value: inventory.data.low_stock.count,
          delta: null,
          trend: undefined,
          hint: inventory.data.low_stock.count === 1 ? 'producto a reponer' : 'productos a reponer',
          source: 'live',
        }
      : kpi,
  )

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
              onClick={() => {
                void refetch()
                void inventory.refetch()
              }}
              disabled={isFetching}
            >
              <RefreshCw className={isFetching ? 'animate-spin' : undefined} />
              Actualizar
            </Button>
          </>
        }
      />

      {isError ? (
        <EmptyState
          icon={TriangleAlert}
          title="No pudimos cargar el resumen"
          description="Revisa tu conexión e inténtalo de nuevo."
          action={
            <Button size="sm" onClick={() => void refetch()}>
              Reintentar
            </Button>
          }
        />
      ) : (
        <>
          <section aria-label="Indicadores clave" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {isPending
              ? Array.from({ length: 4 }, (_, i) => <KpiCardSkeleton key={i} />)
              : kpis?.map((kpi) => <KpiCard key={kpi.key} kpi={kpi} currency={data.currency} />)}
          </section>

          <div className="grid gap-4 xl:grid-cols-3">
            <div className={canInventory ? 'xl:col-span-2' : 'xl:col-span-3'}>
              {isPending ? (
                <SalesAreaChartSkeleton />
              ) : (
                <SalesAreaChart data={data.sales} currency={data.currency} />
              )}
            </div>
            {canInventory && <InventoryValuationCard data={inventory.data?.valuation} />}
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <div className={canInventory ? 'xl:col-span-2' : 'xl:col-span-3'}>
              {isPending ? (
                <RecentOperationsTableSkeleton />
              ) : (
                <RecentOperationsTable operations={data.recentOperations} currency={data.currency} />
              )}
            </div>
            {canInventory && <LowStockCard data={inventory.data?.low_stock} />}
          </div>
        </>
      )}
    </div>
  )
}
