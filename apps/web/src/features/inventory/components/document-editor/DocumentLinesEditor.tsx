import { Plus } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency } from '@/lib/format'

import { emptyLine } from '../../schemas'
import type { DocumentType, InventoryDocument, StockShortage } from '../../types'
import { DocumentLineRow, type LineProductMeta } from './DocumentLineRow'
import type { DocumentEditorState } from './useDocumentEditorForm'

const MAX_LINES = 500

/** "Productos" card: editable lines, add-line button and the estimated total. */
export function DocumentLinesEditor({
  state,
  type,
  document,
  shortages,
  allowNegative,
}: {
  state: DocumentEditorState
  type: DocumentType
  document?: InventoryDocument
  shortages: StockShortage[]
  allowNegative: boolean
}) {
  const { form, fieldArray, lines, productIds, stockOf, requestedByProduct, estimatedTotal } = state
  const { fields, append, remove } = fieldArray
  const { errors } = form.formState
  const isAdjustment = type === 'adjustment'
  const isEntry = type === 'entry'
  const outgoing = type === 'exit' || type === 'transfer'
  const [productMeta, setProductMeta] = useState<Record<number, LineProductMeta>>(() =>
    Object.fromEntries(
      (document?.lines ?? []).map((l) => [
        l.product_id,
        { label: `${l.product?.sku} · ${l.product?.name}`, unit: l.product?.unit?.code },
      ]),
    ),
  )

  return (
    <Card className="gap-3">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">Productos</CardTitle>
        {errors.lines?.root?.message || errors.lines?.message ? (
          <span className="text-sm text-destructive">
            {errors.lines?.root?.message ?? errors.lines?.message}
          </span>
        ) : null}
      </CardHeader>
      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10 pl-6">#</TableHead>
                <TableHead className="min-w-72">Producto</TableHead>
                <TableHead className="text-right">Disponible</TableHead>
                <TableHead className="w-36 text-right">{isAdjustment ? 'Contado' : 'Cantidad'}</TableHead>
                {isAdjustment && <TableHead className="text-right">Diferencia</TableHead>}
                {(isEntry || isAdjustment) && (
                  <TableHead className="w-36 text-right">
                    {isAdjustment ? 'Costo si sobra' : 'Costo unit.'}
                  </TableHead>
                )}
                <TableHead className="text-right">{isEntry ? 'Subtotal' : 'Costo est.'}</TableHead>
                <TableHead className="w-12 pr-6" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field, index) => {
                const line = lines[index]
                const stock = line?.product_id ? stockOf(line.product_id) : undefined
                const requested = line?.product_id ? (requestedByProduct.get(line.product_id) ?? 0) : 0
                const short =
                  (outgoing && stock !== undefined && !allowNegative && requested > Number(stock.quantity)) ||
                  shortages.some((s) => s.product_id === line?.product_id)
                return (
                  <DocumentLineRow
                    key={field.id}
                    form={form}
                    type={type}
                    index={index}
                    line={line}
                    stock={stock}
                    short={short}
                    productMeta={productMeta}
                    usedIds={productIds}
                    canRemove={fields.length > 1}
                    onRemove={() => remove(index)}
                    onPickProduct={(product) => {
                      form.setValue(`lines.${index}.allows_decimals`, product.unit?.allows_decimals ?? false)
                      setProductMeta((m) => ({
                        ...m,
                        [product.id]: { label: `${product.sku} · ${product.name}`, unit: product.unit?.code },
                      }))
                    }}
                  />
                )
              })}
            </TableBody>
          </Table>
        </div>
        <div className="flex flex-col gap-3 border-t px-6 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append(emptyLine())}
            disabled={fields.length >= MAX_LINES}
          >
            <Plus />
            Agregar producto
          </Button>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">
              {isEntry ? 'Total del documento' : 'Costo estimado (al promedio actual)'}
            </p>
            <p className="num text-lg font-semibold">{formatCurrency(estimatedTotal)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
