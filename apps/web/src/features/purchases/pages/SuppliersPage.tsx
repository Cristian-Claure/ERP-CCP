import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'

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
import { useAuth } from '@/features/auth/hooks'
import { formatCurrency } from '@/lib/format'

import { SupplierFormSheet } from '../components/SupplierFormSheet'
import { COUNTRIES, countryLabel } from '../format'
import { useSuppliers } from '../hooks'
import type { Supplier } from '../types'

const col = dataTableColumns<Supplier>()

export function SuppliersPage() {
  const { can } = useAuth()
  const state = useDataTableState({ defaultSort: 'name' })
  const { data, isPending, isFetching } = useSuppliers(state.params)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [creating, setCreating] = useState(false)
  const canManage = can('suppliers.manage')
  const canSeeBalance = can('payables.view')

  const columns = useMemo(
    () => [
      col.accessor('name', {
        id: 'name',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Proveedor" />,
        cell: ({ row }) => (
          <span className="flex flex-col">
            <span className="font-medium">{row.original.name}</span>
            <span className="num text-xs text-muted-foreground">NIT {row.original.tax_id}</span>
          </span>
        ),
        meta: { label: 'Proveedor' },
        enableHiding: false,
      }),
      col.accessor('city', {
        id: 'city',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Ubicación" />,
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.city ? `${row.original.city}, ` : ''}
            {countryLabel(row.original.country)}
          </span>
        ),
        meta: { label: 'Ubicación' },
      }),
      col.accessor('contact_name', { id: 'contact', header: 'Contacto', meta: { label: 'Contacto' } }),
      col.accessor('payment_terms_label', { id: 'terms', header: 'Condición', meta: { label: 'Condición' } }),
      col.accessor('lead_time_days', {
        id: 'lead',
        header: 'Entrega',
        cell: ({ getValue }) => <span className="num text-xs">{getValue()} días</span>,
        meta: { label: 'Entrega' },
      }),
      col.accessor('issues_invoice', {
        id: 'invoice',
        header: 'Factura',
        cell: ({ getValue }) =>
          getValue() ? (
            <Badge variant="outline" className="border-success/25 bg-success/12 text-success">
              Con factura
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              Sin factura
            </Badge>
          ),
        meta: { label: 'Factura' },
      }),
      ...(canSeeBalance
        ? [
            col.accessor('balance', {
              id: 'balance',
              header: ({ column }) => <DataTableColumnHeader column={column} title="Saldo" />,
              cell: ({ getValue }) => {
                const v = Number(getValue() ?? 0)
                return <span className="num font-medium">{v > 0 ? formatCurrency(v) : '—'}</span>
              },
              meta: { label: 'Saldo', align: 'right' as const },
            }),
          ]
        : []),
    ],
    [canSeeBalance],
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Proveedores"
        description="Proveedores locales y de importación, condiciones de pago y plazos de entrega."
        actions={
          canManage && (
            <Button onClick={() => setCreating(true)}>
              <Plus /> Nuevo proveedor
            </Button>
          )
        }
      />
      <DataTable
        id="suppliers"
        columns={columns}
        data={data?.data}
        meta={data?.meta}
        state={state}
        isLoading={isPending}
        isFetching={isFetching}
        onRowClick={canManage ? (s) => setEditing(s) : undefined}
        toolbar={(table) => (
          <DataTableToolbar
            table={table}
            state={state}
            searchPlaceholder="Razón social, NIT, contacto o ciudad…"
          >
            <DataTableFilter
              state={state}
              name="country"
              title="País"
              options={COUNTRIES.map((c) => ({ value: c.value, label: c.label }))}
            />
            <DataTableFilter
              state={state}
              name="issues_invoice"
              title="Factura"
              options={[
                { value: '1', label: 'Con factura' },
                { value: '0', label: 'Sin factura' },
              ]}
            />
          </DataTableToolbar>
        )}
      />
      <SupplierFormSheet
        open={creating || !!editing}
        supplier={editing ?? undefined}
        onOpenChange={(o) => {
          if (!o) {
            setCreating(false)
            setEditing(null)
          }
        }}
      />
    </div>
  )
}
