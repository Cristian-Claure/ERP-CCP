import type { RowData } from '@tanstack/react-table'
import { Columns3, Search, X } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'

import type { DataTableInstance } from './DataTable'
import type { DataTableState } from './use-data-table-state'

interface DataTableToolbarProps<TData extends RowData> {
  table: DataTableInstance<TData>
  state: DataTableState
  searchPlaceholder?: string
  /** Filters (DataTableFacetedFilter, selects...) rendered next to the search. */
  children?: ReactNode
  /** Right-aligned actions (e.g. "Nuevo"). */
  actions?: ReactNode
}

/** Debounced server search + filters + column selector. */
export function DataTableToolbar<TData extends RowData>({
  table,
  state,
  searchPlaceholder = 'Buscar…',
  children,
  actions,
}: DataTableToolbarProps<TData>) {
  const [term, setTerm] = useState(state.search)
  const [syncedSearch, setSyncedSearch] = useState(state.search)

  // External change (e.g. "Limpiar", back button): adopt the URL value during render.
  if (state.search !== syncedSearch) {
    setSyncedSearch(state.search)
    setTerm(state.search)
  }

  useEffect(() => {
    if (term === state.search) return
    const id = setTimeout(() => state.setSearch(term.trim()), 350)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term])

  const hideable = table.getAllLeafColumns().filter((c) => c.getCanHide())
  const hasFilters = state.search !== '' || Object.keys(state.filters).length > 0

  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <InputGroup className="h-9 w-full sm:w-72">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label="Buscar"
          />
          {term && (
            <InputGroupAddon align="inline-end">
              <button type="button" onClick={() => setTerm('')} aria-label="Limpiar búsqueda">
                <X className="size-3.5" />
              </button>
            </InputGroupAddon>
          )}
        </InputGroup>
        {children}
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={state.reset} className="text-muted-foreground">
            Limpiar
            <X />
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {hideable.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <Columns3 />
                Columnas
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Columnas visibles
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {hideable.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  onSelect={(e) => e.preventDefault()}
                >
                  {column.columnDef.meta?.label ?? column.id}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {actions}
      </div>
    </div>
  )
}
