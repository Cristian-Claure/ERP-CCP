import { Ban, HandCoins } from 'lucide-react'
import { useMemo, useState } from 'react'
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
import { AgingBar } from '@/features/sales/components/AgingBar'
import { VoidReasonDialog } from '@/features/sales/components/VoidReasonDialog'
import { formatBizDate } from '@/features/sales/format'
import { ApiError } from '@/lib/api-error'
import { formatCurrency } from '@/lib/format'

import { SupplierPaymentDialog } from '../components/SupplierPaymentDialog'
import { usePayables, useSupplierPayments, useVoidSupplierPayment } from '../hooks'
import type { SupplierPayment } from '../types'

const col = dataTableColumns<SupplierPayment>()

/** /compras/pagos — accounts payable: aging, top suppliers and payments (PAG-). */
export function SupplierPaymentsPage() {
  const { can } = useAuth()
  const state = useDataTableState({ defaultSort: '-created_at' })
  const { data, isPending, isFetching } = useSupplierPayments(state.params)
  const { data: payables } = usePayables()
  const voidPayment = useVoidSupplierPayment()
  const [payOpen, setPayOpen] = useState(false)
  const [toVoid, setToVoid] = useState<SupplierPayment | null>(null)
  const canVoid = can('payables.pay') && can('purchases.void')

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
        id: 'supplier',
        header: 'Proveedor',
        cell: ({ row }) => row.original.supplier?.name,
        meta: { label: 'Proveedor' },
      }),
      col.accessor('method_label', { id: 'method', header: 'Método', meta: { label: 'Método' } }),
      col.accessor('amount', {
        id: 'amount',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Monto" />,
        cell: ({ getValue }) => <span className="num font-medium">{formatCurrency(Number(getValue()))}</span>,
        meta: { label: 'Monto', align: 'right' },
      }),
      col.accessor('status', {
        id: 'status',
        header: 'Estado',
        cell: ({ getValue }) =>
          getValue() === 'voided' ? (
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
          canVoid && row.original.status === 'posted' ? (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`Anular ${row.original.number}`}
              className="text-muted-foreground hover:text-destructive"
              onClick={() => setToVoid(row.original)}
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
        title="Cuentas por pagar"
        description="Deuda con proveedores por antigüedad y pagos registrados (sin cuentas de caja hasta la Fase 4)."
        actions={
          can('payables.pay') && (
            <Button onClick={() => setPayOpen(true)}>
              <HandCoins /> Registrar pago
            </Button>
          )
        }
      />

      {payables && (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <Card className="gap-3">
            <CardHeader className="flex-row items-baseline justify-between">
              <CardTitle className="text-base">Deuda con proveedores</CardTitle>
              <span className="num text-lg font-semibold">
                {formatCurrency(Number(payables.aging.total))}
              </span>
            </CardHeader>
            <CardContent>
              <AgingBar aging={payables.aging} />
            </CardContent>
          </Card>
          <Card className="gap-2">
            <CardHeader>
              <CardTitle className="text-base">Mayores saldos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              {payables.top_suppliers.map((s) => (
                <div key={s.supplier_id} className="flex justify-between gap-3">
                  <span className="truncate">{s.name}</span>
                  <span className="num shrink-0">
                    {formatCurrency(Number(s.balance))}
                    {Number(s.overdue) > 0 && (
                      <span className="ml-1 text-xs text-destructive">
                        ({formatCurrency(Number(s.overdue))} vencido)
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      <DataTable
        id="supplier-payments"
        columns={columns}
        data={data?.data}
        meta={data?.meta}
        state={state}
        isLoading={isPending}
        isFetching={isFetching}
        toolbar={(table) => (
          <DataTableToolbar table={table} state={state} searchPlaceholder="Número, referencia o proveedor…">
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

      <SupplierPaymentDialog open={payOpen} onOpenChange={setPayOpen} />
      <VoidReasonDialog
        open={!!toVoid}
        onOpenChange={(o) => !o && setToVoid(null)}
        title={`Anular pago ${toVoid?.number ?? ''}`}
        description="El monto vuelve a la deuda con el proveedor y las recepciones recuperan su saldo."
        confirmLabel="Anular pago"
        onConfirm={async (reason) => {
          try {
            await voidPayment.mutateAsync({ id: toVoid!.id, reason })
            toast.success(`Pago ${toVoid!.number} anulado`)
          } catch (error) {
            toast.error(error instanceof ApiError ? error.message : 'No se pudo anular el pago.')
            throw error
          }
        }}
      />
    </div>
  )
}
