import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/format'
import { cn } from 'cn'

import { formatBizDate } from '../../format'
import type { Customer } from '../../types'

export function CustomerKpis({ customer }: { customer: Customer }) {
  const r = customer.receivables
  const items: { label: string; value: string; hint?: string; tone?: string }[] = [
    {
      label: 'Ventas acumuladas',
      value: formatCurrency(Number(customer.stats?.sales_total ?? 0)),
      hint: `${customer.stats?.sales_count ?? 0} documentos`,
    },
    { label: 'Última compra', value: formatBizDate(customer.stats?.last_sale_at) },
  ]
  if (r) {
    items.push(
      { label: 'Saldo por cobrar', value: formatCurrency(Number(r.balance)) },
      {
        label: 'Deuda vencida',
        value: formatCurrency(Number(r.overdue_amount ?? 0)),
        tone: Number(r.overdue_amount ?? 0) > 0 ? 'text-destructive' : undefined,
      },
    )
    if (customer.payment_terms === 'credit') {
      items.push({
        label: 'Crédito disponible',
        value: formatCurrency(Number(r.available_credit)),
        hint: `de ${formatCurrency(Number(customer.credit_limit))}`,
      })
    }
  }
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-label="Indicadores del cliente">
      {items.map((i) => (
        <Card key={i.label} className="gap-1 py-4">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">{i.label}</p>
            <p className={cn('num text-lg font-semibold', i.tone)}>{i.value}</p>
            {i.hint && <p className="num text-xs text-muted-foreground">{i.hint}</p>}
          </CardContent>
        </Card>
      ))}
    </section>
  )
}
