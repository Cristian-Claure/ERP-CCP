import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatInteger } from '@/lib/format'
import type { PaginationMeta } from '@/lib/pagination'

import type { DataTableState } from './use-data-table-state'

const PAGE_SIZES = [10, 25, 50, 100]

interface DataTablePaginationProps {
  meta: PaginationMeta | undefined
  state: DataTableState
  isLoading: boolean
}

export function DataTablePagination({ meta, state, isLoading }: DataTablePaginationProps) {
  const last = meta?.last_page ?? 1
  const page = state.page

  return (
    <div className="flex flex-col-reverse items-center justify-between gap-3 border-t px-4 py-2.5 sm:flex-row">
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {isLoading || !meta ? (
          'Cargando…'
        ) : meta.total === 0 ? (
          'Sin registros'
        ) : (
          <>
            <span className="num text-foreground">
              {formatInteger(meta.from ?? 0)}–{formatInteger(meta.to ?? 0)}
            </span>{' '}
            de <span className="num text-foreground">{formatInteger(meta.total)}</span>
          </>
        )}
      </p>

      <div className="flex items-center gap-4">
        <div className="hidden items-center gap-2 sm:flex">
          <span className="text-xs text-muted-foreground">Filas</span>
          <Select value={String(state.perPage)} onValueChange={(v) => state.setPerPage(Number(v))}>
            <SelectTrigger size="sm" className="h-7 w-[70px] text-xs" aria-label="Filas por página">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <span className="num text-xs text-muted-foreground">
          {page} / {last}
        </span>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Primera página"
            disabled={page <= 1}
            onClick={() => state.setPage(1)}
          >
            <ChevronsLeft />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Página anterior"
            disabled={page <= 1}
            onClick={() => state.setPage(page - 1)}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Página siguiente"
            disabled={page >= last}
            onClick={() => state.setPage(page + 1)}
          >
            <ChevronRight />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Última página"
            disabled={page >= last}
            onClick={() => state.setPage(last)}
          >
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </div>
  )
}
