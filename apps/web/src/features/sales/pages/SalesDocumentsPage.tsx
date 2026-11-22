import { ChevronDown, FilePlus2 } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/features/auth/hooks'
import { DocumentStatusBadge } from '@/features/inventory/components/DocumentStatusBadge'
import { useWarehouses } from '@/features/inventory/hooks'
import { formatCurrency } from '@/lib/format'
import { cn } from 'cn'

import { SalesTypeBadge } from '../components/Badges'
import { daysFromToday, formatBizDate, PAYMENT_TERMS, SALES_DOCUMENT_TYPES } from '../format'
import { useSalesDocuments } from '../hooks'
import type { SalesDocument } from '../types'

const col = dataTableColumns<SalesDocument>()

const columns = [
  col.accessor('number', {
    id: 'number',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Número" />,
    cell: ({ row }) =>
      row.original.number ? (
        <span className="num text-xs font-semibold">{row.original.number}</span>
      ) : (
        <span className="text-xs text-muted-foreground italic">Sin número</span>
      ),
    meta: { label: 'Número' },
    enableHiding: false,
  }),
  col.accessor('type', {
    id: 'type',
    header: 'Tipo',
    cell: ({ row }) => <SalesTypeBadge type={row.original.type} label={row.original.type_label} />,
    meta: { label: 'Tipo' },
  }),
  col.accessor('document_date', {
    id: 'document_date',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Fecha" />,
    cell: ({ getValue }) => <span className="num text-xs">{formatBizDate(getValue())}</span>,
    meta: { label: 'Fecha' },
  }),
  col.display({
    id: 'customer',
    header: 'Cliente',
    cell: ({ row }) => (
      <span className="flex min-w-0 flex-col">
        <span className="truncate">{row.original.customer?.name}</span>
        <span className="num text-xs text-muted-foreground">{row.original.customer?.document_label}</span>
      </span>
    ),
    meta: { label: 'Cliente' },
  }),
  col.display({
    id: 'warehouse',
    header: 'Almacén',
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.warehouse?.name}</span>,
    meta: { label: 'Almacén' },
  }),
  col.accessor('payment_terms_label', {
    id: 'payment_terms',
    header: 'Condición',
    meta: { label: 'Condición' },
  }),
  col.accessor('due_date', {
    id: 'due_date',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Vence" />,
    cell: ({ row }) => {
      const d = row.original
      const open = d.status === 'posted' && Number(d.open_amount ?? 0) > 0
      const late = open && d.due_date && daysFromToday(d.due_date) < 0
      return (
        <span className={cn('num text-xs', late && 'font-medium text-destructive')}>
          {formatBizDate(d.due_date)}
        </span>
      )
    },
    meta: { label: 'Vence' },
  }),
  col.accessor('total', {
    id: 'total',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Total" />,
    cell: ({ getValue }) => <span className="num font-medium">{formatCurrency(Number(getValue()))}</span>,
    meta: { label: 'Total', align: 'right' },
  }),
  col.accessor('open_amount', {
    id: 'open_amount',
    header: 'Saldo',
    cell: ({ row }) => {
      const v = Number(row.original.open_amount ?? 0)
      return row.original.status === 'posted' && v > 0 ? (
        <span className="num">{formatCurrency(v)}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    },
    meta: { label: 'Saldo', align: 'right' },
  }),
  col.accessor('status', {
    id: 'status',
    header: 'Estado',
    cell: ({ getValue }) => <DocumentStatusBadge status={getValue()} />,
    meta: { label: 'Estado' },
    enableHiding: false,
  }),
]

export function SalesDocumentsPage() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const state = useDataTableState({ defaultSort: '-created_at' })
  const { data, isPending, isFetching } = useSalesDocuments(state.params)
  const { data: warehouses } = useWarehouses()
  const status = state.filters.status ?? 'all'
  const type = state.filters.type ?? 'all'

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Ventas"
        description="Facturas, notas de venta y cotizaciones. Lo confirmado no se edita: se anula."
        actions={
          can('sales.create') && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  <FilePlus2 />
                  Nuevo documento
                  <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Tipo de documento
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {SALES_DOCUMENT_TYPES.map((t) => (
                  <DropdownMenuItem
                    key={t.value}
                    onSelect={() => navigate(`/ventas/documentos/nuevo?tipo=${t.value}`)}
                    className="items-start gap-3 py-2"
                  >
                    <t.icon className="mt-0.5" />
                    <span className="flex flex-col">
                      <span className="font-medium">
                        {t.label} <span className="num text-xs text-muted-foreground">{t.prefix}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">{t.description}</span>
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={type} onValueChange={(v) => state.setFilter('type', v === 'all' ? undefined : v)}>
          <TabsList>
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="sale">Ventas</TabsTrigger>
            <TabsTrigger value="invoice">Facturas</TabsTrigger>
            <TabsTrigger value="sales_note">Notas</TabsTrigger>
            <TabsTrigger value="quote">Cotizaciones</TabsTrigger>
          </TabsList>
        </Tabs>
        <Tabs value={status} onValueChange={(v) => state.setFilter('status', v === 'all' ? undefined : v)}>
          <TabsList>
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="draft">Borradores</TabsTrigger>
            <TabsTrigger value="posted">Confirmados</TabsTrigger>
            <TabsTrigger value="voided">Anulados</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <DataTable
        id="sales-documents"
        columns={columns}
        data={data?.data}
        meta={data?.meta}
        state={state}
        isLoading={isPending}
        isFetching={isFetching}
        defaultHidden={['warehouse', 'payment_terms']}
        onRowClick={(d) => navigate(`/ventas/documentos/${d.id}`)}
        toolbar={(table) => (
          <DataTableToolbar table={table} state={state} searchPlaceholder="Número, referencia o cliente…">
            <DataTableFilter
              state={state}
              name="payment_terms"
              title="Condición"
              options={PAYMENT_TERMS.map((t) => ({ value: t.value, label: t.label }))}
            />
            <DataTableFilter
              state={state}
              name="warehouse_id"
              title="Almacén"
              options={(warehouses ?? []).map((w) => ({ value: String(w.id), label: w.name }))}
            />
            <DataTableFilter
              state={state}
              name="open"
              title="Saldo"
              options={[{ value: '1', label: 'Con saldo pendiente' }]}
            />
          </DataTableToolbar>
        )}
      />
    </div>
  )
}
