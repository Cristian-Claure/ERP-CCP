import { Trash2, TriangleAlert } from 'lucide-react'
import { Controller } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TableCell, TableRow } from '@/components/ui/table'
import { ProductCombobox } from '@/features/inventory/components/ProductCombobox'
import { formatQty } from '@/features/inventory/format'
import type { Product } from '@/features/inventory/types'
import { formatCurrency } from '@/lib/format'
import { cn } from 'cn'

import type { SalesFormInput } from '../../schemas'
import type { SalesEditorForm } from './useSalesEditorForm'
import { toNumber, type SalesEditorTotals } from './useSalesEditorTotals'

export interface ProductMeta {
  label: string
  unit?: string
  minPrice: number | null
}

/** One editable line: product, availability, quantity, price, discount, total and margin. */
export function SalesLineRow({
  form,
  index,
  line,
  meta,
  productMeta,
  calc,
  short,
  showAvailability,
  showMargin,
  canRemove,
  onPickProduct,
  onRemove,
}: {
  form: SalesEditorForm
  index: number
  line: SalesFormInput['lines'][number] | undefined
  meta: ProductMeta | undefined
  productMeta: Record<number, ProductMeta>
  calc: SalesEditorTotals
  short: boolean
  showAvailability: boolean
  showMargin: boolean
  canRemove: boolean
  onPickProduct: (product: Product) => void
  onRemove: () => void
}) {
  const { errors } = form.formState
  const stock = line?.product_id ? calc.stockOf(line.product_id) : undefined
  const available = stock ? Number(stock.quantity) : undefined
  const amounts = calc.totals.lines[index]
  const qty = toNumber(line?.quantity)
  const belowMin = meta?.minPrice != null && qty > 0 && amounts && amounts.total < meta.minPrice * qty - 0.004
  const lineMargin = amounts && stock ? amounts.net - qty * Number(stock.avg_cost) : null
  const lineErrors = errors.lines?.[index]
  const discountError = calc.totals.errors[`lines.${index}.discount_amount`]

  return (
    <TableRow className={cn(short && 'bg-destructive/[0.06] hover:bg-destructive/[0.08]')}>
      <TableCell className="num pl-6 align-top text-xs text-muted-foreground">
        <span className="inline-block pt-2.5">{index + 1}</span>
      </TableCell>
      <TableCell className="align-top">
        <Controller
          control={form.control}
          name={`lines.${index}.product_id`}
          render={({ field: f }) => (
            <ProductCombobox
              value={f.value || null}
              selectedLabel={f.value ? productMeta[f.value]?.label : undefined}
              invalid={!!lineErrors?.product_id}
              usedIds={calc.productIds}
              onChange={(product) => {
                f.onChange(product.id)
                onPickProduct(product)
              }}
            />
          )}
        />
        {lineErrors?.product_id && (
          <p className="mt-1 text-xs text-destructive">{lineErrors.product_id.message}</p>
        )}
        {belowMin && (
          <p className="mt-1 flex items-center gap-1 text-xs text-warning">
            <TriangleAlert className="size-3" /> Bajo el precio mínimo ({formatCurrency(meta!.minPrice!)}):
            requerirá autorización.
          </p>
        )}
      </TableCell>
      {showAvailability && (
        <TableCell className="num pt-4 text-right align-top text-[13px]">
          {available === undefined ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <span className={cn(short ? 'font-semibold text-destructive' : 'text-muted-foreground')}>
              {formatQty(available, meta?.unit)}
            </span>
          )}
        </TableCell>
      )}
      <TableCell className="align-top">
        <Input
          inputMode="decimal"
          className="num h-9 text-right"
          aria-label="Cantidad"
          aria-invalid={!!lineErrors?.quantity || short}
          {...form.register(`lines.${index}.quantity`)}
        />
        {lineErrors?.quantity && (
          <p className="mt-1 text-right text-xs text-destructive">{lineErrors.quantity.message}</p>
        )}
      </TableCell>
      <TableCell className="align-top">
        <Input
          inputMode="decimal"
          className="num h-9 text-right"
          aria-label="Precio unitario"
          aria-invalid={!!lineErrors?.unit_price}
          {...form.register(`lines.${index}.unit_price`)}
        />
        {lineErrors?.unit_price && (
          <p className="mt-1 text-right text-xs text-destructive">{lineErrors.unit_price.message}</p>
        )}
      </TableCell>
      <TableCell className="align-top">
        <Input
          inputMode="decimal"
          className="num h-9 text-right"
          placeholder="0,00"
          aria-label="Descuento de la línea"
          aria-invalid={!!discountError}
          {...form.register(`lines.${index}.discount_amount`)}
        />
        {discountError && <p className="mt-1 text-right text-xs text-destructive">Mayor al importe</p>}
      </TableCell>
      <TableCell className="num pt-4 text-right align-top text-[13px] font-medium">
        {amounts && amounts.total ? formatCurrency(amounts.total) : '—'}
        {amounts && amounts.globalShare > 0 && (
          <span className="block text-[11px] font-normal text-muted-foreground">
            −{formatCurrency(amounts.globalShare)} global
          </span>
        )}
      </TableCell>
      {showMargin && (
        <TableCell
          className={cn(
            'num pt-4 text-right align-top text-[13px]',
            lineMargin !== null && lineMargin < 0 && 'text-destructive',
          )}
        >
          {lineMargin === null ? '—' : formatCurrency(lineMargin)}
        </TableCell>
      )}
      <TableCell className="pr-6 align-top">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="mt-1 text-muted-foreground hover:text-destructive"
          aria-label={`Quitar línea ${index + 1}`}
          disabled={!canRemove}
          onClick={onRemove}
        >
          <Trash2 />
        </Button>
      </TableCell>
    </TableRow>
  )
}
