import { useMemo } from 'react'
import { useNavigate } from 'react-router'

import {
  DataTable,
  DataTableColumnHeader,
  DataTableFilter,
  DataTableToolbar,
  dataTableColumns,
  useDataTableState,
} from '@/components/data-table'
import { PageHeader } from '@/components/layout/PageHeader'
import { formatBizDate } from '@/features/sales/format'
import { formatCurrency } from '@/lib/format'

import { ReceiptStatusBadge } from '../components/OrderStatusBadge'
import { useReceipts } from '../hooks'
import type { PurchaseReceipt } from '../types'

const col = dataTableColumns<PurchaseReceipt>()
const money = (v: string) => formatCurrency(Number(v))

export function ReceiptsPage() {
  const navigate = useNavigate()
  const state = useDataTableState({ defaultSort: '-created_at' })
  const { data, isPending, isFetching } = useReceipts(state.params)

  const columns = useMemo(
    () => [
      col.accessor('number', {
        id: 'number',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Número" />,
        cell: ({ getValue }) => <span className="num text-xs font-semibold">{getValue()}</span>,
        meta: { label: 'Número' },
        enableHiding: false,
      }),
      col.accessor('receipt_date', {
        id: 'receipt_date',
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
        id: 'order',
        header: 'Orden',
        cell: ({ row }) => <span className="num text-xs">{row.original.order?.number}</span>,
        meta: { label: 'Orden' },
      }),
      col.accessor('supplier_invoice_number', {
        id: 'invoice',
        header: 'Factura',
        cell: ({ getValue }) => (
          <span className="num text-xs text-muted-foreground">{getValue() ?? 'Sin factura'}</span>
        ),
        meta: { label: 'Factura' },
      }),
      col.accessor('invoice_total', {
        id: 'invoice_total',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Total factura" />,
        cell: ({ getValue }) => <span className="num font-medium">{money(getValue())}</span>,
        meta: { label: 'Total factura', align: 'right' },
      }),
      col.accessor('vat_credit', {
        id: 'vat_credit',
        header: 'Crédito fiscal',
        cell: ({ getValue }) => (
          <span className="num text-xs">{Number(getValue()) > 0 ? money(getValue()) : '—'}</span>
        ),
        meta: { label: 'Crédito fiscal', align: 'right' },
      }),
      col.accessor('open_amount', {
        id: 'open',
        header: 'Saldo',
        cell: ({ getValue }) => (
          <span className="num text-xs">{Number(getValue()) > 0 ? money(getValue()) : '—'}</span>
        ),
        meta: { label: 'Saldo', align: 'right' },
      }),
      col.accessor('status', {
        id: 'status',
        header: 'Estado',
        cell: ({ getValue }) => <ReceiptStatusBadge status={getValue()} />,
        meta: { label: 'Estado' },
      }),
    ],
    [],
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Recepciones"
        description="Mercadería recibida con su factura de proveedor, crédito fiscal y entrada de inventario."
      />
      <DataTable
        id="purchase-receipts"
        columns={columns}
        data={data?.data}
        meta={data?.meta}
        state={state}
        isLoading={isPending}
        isFetching={isFetching}
        onRowClick={(r) => navigate(`/compras/recepciones/${r.id}`)}
        toolbar={(table) => (
          <DataTableToolbar table={table} state={state} searchPlaceholder="Número, factura o proveedor…">
            <DataTableFilter
              state={state}
              name="status"
              title="Estado"
              options={[
                { value: 'posted', label: 'Confirmadas' },
                { value: 'voided', label: 'Anuladas' },
              ]}
            />
            <DataTableFilter
              state={state}
              name="open"
              title="Pago"
              options={[{ value: '1', label: 'Con saldo pendiente' }]}
            />
          </DataTableToolbar>
        )}
      />
    </div>
  )
}
