import { ArrowLeft, LoaderCircle, PackageCheck, TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import { PageSkeleton } from '@/components/feedback/PageSkeleton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { formatQty } from '@/features/inventory/format'
import { todayIso } from '@/features/sales/format'
import { ApiError } from '@/lib/api-error'
import { formatCurrency } from '@/lib/format'

import { type CostRow, ReceiptCostsEditor } from '../components/receipt/ReceiptCostsEditor'
import { usePurchaseOrder, usePurchaseSettings, useReceiveOrder } from '../hooks'
import { previewReceiptCost, variancePct } from '../lib/receiptCost'
import type { PurchaseOrder } from '../types'

const dot = (v: string) => v.replace(',', '.').trim()

/** /compras/ordenes/:id/recibir — partial or total receipt with the supplier invoice and additional costs. */
export function ReceiveOrderPage() {
  const id = Number(useParams().id)
  const { data: order, isPending } = usePurchaseOrder(id)
  if (isPending) return <PageSkeleton />
  if (!order || !(order.status === 'approved' || order.status === 'partially_received'))
    return <Navigate to={`/compras/ordenes/${id}`} replace />
  return <ReceiveForm order={order} />
}

function ReceiveForm({ order }: { order: PurchaseOrder }) {
  const navigate = useNavigate()
  const receive = useReceiveOrder()
  const [key] = useState(() => crypto.randomUUID())
  const issuesInvoice = order.supplier?.issues_invoice ?? true
  const { data: settings } = usePurchaseSettings()
  const threshold = Number(settings?.purchase_price_variance_pct ?? 2)
  const [date, setDate] = useState(todayIso())
  const [invoice, setInvoice] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(todayIso())
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [costs, setCosts] = useState<CostRow[]>([])
  const [rows, setRows] = useState(() =>
    (order.lines ?? []).map((l) => ({
      lineId: l.id,
      quantity: String(Number(l.pending_quantity)),
      price: l.unit_price,
    })),
  )
  const preview = useMemo(
    () =>
      previewReceiptCost(
        rows.map((r) => ({ quantity: dot(r.quantity), unitPrice: dot(r.price) })),
        costs.map((c) => dot(c.amount)),
        issuesInvoice,
      ),
    [rows, costs, issuesInvoice],
  )
  const variances = rows.map((r, i) => variancePct(dot(r.price), order.lines![i].unit_price))
  const needsReason = variances.some((v) => v > threshold)

  const submit = async () => {
    try {
      const receipt = await receive.mutateAsync({
        orderId: order.id,
        key,
        payload: {
          receipt_date: date,
          supplier_invoice_number: invoice.trim() || null,
          supplier_invoice_date: invoice.trim() ? invoiceDate : null,
          price_variance_reason: needsReason ? reason : null,
          notes: notes || null,
          lines: rows.map((r) => ({
            purchase_order_line_id: r.lineId,
            quantity: dot(r.quantity) || '0',
            unit_price: dot(r.price),
          })),
          costs: costs
            .filter((c) => Number(dot(c.amount)) > 0)
            .map((c) => ({ kind: c.kind, description: c.description || null, amount: dot(c.amount) })),
        },
      })
      toast.success(`Recepción ${receipt.number} confirmada`, {
        description: `Entrada ${receipt.inventory_document?.number ?? ''} registrada en ${receipt.warehouse?.name ?? 'el almacén'}.`,
      })
      navigate(`/compras/recepciones/${receipt.id}`, { replace: true })
    } catch (error) {
      const details = error instanceof ApiError ? Object.values(error.details ?? {}).flat() : []
      toast.error(error instanceof ApiError ? error.message : 'No se pudo registrar la recepción.', {
        description: details.length > 1 ? details.slice(1).map(String).join(' ') : undefined,
        duration: 10_000,
      })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <Link
            to={`/compras/ordenes/${order.id}`}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> {order.number}
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Recibir mercadería</h1>
          <p className="text-sm text-muted-foreground">
            {order.supplier?.name} → {order.warehouse?.name}.{' '}
            {issuesInvoice
              ? 'Con factura: el IVA es crédito fiscal.'
              : 'Sin factura: el costo es el total pagado.'}
          </p>
        </div>
        <Button onClick={submit} disabled={receive.isPending || (needsReason && reason.trim().length < 5)}>
          {receive.isPending ? <LoaderCircle className="animate-spin" /> : <PackageCheck />} Confirmar
          recepción
        </Button>
      </div>

      <Card className="gap-4">
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field>
            <FieldLabel htmlFor="receipt_date">Fecha de recepción</FieldLabel>
            <Input
              id="receipt_date"
              type="date"
              max={todayIso()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="invoice_number">N° de factura del proveedor</FieldLabel>
            <Input
              id="invoice_number"
              className="num"
              value={invoice}
              onChange={(e) => setInvoice(e.target.value)}
              placeholder={issuesInvoice ? '000123' : 'Opcional'}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="invoice_date">Fecha de la factura</FieldLabel>
            <Input
              id="invoice_date"
              type="date"
              max={todayIso()}
              value={invoiceDate}
              disabled={!invoice.trim()}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="receipt_notes">Notas</FieldLabel>
            <Textarea id="receipt_notes" rows={1} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      <Card className="gap-3">
        <CardHeader>
          <CardTitle className="text-base">Cantidades y precios facturados</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6">Producto</TableHead>
                <TableHead className="text-right">Pendiente</TableHead>
                <TableHead className="w-32 text-right">Recibido</TableHead>
                <TableHead className="w-32 text-right">Precio factura</TableHead>
                <TableHead className="text-right">Precio OC</TableHead>
                <TableHead className="text-right">Costo unit.</TableHead>
                <TableHead className="pr-6 text-right">Costo total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.lines?.map((l, i) => (
                <TableRow key={l.id}>
                  <TableCell className="pl-6">
                    <span className="font-medium">{l.product?.name}</span>
                    {variances[i] > threshold && (
                      <span className="mt-0.5 flex items-center gap-1 text-xs text-warning">
                        <TriangleAlert className="size-3" /> Difiere{' '}
                        {variances[i].toFixed(2).replace('.', ',')} % del precio de la OC
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="num text-right">
                    {formatQty(l.pending_quantity, l.product?.unit?.code)}
                  </TableCell>
                  <TableCell>
                    <Input
                      aria-label={`Recibido ${l.product?.name}`}
                      inputMode="decimal"
                      className="num h-9 text-right"
                      value={rows[i].quantity}
                      onChange={(e) =>
                        setRows((rs) => rs.map((r, j) => (j === i ? { ...r, quantity: e.target.value } : r)))
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      aria-label={`Precio factura ${l.product?.name}`}
                      inputMode="decimal"
                      className="num h-9 text-right"
                      value={rows[i].price}
                      onChange={(e) =>
                        setRows((rs) => rs.map((r, j) => (j === i ? { ...r, price: e.target.value } : r)))
                      }
                    />
                  </TableCell>
                  <TableCell className="num text-right text-muted-foreground">
                    {formatCurrency(Number(l.unit_price))}
                  </TableCell>
                  <TableCell className="num text-right">
                    {preview.lines[i].unitCost ? preview.lines[i].unitCost.toFixed(4).replace('.', ',') : '—'}
                  </TableCell>
                  <TableCell className="num pr-6 text-right">
                    {formatCurrency(preview.lines[i].costTotal)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card className="gap-3">
          <CardHeader>
            <CardTitle className="text-base">Gastos adicionales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ReceiptCostsEditor rows={costs} onChange={setCosts} />
            {needsReason && (
              <Field>
                <FieldLabel htmlFor="variance_reason">Motivo de la diferencia de precio</FieldLabel>
                <Textarea
                  id="variance_reason"
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ej.: actualización de lista del proveedor"
                />
              </Field>
            )}
          </CardContent>
        </Card>
        <Card className="gap-2">
          <CardHeader>
            <CardTitle className="text-base">Resumen</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[1fr_auto] gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Total factura (a pagar)</dt>
              <dd className="num text-right font-medium" data-testid="receipt-invoice-total">
                {formatCurrency(preview.invoiceTotal)}
              </dd>
              <dt className="text-muted-foreground">Crédito fiscal IVA 13 %</dt>
              <dd className="num text-right">{formatCurrency(preview.vatCredit)}</dd>
              <dt className="text-muted-foreground">Neto</dt>
              <dd className="num text-right">{formatCurrency(preview.netTotal)}</dd>
              <dt className="text-muted-foreground">Gastos adicionales</dt>
              <dd className="num text-right">{formatCurrency(preview.additionalTotal)}</dd>
              <div className="col-span-2 my-1 border-t" aria-hidden />
              <dt className="font-medium">Costo de inventario</dt>
              <dd className="num text-right text-lg font-semibold" data-testid="receipt-cost-total">
                {formatCurrency(preview.costTotal)}
              </dd>
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
