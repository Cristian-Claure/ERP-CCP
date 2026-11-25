import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatQty } from '@/features/inventory/format'
import { formatCurrency } from '@/lib/format'
import { cn } from 'cn'

import { formatBizDate } from '../../format'
import type { SalesDocument } from '../../types'

const pct = (part: number, whole: number) => ` · ${((part / whole) * 100).toFixed(1).replace('.', ',')} %`

function PaymentsApplied({ doc }: { doc: SalesDocument }) {
  if (doc.type === 'quote' || !doc.payments?.length) return null
  return (
    <>
      <p className="mb-2 text-xs font-medium text-muted-foreground">Cobros aplicados</p>
      <ul className="space-y-1 text-sm">
        {doc.payments.map((p) => (
          <li
            key={p.payment_id}
            className={cn(
              'flex justify-between gap-4',
              p.status === 'voided' && 'text-muted-foreground line-through',
            )}
          >
            <span className="num">
              {p.number} · {formatBizDate(p.date)} · {p.method_label}
            </span>
            <span className="num">{formatCurrency(Number(p.amount))}</span>
          </li>
        ))}
      </ul>
    </>
  )
}

function Totals({ doc, showMargin }: { doc: SalesDocument; showMargin: boolean }) {
  const discounts = Number(doc.line_discount_total) + Number(doc.global_discount)
  const open = Number(doc.open_amount ?? 0)
  return (
    <dl className="grid w-full max-w-sm grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-sm">
      <dt className="text-muted-foreground">Subtotal</dt>
      <dd className="num text-right">{formatCurrency(Number(doc.subtotal))}</dd>
      {discounts > 0 && (
        <>
          <dt className="text-muted-foreground">Descuentos</dt>
          <dd className="num text-right">−{formatCurrency(discounts)}</dd>
        </>
      )}
      <div className="col-span-2 mt-1 border-t" aria-hidden />
      <dt className="font-medium">Total</dt>
      <dd className="num text-right text-xl font-semibold">{formatCurrency(Number(doc.total))}</dd>
      {Number(doc.iva_amount) > 0 && (
        <>
          <dt className="text-xs text-muted-foreground">Neto (sin IVA)</dt>
          <dd className="num text-right text-xs text-muted-foreground">
            {formatCurrency(Number(doc.net_amount))}
          </dd>
          <dt className="text-xs text-muted-foreground">IVA 13 % incluido</dt>
          <dd className="num text-right text-xs text-muted-foreground">
            {formatCurrency(Number(doc.iva_amount))}
          </dd>
        </>
      )}
      {showMargin && doc.margin_total && (
        <>
          <dt className="text-xs text-muted-foreground">Margen</dt>
          <dd
            className={cn(
              'num text-right text-xs font-medium',
              Number(doc.margin_total) < 0 ? 'text-destructive' : 'text-success',
            )}
          >
            {formatCurrency(Number(doc.margin_total))}
            {Number(doc.net_amount) > 0 && pct(Number(doc.margin_total), Number(doc.net_amount))}
          </dd>
        </>
      )}
      {doc.type !== 'quote' && doc.status === 'posted' && (
        <>
          <dt className="text-muted-foreground">Cobrado</dt>
          <dd className="num text-right">{formatCurrency(Number(doc.paid_amount))}</dd>
          <dt className="font-medium">Saldo</dt>
          <dd className={cn('num text-right font-semibold', open > 0 && 'text-warning')}>
            {formatCurrency(open)}
          </dd>
        </>
      )}
    </dl>
  )
}

/** Read-only lines table with cost/margin (when visible), payments applied and totals. */
export function SalesViewLines({ doc }: { doc: SalesDocument }) {
  const showMargin = doc.margin_total !== undefined && doc.type !== 'quote'
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="text-base">Productos</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6">Producto</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="text-right">Desc.</TableHead>
                <TableHead className="text-right">Total</TableHead>
                {showMargin && <TableHead className="text-right">Costo</TableHead>}
                {showMargin && <TableHead className="pr-6 text-right">Margen</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {doc.lines?.map((l) => {
                const discount = Number(l.discount_amount) + Number(l.global_discount_share)
                return (
                  <TableRow key={l.id}>
                    <TableCell className="pl-6">
                      <span className="flex flex-col">
                        <span className="font-medium">{l.product?.name}</span>
                        <span className="num text-xs text-muted-foreground">{l.product?.sku}</span>
                      </span>
                    </TableCell>
                    <TableCell className="num text-right">
                      {formatQty(l.quantity, l.product?.unit?.code)}
                    </TableCell>
                    <TableCell className="num text-right">{formatCurrency(Number(l.unit_price))}</TableCell>
                    <TableCell className="num text-right text-muted-foreground">
                      {discount > 0 ? `−${formatCurrency(discount)}` : '—'}
                    </TableCell>
                    <TableCell className="num text-right font-medium">
                      {formatCurrency(Number(l.total))}
                    </TableCell>
                    {showMargin && (
                      <TableCell className="num text-right text-muted-foreground">
                        {l.cost_total ? formatCurrency(Number(l.cost_total)) : '—'}
                      </TableCell>
                    )}
                    {showMargin && (
                      <TableCell
                        className={cn(
                          'num pr-6 text-right',
                          Number(l.margin ?? 0) < 0 ? 'text-destructive' : 'text-success',
                        )}
                      >
                        {l.margin ? formatCurrency(Number(l.margin)) : '—'}
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
        <div className="flex flex-col gap-6 border-t px-6 pt-4 lg:flex-row lg:justify-between">
          <div className="min-w-0 flex-1">
            <PaymentsApplied doc={doc} />
          </div>
          <Totals doc={doc} showMargin={showMargin} />
        </div>
      </CardContent>
    </Card>
  )
}
