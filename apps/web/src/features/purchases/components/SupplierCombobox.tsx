import { Check, ChevronsUpDown, LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from 'cn'

import { countryLabel } from '../format'
import { useSuppliers } from '../hooks'
import type { Supplier } from '../types'

interface SupplierComboboxProps {
  value: number | null
  selectedLabel?: string
  onChange: (supplier: Supplier) => void
  invalid?: boolean
  disabled?: boolean
}

/** Async server-side supplier search (razón social, NIT, contact or city). */
export function SupplierCombobox({
  value,
  selectedLabel,
  onChange,
  invalid,
  disabled,
}: SupplierComboboxProps) {
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const [debounced, setDebounced] = useState('')
  const [picked, setPicked] = useState<string>()
  const label = selectedLabel ?? picked

  useEffect(() => {
    const id = setTimeout(() => setDebounced(term.trim()), 250)
    return () => clearTimeout(id)
  }, [term])

  const { data, isFetching } = useSuppliers(
    {
      per_page: 20,
      sort: 'name',
      'filter[is_active]': 1,
      ...(debounced ? { 'filter[search]': debounced } : {}),
    },
    open,
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid}
          disabled={disabled}
          className={cn('h-9 w-full justify-between font-normal', !label && 'text-muted-foreground')}
        >
          <span className="truncate">{label ?? 'Buscar proveedor…'}</span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(92vw,460px)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={term} onValueChange={setTerm} placeholder="Razón social, NIT o ciudad…" />
          <CommandList>
            {isFetching && !data ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" /> Buscando…
              </div>
            ) : (
              <CommandEmpty>Sin coincidencias.</CommandEmpty>
            )}
            <CommandGroup>
              {data?.data.map((s) => (
                <CommandItem
                  key={s.id}
                  value={String(s.id)}
                  onSelect={() => {
                    onChange(s)
                    setPicked(s.name)
                    setOpen(false)
                  }}
                  className="gap-3"
                >
                  <Check className={cn('size-4', value === s.id ? 'opacity-100' : 'opacity-0')} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{s.name}</span>
                    <span className="num truncate text-xs text-muted-foreground">
                      NIT {s.tax_id} · {s.city ? `${s.city}, ` : ''}
                      {countryLabel(s.country)}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {s.issues_invoice ? 'Con factura' : 'Sin factura'}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
