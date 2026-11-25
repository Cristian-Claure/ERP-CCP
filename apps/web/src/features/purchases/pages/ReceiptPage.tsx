import { ArrowLeft, Ban, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'

import { PageSkeleton } from '@/components/feedback/PageSkeleton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/features/auth/hooks'
import { formatQty } from '@/features/inventory/format'
import { VoidReasonDialog } from '@/features/sales/components/VoidReasonDialog'
import { formatBizDate, formatDateTime } from '@/features/sales/format'
import { ApiError } from '@/lib/api-error'
import { formatCurrency } from '@/lib/format'
import { cn } from 'cn'

import { ReceiptStatusBadge } from '../components/OrderStatusBadge'
import { useReceipt, useVoidReceipt } from '../hooks'

const money = (v: string | number) => formatCurrency(Number(v))

/** /compras/recepciones/:id — costs per line, fiscal credit, ENT- link and void. */
export function ReceiptPage() {
  const id = Number(useParams().id)
  const { data: r, isPending } = useReceipt(id)
  const { can } = useAuth()
  const voidReceipt = useVoidReceipt()
  const [voidOpen, setVoidOpen] = useState(false)
  if (isPending || !r) return <PageSkeleton />

  const info: [string, React.ReactNode][] = [
    ['Proveedor', r.supplier?.name],
    [
      'Orden',
      <Link key="o" to={`/compras/ordenes/${r.purchase_order_id}`} className="num hover:underline">
        {r.order?.number}
      </Link>,
    ],
    [
      'Factura',
      r.supplier_invoice_number
        ? `${r.supplier_invoice_number} · ${formatBizDate(r.supplier_invoice_date)}`
        : 'Sin factura',
    ],
    ['Recepción', formatBizDate(r.receipt_date)],
    ['Vencimiento', formatBizDate(r.due_date)],
    ['Almacén', r.warehouse?.name],
    [
      'Entrada de inventario',
      r.inventory_document ? (
        <Link
          key="e"
          to={`/inventario/documentos/${r.inventory_document.id}`}
          className="num hover:underline"
        >
          {r.inventory_document.number}
        </Link>
      ) : (
        '—'
      ),
    ],
    ['Registrada por', r.created_by?.name ?? '—'],
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <Link
            to="/compras/recepciones"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Recepciones
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="num text-2xl font-semibold tracking-tight">{r.number}</h1>
            <ReceiptStatusBadge status={r.status} />
          </div>
        </div>
        {r.status === 'posted' && can('purchases.void') && (
          <Button variant="destructive" onClick={() => setVoidOpen(true)}>
            <Ban /> Anular recepción
          </Button>
        )}
      </div>

      {r.status === 'voided' && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm">
          <p className="font-medium text-destructive">Recepción anulada</p>
          <p className="mt-1">
            {r.voided_by?.name} · {r.voided_at && formatDateTime(r.voided_at)}
          </p>
          <p className="mt-1 text-muted-foreground">Motivo: {r.void_reason}</p>
        </div>
      )}
      {r.price_variance_reason && (
        <div className="flex gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" /> Diferencia de precio con la OC. Motivo:{' '}
          {r.price_variance_reason}
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
          <CardTitle className="text-base">Costo de entrada por línea</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6">Producto</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Precio factura</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">IVA (crédito)</TableHead>
                <TableHead className="text-right">Neto</TableHead>
                <TableHead className="text-right">Gastos</TableHead>
                <TableHead className="text-right">Costo unit.</TableHead>
                <TableHead className="pr-6 text-right">Costo total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.lines?.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="pl-6">
                    <span className="font-medium">{l.product?.name}</span>
                    {l.price_variance_flag && (
                      <span className="block text-xs text-warning">
                        OC {money(l.order_unit_price)} · {l.price_variance_pct.replace('.', ',')} %
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="num text-right">{formatQty(l.quantity)}</TableCell>
                  <TableCell className={cn('num text-right', l.price_variance_flag && 'text-warning')}>
                    {money(l.unit_price)}
                  </TableCell>
                  <TableCell className="num text-right">{money(l.line_total)}</TableCell>
                  <TableCell className="num text-right text-muted-foreground">{money(l.vat)}</TableCell>
                  <TableCell className="num text-right">{money(l.net)}</TableCell>
                  <TableCell className="num text-right text-muted-foreground">
                    {money(l.additional_cost)}
                  </TableCell>
                  <TableCell className="num text-right">
                    {Number(l.unit_cost).toFixed(4).replace('.', ',')}
                  </TableCell>
                  <TableCell className="num pr-6 text-right font-medium">{money(l.cost_total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="gap-2">
          <CardHeader>
            <CardTitle className="text-base">Gastos adicionales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {r.costs?.length ? (
              r.costs.map((c, i) => (
                <div key={i} className="flex justify-between gap-4">
                  <span>
                    {c.kind_label}
                    {c.description ? ` · ${c.description}` : ''}
                  </span>
                  <span className="num">{money(c.amount)}</span>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">Sin gastos adicionales.</p>
            )}
          </CardContent>
        </Card>
        <Card className="gap-2">
          <CardContent>
            <dl className="grid grid-cols-[1fr_auto] gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Total factura</dt>
              <dd className="num text-right font-medium">{money(r.invoice_total)}</dd>
              <dt className="text-muted-foreground">Crédito fiscal IVA</dt>
              <dd className="num text-right">{money(r.vat_credit)}</dd>
              <dt className="text-muted-foreground">Costo de inventario</dt>
              <dd className="num text-right font-semibold">{money(r.cost_total)}</dd>
              <dt className="text-muted-foreground">Pagado</dt>
              <dd className="num text-right">{money(r.paid_amount)}</dd>
              <dt className="font-medium">Saldo por pagar</dt>
              <dd className="num text-right font-semibold">{money(r.open_amount)}</dd>
            </dl>
          </CardContent>
        </Card>
      </div>

      <VoidReasonDialog
        open={voidOpen}
        onOpenChange={setVoidOpen}
        title={`Anular ${r.number}`}
        description="Se anula su entrada de inventario (al costo original), la cuenta por pagar y lo recibido en la OC. Si la mercadería ya se vendió o consumió, la anulación se rechaza."
        confirmLabel="Anular recepción"
        onConfirm={async (reason) => {
          try {
            await voidReceipt.mutateAsync({ id: r.id, reason })
            toast.success(`Recepción ${r.number} anulada`)
          } catch (error) {
            toast.error(error instanceof ApiError ? error.message : 'No se pudo anular.', {
              duration: 12_000,
            })
            throw error
          }
        }}
      />
    </div>
  )
}
