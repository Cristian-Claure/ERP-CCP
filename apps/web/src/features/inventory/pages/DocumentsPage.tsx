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
import { formatCurrency } from '@/lib/format'

import { DocumentStatusBadge } from '../components/DocumentStatusBadge'
import { DOCUMENT_TYPES, TYPE_ICONS } from '../format'
import { useDocuments, useWarehouses } from '../hooks'
import type { InventoryDocument } from '../types'

const dateFmt = new Intl.DateTimeFormat('es-BO', { day: '2-digit', month: 'short', year: 'numeric' })
const col = dataTableColumns<InventoryDocument>()

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
    header: ({ column }) => <DataTableColumnHeader column={column} title="Tipo" />,
    cell: ({ row }) => {
      const Icon = TYPE_ICONS[row.original.type]
      return (
        <span className="inline-flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" />
          {row.original.type_label}
        </span>
      )
    },
    meta: { label: 'Tipo' },
  }),
  col.accessor('document_date', {
    id: 'document_date',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Fecha" />,
    cell: ({ getValue }) => (
      <span className="num text-xs">{dateFmt.format(new Date(`${getValue()}T00:00:00`))}</span>
    ),
    meta: { label: 'Fecha' },
  }),
  col.display({
    id: 'warehouse',
    header: 'Almacén',
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {row.original.warehouse?.name}
        {row.original.destination_warehouse && <> → {row.original.destination_warehouse.name}</>}
      </span>
    ),
    meta: { label: 'Almacén' },
  }),
  col.accessor('reference', {
    id: 'reference',
    header: 'Referencia',
    cell: ({ getValue }) => <span className="num text-xs text-muted-foreground">{getValue() ?? '—'}</span>,
    meta: { label: 'Referencia' },
  }),
  col.accessor('lines_count', {
    id: 'lines_count',
    header: 'Líneas',
    cell: ({ getValue }) => <span className="num">{getValue()}</span>,
    meta: { label: 'Líneas', align: 'right' },
  }),
  col.accessor('total_cost', {
    id: 'total_cost',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Costo total" />,
    cell: ({ getValue }) => (
      <span className="num">{getValue() ? formatCurrency(Number(getValue())) : '—'}</span>
    ),
    meta: { label: 'Costo total', align: 'right' },
  }),
  col.display({
    id: 'created_by',
    header: 'Creado por',
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.created_by?.name}</span>,
    meta: { label: 'Creado por' },
  }),
  col.accessor('status', {
    id: 'status',
    header: 'Estado',
    cell: ({ getValue }) => <DocumentStatusBadge status={getValue()} />,
    meta: { label: 'Estado' },
    enableHiding: false,
  }),
]

export function DocumentsPage() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const state = useDataTableState({ defaultSort: '-created_at' })
  const { data, isPending, isFetching } = useDocuments(state.params)
  const { data: warehouses } = useWarehouses()
  const status = state.filters.status ?? 'all'

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Documentos de inventario"
        description="Entradas, salidas, transferencias y ajustes. Los confirmados no se editan: se anulan."
        actions={
          can('movements.create') && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  <FilePlus2 />
                  Nuevo documento
                  <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Tipo de documento
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {DOCUMENT_TYPES.map((t) => {
                  const Icon = TYPE_ICONS[t.value]
                  return (
                    <DropdownMenuItem
                      key={t.value}
                      onSelect={() => navigate(`/inventario/documentos/nuevo?tipo=${t.value}`)}
                      className="items-start gap-3 py-2"
                    >
                      <Icon className="mt-0.5" />
                      <span className="flex flex-col">
                        <span className="font-medium">
                          {t.label} <span className="num text-xs text-muted-foreground">{t.prefix}</span>
                        </span>
                        <span className="text-xs text-muted-foreground">{t.description}</span>
                      </span>
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        }
      />

      <Tabs value={status} onValueChange={(v) => state.setFilter('status', v === 'all' ? undefined : v)}>
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="draft">Borradores</TabsTrigger>
          <TabsTrigger value="posted">Confirmados</TabsTrigger>
          <TabsTrigger value="voided">Anulados</TabsTrigger>
        </TabsList>
      </Tabs>

      <DataTable
        id="inventory-documents"
        columns={columns}
        data={data?.data}
        meta={data?.meta}
        state={state}
        isLoading={isPending}
        isFetching={isFetching}
        defaultHidden={['created_by', 'reference']}
        onRowClick={(d) => navigate(`/inventario/documentos/${d.id}`)}
        toolbar={(table) => (
          <DataTableToolbar table={table} state={state} searchPlaceholder="Número o referencia…">
            <DataTableFilter
              state={state}
              name="type"
              title="Tipo"
              options={DOCUMENT_TYPES.map((t) => ({ value: t.value, label: t.label }))}
            />
            <DataTableFilter
              state={state}
              name="warehouse_id"
              title="Almacén"
              options={(warehouses ?? []).map((w) => ({ value: String(w.id), label: w.name }))}
            />
          </DataTableToolbar>
        )}
      />
    </div>
  )
}
