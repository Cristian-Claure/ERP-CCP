import { ShieldCheck } from 'lucide-react'
import { Link } from 'react-router'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/format'

import type { useCustomer } from '../../hooks'
import type { PaymentTerms } from '../../types'
import { DebtStatusBadge } from '../Badges'

/** Side card with the selected customer's credit, balance and warnings. */
export function CustomerSummary({
  customer,
  overCredit,
  isQuote,
  terms,
}: {
  customer: ReturnType<typeof useCustomer>['data']
  overCredit: boolean
  isQuote: boolean
  terms: PaymentTerms
}) {
  if (!customer) {
    return (
      <Card className="justify-center">
        <CardContent className="text-sm text-muted-foreground">
          Selecciona un cliente para ver su crédito y saldo.
        </CardContent>
      </Card>
    )
  }
  const r = customer.receivables
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <Link to={`/ventas/clientes/${customer.id}`} className="truncate hover:underline" target="_blank">
            {customer.name}
          </Link>
          <DebtStatusBadge status={r?.debt_status} />
        </CardTitle>
        <p className="num text-xs text-muted-foreground">
          {customer.document_label} · {customer.segment_label}
        </p>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Condición</span>
          <span>
            {customer.payment_terms === 'credit' ? `Crédito ${customer.credit_days} días` : 'Contado'}
          </span>
        </div>
        {r && customer.payment_terms === 'credit' && (
          <>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Límite</span>
              <span className="num">{formatCurrency(Number(customer.credit_limit))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Saldo</span>
              <span className="num">{formatCurrency(Number(r.balance))}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Disponible</span>
              <span className="num">{formatCurrency(Number(r.available_credit))}</span>
            </div>
          </>
        )}
        {r && Number(r.overdue_amount ?? 0) > 0 && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
            Tiene deuda vencida por {formatCurrency(Number(r.overdue_amount))}.
          </p>
        )}
        {overCredit && (
          <p className="flex items-start gap-1.5 rounded-md border border-warning/30 bg-warning/10 p-2 text-xs text-warning">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
            Esta venta supera el crédito disponible: requerirá autorización de gerencia.
          </p>
        )}
        {!isQuote && terms === 'credit' && customer.payment_terms !== 'credit' && (
          <p className="text-xs text-warning">
            El cliente es de contado: una venta a crédito requerirá autorización.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
