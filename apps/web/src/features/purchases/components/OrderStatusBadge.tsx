import { Badge } from '@/components/ui/badge'

import { orderStatusMeta } from '../format'
import type { PurchaseOrderStatus } from '../types'

export function OrderStatusBadge({ status }: { status: PurchaseOrderStatus }) {
  const meta = orderStatusMeta(status)
  return (
    <Badge variant="outline" className={meta.className}>
      {meta.label}
    </Badge>
  )
}

export function ReceiptStatusBadge({ status }: { status: 'posted' | 'voided' }) {
  return status === 'voided' ? (
    <Badge
      variant="outline"
      className="border-destructive/25 bg-destructive/10 text-destructive line-through"
    >
      Anulada
    </Badge>
  ) : (
    <Badge variant="outline" className="border-success/25 bg-success/12 text-success">
      Confirmada
    </Badge>
  )
}
