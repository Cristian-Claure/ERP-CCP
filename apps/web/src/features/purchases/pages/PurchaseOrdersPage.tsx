import { Lightbulb, Plus } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'

import {
  DataTable,
  DataTableColumnHeader,
  DataTableFilter,
  DataTableToolbar,
  dataTableColumns,
  useDataTableState,
} from '@/components/data-table'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/hooks'
import { formatBizDate } from '@/features/sales/format'
import { formatCurrency } from '@/lib/format'

import { OrderStatusBadge } from '../components/OrderStatusBadge'
import { ORDER_STATUSES } from '../format'
import { usePurchaseOrders } from '../hooks'
import type { PurchaseOrder } from '../types'

const col = dataTableColumns<PurchaseOrder>()

export function PurchaseOrdersPage() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const state = useDataTableState({ defaultSort: '-created_at' })
  const { data, isPending, isFetching } = usePurchaseOrders(state.params)

  const columns = useMemo(
    () => [
      col.accessor('number', {
        id: 'number',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Número" />,
        cell: ({ getValue }) => <span className="num text-xs font-semibold">{getValue() ?? 'Borrador'}</span>,
        meta: { label: 'Número' },
        enableHiding: false,
      }),
      col.accessor('order_date', {
        id: 'order_date',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Fecha" />,
        cell: ({ getValue }) => <span className="num text-xs">{formatBizDate(getValue())}</span>,
        meta: { label: 'Fecha' },
      }),
      col.display({
        id: 'supplier',
        header: 'Proveedor',
        cell: ({ row }) => <span className="font-medium">{row.original.supplier?.name}</span>,
        meta: { label: 'Proveedor' },
      }),
      col.display({
        id: 'warehouse',
        header: 'Almacén',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{row.original.warehouse?.name}</span>
        ),
        meta: { label: 'Almacén' },
      }),
      col.accessor('expected_date', {
        id: 'expected_date',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Llegada" />,
        cell: ({ getValue }) => <span className="num text-xs">{formatBizDate(getValue())}</span>,
        meta: { label: 'Llegada esperada' },
      }),
      col.accessor('total', {
        id: 'total',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Total" />,
        cell: ({ getValue }) => <span className="num font-medium">{formatCurrency(Number(getValue()))}</span>,
        meta: { label: 'Total', align: 'right' },
      }),
      col.accessor('status', {
        id: 'status',
        header: 'Estado',
        cell: ({ getValue }) => <OrderStatusBadge status={getValue()} />,
        meta: { label: 'Estado' },
      }),
    ],
    [],
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Órdenes de compra"
        description="Del borrador a la recepción: aprobación por monto, recepciones parciales y su entrada a stock."
        actions={
          can('purchases.create') && (
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link to="/compras/sugerencias">
                  <Lightbulb /> Sugerencias
                </Link>
              </Button>
              <Button asChild>
                <Link to="/compras/ordenes/nueva">
                  <Plus /> Nueva orden
                </Link>
              </Button>
            </div>
          )
        }
      />
      <DataTable
        id="purchase-orders"
        columns={columns}
        data={data?.data}
        meta={data?.meta}
        state={state}
        isLoading={isPending}
        isFetching={isFetching}
        onRowClick={(o) => navigate(`/compras/ordenes/${o.id}`)}
        toolbar={(table) => (
          <DataTableToolbar table={table} state={state} searchPlaceholder="Número, referencia o proveedor…">
            <DataTableFilter
              state={state}
              name="status"
              title="Estado"
              multiple
              options={ORDER_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
            />
          </DataTableToolbar>
        )}
      />
    </div>
  )
}
