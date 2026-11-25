import { FileWarning } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router'

import { EmptyState } from '@/components/feedback/EmptyState'
import { PageSkeleton } from '@/components/feedback/PageSkeleton'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/hooks'

import { OrderEditor } from '../components/order/OrderEditor'
import { OrderView } from '../components/order/OrderView'
import { usePurchaseOrder } from '../hooks'

/** /compras/ordenes/nueva and /compras/ordenes/:id — editor for drafts, view otherwise. */
export function PurchaseOrderPage() {
  const params = useParams()
  const id = params.id ? Number(params.id) : undefined
  const { data: order, isPending, isError } = usePurchaseOrder(id)
  const { can } = useAuth()

  if (!id)
    return can('purchases.create') ? <OrderEditor key="new" /> : <Navigate to="/compras/ordenes" replace />
  if (isPending) return <PageSkeleton />
  if (isError || !order)
    return (
      <EmptyState
        icon={FileWarning}
        title="Orden no encontrada"
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/compras/ordenes">Volver</Link>
          </Button>
        }
      />
    )

  return order.status === 'draft' && can('purchases.create') ? (
    <OrderEditor key={order.id} order={order} />
  ) : (
    <OrderView order={order} />
  )
}
