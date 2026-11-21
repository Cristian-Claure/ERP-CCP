import { CalendarDays, RefreshCw, TriangleAlert } from 'lucide-react'

import { EmptyState } from '@/components/feedback/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/hooks'

import { KpiCard, KpiCardSkeleton } from '../components/KpiCard'
import { RecentOperationsTable, RecentOperationsTableSkeleton } from '../components/RecentOperationsTable'
import { SalesAreaChart, SalesAreaChartSkeleton } from '../components/SalesAreaChart'
import { useDashboardSummary } from '../hooks'

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
  const { user } = useAuth()
  const { data, isPending, isError, refetch, isFetching } = useDashboardSummary()

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
            <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
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
              : data.kpis.map((kpi) => <KpiCard key={kpi.key} kpi={kpi} currency={data.currency} />)}
          </section>

          {isPending ? (
            <SalesAreaChartSkeleton />
          ) : (
            <SalesAreaChart data={data.sales} currency={data.currency} />
          )}

          {isPending ? (
            <RecentOperationsTableSkeleton />
          ) : (
            <RecentOperationsTable operations={data.recentOperations} currency={data.currency} />
          )}
        </>
      )}
    </div>
  )
}
