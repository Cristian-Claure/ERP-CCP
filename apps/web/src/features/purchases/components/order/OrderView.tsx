import { ArrowLeft, Ban, CheckCheck, LoaderCircle, PackageCheck } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/features/auth/hooks'
import { formatQty } from '@/features/inventory/format'
import { VoidReasonDialog } from '@/features/sales/components/VoidReasonDialog'
import { formatBizDate, formatDateTime } from '@/features/sales/format'
import { ApiError } from '@/lib/api-error'
import { formatCurrency } from '@/lib/format'

import { useApproveOrder, useCancelOrder } from '../../hooks'
import type { PurchaseOrder } from '../../types'
import { OrderStatusBadge, ReceiptStatusBadge } from '../OrderStatusBadge'

/** Read-only OC: progress per line, its receipts and the actions of its state. */
export function OrderView({ order }: { order: PurchaseOrder }) {
  const { can } = useAuth()
  const approve = useApproveOrder()
  const cancel = useCancelOrder()
  const [cancelOpen, setCancelOpen] = useState(false)
  const receivable = order.status === 'approved' || order.status === 'partially_received'
  const hasReceipts = order.receipts?.some((r) => r.status === 'posted') ?? false
  const canCancel =
    (order.status === 'draft' || order.status === 'approved') &&
    !hasReceipts &&
    (can('purchases.void') || (order.status === 'draft' && can('purchases.create')))

  const onApprove = async () => {
    try {
      const approved = await approve.mutateAsync(order.id)
      toast.success(`Orden ${approved.number} aprobada`)
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'No se pudo aprobar.')
    }
  }

  const info: [string, React.ReactNode][] = [
    ['Proveedor', order.supplier?.name],
    ['Almacén de destino', order.warehouse?.name],
    ['Fecha', formatBizDate(order.order_date)],
    ['Llegada esperada', formatBizDate(order.expected_date)],
    ['Referencia', order.reference ?? '—'],
    ['Creada por', `${order.created_by?.name ?? '—'} · ${formatDateTime(order.created_at)}`],
    [
      'Aprobada por',
      order.approved_at ? `${order.approved_by?.name} · ${formatDateTime(order.approved_at)}` : '—',
    ],
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <Link
            to="/compras/ordenes"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Órdenes de compra
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="num text-2xl font-semibold tracking-tight">{order.number ?? 'Borrador'}</h1>
            <OrderStatusBadge status={order.status} />
          </div>
          <p className="text-sm text-muted-foreground">{order.supplier?.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {order.status === 'draft' && can('purchases.approve') && (
            <Button onClick={onApprove} disabled={approve.isPending}>
              {approve.isPending ? <LoaderCircle className="animate-spin" /> : <CheckCheck />} Aprobar
            </Button>
          )}
          {receivable && can('purchases.receive') && (
            <Button asChild>
              <Link to={`/compras/ordenes/${order.id}/recibir`}>
                <PackageCheck /> Recibir mercadería
              </Link>
            </Button>
          )}
          {canCancel && (
            <Button variant="destructive" onClick={() => setCancelOpen(true)}>
              <Ban /> Cancelar orden
            </Button>
          )}
        </div>
      </div>

      {order.status === 'cancelled' && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm">
          <p className="font-medium text-destructive">Orden cancelada</p>
          <p className="mt-1 text-muted-foreground">Motivo: {order.cancel_reason}</p>
        </div>
      )}

      <Card>
        <CardContent className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          {info.map(([label, value]) => (
            <div key={label} className="space-y-0.5">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-sm font-medium">{value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="gap-3">
        <CardHeader>
          <CardTitle className="text-base">Productos</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6">Producto</TableHead>
                <TableHead className="text-right">Pedido</TableHead>
                <TableHead className="text-right">Recibido</TableHead>
                <TableHead className="text-right">Pendiente</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="pr-6 text-right">Subtotal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.lines?.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="pl-6">
                    <span className="flex flex-col">
                      <span className="font-medium">{l.product?.name}</span>
                      <span className="num text-xs text-muted-foreground">{l.product?.sku}</span>
                    </span>
                  </TableCell>
                  <TableCell className="num text-right">
                    {formatQty(l.quantity, l.product?.unit?.code)}
                  </TableCell>
                  <TableCell className="num text-right">{formatQty(l.received_quantity)}</TableCell>
                  <TableCell className="num text-right font-medium">
                    {formatQty(l.pending_quantity)}
                  </TableCell>
                  <TableCell className="num text-right">{formatCurrency(Number(l.unit_price))}</TableCell>
                  <TableCell className="num pr-6 text-right">
                    {formatCurrency(Number(l.line_total))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex justify-end border-t px-6 pt-4">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Total de la orden</p>
              <p className="num text-xl font-semibold">{formatCurrency(Number(order.total))}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {order.receipts && order.receipts.length > 0 && (
        <Card className="gap-3">
          <CardHeader>
            <CardTitle className="text-base">Recepciones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {order.receipts.map((r) => (
              <Link
                key={r.id}
                to={`/compras/recepciones/${r.id}`}
                className="flex items-center justify-between gap-4 rounded-lg border p-3 text-sm hover:bg-accent"
              >
                <span className="num font-medium">{r.number}</span>
                <span className="text-muted-foreground">{formatBizDate(r.receipt_date)}</span>
                <span className="num text-muted-foreground">
                  {r.supplier_invoice_number ? `Factura ${r.supplier_invoice_number}` : 'Sin factura'}
                </span>
                <span className="num">{formatCurrency(Number(r.invoice_total))}</span>
                <ReceiptStatusBadge status={r.status} />
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <VoidReasonDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={`Cancelar ${order.number ?? 'borrador'}`}
        description="La orden dejará de esperar mercadería. Queda registrada con su motivo."
        confirmLabel="Cancelar orden"
        onConfirm={async (reason) => {
          try {
            await cancel.mutateAsync({ id: order.id, reason })
            toast.success('Orden cancelada')
          } catch (error) {
            toast.error(error instanceof ApiError ? error.message : 'No se pudo cancelar.')
            throw error
          }
        }}
      />
    </div>
  )
}
