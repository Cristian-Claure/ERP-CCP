import { ExternalLink, FilePlus2, X } from 'lucide-react'
import { Link } from 'react-router'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/hooks'
import { DocumentStatusBadge } from '@/features/inventory/components/DocumentStatusBadge'
import { AgingBar } from '@/features/sales/components/AgingBar'
import { DebtStatusBadge } from '@/features/sales/components/Badges'
import { formatBizDate } from '@/features/sales/format'
import { useCustomer, useSalesDocuments } from '@/features/sales/hooks'
import { formatCurrency } from '@/lib/format'
import { cn } from 'cn'

import { SEGMENT_COLORS } from '../lib/colors'
import { useAtlasStore } from '../store'
import type { AtlasCustomer } from '../types'
import { panel } from './AtlasHud'

/** Side panel of the selected customer: KPIs, last sales, account summary, actions. */
export function CustomerPanel({ customer, periodLabel }: { customer: AtlasCustomer; periodLabel: string }) {
  const { can } = useAuth()
  const { data: detail } = useCustomer(customer.id)
  const { data: sales, isPending } = useSalesDocuments(
    { 'filter[customer_id]': customer.id, 'filter[type]': 'sale', sort: '-document_date', per_page: 5 },
    can('sales.view'),
  )
  const r = customer.receivables
  const close = () => useAtlasStore.getState().select(null)

  const kpis: [string, string, string?][] = [
    [
      `Ventas · ${periodLabel}`,
      formatCurrency(Number(customer.sales_total)),
      `${customer.sales_count} documentos`,
    ],
    ['Última compra', formatBizDate(customer.last_sale_at)],
    ...(r
      ? ([
          ['Saldo por cobrar', formatCurrency(Number(r.balance))],
          ['Deuda vencida', formatCurrency(Number(r.overdue))],
        ] as [string, string][])
      : []),
  ]

  return (
    <aside
      className={cn(
        panel,
        'pointer-events-auto flex max-h-full w-full flex-col overflow-hidden sm:w-96',
        'animate-in fade-in slide-in-from-right-4 motion-reduce:animate-none',
      )}
      aria-label={`Cliente ${customer.name}`}
    >
      <header className="flex items-start justify-between gap-3 border-b p-4">
        <div className="min-w-0 space-y-1">
          <h2 className="truncate text-base font-semibold">{customer.name}</h2>
          <p className="text-xs text-muted-foreground">
            {[customer.city, customer.department, customer.country].filter(Boolean).join(' · ')}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" style={{ borderColor: SEGMENT_COLORS[customer.segment].color }}>
              {SEGMENT_COLORS[customer.segment].label}
            </Badge>
            <DebtStatusBadge status={r?.debt_status} />
          </div>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={close} aria-label="Cerrar panel">
          <X />
        </Button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <dl className="grid grid-cols-2 gap-3">
          {kpis.map(([label, value, hint]) => (
            <div key={label} className="rounded-lg border bg-surface-2/40 p-2.5">
              <dt className="text-[11px] text-muted-foreground">{label}</dt>
              <dd className="num text-sm font-semibold">{value}</dd>
              {hint && <dd className="num text-[10px] text-muted-foreground">{hint}</dd>}
            </div>
          ))}
        </dl>

        {detail?.payment_terms === 'credit' && detail.receivables && (
          <p className="text-xs text-muted-foreground">
            Crédito {detail.credit_days} días · disponible{' '}
            <span className="num font-medium text-foreground">
              {formatCurrency(Number(detail.receivables.available_credit))}
            </span>{' '}
            de {formatCurrency(Number(detail.credit_limit))}
          </p>
        )}

        {detail?.aging && Number(detail.aging.total) > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">Estado de cuenta</h3>
            <AgingBar aging={detail.aging} compact />
          </section>
        )}

        {can('sales.view') && (
          <section>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">Últimas ventas</h3>
            {isPending ? (
              <Skeleton className="h-24 w-full" />
            ) : !sales?.data.length ? (
              <p className="text-xs text-muted-foreground">Sin ventas registradas.</p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {sales.data.map((d) => (
                  <li key={d.id}>
                    <Link
                      to={`/ventas/documentos/${d.id}`}
                      className="flex items-center justify-between gap-2 px-3 py-2 text-xs hover:bg-accent"
                    >
                      <span className="flex flex-col">
                        <span className="num font-medium">{d.number}</span>
                        <span className="text-muted-foreground">{formatBizDate(d.document_date)}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="num">{formatCurrency(Number(d.total))}</span>
                        <DocumentStatusBadge status={d.status} className="text-[10px]" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      <footer className="flex gap-2 border-t p-3">
        <Button asChild variant="outline" size="sm" className="flex-1">
          <Link to={`/ventas/clientes/${customer.id}`}>
            <ExternalLink /> Ver cliente
          </Link>
        </Button>
        {can('sales.create') && (
          <Button asChild size="sm" className="flex-1">
            <Link to={`/ventas/documentos/nuevo?tipo=invoice&cliente=${customer.id}`}>
              <FilePlus2 /> Nueva venta
            </Link>
          </Button>
        )}
      </footer>
    </aside>
  )
}
