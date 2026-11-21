import type { Column, RowData } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'

import { cn } from 'cn'

import type { DataTableFeatures } from './features'

interface DataTableColumnHeaderProps<TData extends RowData> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  column: Column<DataTableFeatures, TData, any>
  title: string
  className?: string
}

/** Clickable header that toggles SERVER sorting (asc → desc → asc). */
export function DataTableColumnHeader<TData extends RowData>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData>) {
  if (!column.getCanSort()) return <span className={className}>{title}</span>

  const sorted = column.getIsSorted()
  const Icon = sorted === 'asc' ? ArrowUp : sorted === 'desc' ? ArrowDown : ChevronsUpDown

  return (
    <button
      type="button"
      onClick={() => column.toggleSorting(sorted === 'asc')}
      className={cn(
        '-mx-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 transition-colors hover:bg-accent hover:text-foreground',
        sorted && 'text-foreground',
        column.columnDef.meta?.align === 'right' && 'flex-row-reverse',
        className,
      )}
      aria-label={`Ordenar por ${title}`}
    >
      {title}
      <Icon className={cn('size-3.5', !sorted && 'opacity-40')} />
    </button>
  )
}
