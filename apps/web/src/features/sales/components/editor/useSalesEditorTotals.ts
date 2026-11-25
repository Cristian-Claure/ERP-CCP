import { useMemo } from 'react'

import { useStockAvailability } from '@/features/inventory/hooks'
import { normalizeDecimal } from '@/features/inventory/schemas'

import { computeSalesTotals } from '../../calc'
import type { SalesFormInput } from '../../schemas'

/** Parses a form decimal ("1,50") into a number (0 when empty or invalid). */
export const toNumber = (v: string | undefined | null) => Number(normalizeDecimal(v ?? '')) || 0

/**
 * Derived figures of the editor: live totals (same algorithm as the server, exact
 * to the cent), stock availability per product and the estimated margin.
 */
export function useSalesEditorTotals({
  lines,
  globalDiscount,
  breakDownVat,
  warehouseId,
  isQuote,
}: {
  lines: SalesFormInput['lines']
  globalDiscount: string | undefined
  breakDownVat: boolean
  warehouseId: number
  isQuote: boolean
}) {
  const productIds = useMemo(() => [...new Set(lines.map((l) => l.product_id).filter((v) => v > 0))], [lines])
  const { data: availability } = useStockAvailability(
    isQuote ? undefined : warehouseId || undefined,
    productIds,
  )
  const stockOf = (productId: number) => availability?.find((a) => a.product_id === productId)

  const totals = useMemo(
    () =>
      computeSalesTotals(
        lines.map((l) => ({
          quantity: normalizeDecimal(l.quantity ?? ''),
          unit_price: normalizeDecimal(l.unit_price ?? ''),
          discount_amount: normalizeDecimal(l.discount_amount ?? ''),
        })),
        normalizeDecimal(globalDiscount ?? ''),
        breakDownVat,
      ),
    [lines, globalDiscount, breakDownVat],
  )
  const estimatedCost = lines.reduce(
    (s, l) => s + toNumber(l.quantity) * Number(stockOf(l.product_id)?.avg_cost ?? 0),
    0,
  )

  const requestedByProduct = useMemo(() => {
    const m = new Map<number, number>()
    for (const l of lines)
      if (l.product_id) m.set(l.product_id, (m.get(l.product_id) ?? 0) + toNumber(l.quantity))
    return m
  }, [lines])

  return { productIds, stockOf, totals, estimatedMargin: totals.net - estimatedCost, requestedByProduct }
}

export type SalesEditorTotals = ReturnType<typeof useSalesEditorTotals>
