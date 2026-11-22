import { Check, ChevronsUpDown, LoaderCircle, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'

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
import { cn } from 'cn'

import { useCustomers } from '../hooks'
import type { Customer } from '../types'

interface CustomerComboboxProps {
  value: number | null
  selectedLabel?: string
  onChange: (customer: Customer) => void
  onCreate?: () => void
  invalid?: boolean
  disabled?: boolean
}

/** Async server-side customer search (name, document number or email). */
export function CustomerCombobox({
  value,
  selectedLabel,
  onChange,
  onCreate,
  invalid,
  disabled,
}: CustomerComboboxProps) {
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const [debounced, setDebounced] = useState('')
  const [picked, setPicked] = useState<string>()
  const label = selectedLabel ?? picked

  useEffect(() => {
    const id = setTimeout(() => setDebounced(term.trim()), 250)
    return () => clearTimeout(id)
  }, [term])

  const { data, isFetching } = useCustomers(
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
          <span className="truncate">{label ?? 'Buscar cliente…'}</span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(92vw,460px)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={term} onValueChange={setTerm} placeholder="Nombre, NIT/CI o correo…" />
          <CommandList>
            {isFetching && !data ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" /> Buscando…
              </div>
            ) : (
              <CommandEmpty>Sin coincidencias.</CommandEmpty>
            )}
            <CommandGroup>
              {data?.data.map((c) => (
                <CommandItem
                  key={c.id}
                  value={String(c.id)}
                  onSelect={() => {
                    onChange(c)
                    setPicked(c.name)
                    setOpen(false)
                  }}
                  className="gap-3"
                >
                  <Check className={cn('size-4', value === c.id ? 'opacity-100' : 'opacity-0')} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{c.name}</span>
                    <span className="num truncate text-xs text-muted-foreground">
                      {c.document_label}
                      {c.city ? ` · ${c.city}` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{c.payment_terms_label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            {onCreate && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    value="__create"
                    onSelect={() => {
                      setOpen(false)
                      onCreate()
                    }}
                  >
                    <Plus className="size-4" /> Nuevo cliente
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
