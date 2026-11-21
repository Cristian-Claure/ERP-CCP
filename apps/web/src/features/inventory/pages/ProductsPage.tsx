import { AlertTriangle, PackagePlus, Plus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import {
  DataTable,
  DataTableColumnHeader,
  DataTableFilter,
  DataTableToolbar,
  dataTableColumns,
  useDataTableState,
} from '@/components/data-table'
import { EmptyState } from '@/components/feedback/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/hooks'
import { formatCurrency } from '@/lib/format'

import { ProductFormSheet } from '../components/ProductFormSheet'
import { formatQty } from '../format'
import { useCategories, useProducts } from '../hooks'
import type { Product } from '../types'

const col = dataTableColumns<Product>()

const columns = [
  col.accessor('sku', {
    id: 'sku',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Código" />,
    cell: ({ getValue }) => <span className="num text-xs font-medium">{getValue()}</span>,
    meta: { label: 'Código' },
    enableHiding: false,
  }),
  col.accessor('name', {
    id: 'name',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Producto" />,
    cell: ({ row }) => (
      <div className="flex min-w-48 flex-col">
        <span className="font-medium">{row.original.name}</span>
        {!row.original.is_active && <span className="text-xs text-muted-foreground">Inactivo</span>}
      </div>
    ),
    meta: { label: 'Producto' },
    enableHiding: false,
  }),
  col.display({
    id: 'category',
    header: 'Categoría',
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.category?.name ?? '—'}</span>,
    meta: { label: 'Categoría' },
  }),
  col.display({
    id: 'unit',
    header: 'Unidad',
    cell: ({ row }) => <span className="num text-xs text-muted-foreground">{row.original.unit?.code}</span>,
    meta: { label: 'Unidad' },
  }),
  // Accessor (not display) columns so TanStack allows sorting; the server sorts by id.
  col.accessor((p) => p.stock?.quantity ?? '0', {
    id: 'stock',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Stock" />,
    enableSorting: true,
    cell: ({ row }) => (
      <span className="num inline-flex items-center gap-1.5 font-medium">
        {row.original.stock?.below_min && (
          <AlertTriangle className="size-3.5 text-warning" aria-label="Bajo mínimo" />
        )}
        {formatQty(row.original.stock?.quantity)}
      </span>
    ),
    meta: { label: 'Stock', align: 'right' },
  }),
  col.accessor('min_stock', {
    id: 'min_stock',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Mínimo" />,
    cell: ({ getValue }) => <span className="num text-muted-foreground">{formatQty(getValue())}</span>,
    meta: { label: 'Stock mínimo', align: 'right' },
  }),
  col.accessor((p) => p.stock?.value ?? '0', {
    id: 'value',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Valorizado" />,
    enableSorting: true,
    cell: ({ row }) => <span className="num">{formatCurrency(Number(row.original.stock?.value ?? 0))}</span>,
    meta: { label: 'Valorizado', align: 'right' },
  }),
  col.display({
    id: 'status',
    header: 'Estado',
    cell: ({ row }) =>
      row.original.stock?.below_min ? (
        <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">
          Reponer
        </Badge>
      ) : (
        <Badge variant="outline" className="text-muted-foreground">
          OK
        </Badge>
      ),
    meta: { label: 'Estado' },
  }),
]

export function ProductsPage() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const [creating, setCreating] = useState(false)
  const state = useDataTableState({ defaultSort: 'name' })
  const { data, isPending, isFetching } = useProducts(state.params)
  const { data: categories } = useCategories()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Productos"
        description="Catálogo con stock consolidado de todos los almacenes."
        actions={
          can('products.manage') && (
            <Button onClick={() => setCreating(true)}>
              <Plus />
              Nuevo producto
            </Button>
          )
        }
      />

      <DataTable
        id="inventory-products"
        columns={columns}
        data={data?.data}
        meta={data?.meta}
        state={state}
        isLoading={isPending}
        isFetching={isFetching}
        defaultHidden={['unit']}
        onRowClick={(p) => navigate(`/inventario/productos/${p.id}`)}
        toolbar={(table) => (
          <DataTableToolbar
            table={table}
            state={state}
            searchPlaceholder="Código, nombre o código de barras…"
          >
            <DataTableFilter
              state={state}
              name="category_id"
              title="Categoría"
              options={(categories ?? []).map((c) => ({ value: String(c.id), label: c.name }))}
            />
            <DataTableFilter
              state={state}
              name="below_min"
              title="Stock"
              options={[{ value: '1', label: 'Bajo mínimo' }]}
            />
            <DataTableFilter
              state={state}
              name="is_active"
              title="Estado"
              options={[
                { value: '1', label: 'Activos' },
                { value: '0', label: 'Inactivos' },
              ]}
            />
          </DataTableToolbar>
        )}
        empty={
          state.search || Object.keys(state.filters).length ? undefined : (
            <EmptyState
              icon={PackagePlus}
              title="Aún no hay productos"
              description="Crea tu primer producto para empezar a registrar movimientos."
              className="border-0"
              action={
                can('products.manage') && (
                  <Button size="sm" onClick={() => setCreating(true)}>
                    Nuevo producto
                  </Button>
                )
              }
            />
          )
        }
      />

      <ProductFormSheet
        open={creating}
        onOpenChange={setCreating}
        onSaved={(p) => navigate(`/inventario/productos/${p.id}`)}
      />
    </div>
  )
}
