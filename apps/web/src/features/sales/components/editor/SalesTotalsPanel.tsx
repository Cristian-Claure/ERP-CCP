import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/format'
import { cn } from 'cn'

import type { SalesEditorForm } from './useSalesEditorForm'
import type { SalesEditorTotals } from './useSalesEditorTotals'

/** Subtotal, discounts, global discount input, total with VAT breakdown and estimated margin. */
export function SalesTotalsPanel({
  form,
  totals,
  breakDownVat,
  estimatedMargin,
  showMargin,
}: {
  form: SalesEditorForm
  totals: SalesEditorTotals['totals']
  breakDownVat: boolean
  estimatedMargin: number
  showMargin: boolean
}) {
  return (
    <dl className="grid w-full max-w-sm grid-cols-[1fr_auto] items-center gap-x-6 gap-y-1.5 text-sm">
      <dt className="text-muted-foreground">Subtotal</dt>
      <dd className="num text-right">{formatCurrency(totals.subtotal)}</dd>
      {totals.lineDiscountTotal > 0 && (
        <>
          <dt className="text-muted-foreground">Descuentos por línea</dt>
          <dd className="num text-right">−{formatCurrency(totals.lineDiscountTotal)}</dd>
        </>
      )}
      <dt className="text-muted-foreground">
        <label htmlFor="global_discount">Descuento global</label>
      </dt>
      <dd>
        <Input
          id="global_discount"
          inputMode="decimal"
          placeholder="0,00"
          className={cn(
            'num ml-auto h-8 w-28 text-right',
            totals.errors.global_discount && 'border-destructive',
          )}
          {...form.register('global_discount')}
        />
      </dd>
      <div className="col-span-2 mt-1 border-t" aria-hidden />
      <dt className="font-medium">Total</dt>
      <dd className="num text-right text-xl font-semibold">{formatCurrency(totals.total)}</dd>
      {breakDownVat ? (
        <>
          <dt className="text-xs text-muted-foreground">Neto (sin IVA)</dt>
          <dd className="num text-right text-xs text-muted-foreground">{formatCurrency(totals.net)}</dd>
          <dt className="text-xs text-muted-foreground">IVA 13 % incluido</dt>
          <dd className="num text-right text-xs text-muted-foreground">{formatCurrency(totals.vat)}</dd>
        </>
      ) : (
        <dt className="col-span-2 text-xs text-muted-foreground">Nota de venta sin desglose de IVA.</dt>
      )}
      {showMargin && (
        <>
          <dt className="text-xs text-muted-foreground">Margen estimado</dt>
          <dd
            className={cn(
              'num text-right text-xs font-medium',
              estimatedMargin < 0 ? 'text-destructive' : 'text-success',
            )}
          >
            {formatCurrency(estimatedMargin)}
            {totals.net > 0 && ` · ${((estimatedMargin / totals.net) * 100).toFixed(1).replace('.', ',')} %`}
          </dd>
        </>
      )}
    </dl>
  )
}
