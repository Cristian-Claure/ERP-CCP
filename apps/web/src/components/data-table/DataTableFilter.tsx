import { Check, PlusCircle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { cn } from 'cn'

import type { DataTableState } from './use-data-table-state'

export interface FilterOption {
  value: string
  label: string
}

interface DataTableFilterProps {
  state: DataTableState
  /** Server filter key: sent as filter[<name>]. */
  name: string
  title: string
  options: FilterOption[]
  /** Multi-select sends comma separated values (filter[x]=a,b). */
  multiple?: boolean
}

/** Faceted server filter (popover + searchable list). */
export function DataTableFilter({ state, name, title, options, multiple = false }: DataTableFilterProps) {
  const current = state.filters[name]
  const selected = new Set(current ? current.split(',') : [])

  const toggle = (value: string) => {
    if (multiple) {
      if (selected.has(value)) selected.delete(value)
      else selected.add(value)
      state.setFilter(name, selected.size ? [...selected].join(',') : undefined)
    } else {
      state.setFilter(name, selected.has(value) ? undefined : value)
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 border-dashed">
          <PlusCircle />
          {title}
          {selected.size > 0 && (
            <>
              <Separator orientation="vertical" className="mx-0.5 data-[orientation=vertical]:h-4" />
              {selected.size > 2 ? (
                <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                  {selected.size} seleccionados
                </Badge>
              ) : (
                options
                  .filter((o) => selected.has(o.value))
                  .map((o) => (
                    <Badge key={o.value} variant="secondary" className="rounded-sm px-1 font-normal">
                      {o.label}
                    </Badge>
                  ))
              )}
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandInput placeholder={title} />
          <CommandList>
            <CommandEmpty>Sin opciones.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selected.has(option.value)
                return (
                  <CommandItem key={option.value} value={option.label} onSelect={() => toggle(option.value)}>
                    <span
                      className={cn(
                        'flex size-4 items-center justify-center rounded-[4px] border',
                        isSelected ? 'border-primary bg-primary text-primary-foreground' : 'opacity-60',
                      )}
                    >
                      {isSelected && <Check className="size-3 text-white" />}
                    </span>
                    {option.label}
                  </CommandItem>
                )
              })}
            </CommandGroup>
            {selected.size > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem onSelect={() => state.setFilter(name, undefined)} className="justify-center">
                    Quitar filtro
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
