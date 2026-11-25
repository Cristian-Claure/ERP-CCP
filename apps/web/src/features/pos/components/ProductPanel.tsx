import { PackageSearch, ScanBarcode } from 'lucide-react'
import { forwardRef, useMemo, useState } from 'react'

import { Input } from '@/components/ui/input'
import { formatQty } from '@/features/inventory/format'
import { formatCurrency } from '@/lib/format'
import { cn } from 'cn'

import type { ProductIndex } from '../lib/search'
import type { PosProduct } from '../types'

interface ProductPanelProps {
  term: string
  onTermChange: (term: string) => void
  products: PosProduct[]
  index: ProductIndex
  loading: boolean
  onPick: (product: PosProduct) => void
}

/** Left side: always-focused search (F2), category tabs and the product grid. */
export const ProductPanel = forwardRef<HTMLInputElement, ProductPanelProps>(function ProductPanel(
  { term, onTermChange: setTerm, products, index, loading, onPick },
  searchRef,
) {
  const [category, setCategory] = useState<number | null>(null)

  const categories = useMemo(() => {
    const map = new Map<number, string>()
    for (const p of products) if (p.category_id && p.category) map.set(p.category_id, p.category)
    return [...map].sort((a, b) => a[1].localeCompare(b[1], 'es'))
  }, [products])
  const results = useMemo(() => index.search(term, { categoryId: category }), [index, term, category])

  const pick = (product: PosProduct) => {
    onPick(product)
    setTerm('')
  }

  return (
    <section className="flex min-h-0 flex-col gap-3">
      <div className="relative">
        <ScanBarcode className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={searchRef}
          autoFocus
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results[0]) {
              e.preventDefault()
              pick(results[0])
            }
          }}
          placeholder="Escanea o busca por código, SKU o nombre (F2)"
          aria-label="Buscar producto"
          className="h-12 pl-11 text-base"
        />
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Categorías">
        {[[null, 'Todos'] as const, ...categories].map(([id, name]) => (
          <button
            key={id ?? 'all'}
            type="button"
            role="tab"
            aria-selected={category === id}
            onClick={() => setCategory(id)}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1 text-sm transition-colors',
              category === id
                ? 'border-brand bg-brand/15 text-foreground'
                : 'text-muted-foreground hover:bg-accent',
            )}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2 overflow-y-auto pr-1">
        {loading &&
          Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-surface-2" />
          ))}
        {!loading && results.length === 0 && (
          <div className="col-span-full flex flex-col items-center gap-2 py-12 text-sm text-muted-foreground">
            <PackageSearch className="size-8" /> Sin coincidencias.
          </div>
        )}
        {results.map((p) => {
          const stock = Number(p.stock)
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => pick(p)}
              className="flex h-24 flex-col justify-between rounded-lg border bg-card p-2.5 text-left transition-colors hover:border-brand/60 hover:bg-accent focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
            >
              <span className="line-clamp-2 text-[13px] leading-tight font-medium">{p.name}</span>
              <span className="flex items-end justify-between gap-1">
                <span className="num text-sm font-semibold">
                  {p.sale_price ? formatCurrency(Number(p.sale_price)) : '—'}
                </span>
                <span
                  className={cn('num text-[11px]', stock <= 0 ? 'text-destructive' : 'text-muted-foreground')}
                >
                  {formatQty(stock, p.unit)}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
})
