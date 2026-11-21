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

import { useProducts } from '../hooks'
import type { Product } from '../types'

interface ProductComboboxProps {
  value: number | null
  /** Label shown for the current value before the list loads (edit mode). */
  selectedLabel?: string
  onChange: (product: Product) => void
  invalid?: boolean
  disabled?: boolean
  /** Product ids to mark as already used. */
  usedIds?: number[]
  className?: string
}

/** Async server-side product search (sku, name or barcode). */
export function ProductCombobox({
  value,
  selectedLabel,
  onChange,
  invalid,
  disabled,
  usedIds = [],
  className,
}: ProductComboboxProps) {
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const [debounced, setDebounced] = useState('')
  // Parent-provided label wins (edit mode, async load); otherwise the last pick.
  const [picked, setPicked] = useState<string>()
  const label = selectedLabel ?? picked
  useEffect(() => {
    const id = setTimeout(() => setDebounced(term.trim()), 250)
    return () => clearTimeout(id)
  }, [term])

  const { data, isFetching } = useProducts(
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
          className={cn(
            'h-9 w-full justify-between font-normal',
            !label && 'text-muted-foreground',
            className,
          )}
        >
          <span className="truncate">{label ?? 'Buscar producto…'}</span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(92vw,420px)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={term}
            onValueChange={setTerm}
            placeholder="Código, nombre o código de barras…"
          />
          <CommandList>
            {isFetching && !data ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" /> Buscando…
              </div>
            ) : (
              <CommandEmpty>Sin coincidencias.</CommandEmpty>
            )}
            <CommandGroup>
              {data?.data.map((product) => (
                <CommandItem
                  key={product.id}
                  value={String(product.id)}
                  onSelect={() => {
                    onChange(product)
                    setPicked(`${product.sku} · ${product.name}`)
                    setOpen(false)
                  }}
                  className="gap-3"
                >
                  <Check className={cn('size-4', value === product.id ? 'opacity-100' : 'opacity-0')} />
                  <span className="num w-20 shrink-0 text-xs text-muted-foreground">{product.sku}</span>
                  <span className="flex-1 truncate">{product.name}</span>
                  {usedIds.includes(product.id) && value !== product.id && (
                    <span className="text-[11px] text-muted-foreground">en uso</span>
                  )}
                  <span className="num shrink-0 text-xs text-muted-foreground">{product.unit?.code}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
