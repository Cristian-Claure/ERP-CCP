import { Warehouse as WarehouseIcon } from 'lucide-react'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useWarehouses } from '@/features/inventory/hooks'

import { useSavePosWarehouse } from '../queries'

/** Warehouse of this POS (saved as the user's preference). */
export function WarehouseSelect({ value }: { value: number | undefined }) {
  const { data: warehouses } = useWarehouses()
  const save = useSavePosWarehouse()

  return (
    <Select value={value ? String(value) : ''} onValueChange={(v) => save.mutate(Number(v))}>
      <SelectTrigger className="h-9 w-56" aria-label="Almacén del punto de venta">
        <WarehouseIcon className="size-4 text-muted-foreground" />
        <SelectValue placeholder="Elegir almacén" />
      </SelectTrigger>
      <SelectContent>
        {warehouses
          ?.filter((w) => w.is_active)
          .map((w) => (
            <SelectItem key={w.id} value={String(w.id)}>
              {w.name}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  )
}
