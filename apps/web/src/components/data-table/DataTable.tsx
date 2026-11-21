import {
  type ColumnVisibilityState,
  type ReactTable,
  type RowData,
  type SortingState,
  useTable,
} from '@tanstack/react-table'
import { Inbox } from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'

import { EmptyState } from '@/components/feedback/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { PaginationMeta } from '@/lib/pagination'
import { cn } from 'cn'

import { DataTablePagination } from './DataTablePagination'
import { type DataTableColumn, type DataTableFeatures, dataTableFeatures } from './features'
import type { DataTableState } from './use-data-table-state'

export interface DataTableProps<TData extends RowData> {
  /** Stable id: persists the column selection in localStorage. */
  id: string
  /** Define at module scope or memoize: a new array each render resets the table. */
  columns: DataTableColumn<TData>[]
  data: TData[] | undefined
  meta: PaginationMeta | undefined
  state: DataTableState
  isLoading?: boolean
  isFetching?: boolean
  /** Toolbar (search, filters). Receives the table so it can render the column selector. */
  toolbar?: (table: DataTableInstance<TData>) => ReactNode
  empty?: ReactNode
  onRowClick?: (row: TData) => void
  getRowId?: (row: TData) => string
  /** Columns hidden until the user enables them. */
  defaultHidden?: string[]
}

export type DataTableInstance<TData extends RowData> = ReactTable<DataTableFeatures, TData>

const EMPTY: never[] = []

function toSorting(sort: string | undefined): SortingState {
  if (!sort) return []
  return [{ id: sort.replace(/^-/, ''), desc: sort.startsWith('-') }]
}

function loadVisibility(id: string, defaultHidden: string[]): ColumnVisibilityState {
  const fallback = Object.fromEntries(defaultHidden.map((c) => [c, false]))
  try {
    const stored = localStorage.getItem(`ccp-table:${id}`)
    return stored ? { ...fallback, ...(JSON.parse(stored) as ColumnVisibilityState) } : fallback
  } catch {
    return fallback
  }
}

/**
 * Reusable server-driven table. See docs/frontend/data-table.md.
 *
 * - Pagination, sorting and filters are SERVER-side (state lives in the URL).
 * - Column visibility is per user (localStorage).
 * - Loading (skeleton rows), refetch (dimmed) and empty states built in.
 */
export function DataTable<TData extends RowData>({
  id,
  columns,
  data,
  meta,
  state,
  isLoading = false,
  isFetching = false,
  toolbar,
  empty,
  onRowClick,
  getRowId,
  defaultHidden = EMPTY,
}: DataTableProps<TData>) {
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>(() =>
    loadVisibility(id, defaultHidden),
  )
  const sorting = useMemo(() => toSorting(state.sort), [state.sort])

  const table = useTable<DataTableFeatures, TData>({
    features: dataTableFeatures,
    columns,
    data: data ?? EMPTY,
    getRowId: getRowId ? (row: TData) => getRowId(row) : undefined,
    manualPagination: true,
    manualSorting: true,
    enableSortingRemoval: false,
    rowCount: meta?.total ?? 0,
    state: {
      sorting,
      columnVisibility,
      pagination: { pageIndex: state.page - 1, pageSize: state.perPage },
    },
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater
      const first = next[0]
      state.setSort(first ? `${first.desc ? '-' : ''}${first.id}` : undefined)
    },
    onColumnVisibilityChange: (updater) => {
      setColumnVisibility((prev: ColumnVisibilityState) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        try {
          localStorage.setItem(`ccp-table:${id}`, JSON.stringify(next))
        } catch {
          /* storage unavailable: keep in memory */
        }
        return next
      })
    },
  })

  const visibleColumns = table.getVisibleLeafColumns()
  const rows = table.getRowModel().rows

  return (
    <div className="flex flex-col gap-3">
      {toolbar?.(table)}

      <div className="overflow-hidden rounded-xl border bg-card">
        <div
          className={cn(
            'relative overflow-x-auto transition-opacity',
            isFetching && !isLoading && 'opacity-60',
          )}
        >
          <Table>
            <TableHeader className="bg-surface-2/50">
              {table.getHeaderGroups().map((group) => (
                <TableRow key={group.id} className="hover:bg-transparent">
                  {group.headers
                    .filter((h) => h.column.getIsVisible())
                    .map((header) => (
                      <TableHead
                        key={header.id}
                        className={cn(
                          'h-10 text-xs font-medium tracking-wide text-muted-foreground first:pl-4 last:pr-4',
                          header.column.columnDef.meta?.align === 'right' && 'text-right',
                          header.column.columnDef.meta?.className,
                        )}
                      >
                        {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                      </TableHead>
                    ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: Math.min(state.perPage, 8) }, (_, i) => (
                  <TableRow key={`skeleton-${i}`} className="hover:bg-transparent">
                    {visibleColumns.map((column) => (
                      <TableCell key={column.id} className="first:pl-4 last:pr-4">
                        <Skeleton
                          className={cn(
                            'h-4',
                            column.columnDef.meta?.align === 'right' ? 'ml-auto w-16' : 'w-3/4',
                          )}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={visibleColumns.length} className="p-6">
                    {empty ?? (
                      <EmptyState
                        icon={Inbox}
                        title="Sin resultados"
                        description="No hay registros que coincidan con los filtros aplicados."
                        className="border-0"
                      />
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow
                    key={row.id}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                    className={cn(onRowClick && 'cursor-pointer')}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          'text-[13px] first:pl-4 last:pr-4',
                          cell.column.columnDef.meta?.align === 'right' && 'text-right',
                          cell.column.columnDef.meta?.className,
                        )}
                      >
                        <table.FlexRender cell={cell} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <DataTablePagination meta={meta} state={state} isLoading={isLoading} />
      </div>
    </div>
  )
}
