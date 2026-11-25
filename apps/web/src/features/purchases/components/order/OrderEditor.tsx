import { ArrowLeft, CheckCheck, LoaderCircle, Plus, Save, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/features/auth/hooks'
import { ProductCombobox } from '@/features/inventory/components/ProductCombobox'
import { useWarehouses } from '@/features/inventory/hooks'
import { todayIso } from '@/features/sales/format'
import { ApiError } from '@/lib/api-error'
import { formatCurrency } from '@/lib/format'

import { useApproveOrder, useSaveOrder } from '../../hooks'
import type { PurchaseOrder } from '../../types'
import { SupplierCombobox } from '../SupplierCombobox'

interface Line {
  key: string
  product_id: number
  label?: string
  quantity: string
  unit_price: string
}

const newLine = (): Line => ({ key: crypto.randomUUID(), product_id: 0, quantity: '', unit_price: '' })
const dot = (v: string) => v.replace(',', '.').trim()

/** New or draft OC: supplier, destination warehouse, lines (agreed price, VAT included if invoiced). */
export function OrderEditor({ order }: { order?: PurchaseOrder }) {
  const navigate = useNavigate()
  const { can, user } = useAuth()
  const { data: warehouses } = useWarehouses()
  const save = useSaveOrder()
  const approve = useApproveOrder()
  const [key] = useState(() => crypto.randomUUID())
  const [supplierId, setSupplierId] = useState(order?.supplier_id ?? 0)
  const [issuesInvoice, setIssuesInvoice] = useState(order?.supplier?.issues_invoice ?? true)
  const [warehouseId, setWarehouseId] = useState(order?.warehouse_id ?? 0)
  const [expected, setExpected] = useState(order?.expected_date ?? '')
  const [reference, setReference] = useState(order?.reference ?? '')
  const [notes, setNotes] = useState(order?.notes ?? '')
  const [lines, setLines] = useState<Line[]>(() =>
    order?.lines?.length
      ? order.lines.map((l) => ({
          key: String(l.id),
          product_id: l.product_id,
          label: l.product ? `${l.product.sku} · ${l.product.name}` : undefined,
          quantity: String(Number(l.quantity)),
          unit_price: l.unit_price,
        }))
      : [newLine()],
  )
  const total = lines.reduce(
    (s, l) => s + (Number(dot(l.quantity)) || 0) * (Number(dot(l.unit_price)) || 0),
    0,
  )
  const threshold = Number(user?.company.purchase_approval_threshold ?? 0)
  const busy = save.isPending || approve.isPending
  const patch = (k: string, p: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === k ? { ...l, ...p } : l)))

  const persist = async () => {
    const payload = {
      supplier_id: supplierId,
      warehouse_id: warehouseId,
      order_date: order?.order_date ?? todayIso(),
      expected_date: expected || null,
      reference: reference || null,
      notes: notes || null,
      lines: lines
        .filter((l) => l.product_id)
        .map((l) => ({ product_id: l.product_id, quantity: dot(l.quantity), unit_price: dot(l.unit_price) })),
    }
    return save.mutateAsync({ payload, id: order?.id, idempotencyKey: key })
  }

  const fail = (error: unknown, fallback: string) => {
    const details = error instanceof ApiError ? Object.values(error.details ?? {}).flat() : []
    toast.error(error instanceof ApiError ? error.message : fallback, {
      description: details.length > 1 ? String(details[1]) : undefined,
    })
  }

  const run = async (andApprove: boolean) => {
    let saved: PurchaseOrder
    try {
      saved = await persist()
    } catch (error) {
      return fail(error, 'No se pudo guardar la orden.')
    }
    try {
      if (andApprove) {
        saved = await approve.mutateAsync(saved.id)
        toast.success(`Orden ${saved.number} aprobada`)
      } else toast.success('Borrador guardado')
    } catch (error) {
      fail(error, 'No se pudo aprobar la orden.')
    }
    // The draft exists even if the approval was rejected: continue from its page.
    navigate(`/compras/ordenes/${saved.id}`, { replace: true })
  }

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
          <h1 className="text-2xl font-semibold tracking-tight">
            {order ? 'Borrador de orden de compra' : 'Nueva orden de compra'}
          </h1>
          <p className="text-sm text-muted-foreground">El número OC- se asigna al aprobar.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => run(false)} disabled={busy}>
            {save.isPending && !approve.isPending ? <LoaderCircle className="animate-spin" /> : <Save />}{' '}
            Guardar borrador
          </Button>
          {(can('purchases.create') || can('purchases.approve')) && (
            <Button onClick={() => run(true)} disabled={busy}>
              {approve.isPending ? <LoaderCircle className="animate-spin" /> : <CheckCheck />} Aprobar
            </Button>
          )}
        </div>
      </div>

      <Card className="gap-4">
        <CardHeader>
          <CardTitle className="text-base">Datos de la orden</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field className="sm:col-span-2">
            <FieldLabel>Proveedor</FieldLabel>
            <SupplierCombobox
              value={supplierId || null}
              selectedLabel={order?.supplier?.name}
              onChange={(s) => {
                setSupplierId(s.id)
                setIssuesInvoice(s.issues_invoice)
              }}
            />
          </Field>
          <Field>
            <FieldLabel>Almacén de destino</FieldLabel>
            <Select
              value={warehouseId ? String(warehouseId) : ''}
              onValueChange={(v) => setWarehouseId(Number(v))}
            >
              <SelectTrigger className="w-full" aria-label="Almacén de destino">
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {warehouses
                  ?.filter((w) => w.is_active)
                  .map((w) => (
                    <SelectItem key={w.id} value={String(w.id)}>
                      {w.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="expected_date">Llegada esperada</FieldLabel>
            <Input
              id="expected_date"
              type="date"
              value={expected}
              onChange={(e) => setExpected(e.target.value)}
            />
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="po-reference">Referencia</FieldLabel>
            <Input id="po-reference" value={reference} onChange={(e) => setReference(e.target.value)} />
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="po-notes">Notas</FieldLabel>
            <Textarea id="po-notes" rows={1} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      <Card className="gap-3">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Productos</CardTitle>
          <span className="text-xs text-muted-foreground">
            {issuesInvoice
              ? 'Precios acordados con IVA incluido (el proveedor factura).'
              : 'Proveedor sin factura: el precio es el costo.'}
          </span>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="min-w-72 pl-6">Producto</TableHead>
                <TableHead className="w-32 text-right">Cantidad</TableHead>
                <TableHead className="w-36 text-right">Precio unit.</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="w-12 pr-6" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((l, i) => (
                <TableRow key={l.key}>
                  <TableCell className="pl-6">
                    <ProductCombobox
                      value={l.product_id || null}
                      selectedLabel={l.label}
                      usedIds={lines.map((x) => x.product_id)}
                      onChange={(p) => patch(l.key, { product_id: p.id, label: `${p.sku} · ${p.name}` })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      aria-label={`Cantidad ${i + 1}`}
                      inputMode="decimal"
                      className="num h-9 text-right"
                      value={l.quantity}
                      onChange={(e) => patch(l.key, { quantity: e.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      aria-label={`Precio ${i + 1}`}
                      inputMode="decimal"
                      className="num h-9 text-right"
                      value={l.unit_price}
                      onChange={(e) => patch(l.key, { unit_price: e.target.value })}
                    />
                  </TableCell>
                  <TableCell className="num text-right text-sm">
                    {formatCurrency((Number(dot(l.quantity)) || 0) * (Number(dot(l.unit_price)) || 0))}
                  </TableCell>
                  <TableCell className="pr-6">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Quitar línea ${i + 1}`}
                      disabled={lines.length === 1}
                      onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                    >
                      <Trash2 />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between border-t px-6 pt-4">
            <Button variant="outline" size="sm" onClick={() => setLines((ls) => [...ls, newLine()])}>
              <Plus /> Agregar producto
            </Button>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Total de la orden</p>
              <p className="num text-xl font-semibold">{formatCurrency(total)}</p>
              {threshold > 0 && total > threshold && (
                <p className="text-xs text-warning">
                  Supera {formatCurrency(threshold)}: la aprobará un gerente distinto de quien la creó.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
