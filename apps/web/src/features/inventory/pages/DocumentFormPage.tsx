import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Ban, CheckCheck, FileWarning, LoaderCircle, Plus, Save, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { EmptyState } from '@/components/feedback/EmptyState'
import { PageSkeleton } from '@/components/feedback/PageSkeleton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/features/auth/hooks'
import { ApiError } from '@/lib/api-error'
import { formatCurrency } from '@/lib/format'
import { cn } from 'cn'

import { ConfirmPostDialog, VoidDialog } from '../components/DocumentActionDialogs'
import { DocumentStatusBadge } from '../components/DocumentStatusBadge'
import { ProductCombobox } from '../components/ProductCombobox'
import { StockShortageAlert } from '../components/StockShortageAlert'
import { DOCUMENT_TYPES, formatCost, formatQty, TYPE_ICONS } from '../format'
import {
  useAdjustmentReasons,
  useDeleteDocument,
  useDocument,
  usePostDocument,
  useSaveDocument,
  useStockAvailability,
  useVoidDocument,
  useWarehouses,
} from '../hooks'
import {
  type DocumentFormInput,
  type DocumentFormValues,
  documentFormSchema,
  emptyLine,
  normalizeDecimal,
  toDocumentPayload,
} from '../schemas'
import type { DocumentType, InventoryDocument, StockShortage } from '../types'

const today = () => new Date().toLocaleDateString('en-CA')
const daysAgo = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toLocaleDateString('en-CA')
}

export function DocumentFormPage() {
  const params = useParams()
  const [search] = useSearchParams()
  const id = params.id ? Number(params.id) : undefined
  const { data: document, isPending, isError } = useDocument(id)
  const { can } = useAuth()

  if (!id) {
    const type = search.get('tipo') as DocumentType | null
    if (!type || !DOCUMENT_TYPES.some((t) => t.value === type))
      return <Navigate to="/inventario/documentos" replace />
    if (!can('movements.create')) return <Navigate to="/inventario/documentos" replace />
    return <DocumentEditor key={`new-${type}`} type={type} />
  }

  if (isPending) return <PageSkeleton />
  if (isError || !document)
    return (
      <EmptyState
        icon={FileWarning}
        title="Documento no encontrado"
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/inventario/documentos">Volver</Link>
          </Button>
        }
      />
    )

  return document.status === 'draft' && can('movements.create') ? (
    <DocumentEditor key={document.id} type={document.type} document={document} />
  ) : (
    <DocumentView document={document} />
  )
}

/* -------------------------------------------------------------------------- */
/*                                   Editor                                   */
/* -------------------------------------------------------------------------- */

interface DocumentEditorProps {
  type: DocumentType
  document?: InventoryDocument
}

