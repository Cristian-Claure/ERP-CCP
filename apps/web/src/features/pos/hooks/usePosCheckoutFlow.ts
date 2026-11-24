import { useState } from 'react'
import { toast } from 'sonner'

import type { AuthorizationRequest } from '@/features/sales/components/AuthorizationDialog'
import type { PriceBelowCostDetails, SalesDocument } from '@/features/sales/types'
import type { StockShortage } from '@/features/inventory/types'
import { ApiError } from '@/lib/api-error'

import { usePosCheckout } from '../queries'
import { usePosStore } from '../store'
import type { PosCheckoutPayload, Tender } from '../types'

const newKey = () => crypto.randomUUID()

/**
 * Checkout round-trip: builds the payload from the cart, keeps ONE
 * Idempotency-Key per sale (a double Enter or a retry after an authorization
 * never posts twice) and maps engine errors: insufficient_stock marks the
 * lines, price_below_cost opens the authorization dialog and retries.
 */
export function usePosCheckoutFlow(warehouseId: number | undefined) {
  const checkout = usePosCheckout(warehouseId)
  const [key, setKey] = useState(newKey)
  const [authRequest, setAuthRequest] = useState<AuthorizationRequest | null>(null)
  const [pendingTenders, setPendingTenders] = useState<Tender[]>([])
  const [done, setDone] = useState<SalesDocument | null>(null)

  const buildPayload = (tenders: Tender[], belowCostReason?: string): PosCheckoutPayload => {
    const s = usePosStore.getState()
    return {
      type: s.docType,
      warehouse_id: warehouseId!,
      customer: s.customer,
      global_discount: s.globalDiscount,
      lines: s.lines.map((l) => ({
        product_id: l.productId,
        quantity: l.quantity,
        unit_price: l.unitPrice,
        discount_amount: l.discount,
      })),
      payments: tenders.filter((t) => Number(t.amount) > 0),
      below_cost_reason: belowCostReason,
    }
  }

  /** 'ok' posted · 'auth' waiting for an authorization · 'error' anything else (already notified). */
  const submit = async (tenders: Tender[], belowCostReason?: string): Promise<'ok' | 'auth' | 'error'> => {
    setPendingTenders(tenders)
    try {
      const sale = await checkout.mutateAsync({ payload: buildPayload(tenders, belowCostReason), key })
      setAuthRequest(null)
      setDone(sale)
      usePosStore.getState().clear()
      setKey(newKey())
      return 'ok'
    } catch (error) {
      if (!(error instanceof ApiError)) {
        toast.error('No se pudo registrar la venta. Revisa la conexión y vuelve a intentar.')
        return 'error'
      }
      if (error.code === 'insufficient_stock') {
        const lines = (error.details as unknown as { lines: StockShortage[] }).lines ?? []
        usePosStore.getState().setShortages(lines.map((l) => l.product_id))
        toast.error('Stock insuficiente en las líneas marcadas.')
      } else if (error.code === 'price_below_cost') {
        setAuthRequest({ kind: 'below_cost', details: error.details as unknown as PriceBelowCostDetails })
        return 'auth'
      } else {
        const details = Object.values(error.details ?? {}).flat()
        toast.error(error.message, { description: details.length ? String(details[0]) : undefined })
      }
      return 'error'
    }
  }

  return {
    submit,
    authRequest,
    closeAuthorization: () => setAuthRequest(null),
    authorize: (reason: string) => submit(pendingTenders, reason),
    pending: checkout.isPending,
    done,
    closeDone: () => setDone(null),
  }
}
