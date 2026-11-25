import { Plus } from 'lucide-react'
import { useState } from 'react'
import type { UseFieldArrayReturn } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { StockShortage } from '@/features/inventory/types'

import { emptySalesLine, type SalesFormInput } from '../../schemas'
import type { SalesDocument } from '../../types'
import { type ProductMeta, SalesLineRow } from './SalesLineRow'
import { SalesTotalsPanel } from './SalesTotalsPanel'
import type { SalesEditorForm } from './useSalesEditorForm'
import type { SalesEditorTotals } from './useSalesEditorTotals'

const MAX_LINES = 300

/** "Productos" card: editable lines table, add-line button and the totals panel. */
export function SalesLinesEditor({
  form,
  fieldArray,
  lines,
  document,
  calc,
  shortages,
  isQuote,
  canSeeMargin,
  allowNegativeStock,
  breakDownVat,
}: {
  form: SalesEditorForm
  fieldArray: UseFieldArrayReturn<SalesFormInput, 'lines', 'id'>
  lines: SalesFormInput['lines']
  document?: SalesDocument
  calc: SalesEditorTotals
  shortages: StockShortage[]
  isQuote: boolean
  canSeeMargin: boolean
  allowNegativeStock: boolean
  breakDownVat: boolean
}) {
  const { fields, append, remove } = fieldArray
  const { errors } = form.formState
  const [productMeta, setProductMeta] = useState<Record<number, ProductMeta>>(() =>
    Object.fromEntries(
      (document?.lines ?? []).map((l) => [
        l.product_id,
        { label: `${l.product?.sku} · ${l.product?.name}`, unit: l.product?.unit?.code, minPrice: null },
      ]),
    ),
  )
  const showMargin = canSeeMargin && !isQuote

  const isShort = (productId: number | undefined) => {
    if (isQuote || !productId) return false
    const stock = calc.stockOf(productId)
    const requested = calc.requestedByProduct.get(productId) ?? 0
    return (
      (stock !== undefined && !allowNegativeStock && requested > Number(stock.quantity)) ||
      shortages.some((s) => s.product_id === productId)
    )
  }

  return (
    <Card className="gap-3">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">Productos</CardTitle>
        {(errors.lines?.root?.message || errors.lines?.message) && (
          <span className="text-sm text-destructive">
            {errors.lines?.root?.message ?? errors.lines?.message}
          </span>
        )}
      </CardHeader>
      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10 pl-6">#</TableHead>
                <TableHead className="min-w-64">Producto</TableHead>
                {!isQuote && <TableHead className="text-right">Disponible</TableHead>}
                <TableHead className="w-28 text-right">Cantidad</TableHead>
                <TableHead className="w-32 text-right">Precio (c/IVA)</TableHead>
                <TableHead className="w-28 text-right">Descuento</TableHead>
                <TableHead className="text-right">Total</TableHead>
                {showMargin && <TableHead className="text-right">Margen est.</TableHead>}
                <TableHead className="w-12 pr-6" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field, index) => {
                const line = lines[index]
                return (
                  <SalesLineRow
                    key={field.id}
                    form={form}
                    index={index}
                    line={line}
                    meta={line?.product_id ? productMeta[line.product_id] : undefined}
                    productMeta={productMeta}
                    calc={calc}
                    short={isShort(line?.product_id)}
                    showAvailability={!isQuote}
                    showMargin={showMargin}
                    canRemove={fields.length > 1}
                    onRemove={() => remove(index)}
                    onPickProduct={(product) => {
                      form.setValue(`lines.${index}.allows_decimals`, product.unit?.allows_decimals ?? false)
                      if (product.sale_price)
                        form.setValue(`lines.${index}.unit_price`, product.sale_price, { shouldDirty: true })
                      setProductMeta((m) => ({
                        ...m,
                        [product.id]: {
                          label: `${product.sku} · ${product.name}`,
                          unit: product.unit?.code,
                          minPrice: product.min_price ? Number(product.min_price) : null,
                        },
                      }))
                    }}
                  />
                )
              })}
            </TableBody>
          </Table>
        </div>
        <div className="flex flex-col gap-4 border-t px-6 pt-4 lg:flex-row lg:items-start lg:justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append(emptySalesLine())}
            disabled={fields.length >= MAX_LINES}
          >
            <Plus /> Agregar producto
          </Button>
          <SalesTotalsPanel
            form={form}
            totals={calc.totals}
            breakDownVat={breakDownVat}
            estimatedMargin={calc.estimatedMargin}
            showMargin={showMargin && calc.productIds.length > 0}
          />
        </div>
      </CardContent>
    </Card>
  )
}