function DocumentEditor({ type, document }: DocumentEditorProps) {
  const navigate = useNavigate()
  const { user, can } = useAuth()
  const { data: warehouses } = useWarehouses()
  const { data: reasons } = useAdjustmentReasons()
  const save = useSaveDocument()
  const post = usePostDocument()
  const remove = useDeleteDocument()
  // One key per editor instance: a double click or retry never creates two drafts.
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [shortages, setShortages] = useState<StockShortage[]>([])
  const [productLabels, setProductLabels] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      (document?.lines ?? []).map((l) => [l.product_id, `${l.product?.sku} · ${l.product?.name}`]),
    ),
  )
  const [units, setUnits] = useState<Record<number, string | undefined>>(() =>
    Object.fromEntries((document?.lines ?? []).map((l) => [l.product_id, l.product?.unit?.code])),
  )

  const meta = DOCUMENT_TYPES.find((t) => t.value === type)!
  const TypeIcon = TYPE_ICONS[type]
  const allowNegative = user?.company.allow_negative_stock ?? false
  const backdate = user?.company.document_backdate_days ?? 30
  const isAdjustment = type === 'adjustment'
  const isEntry = type === 'entry'

  const form = useForm<DocumentFormInput, unknown, DocumentFormValues>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: {
      type,
      warehouse_id: document?.warehouse_id ?? 0,
      destination_warehouse_id: document?.destination_warehouse_id ?? null,
      document_date: document?.document_date ?? today(),
      adjustment_reason: document?.adjustment_reason ?? null,
      reference: document?.reference ?? '',
      notes: document?.notes ?? '',
      lines: document?.lines?.length
        ? document.lines.map((l) => ({
            product_id: l.product_id,
            allows_decimals: l.product?.unit?.allows_decimals ?? false,
            quantity: l.quantity ? String(Number(l.quantity)) : '',
            counted_quantity: l.counted_quantity ? String(Number(l.counted_quantity)) : '',
            unit_cost: l.unit_cost ? String(Number(l.unit_cost)) : '',
          }))
        : [emptyLine()],
    },
    mode: 'onTouched',
  })
  const { fields, append, remove: removeLine } = useFieldArray({ control: form.control, name: 'lines' })
  const lines = useWatch({ control: form.control, name: 'lines' })
  const warehouseId = useWatch({ control: form.control, name: 'warehouse_id' })
  const reason = useWatch({ control: form.control, name: 'adjustment_reason' })
  const { errors, isSubmitting, isDirty } = form.formState

  const productIds = useMemo(() => [...new Set(lines.map((l) => l.product_id).filter((v) => v > 0))], [lines])
  const { data: availability } = useStockAvailability(warehouseId || undefined, productIds)
  const stockOf = (productId: number) => availability?.find((a) => a.product_id === productId)

  // Requested quantity per product (a product may appear in several lines).
  const requestedByProduct = useMemo(() => {
    const totals = new Map<number, number>()
    for (const l of lines) {
      if (!l.product_id) continue
      totals.set(
        l.product_id,
        (totals.get(l.product_id) ?? 0) + (Number(normalizeDecimal(l.quantity ?? '')) || 0),
      )
    }
    return totals
  }, [lines])

  const estimatedTotal = lines.reduce((sum, l) => {
    const qty = Number(normalizeDecimal(isAdjustment ? (l.counted_quantity ?? '') : (l.quantity ?? ''))) || 0
    if (isEntry) return sum + qty * (Number(normalizeDecimal(l.unit_cost ?? '')) || 0)
    const stock = stockOf(l.product_id)
    if (!stock) return sum
    const units = isAdjustment ? Math.abs(qty - Number(stock.quantity)) : qty
    return sum + units * Number(stock.avg_cost)
  }, 0)

  const applyServerErrors = (error: unknown): boolean => {
    if (!(error instanceof ApiError)) return false
    if (error.code === 'insufficient_stock') {
      setShortages((error.details as unknown as { lines: StockShortage[] }).lines ?? [])
      return true
    }
    if (error.isValidation) {
      for (const [field, messages] of Object.entries(error.details)) {
        form.setError(field as never, { message: messages[0] })
      }
      toast.error('Revisa los campos marcados.')
      return true
    }
    return false
  }

  const persist = async (values: DocumentFormValues): Promise<InventoryDocument> => {
    const saved = await save.mutateAsync({
      payload: toDocumentPayload(values),
      id: document?.id,
      idempotencyKey,
    })
    form.reset(values)
    return saved
  }

  const onSaveDraft = form.handleSubmit(async (values) => {
    setShortages([])
    try {
      const saved = await persist(values)
      toast.success('Borrador guardado')
      if (!document) navigate(`/inventario/documentos/${saved.id}`, { replace: true })
    } catch (error) {
      if (!applyServerErrors(error))
        toast.error(error instanceof ApiError ? error.message : 'No se pudo guardar.')
    }
  })

  const onRequestPost = form.handleSubmit(() => {
    setShortages([])
    setConfirmOpen(true)
  })

  const doPost = async () => {
    try {
      const saved = isDirty || !document ? await persist(form.getValues() as DocumentFormValues) : document
      const posted = await post.mutateAsync(saved.id)
      toast.success(`Documento ${posted.number} confirmado`, {
        description: 'Los movimientos de stock fueron registrados.',
      })
      navigate(`/inventario/documentos/${posted.id}`, { replace: true })
    } catch (error) {
      setConfirmOpen(false)
      if (!applyServerErrors(error))
        toast.error(error instanceof ApiError ? error.message : 'No se pudo confirmar.')
    }
  }

  const doDelete = async () => {
    if (
      !document ||
      !window.confirm('¿Eliminar este borrador? La eliminación queda registrada en la auditoría.')
    )
      return
    await remove.mutateAsync(document.id)
    toast.success('Borrador eliminado')
    navigate('/inventario/documentos', { replace: true })
  }

  const busy = isSubmitting || save.isPending || post.isPending

  return (
    <form onSubmit={onSaveDraft} className="flex flex-col gap-6" noValidate>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <Link
            to="/inventario/documentos"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Documentos
          </Link>
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl border bg-surface-2">
              <TypeIcon className="size-5 text-brand-accent" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {document ? `Borrador de ${meta.label.toLowerCase()}` : meta.newTitle}
              </h1>
              <p className="text-sm text-muted-foreground">
                {meta.description}. El número se asigna al confirmar.
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {document && (
            <Button
              type="button"
              variant="ghost"
              onClick={doDelete}
              disabled={busy}
              className="text-destructive"
            >
              <Trash2 />
              Eliminar
            </Button>
          )}
          <Button type="submit" variant="outline" disabled={busy}>
            {save.isPending && !confirmOpen ? <LoaderCircle className="animate-spin" /> : <Save />}
            Guardar borrador
          </Button>
          {can('movements.post') && (
            <Button type="button" onClick={onRequestPost} disabled={busy}>
              <CheckCheck />
              Confirmar
            </Button>
          )}
        </div>
      </div>

      {shortages.length > 0 && (
        <StockShortageAlert lines={shortages} title="No se puede confirmar: stock insuficiente" />
      )}

      <Card className="gap-4">
        <CardHeader>
          <CardTitle className="text-base">Datos del documento</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Controller
            control={form.control}
            name="warehouse_id"
            render={({ field }) => (
              <Field data-invalid={!!errors.warehouse_id}>
                <FieldLabel>{type === 'transfer' ? 'Almacén de origen' : 'Almacén'}</FieldLabel>
                <Select
                  value={field.value ? String(field.value) : ''}
                  onValueChange={(v) => field.onChange(Number(v))}
                >
                  <SelectTrigger className="w-full" aria-invalid={!!errors.warehouse_id}>
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
                <FieldError errors={[errors.warehouse_id]} />
              </Field>
            )}
          />
          {type === 'transfer' && (
            <Controller
              control={form.control}
              name="destination_warehouse_id"
              render={({ field }) => (
                <Field data-invalid={!!errors.destination_warehouse_id}>
                  <FieldLabel>Almacén de destino</FieldLabel>
                  <Select
                    value={field.value ? String(field.value) : ''}
                    onValueChange={(v) => field.onChange(Number(v))}
                  >
                    <SelectTrigger className="w-full" aria-invalid={!!errors.destination_warehouse_id}>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {warehouses
                        ?.filter((w) => w.is_active && w.id !== warehouseId)
                        .map((w) => (
                          <SelectItem key={w.id} value={String(w.id)}>
                            {w.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FieldError errors={[errors.destination_warehouse_id]} />
                </Field>
              )}
            />
          )}
          <Field data-invalid={!!errors.document_date}>
            <FieldLabel htmlFor="document_date">Fecha del documento</FieldLabel>
            <Input
              id="document_date"
              type="date"
              min={daysAgo(backdate)}
              max={today()}
              className="num"
              {...form.register('document_date')}
            />
            <FieldError errors={[errors.document_date]} />
          </Field>
          {isAdjustment && (
            <Controller
              control={form.control}
              name="adjustment_reason"
              render={({ field }) => (
                <Field data-invalid={!!errors.adjustment_reason}>
                  <FieldLabel>Motivo del ajuste</FieldLabel>
                  <Select value={field.value ?? ''} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full" aria-invalid={!!errors.adjustment_reason}>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {reasons?.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError errors={[errors.adjustment_reason]} />
                </Field>
              )}
            />
          )}
          <Field data-invalid={!!errors.reference}>
            <FieldLabel htmlFor="reference">Referencia</FieldLabel>
            <Input
              id="reference"
              placeholder={isEntry ? 'N° factura del proveedor' : 'Opcional'}
              {...form.register('reference')}
            />
            <FieldError errors={[errors.reference]} />
          </Field>
          <Field data-invalid={!!errors.notes} className="sm:col-span-2 lg:col-span-4">
            <FieldLabel htmlFor="notes">
              Notas {isAdjustment && reason === 'other' && <span className="text-destructive">*</span>}
            </FieldLabel>
            <Textarea id="notes" rows={2} {...form.register('notes')} />
            <FieldError errors={[errors.notes]} />
          </Field>
        </CardContent>
      </Card>

      <Card className="gap-3">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Productos</CardTitle>
          {errors.lines?.root?.message || errors.lines?.message ? (
            <span className="text-sm text-destructive">
              {errors.lines?.root?.message ?? errors.lines?.message}
            </span>
          ) : null}
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10 pl-6">#</TableHead>
                  <TableHead className="min-w-72">Producto</TableHead>
                  <TableHead className="text-right">Disponible</TableHead>
                  <TableHead className="w-36 text-right">{isAdjustment ? 'Contado' : 'Cantidad'}</TableHead>
                  {isAdjustment && <TableHead className="text-right">Diferencia</TableHead>}
                  {(isEntry || isAdjustment) && (
                    <TableHead className="w-36 text-right">
                      {isAdjustment ? 'Costo si sobra' : 'Costo unit.'}
                    </TableHead>
                  )}
                  <TableHead className="text-right">{isEntry ? 'Subtotal' : 'Costo est.'}</TableHead>
                  <TableHead className="w-12 pr-6" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, index) => {
                  const line = lines[index]
                  const stock = line?.product_id ? stockOf(line.product_id) : undefined
                  const available = stock ? Number(stock.quantity) : undefined
                  const qty =
                    Number(
                      normalizeDecimal(
                        isAdjustment ? (line?.counted_quantity ?? '') : (line?.quantity ?? ''),
                      ),
                    ) || 0
                  const requested = line?.product_id ? (requestedByProduct.get(line.product_id) ?? 0) : 0
                  const outgoing = type === 'exit' || type === 'transfer'
                  const short =
                    (outgoing && available !== undefined && !allowNegative && requested > available) ||
                    shortages.some((s) => s.product_id === line?.product_id)
                  const difference =
                    isAdjustment && available !== undefined && line?.counted_quantity !== ''
                      ? qty - available
                      : null
                  const lineCost = isEntry
                    ? qty * (Number(normalizeDecimal(line?.unit_cost ?? '')) || 0)
                    : stock
                      ? (isAdjustment ? Math.abs(difference ?? 0) : qty) * Number(stock.avg_cost)
                      : 0
                  const lineErrors = errors.lines?.[index]
                  const unit = line?.product_id ? units[line.product_id] : undefined
                  const qtyField = isAdjustment ? 'counted_quantity' : 'quantity'

                  return (
                    <TableRow
                      key={field.id}
                      className={cn(short && 'bg-destructive/[0.06] hover:bg-destructive/[0.08]')}
                    >
                      <TableCell className="num pl-6 align-top text-xs text-muted-foreground">
                        <span className="inline-block pt-2.5">{index + 1}</span>
                      </TableCell>
                      <TableCell className="align-top">
                        <Controller
                          control={form.control}
                          name={`lines.${index}.product_id`}
                          render={({ field: f }) => (
                            <ProductCombobox
                              value={f.value || null}
                              selectedLabel={f.value ? productLabels[f.value] : undefined}
                              invalid={!!lineErrors?.product_id}
                              usedIds={productIds}
                              onChange={(product) => {
                                f.onChange(product.id)
                                form.setValue(
                                  `lines.${index}.allows_decimals`,
                                  product.unit?.allows_decimals ?? false,
                                )
                                setProductLabels((m) => ({
                                  ...m,
                                  [product.id]: `${product.sku} · ${product.name}`,
                                }))
                                setUnits((m) => ({ ...m, [product.id]: product.unit?.code }))
                              }}
                            />
                          )}
                        />
                        {lineErrors?.product_id && (
                          <p className="mt-1 text-xs text-destructive">{lineErrors.product_id.message}</p>
                        )}
                      </TableCell>
                      <TableCell className="num pt-4 text-right align-top text-[13px]">
                        {available === undefined ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span
                            className={cn(short ? 'font-semibold text-destructive' : 'text-muted-foreground')}
                          >
                            {formatQty(available, unit)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        <Input
                          inputMode="decimal"
                          className="num h-9 text-right"
                          aria-label={isAdjustment ? 'Cantidad contada' : 'Cantidad'}
                          aria-invalid={!!lineErrors?.[qtyField] || short}
                          {...form.register(`lines.${index}.${qtyField}`)}
                        />
                        {lineErrors?.[qtyField] && (
                          <p className="mt-1 text-right text-xs text-destructive">
                            {lineErrors[qtyField]?.message}
                          </p>
                        )}
                        {short && !lineErrors?.[qtyField] && (
                          <p className="mt-1 text-right text-xs text-destructive">Supera el disponible</p>
                        )}
                      </TableCell>
                      {isAdjustment && (
                        <TableCell className="num pt-4 text-right align-top text-[13px] font-medium">
                          {difference === null ? (
                            '—'
                          ) : (
                            <span
                              className={cn(
                                difference > 0 && 'text-success',
                                difference < 0 && 'text-destructive',
                              )}
                            >
                              {difference > 0 ? '+' : ''}
                              {formatQty(difference)}
                            </span>
                          )}
                        </TableCell>
                      )}
                      {(isEntry || isAdjustment) && (
                        <TableCell className="align-top">
                          <Input
                            inputMode="decimal"
                            className="num h-9 text-right"
                            placeholder={isAdjustment && stock ? formatCost(stock.avg_cost) : '0,00'}
                            aria-label="Costo unitario"
                            aria-invalid={!!lineErrors?.unit_cost}
                            {...form.register(`lines.${index}.unit_cost`)}
                          />
                          {lineErrors?.unit_cost && (
                            <p className="mt-1 text-right text-xs text-destructive">
                              {lineErrors.unit_cost.message}
                            </p>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="num pt-4 text-right align-top text-[13px]">
                        {lineCost ? formatCurrency(lineCost) : '—'}
                      </TableCell>
                      <TableCell className="pr-6 align-top">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="mt-1 text-muted-foreground hover:text-destructive"
                          aria-label={`Quitar línea ${index + 1}`}
                          disabled={fields.length === 1}
                          onClick={() => removeLine(index)}
                        >
                          <Trash2 />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-col gap-3 border-t px-6 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append(emptyLine())}
              disabled={fields.length >= 500}
            >
              <Plus />
              Agregar producto
            </Button>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">
                {isEntry ? 'Total del documento' : 'Costo estimado (al promedio actual)'}
              </p>
              <p className="num text-lg font-semibold">{formatCurrency(estimatedTotal)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <ConfirmPostDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={doPost}
        summary={
          <dl className="grid grid-cols-2 gap-y-1.5">
            <dt className="text-muted-foreground">Tipo</dt>
            <dd className="text-right font-medium">{meta.label}</dd>
            <dt className="text-muted-foreground">Almacén</dt>
            <dd className="text-right font-medium">
              {warehouses?.find((w) => w.id === warehouseId)?.name}
              {type === 'transfer' &&
                ` → ${warehouses?.find((w) => w.id === form.getValues('destination_warehouse_id'))?.name ?? ''}`}
            </dd>
            <dt className="text-muted-foreground">Productos</dt>
            <dd className="num text-right font-medium">{lines.filter((l) => l.product_id).length}</dd>
            <dt className="text-muted-foreground">{isEntry ? 'Total' : 'Costo estimado'}</dt>
            <dd className="num text-right font-medium">{formatCurrency(estimatedTotal)}</dd>
          </dl>
        }
      />
    </form>
  )
}

/* -------------------------------------------------------------------------- */
/*                                 Read-only                                  */
/* -------------------------------------------------------------------------- */

const dateTimeFmt = new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium', timeStyle: 'short' })
const dateFmt = new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium' })

function DocumentView({ document: doc }: { document: InventoryDocument }) {
  const { can } = useAuth()
  const voidDoc = useVoidDocument()
  const [voidOpen, setVoidOpen] = useState(false)
  const TypeIcon = TYPE_ICONS[doc.type]
  const isAdjustment = doc.type === 'adjustment'

  const onVoid = async (reason: string) => {
    try {
      await voidDoc.mutateAsync({ id: doc.id, reason })
      toast.success(`Documento ${doc.number} anulado`)
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'No se pudo anular.', { duration: 10_000 })
      throw error
    }
  }

  const info: [string, React.ReactNode][] = [
    ['Fecha del documento', dateFmt.format(new Date(`${doc.document_date}T00:00:00`))],
    [
      doc.type === 'transfer' ? 'Origen → destino' : 'Almacén',
      `${doc.warehouse?.name}${doc.destination_warehouse ? ` → ${doc.destination_warehouse.name}` : ''}`,
    ],
    ['Referencia', doc.reference ?? '—'],
    ...(isAdjustment ? ([['Motivo', doc.adjustment_reason_label ?? '—']] as [string, string][]) : []),
    ['Creado por', `${doc.created_by?.name ?? '—'} · ${dateTimeFmt.format(new Date(doc.created_at))}`],
    [
      'Confirmado por',
      doc.posted_at ? `${doc.posted_by?.name} · ${dateTimeFmt.format(new Date(doc.posted_at))}` : '—',
    ],
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <Link
            to="/inventario/documentos"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Documentos
          </Link>
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl border bg-surface-2">
              <TypeIcon className="size-5 text-brand-accent" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="num text-2xl font-semibold tracking-tight">{doc.number ?? 'Borrador'}</h1>
                <DocumentStatusBadge status={doc.status} />
              </div>
              <p className="text-sm text-muted-foreground">{doc.type_label}</p>
            </div>
          </div>
        </div>
        {doc.status === 'posted' && can('movements.void') && (
          <Button variant="destructive" onClick={() => setVoidOpen(true)}>
            <Ban />
            Anular
          </Button>
        )}
      </div>

      {doc.status === 'voided' && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm">
          <p className="font-medium text-destructive">Documento anulado</p>
          <p className="mt-1">
            {doc.voided_by?.name} · {doc.voided_at && dateTimeFmt.format(new Date(doc.voided_at))}
          </p>
          <p className="mt-1 text-muted-foreground">Motivo: {doc.void_reason}</p>
        </div>
      )}

      <Card>
        <CardContent className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {info.map(([label, value]) => (
            <div key={label} className="space-y-0.5">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-sm font-medium">{value}</p>
            </div>
          ))}
          {doc.notes && (
            <div className="space-y-0.5 sm:col-span-2 lg:col-span-3">
              <p className="text-xs text-muted-foreground">Notas</p>
              <p className="text-sm">{doc.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="gap-3">
        <CardHeader>
          <CardTitle className="text-base">Productos</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Producto</TableHead>
                  {isAdjustment && <TableHead className="text-right">Sistema</TableHead>}
                  {isAdjustment && <TableHead className="text-right">Contado</TableHead>}
                  <TableHead className="text-right">{isAdjustment ? 'Diferencia' : 'Cantidad'}</TableHead>
                  <TableHead className="text-right">Costo unit.</TableHead>
                  <TableHead className="pr-6 text-right">Costo total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {doc.lines?.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell className="pl-6">
                      <Link
                        to={`/inventario/productos/${line.product_id}?tab=kardex`}
                        className="group flex flex-col"
                      >
                        <span className="font-medium group-hover:text-brand-accent group-hover:underline">
                          {line.product?.name}
                        </span>
                        <span className="num text-xs text-muted-foreground">{line.product?.sku}</span>
                      </Link>
                    </TableCell>
                    {isAdjustment && (
                      <TableCell className="num text-right">{formatQty(line.system_quantity)}</TableCell>
                    )}
                    {isAdjustment && (
                      <TableCell className="num text-right">{formatQty(line.counted_quantity)}</TableCell>
                    )}
                    <TableCell className="num text-right font-medium">
                      {formatQty(line.quantity, line.product?.unit?.code)}
                    </TableCell>
                    <TableCell className="num text-right">{formatCost(line.unit_cost)}</TableCell>
                    <TableCell className="num pr-6 text-right">
                      {line.total_cost ? formatCurrency(Number(line.total_cost)) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {doc.total_cost && (
            <div className="flex justify-end border-t px-6 pt-4">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Costo total</p>
                <p className="num text-lg font-semibold">{formatCurrency(Number(doc.total_cost))}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <VoidDialog open={voidOpen} onOpenChange={setVoidOpen} documentNumber={doc.number} onConfirm={onVoid} />
    </div>
  )
}
