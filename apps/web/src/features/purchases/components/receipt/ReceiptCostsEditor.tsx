import { Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

import { COST_KINDS } from '../../format'
import type { ReceiptCostKind } from '../../types'

export interface CostRow {
  key: string
  kind: ReceiptCostKind
  description: string
  amount: string
}

const newCost = (): CostRow => ({
  key: crypto.randomUUID(),
  kind: 'freight',
  description: '',
  amount: '',
})

/** Additional costs of the receipt (freight, unloading, other), prorated into the unit cost by value. */
export function ReceiptCostsEditor({
  rows,
  onChange,
}: {
  rows: CostRow[]
  onChange: (rows: CostRow[]) => void
}) {
  const patch = (key: string, p: Partial<CostRow>) =>
    onChange(rows.map((r) => (r.key === key ? { ...r, ...p } : r)))

  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={r.key} className="grid grid-cols-[140px_1fr_140px_auto] items-center gap-2">
          <Select value={r.kind} onValueChange={(v) => patch(r.key, { kind: v as ReceiptCostKind })}>
            <SelectTrigger className="w-full" aria-label={`Tipo de gasto ${i + 1}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COST_KINDS.map((k) => (
                <SelectItem key={k.value} value={k.value}>
                  {k.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            aria-label={`Detalle del gasto ${i + 1}`}
            placeholder="Detalle (transportista, despacho…)"
            value={r.description}
            onChange={(e) => patch(r.key, { description: e.target.value })}
          />
          <Input
            aria-label={`Monto del gasto ${i + 1}`}
            inputMode="decimal"
            placeholder="0,00"
            className="num text-right"
            value={r.amount}
            onChange={(e) => patch(r.key, { amount: e.target.value })}
          />
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Quitar gasto ${i + 1}`}
            onClick={() => onChange(rows.filter((x) => x.key !== r.key))}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => onChange([...rows, newCost()])}>
        <Plus /> Agregar gasto
      </Button>
      <p className="text-xs text-muted-foreground">
        Monto que va al costo (si el transportista factura, ingresa el neto). Se prorratea por valor entre las
        líneas.
      </p>
    </div>
  )
}
