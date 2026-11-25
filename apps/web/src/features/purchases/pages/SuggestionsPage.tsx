import { ClipboardPlus, Lightbulb } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { EmptyState } from '@/components/feedback/EmptyState'
import { PageSkeleton } from '@/components/feedback/PageSkeleton'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatQty } from '@/features/inventory/format'
import { useWarehouses } from '@/features/inventory/hooks'
import { ApiError } from '@/lib/api-error'
import { formatCurrency } from '@/lib/format'

import { useOrderFromSuggestion, useSuggestions } from '../hooks'
import type { PurchaseSuggestion } from '../types'

/**
 * /compras/sugerencias — what to buy per product and warehouse:
 * min stock + 30-day sales × supplier lead time − stock − on order.
 * Each supplier group becomes a draft OC (the price defaults to the last purchase).
 */
export function SuggestionsPage() {
  const navigate = useNavigate()
  const { data: warehouses } = useWarehouses()
  const [warehouseId, setWarehouseId] = useState<number | undefined>(undefined)
  const { data, isPending } = useSuggestions(warehouseId)
  const create = useOrderFromSuggestion()
  const [qty, setQty] = useState<Record<string, string>>({})

  const groups = useMemo(() => {
    const map = new Map<string, PurchaseSuggestion[]>()
    for (const s of data ?? []) {
      const k = `${s.supplier_id ?? 0}:${s.warehouse_id}`
      map.set(k, [...(map.get(k) ?? []), s])
    }
    return [...map.entries()]
  }, [data])

  const rowKey = (s: PurchaseSuggestion) => `${s.product_id}:${s.warehouse_id}`

  const createOrder = async (rows: PurchaseSuggestion[]) => {
    const first = rows[0]
    if (!first.supplier_id)
      return toast.error('Estos productos no tienen proveedor previo: crea la orden manualmente.')
    try {
      const order = await create.mutateAsync({
        supplier_id: first.supplier_id,
        warehouse_id: first.warehouse_id,
        lines: rows
          .map((s) => ({
            product_id: s.product_id,
            quantity: (qty[rowKey(s)] ?? s.suggested_quantity).replace(',', '.'),
            unit_price: s.last_price ?? '0',
          }))
          .filter((l) => Number(l.quantity) > 0),
      })
      toast.success('Orden borrador creada desde la sugerencia')
      navigate(`/compras/ordenes/${order.id}`)
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'No se pudo crear la orden.')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Sugerencia de compra"
        description="Stock frente al mínimo más la venta diaria de los últimos 30 días por el plazo del proveedor, descontando lo ya pedido."
        actions={
          <Select
            value={warehouseId ? String(warehouseId) : 'all'}
            onValueChange={(v) => setWarehouseId(v === 'all' ? undefined : Number(v))}
          >
            <SelectTrigger className="w-56" aria-label="Almacén">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los almacenes</SelectItem>
              {warehouses?.map((w) => (
                <SelectItem key={w.id} value={String(w.id)}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      {isPending && <PageSkeleton />}
      {!isPending && groups.length === 0 && <EmptyState icon={Lightbulb} title="No hay nada que reponer" />}
      {groups.map(([k, rows]) => (
        <Card key={k} className="gap-3">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">
              {rows[0].supplier_name ?? 'Sin proveedor previo'}{' '}
              <span className="font-normal text-muted-foreground">→ {rows[0].warehouse_name}</span>
            </CardTitle>
            <Button
              size="sm"
              onClick={() => createOrder(rows)}
              disabled={create.isPending || !rows[0].supplier_id}
            >
              <ClipboardPlus /> Crear orden borrador
            </Button>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Producto</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Mínimo</TableHead>
                  <TableHead className="text-right">Venta/día</TableHead>
                  <TableHead className="text-right">Plazo</TableHead>
                  <TableHead className="text-right">En OC</TableHead>
                  <TableHead className="text-right">Último precio</TableHead>
                  <TableHead className="w-32 pr-6 text-right">Sugerido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => (
                  <TableRow key={rowKey(s)}>
                    <TableCell className="pl-6">
                      <span className="font-medium">{s.product_name}</span>
                      <span className="num block text-xs text-muted-foreground">{s.sku}</span>
                    </TableCell>
                    <TableCell className="num text-right">{formatQty(s.stock, s.unit)}</TableCell>
                    <TableCell className="num text-right text-muted-foreground">
                      {formatQty(s.min_stock)}
                    </TableCell>
                    <TableCell className="num text-right">{formatQty(s.daily_sales)}</TableCell>
                    <TableCell className="num text-right">{s.lead_time_days} d</TableCell>
                    <TableCell className="num text-right text-muted-foreground">
                      {formatQty(s.on_order)}
                    </TableCell>
                    <TableCell className="num text-right">
                      {s.last_price ? formatCurrency(Number(s.last_price)) : '—'}
                    </TableCell>
                    <TableCell className="pr-6">
                      <Input
                        aria-label={`Cantidad sugerida ${s.product_name}`}
                        inputMode="decimal"
                        className="num h-8 text-right"
                        value={qty[rowKey(s)] ?? s.suggested_quantity}
                        onChange={(e) => setQty((q) => ({ ...q, [rowKey(s)]: e.target.value }))}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
