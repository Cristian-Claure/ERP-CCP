import { Link } from 'react-router'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency } from '@/lib/format'

import { formatCost, formatQty } from '../../format'
import type { InventoryDocument } from '../../types'

/** Read-only lines of an inventory document (system/counted columns for adjustments) and its total cost. */
export function DocumentViewLines({ doc }: { doc: InventoryDocument }) {
  const isAdjustment = doc.type === 'adjustment'
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
                {isAdjustment && <TableHead className="text-right">Sistema</TableHead>}
                {isAdjustment && <TableHead className="text-right">Contado</TableHead>}
                <TableHead className="text-right">{isAdjustment ? 'Diferencia' : 'Cantidad'}</TableHead>
                <TableHead className="text-right">Costo unit.</TableHead>
                <TableHead className="pr-6 text-right">Costo total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {doc.lines?.map((line) => (
                <TableRow key={line.id}>
                  <TableCell className="pl-6">
                    <Link
                      to={`/inventario/productos/${line.product_id}?tab=kardex`}
                      className="group flex flex-col"
                    >
                      <span className="font-medium group-hover:text-brand-accent group-hover:underline">
                        {line.product?.name}
                      </span>
                      <span className="num text-xs text-muted-foreground">{line.product?.sku}</span>
                    </Link>
                  </TableCell>
                  {isAdjustment && (
                    <TableCell className="num text-right">{formatQty(line.system_quantity)}</TableCell>
                  )}
                  {isAdjustment && (
                    <TableCell className="num text-right">{formatQty(line.counted_quantity)}</TableCell>
                  )}
                  <TableCell className="num text-right font-medium">
                    {formatQty(line.quantity, line.product?.unit?.code)}
                  </TableCell>
                  <TableCell className="num text-right">{formatCost(line.unit_cost)}</TableCell>
                  <TableCell className="num pr-6 text-right">
                    {line.total_cost ? formatCurrency(Number(line.total_cost)) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {doc.total_cost && (
          <div className="flex justify-end border-t px-6 pt-4">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Costo total</p>
              <p className="num text-lg font-semibold">{formatCurrency(Number(doc.total_cost))}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
