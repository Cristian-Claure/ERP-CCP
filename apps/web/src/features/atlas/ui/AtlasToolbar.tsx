import { Map as MapIcon, Navigation, Pause, Search, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useAuth } from '@/features/auth/hooks'
import { cn } from 'cn'

import { SEGMENT_COLORS, STATUS_COLORS } from '../lib/colors'
import { useAtlasStore } from '../store'
import { PERIODS } from '../lib/periods'
import type { AtlasCustomer, AtlasPeriod } from '../types'
import { panel } from './AtlasHud'

const ALL = '__all'

interface ToolbarProps {
  customers: AtlasCustomer[]
  withReceivables: boolean
  reducedMotion: boolean
  onShowMap: () => void
}

/** Search with camera flight, filters, layers, mode and tour. */
export function AtlasToolbar({ customers, withReceivables, reducedMotion, onShowMap }: ToolbarProps) {
  const canSuppliers = useAuth().can('suppliers.view')
  const s = useAtlasStore()
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-2">
      <Popover open={searchOpen} onOpenChange={setSearchOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={cn(panel, 'h-9 gap-2')}>
            <Search /> <span className="sr-only sm:not-sr-only">Buscar cliente</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[min(92vw,340px)] p-0">
          <Command>
            <CommandInput placeholder="Nombre o ciudad…" />
            <CommandList>
              <CommandEmpty>Sin coincidencias en el globo.</CommandEmpty>
              <CommandGroup>
                {customers.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={`${c.name} ${c.city ?? ''} ${c.id}`}
                    onSelect={() => {
                      s.select(c.id, { lat: c.lat, lng: c.lng, distance: 1.32 })
                      setSearchOpen(false)
                    }}
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{c.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {[c.city, c.country].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={cn(panel, 'h-9 gap-2')}>
            <SlidersHorizontal /> <span className="sr-only sm:not-sr-only">Filtros y capas</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Período de ventas</Label>
            <Select value={s.period} onValueChange={(v) => s.set({ period: v as AtlasPeriod })}>
              <SelectTrigger className="w-full" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Segmento</Label>
            <ToggleGroup
              type="multiple"
              variant="outline"
              size="sm"
              value={s.segments}
              onValueChange={(v) => s.set({ segments: v })}
              className="w-full"
            >
              {Object.entries(SEGMENT_COLORS).map(([value, seg]) => (
                <ToggleGroupItem key={value} value={value} className="flex-1 text-xs">
                  {seg.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          {/* The debt filter only exists with receivables.view. */}
          {withReceivables && (
            <div className="space-y-1.5">
              <Label className="text-xs">Estado de cobro</Label>
              <Select value={s.status ?? ALL} onValueChange={(v) => s.set({ status: v === ALL ? null : v })}>
                <SelectTrigger className="w-full" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos</SelectItem>
                  {Object.entries(STATUS_COLORS).map(([value, st]) => (
                    <SelectItem key={value} value={value}>
                      {st.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">Visualización</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={s.mode}
              onValueChange={(v) => v && s.set({ mode: v as 'columns' | 'hexbin' })}
              className="w-full"
            >
              <ToggleGroupItem value="columns" className="flex-1 text-xs">
                Columnas
              </ToggleGroupItem>
              <ToggleGroupItem value="hexbin" className="flex-1 text-xs">
                Hexágonos
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="space-y-2 border-t pt-3">
            {(
              [
                ['showArcs', 'Arcos almacén → cliente'],
                ...(canSuppliers ? ([['showSuppliers', 'Proveedores y arcos de compra']] as const) : []),
                ['showBorders', 'Fronteras y departamentos'],
                ['showClouds', 'Nubes'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center justify-between gap-3 text-sm">
                {label}
                <Switch checked={s[key]} onCheckedChange={(v) => s.set({ [key]: v })} />
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Button
        variant="outline"
        size="sm"
        className={cn(panel, 'h-9 gap-2')}
        disabled={reducedMotion}
        title={reducedMotion ? 'Desactivado: tu sistema pide reducir el movimiento' : undefined}
        onClick={() => s.set({ touring: !s.touring, selectedId: null })}
      >
        {s.touring ? <Pause /> : <Navigation />}{' '}
        <span className="sr-only sm:not-sr-only">{s.touring ? 'Detener tour' : 'Tour'}</span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        className={cn(panel, 'h-9')}
        onClick={onShowMap}
        title="Ver en mapa 2D"
      >
        <MapIcon />
      </Button>
    </div>
  )
}
