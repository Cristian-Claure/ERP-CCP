import { MapPin, UserPlus } from 'lucide-react'
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
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/hooks'
import { formatCurrency } from '@/lib/format'

import { DebtStatusBadge } from '../components/Badges'
import { CustomerFormSheet } from '../components/CustomerFormSheet'
import { DEBT_STATUS, PAYMENT_TERMS, SEGMENTS } from '../format'
import { useCustomerCities, useCustomers } from '../hooks'
import type { Customer, DebtStatus } from '../types'

const col = dataTableColumns<Customer>()

const baseColumns = [
  col.accessor('name', {
    id: 'name',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Cliente" />,
    cell: ({ row }) => (
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-medium">{row.original.name}</span>
        <span className="num text-xs text-muted-foreground">{row.original.document_label}</span>
      </span>
    ),
    meta: { label: 'Cliente' },
    enableHiding: false,
  }),
  col.accessor('city', {
    id: 'city',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Ciudad" />,
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        {row.original.latitude && (
          <MapPin className="size-3.5 text-brand-accent" aria-label="Con ubicación" />
        )}
        {row.original.city ?? '—'}
        {row.original.country !== 'BO' && <span className="num text-xs">({row.original.country})</span>}
      </span>
    ),
    meta: { label: 'Ciudad' },
  }),
  col.accessor('segment_label', {
    id: 'segment',
    header: 'Segmento',
    meta: { label: 'Segmento' },
  }),
  col.accessor('payment_terms_label', {
    id: 'payment_terms',
    header: 'Condición',
    cell: ({ row }) =>
      row.original.payment_terms === 'credit' ? (
        <span>
          Crédito <span className="num text-xs text-muted-foreground">{row.original.credit_days} d</span>
        </span>
      ) : (
        <span className="text-muted-foreground">Contado</span>
      ),
    meta: { label: 'Condición' },
  }),
  col.accessor('phone', {
    id: 'phone',
    header: 'Teléfono',
    cell: ({ getValue }) => <span className="num text-xs text-muted-foreground">{getValue() ?? '—'}</span>,
    meta: { label: 'Teléfono' },
  }),
]

const receivableColumns = [
  col.accessor('credit_limit', {
    id: 'credit_limit',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Límite" />,
    cell: ({ row }) =>
      row.original.payment_terms === 'credit' ? (
        <span className="num">{formatCurrency(Number(row.original.credit_limit))}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
    meta: { label: 'Límite', align: 'right' },
  }),
  col.display({
    id: 'balance',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Saldo" />,
    enableSorting: true,
    cell: ({ row }) => {
      const r = row.original.receivables
      const balance = Number(r?.balance ?? 0)
      const limit = Number(row.original.credit_limit)
      const usage = limit > 0 ? Math.min(balance / limit, 1) : 0
      return (
        <span className="flex flex-col items-end gap-1">
          <span className="num font-medium">{balance ? formatCurrency(balance) : '—'}</span>
          {limit > 0 && balance > 0 && (
            <span
              className="h-1 w-16 overflow-hidden rounded-full bg-muted"
              title={`${Math.round(usage * 100)} % del límite`}
            >
              <span
                className={
                  usage >= 0.9
                    ? 'block h-full bg-destructive'
                    : usage >= 0.7
                      ? 'block h-full bg-warning'
                      : 'block h-full bg-brand'
                }
                style={{ width: `${usage * 100}%` }}
              />
            </span>
          )}
        </span>
      )
    },
    meta: { label: 'Saldo', align: 'right' },
  }),
  col.display({
    id: 'debt_status',
    header: 'Deuda',
    cell: ({ row }) => <DebtStatusBadge status={row.original.receivables?.debt_status} />,
    meta: { label: 'Deuda' },
  }),
]

const allColumns = [...baseColumns, ...receivableColumns]

export function CustomersPage() {
  const navigate = useNavigate()
  const { can } = useAuth()
  const canReceivables = can('receivables.view')
  const state = useDataTableState({ defaultSort: 'name' })
  const { data, isPending, isFetching } = useCustomers(state.params)
  const { data: cities } = useCustomerCities()
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Clientes"
        description="Cartera de clientes, condiciones de crédito y estado de deuda."
        actions={
          can('customers.manage') && (
            <Button onClick={() => setCreateOpen(true)}>
              <UserPlus />
              Nuevo cliente
            </Button>
          )
        }
      />

      <DataTable
        id="customers"
        columns={canReceivables ? allColumns : baseColumns}
        data={data?.data}
        meta={data?.meta}
        state={state}
        isLoading={isPending}
        isFetching={isFetching}
        defaultHidden={['phone']}
        onRowClick={(c) => navigate(`/ventas/clientes/${c.id}`)}
        toolbar={(table) => (
          <DataTableToolbar table={table} state={state} searchPlaceholder="Nombre, NIT/CI o correo…">
            <DataTableFilter
              state={state}
              name="city"
              title="Ciudad"
              options={(cities ?? []).map((c) => ({ value: c, label: c }))}
            />
            <DataTableFilter
              state={state}
              name="segment"
              title="Segmento"
              multiple
              options={SEGMENTS.map((s) => ({ value: s.value, label: s.label }))}
            />
            <DataTableFilter
              state={state}
              name="payment_terms"
              title="Condición"
              options={PAYMENT_TERMS.map((t) => ({ value: t.value, label: t.label }))}
            />
            {canReceivables && (
              <DataTableFilter
                state={state}
                name="debt_status"
                title="Deuda"
                options={(Object.keys(DEBT_STATUS) as DebtStatus[]).map((k) => ({
                  value: k,
                  label: DEBT_STATUS[k].label,
                }))}
              />
            )}
          </DataTableToolbar>
        )}
      />

      <CustomerFormSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={(c) => navigate(`/ventas/clientes/${c.id}`)}
      />
    </div>
  )
}
