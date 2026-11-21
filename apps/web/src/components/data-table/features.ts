import {
  type ColumnDef,
  type RowData,
  columnVisibilityFeature,
  createColumnHelper,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
} from '@tanstack/react-table'

/**
 * Features every DataTable registers (TanStack Table v9 is opt-in per feature).
 * Sorting and pagination run on the SERVER (manual mode); visibility is client-side.
 */
export const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  columnVisibilityFeature,
  rowPaginationFeature,
})

export type DataTableFeatures = typeof dataTableFeatures

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DataTableColumn<TData extends RowData> = ColumnDef<DataTableFeatures, TData, any>

/** Typed column helper bound to the DataTable features. */
export function dataTableColumns<TData extends RowData>() {
  return createColumnHelper<DataTableFeatures, TData>()
}

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TFeatures, TData, TValue> {
    /** Human label used by the column selector (defaults to the column id). */
    label?: string
    /** Right-align numeric columns. */
    align?: 'left' | 'right'
    /** Extra classes for header and cells. */
    className?: string
  }
}
