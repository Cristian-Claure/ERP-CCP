import { Minus, Plus, ShoppingBasket, Trash2, Wallet } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/format'
import { cn } from 'cn'

import type { cartTotals } from '../lib/cart'
import { usePosStore } from '../store'

const display = (v: string) => v.replace('.', ',')
const parse = (v: string) => v.replace(',', '.').trim()

/** Right side: cart lines (qty ±, price, discount with permission), totals and the checkout button. */
export function CartPanel({
  totals,
  breakDownVat,
  overStock,
  canDiscount,
  onCheckout,
}: {
  totals: ReturnType<typeof cartTotals>
  breakDownVat: boolean
  overStock: Set<number>
  canDiscount: boolean
  onCheckout: () => void
}) {
  const { lines, selected, shortages, select, step, setQuantity, setLine, remove } = usePosStore()

  return (
    <section className="flex min-h-0 flex-col rounded-xl border bg-card">
      <ul className="min-h-0 flex-1 divide-y overflow-y-auto" aria-label="Carrito">
        {lines.length === 0 && (
          <li className="flex flex-col items-center gap-2 py-16 text-sm text-muted-foreground">
            <ShoppingBasket className="size-8" /> Escanea un producto para empezar.
          </li>
        )}
        {lines.map((l, i) => {
          const amounts = totals.lines[i]
          const short = overStock.has(l.productId) || shortages.includes(l.productId)
          return (
            <li
              key={l.productId}
              data-selected={i === selected}
              onClick={() => select(i)}
              className={cn(
                'grid cursor-pointer grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 px-3 py-2.5',
                i === selected && 'bg-brand/10',
                short && 'bg-destructive/10',
              )}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{l.name}</p>
                <p className="num text-[11px] text-muted-foreground">
                  {l.sku}
                  {short && <span className="ml-2 font-semibold text-destructive">Sin stock suficiente</span>}
                </p>
              </div>
              <p className="num text-right text-sm font-semibold">{formatCurrency(amounts?.total ?? 0)}</p>
              <div className="col-span-2 flex flex-wrap items-center gap-1.5">
                <Button size="icon-sm" variant="outline" aria-label="Restar" onClick={() => step(i, -1)}>
                  <Minus />
                </Button>
                <Input
                  aria-label={`Cantidad de ${l.name}`}
                  inputMode="decimal"
                  className="num h-8 w-20 text-center"
                  value={display(l.quantity)}
                  onChange={(e) => setQuantity(i, parse(e.target.value))}
                />
                <Button size="icon-sm" variant="outline" aria-label="Sumar" onClick={() => step(i, 1)}>
                  <Plus />
                </Button>
                <span className="num px-1 text-xs text-muted-foreground">
                  × {formatCurrency(Number(l.unitPrice))}
                </span>
                {canDiscount && (
                  <Input
                    aria-label={`Descuento de ${l.name}`}
                    inputMode="decimal"
                    placeholder="Desc."
                    className="num h-8 w-20 text-right"
                    value={l.discount === '0' ? '' : display(l.discount)}
                    onChange={(e) => setLine(i, { discount: parse(e.target.value) || '0' })}
                  />
                )}
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="ml-auto text-muted-foreground hover:text-destructive"
                  aria-label={`Quitar ${l.name}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    remove(i)
                  }}
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          )
        })}
      </ul>

      <div className="space-y-1.5 border-t p-3 text-sm">
        {totals.lineDiscountTotal > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>Descuentos</span>
            <span className="num">−{formatCurrency(totals.lineDiscountTotal)}</span>
          </div>
        )}
        {breakDownVat && (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Neto {formatCurrency(totals.net)} · IVA 13 % incluido</span>
            <span className="num">{formatCurrency(totals.vat)}</span>
          </div>
        )}
        <div className="flex items-end justify-between">
          <span className="font-medium">Total</span>
          <span className="num text-3xl font-semibold" data-testid="pos-total">
            {formatCurrency(totals.total)}
          </span>
        </div>
        <Button className="h-12 w-full text-base" disabled={lines.length === 0} onClick={onCheckout}>
          <Wallet /> Cobrar <kbd className="num ml-1 text-xs opacity-70">F4</kbd>
        </Button>
      </div>
    </section>
  )
}
