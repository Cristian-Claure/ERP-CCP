import { Trash2 } from 'lucide-react'
import { Controller } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TableCell, TableRow } from '@/components/ui/table'
import { formatCurrency } from '@/lib/format'
import { cn } from 'cn'

import { formatCost, formatQty } from '../../format'
import type { DocumentFormInput } from '../../schemas'
import type { DocumentType, Product, StockAvailability } from '../../types'
import { ProductCombobox } from '../ProductCombobox'
import { type DocumentEditorForm, toNumber } from './useDocumentEditorForm'

export interface LineProductMeta {
  label: string
  unit?: string
}

/** One editable line: product, availability, quantity (or counted), difference, cost and subtotal. */
export function DocumentLineRow({
  form,
  type,
  index,
  line,
  stock,
  short,
  productMeta,
  usedIds,
  canRemove,
  onPickProduct,
  onRemove,
}: {
  form: DocumentEditorForm
  type: DocumentType
  index: number
  line: DocumentFormInput['lines'][number] | undefined
  stock: StockAvailability | undefined
  short: boolean
  productMeta: Record<number, LineProductMeta>
  usedIds: number[]
  canRemove: boolean
  onPickProduct: (product: Product) => void
  onRemove: () => void
}) {
  const isAdjustment = type === 'adjustment'
  const isEntry = type === 'entry'
  const lineErrors = form.formState.errors.lines?.[index]
  const available = stock ? Number(stock.quantity) : undefined
  const qty = toNumber(isAdjustment ? line?.counted_quantity : line?.quantity)
  const difference =
    isAdjustment && available !== undefined && line?.counted_quantity !== '' ? qty - available : null
  const lineCost = isEntry
    ? qty * toNumber(line?.unit_cost)
    : stock
      ? (isAdjustment ? Math.abs(difference ?? 0) : qty) * Number(stock.avg_cost)
      : 0
  const unit = line?.product_id ? productMeta[line.product_id]?.unit : undefined
  const qtyField = isAdjustment ? 'counted_quantity' : 'quantity'

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
              usedIds={usedIds}
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
      </TableCell>
      <TableCell className="num pt-4 text-right align-top text-[13px]">
        {available === undefined ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className={cn(short ? 'font-semibold text-destructive' : 'text-muted-foreground')}>
            {formatQty(available, unit)}
          </span>
        )}
      </TableCell>
      <TableCell className="align-top">
        <Input
          inputMode="decimal"
          className="num h-9 text-right"
          aria-label={isAdjustment ? 'Cantidad contada' : 'Cantidad'}
          aria-invalid={!!lineErrors?.[qtyField] || short}
          {...form.register(`lines.${index}.${qtyField}`)}
        />
        {lineErrors?.[qtyField] && (
          <p className="mt-1 text-right text-xs text-destructive">{lineErrors[qtyField]?.message}</p>
        )}
        {short && !lineErrors?.[qtyField] && (
          <p className="mt-1 text-right text-xs text-destructive">Supera el disponible</p>
        )}
      </TableCell>
      {isAdjustment && (
        <TableCell className="num pt-4 text-right align-top text-[13px] font-medium">
          {difference === null ? (
            '—'
          ) : (
            <span className={cn(difference > 0 && 'text-success', difference < 0 && 'text-destructive')}>
              {difference > 0 ? '+' : ''}
              {formatQty(difference)}
            </span>
          )}
        </TableCell>
      )}
      {(isEntry || isAdjustment) && (
        <TableCell className="align-top">
          <Input
            inputMode="decimal"
            className="num h-9 text-right"
            placeholder={isAdjustment && stock ? formatCost(stock.avg_cost) : '0,00'}
            aria-label="Costo unitario"
            aria-invalid={!!lineErrors?.unit_cost}
            {...form.register(`lines.${index}.unit_cost`)}
          />
          {lineErrors?.unit_cost && (
            <p className="mt-1 text-right text-xs text-destructive">{lineErrors.unit_cost.message}</p>
          )}
        </TableCell>
      )}
      <TableCell className="num pt-4 text-right align-top text-[13px]">
        {lineCost ? formatCurrency(lineCost) : '—'}
      </TableCell>
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
