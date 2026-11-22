import { Ban } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'

import {
  DataTable,
  DataTableColumnHeader,
  DataTableFilter,
  DataTableToolbar,
  dataTableColumns,
  useDataTableState,
} from '@/components/data-table'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/features/auth/hooks'
import { ApiError } from '@/lib/api-error'
import { formatCurrency } from '@/lib/format'

import { AgingBar } from '../components/AgingBar'
import { VoidReasonDialog } from '../components/VoidReasonDialog'
import { formatBizDate, PAYMENT_METHODS } from '../format'
import { usePayments, useSalesDashboard, useVoidPayment } from '../hooks'
import type { Payment } from '../types'

const col = dataTableColumns<Payment>()

export function PaymentsPage() {
  const { can } = useAuth()
  const state = useDataTableState({ defaultSort: '-created_at' })
  const { data, isPending, isFetching } = usePayments(state.params)
  const { data: dashboard } = useSalesDashboard()
  const voidPayment = useVoidPayment()
  const [toVoid, setToVoid] = useState<Payment | null>(null)
  const canVoid = can('receivables.void')

  // Memoized: DataTable resets its state when it receives a new columns array.
  const columns = useMemo(
    () => [
      col.accessor('number', {
        id: 'number',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Número" />,
        cell: ({ getValue }) => <span className="num text-xs font-semibold">{getValue()}</span>,
        meta: { label: 'Número' },
        enableHiding: false,
      }),
      col.accessor('payment_date', {
        id: 'payment_date',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Fecha" />,
        cell: ({ getValue }) => <span className="num text-xs">{formatBizDate(getValue())}</span>,
        meta: { label: 'Fecha' },
      }),
      col.display({
        id: 'customer',
        header: 'Cliente',
        cell: ({ row }) => (
          <Link
            to={`/ventas/clientes/${row.original.customer_id}?tab=statement`}
            className="hover:text-brand-accent hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {row.original.customer?.name}
          </Link>
        ),
        meta: { label: 'Cliente' },
      }),
      col.accessor('method_label', { id: 'method', header: 'Método', meta: { label: 'Método' } }),
      col.display({
        id: 'allocations',
        header: 'Aplicado a',
        cell: ({ row }) => (
          <span className="num text-xs text-muted-foreground">
            {row.original.allocations?.map((a) => a.number).join(', ') || '—'}
            {row.original.is_automatic && <span className="ml-1 not-italic">(contado)</span>}
          </span>
        ),
        meta: { label: 'Aplicado a' },
      }),
      col.accessor('amount', {
        id: 'amount',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Monto" />,
        cell: ({ getValue }) => <span className="num font-medium">{formatCurrency(Number(getValue()))}</span>,
        meta: { label: 'Monto', align: 'right' },
      }),
      col.accessor('status', {
        id: 'status',
        header: 'Estado',
        cell: ({ row }) =>
          row.original.status === 'voided' ? (
            <Badge
              variant="outline"
              className="border-destructive/25 bg-destructive/10 text-destructive line-through"
            >
              Anulado
            </Badge>
          ) : (
            <Badge variant="outline" className="border-success/25 bg-success/12 text-success">
              Registrado
            </Badge>
          ),
        meta: { label: 'Estado' },
      }),
      col.display({
        id: 'actions',
        header: '',
        cell: ({ row }) =>
          canVoid && row.original.status === 'posted' && !row.original.is_automatic ? (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`Anular ${row.original.number}`}
              className="text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation()
                setToVoid(row.original)
              }}
            >
              <Ban />
            </Button>
          ) : null,
        meta: { label: 'Acciones' },
        enableHiding: false,
      }),
    ],
    [canVoid],
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Cobros"
        description="Cuentas por cobrar: recibos registrados y antigüedad de la cartera."
      />

      {dashboard?.receivables && (
        <Card className="gap-3">
          <CardHeader className="flex-row items-baseline justify-between">
            <CardTitle className="text-base">Cartera por cobrar</CardTitle>
            <span className="num text-lg font-semibold">
              {formatCurrency(Number(dashboard.receivables.total))}
            </span>
          </CardHeader>
          <CardContent>
            <AgingBar aging={dashboard.receivables.aging} />
          </CardContent>
        </Card>
      )}

      <DataTable
        id="payments"
        columns={columns}
        data={data?.data}
        meta={data?.meta}
        state={state}
        isLoading={isPending}
        isFetching={isFetching}
        toolbar={(table) => (
          <DataTableToolbar table={table} state={state} searchPlaceholder="Número o referencia…">
            <DataTableFilter
              state={state}
              name="method"
              title="Método"
              options={PAYMENT_METHODS.map((m) => ({ value: m.value, label: m.label }))}
            />
            <DataTableFilter
              state={state}
              name="status"
              title="Estado"
              options={[
                { value: 'posted', label: 'Registrados' },
                { value: 'voided', label: 'Anulados' },
              ]}
            />
          </DataTableToolbar>
        )}
      />

      <VoidReasonDialog
        open={!!toVoid}
        onOpenChange={(o) => !o && setToVoid(null)}
        title={`Anular cobro ${toVoid?.number ?? ''}`}
        description="El monto vuelve a la deuda del cliente y las ventas recuperan su saldo pendiente."
        confirmLabel="Anular cobro"
        onConfirm={async (reason) => {
          try {
            await voidPayment.mutateAsync({ id: toVoid!.id, reason })
            toast.success(`Cobro ${toVoid!.number} anulado`)
          } catch (error) {
            toast.error(error instanceof ApiError ? error.message : 'No se pudo anular el cobro.')
            throw error
          }
        }}
      />
    </div>
  )
}
