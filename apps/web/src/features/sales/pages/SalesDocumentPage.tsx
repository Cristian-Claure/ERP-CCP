import { zodResolver } from '@hookform/resolvers/zod'
import {
  ArrowLeft,
  ArrowRightLeft,
  Ban,
  CheckCheck,
  FileWarning,
  HandCoins,
  LoaderCircle,
  Plus,
  Printer,
  Save,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { EmptyState } from '@/components/feedback/EmptyState'
import { PageSkeleton } from '@/components/feedback/PageSkeleton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/features/auth/hooks'
import { DocumentStatusBadge } from '@/features/inventory/components/DocumentStatusBadge'
import { ProductCombobox } from '@/features/inventory/components/ProductCombobox'
import { StockShortageAlert } from '@/features/inventory/components/StockShortageAlert'
import { formatQty } from '@/features/inventory/format'
import { useStockAvailability, useWarehouses } from '@/features/inventory/hooks'
import { normalizeDecimal } from '@/features/inventory/schemas'
import type { StockShortage } from '@/features/inventory/types'
import { ApiError } from '@/lib/api-error'
import { formatCurrency } from '@/lib/format'
import { cn } from 'cn'

import { type AuthorizationRequest, AuthorizationDialog } from '../components/AuthorizationDialog'
import { DebtStatusBadge, SalesTypeBadge } from '../components/Badges'
import { CustomerCombobox } from '../components/CustomerCombobox'
import { CustomerFormSheet } from '../components/CustomerFormSheet'
import { PaymentDialog } from '../components/PaymentDialog'
import { VoidReasonDialog } from '../components/VoidReasonDialog'
import { computeSalesTotals } from '../calc'
import {
  daysFromToday,
  formatBizDate,
  PAYMENT_METHODS,
  PAYMENT_TERMS,
  SALES_DOCUMENT_TYPES,
  salesTypeMeta,
  todayIso,
} from '../format'
import {
  useConvertQuote,
  useCustomer,
  useDeleteSalesDocument,
  usePostSalesDocument,
  useSalesDocument,
  useSaveSalesDocument,
  useVoidSalesDocument,
} from '../hooks'
import {
  emptySalesLine,
  type SalesFormInput,
  type SalesFormValues,
  salesFormSchema,
  toSalesPayload,
} from '../schemas'
import type {
  CreditLimitDetails,
  PostingAuthorizationPayload,
  PriceBelowCostDetails,
  SalesDocument,
  SalesDocumentType,
} from '../types'

export function SalesDocumentPage() {
  const params = useParams()
  const [search] = useSearchParams()
  const id = params.id ? Number(params.id) : undefined
  const { data: document, isPending, isError } = useSalesDocument(id)
  const { can } = useAuth()

  if (!id) {
    const type = search.get('tipo') as SalesDocumentType | null
    if (!type || !SALES_DOCUMENT_TYPES.some((t) => t.value === type) || !can('sales.create'))
      return <Navigate to="/ventas/documentos" replace />
    const customerId = Number(search.get('cliente')) || undefined
    return <SalesEditor key={`new-${type}`} type={type} initialCustomerId={customerId} />
  }

  if (isPending) return <PageSkeleton />
  if (isError || !document)
    return (
      <EmptyState
        icon={FileWarning}
        title="Documento no encontrado"
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/ventas/documentos">Volver</Link>
          </Button>
        }
      />
    )

  return document.status === 'draft' && can('sales.create') ? (
    <SalesEditor key={document.id} type={document.type} document={document} />
  ) : (
    <SalesView document={document} />
  )
}

/* -------------------------------------------------------------------------- */
/*                                   Editor                                   */
/* -------------------------------------------------------------------------- */

const num = (v: string | undefined | null) => Number(normalizeDecimal(v ?? '')) || 0

function SalesEditor({
  type,
  document,
  initialCustomerId,
}: {
  type: SalesDocumentType
  document?: SalesDocument
  initialCustomerId?: number
}) {
  const navigate = useNavigate()
  const { user, can } = useAuth()
  const { data: warehouses } = useWarehouses()
  const save = useSaveSalesDocument()
  const post = usePostSalesDocument()
  const remove = useDeleteSalesDocument()
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const [shortages, setShortages] = useState<StockShortage[]>([])
  const [authRequest, setAuthRequest] = useState<AuthorizationRequest | null>(null)
  const [granted, setGranted] = useState<PostingAuthorizationPayload>({})
  const [customerSheet, setCustomerSheet] = useState(false)
  const [productMeta, setProductMeta] = useState<
    Record<number, { label: string; unit?: string; minPrice: number | null }>
  >(() =>
    Object.fromEntries(
      (document?.lines ?? []).map((l) => [
        l.product_id,
        { label: `${l.product?.sku} · ${l.product?.name}`, unit: l.product?.unit?.code, minPrice: null },
      ]),
    ),
  )
  const meta = salesTypeMeta(type)
  const isQuote = type === 'quote'
  const canSeeMargin = can('sales.view_margin')
  const breakDownVat = type !== 'sales_note' || (user?.company.sales_note_vat_breakdown ?? false)

  const form = useForm<SalesFormInput, unknown, SalesFormValues>({
    resolver: zodResolver(salesFormSchema),
    defaultValues: {
      type,
      customer_id: document?.customer_id ?? initialCustomerId ?? 0,
      warehouse_id: document?.warehouse_id ?? 0,
      document_date: document?.document_date ?? todayIso(),
      valid_until: document?.valid_until ?? '',
      payment_terms: document?.payment_terms ?? 'cash',
      payment_method: document?.payment_method ?? 'cash',
      global_discount: document && Number(document.global_discount) > 0 ? document.global_discount : '',
      reference: document?.reference ?? '',
      notes: document?.notes ?? '',
      lines: document?.lines?.length
        ? document.lines.map((l) => ({
            product_id: l.product_id,
            allows_decimals: l.product?.unit?.allows_decimals ?? false,
            quantity: String(Number(l.quantity)),
            unit_price: l.unit_price,
            discount_amount: Number(l.discount_amount) > 0 ? l.discount_amount : '',
          }))
        : [emptySalesLine()],
    },
    mode: 'onTouched',
  })
  const { fields, append, remove: removeLine } = useFieldArray({ control: form.control, name: 'lines' })
  const lines = useWatch({ control: form.control, name: 'lines' })
  const customerId = useWatch({ control: form.control, name: 'customer_id' })
  const warehouseId = useWatch({ control: form.control, name: 'warehouse_id' })
  const terms = useWatch({ control: form.control, name: 'payment_terms' })
  const globalDiscount = useWatch({ control: form.control, name: 'global_discount' })
  const { errors, isSubmitting, isDirty } = form.formState
  const { data: customer } = useCustomer(customerId || undefined)

  // A customer preselected from its page (?cliente=) brings its payment terms.
  const presetTermsFor = initialCustomerId && !document ? initialCustomerId : undefined
  useEffect(() => {
    if (presetTermsFor && customer?.id === presetTermsFor && !form.getFieldState('payment_terms').isDirty) {
      form.setValue('payment_terms', customer.payment_terms)
    }
  }, [presetTermsFor, customer, form])

  const productIds = useMemo(() => [...new Set(lines.map((l) => l.product_id).filter((v) => v > 0))], [lines])
  const { data: availability } = useStockAvailability(
    isQuote ? undefined : warehouseId || undefined,
    productIds,
  )
  const stockOf = (productId: number) => availability?.find((a) => a.product_id === productId)

  // Live totals: same algorithm as the server (exact to the cent).
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
    (s, l) => s + num(l.quantity) * Number(stockOf(l.product_id)?.avg_cost ?? 0),
    0,
  )
  const estimatedMargin = totals.net - estimatedCost

  const requestedByProduct = useMemo(() => {
    const m = new Map<number, number>()
    for (const l of lines) if (l.product_id) m.set(l.product_id, (m.get(l.product_id) ?? 0) + num(l.quantity))
    return m
  }, [lines])

  const creditAvailable = customer?.receivables ? Number(customer.receivables.available_credit) : null
  const overCredit =
    !isQuote && terms === 'credit' && creditAvailable !== null && totals.total > creditAvailable

  const applyServerErrors = (error: unknown, authorization: PostingAuthorizationPayload): boolean => {
    if (!(error instanceof ApiError)) return false
    const details = error.details as unknown
    if (error.code === 'insufficient_stock') {
      setShortages((details as { lines: StockShortage[] }).lines ?? [])
      return true
    }
    if (error.code === 'credit_limit_exceeded') {
      setGranted(authorization)
      setAuthRequest({ kind: 'credit', details: details as CreditLimitDetails })
      return true
    }
    if (error.code === 'price_below_cost') {
      setGranted(authorization)
      setAuthRequest({ kind: 'below_cost', details: details as PriceBelowCostDetails })
      return true
    }
    if (error.isValidation) {
      for (const [field, messages] of Object.entries(error.details)) {
        form.setError(field as never, { message: Array.isArray(messages) ? messages[0] : String(messages) })
      }
      toast.error(error.message || 'Revisa los campos marcados.')
      return true
    }
    return false
  }

  // Id of the draft once created. A failed post (stock, authorization) keeps the user on this
  // editor instance — remounting would lose the authorization dialog — so the URL is updated
  // with replaceState instead of a router navigation.
  const [draftId, setDraftId] = useState(document?.id)

  const persist = async (values: SalesFormValues) => {
    const saved = await save.mutateAsync({ payload: toSalesPayload(values), id: draftId, idempotencyKey })
    form.reset(values)
    if (!draftId) {
      setDraftId(saved.id)
      window.history.replaceState(window.history.state, '', `/ventas/documentos/${saved.id}`)
    }
    return saved
  }

  const onSaveDraft = form.handleSubmit(async (values) => {
    setShortages([])
    try {
      await persist(values)
      toast.success('Borrador guardado')
    } catch (error) {
      if (!applyServerErrors(error, {}))
        toast.error(error instanceof ApiError ? error.message : 'No se pudo guardar.')
    }
  })

  const doPost = async (authorization: PostingAuthorizationPayload) => {
    setShortages([])
    try {
      // Parsed values (Zod output): raw form values keep the decimal comma ("1,50").
      const id = isDirty || !draftId ? (await persist(salesFormSchema.parse(form.getValues()))).id : draftId
      const posted = await post.mutateAsync({ id, authorization })
      setAuthRequest(null)
      toast.success(`${posted.type_label} ${posted.number} confirmada`, {
        description: isQuote
          ? 'La cotización fue emitida.'
          : 'Stock descontado y cuenta por cobrar registrada.',
      })
      navigate(`/ventas/documentos/${posted.id}`, { replace: true })
    } catch (error) {
      if (!applyServerErrors(error, authorization))
        toast.error(error instanceof ApiError ? error.message : 'No se pudo confirmar.')
    }
  }

  const onPost = form.handleSubmit(() => doPost({}))

  const doDelete = async () => {
    if (
      !draftId ||
      !window.confirm('¿Eliminar este borrador? La eliminación queda registrada en la auditoría.')
    )
      return
    await remove.mutateAsync(draftId)
    toast.success('Borrador eliminado')
    navigate('/ventas/documentos', { replace: true })
  }

  const busy = isSubmitting || save.isPending || post.isPending

  return (
    <form onSubmit={onSaveDraft} className="flex flex-col gap-6" noValidate>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <Link
            to="/ventas/documentos"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Ventas
          </Link>
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl border bg-surface-2">
              <meta.icon className="size-5 text-brand-accent" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {draftId ? `Borrador de ${meta.label.toLowerCase()}` : meta.newTitle}
              </h1>
              <p className="text-sm text-muted-foreground">{meta.description}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {draftId && (
            <Button
              type="button"
              variant="ghost"
              onClick={doDelete}
              disabled={busy}
              className="text-destructive"
            >
              <Trash2 /> Eliminar
            </Button>
          )}
          <Button type="submit" variant="outline" disabled={busy}>
            {save.isPending && !post.isPending ? <LoaderCircle className="animate-spin" /> : <Save />}
            Guardar borrador
          </Button>
          {can('sales.post') && (
            <Button type="button" onClick={onPost} disabled={busy}>
              {post.isPending ? <LoaderCircle className="animate-spin" /> : <CheckCheck />}
              {isQuote ? 'Emitir cotización' : 'Confirmar venta'}
            </Button>
          )}
        </div>
      </div>

      {shortages.length > 0 && (
        <StockShortageAlert lines={shortages} title="No se puede confirmar: stock insuficiente" />
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <Card className="gap-4">
          <CardHeader>
            <CardTitle className="text-base">Datos del documento</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Controller
              control={form.control}
              name="customer_id"
              render={({ field }) => (
                <Field data-invalid={!!errors.customer_id} className="sm:col-span-2">
                  <FieldLabel>Cliente</FieldLabel>
                  <CustomerCombobox
                    value={field.value || null}
                    selectedLabel={customer?.name ?? document?.customer?.name}
                    invalid={!!errors.customer_id}
                    onCreate={can('customers.manage') ? () => setCustomerSheet(true) : undefined}
                    onChange={(c) => {
                      field.onChange(c.id)
                      form.setValue('payment_terms', c.payment_terms, { shouldDirty: true })
                    }}
                  />
                  <FieldError errors={[errors.customer_id]} />
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="warehouse_id"
              render={({ field }) => (
                <Field data-invalid={!!errors.warehouse_id}>
                  <FieldLabel>Almacén</FieldLabel>
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
            <Field data-invalid={!!errors.document_date}>
              <FieldLabel htmlFor="document_date">Fecha</FieldLabel>
              <Input id="document_date" type="date" max={todayIso()} {...form.register('document_date')} />
              <FieldError errors={[errors.document_date]} />
            </Field>
            <Controller
              control={form.control}
              name="payment_terms"
              render={({ field }) => (
                <Field>
                  <FieldLabel>Condición</FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_TERMS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />
            {isQuote ? (
              <Field data-invalid={!!errors.valid_until}>
                <FieldLabel htmlFor="valid_until">Válida hasta</FieldLabel>
                <Input id="valid_until" type="date" {...form.register('valid_until')} />
                <FieldError errors={[errors.valid_until]} />
              </Field>
            ) : terms === 'cash' ? (
              <Controller
                control={form.control}
                name="payment_method"
                render={({ field }) => (
                  <Field>
                    <FieldLabel>Método de pago</FieldLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />
            ) : (
              <div className="space-y-1">
                <p className="text-sm font-medium">Vencimiento</p>
                <p className="num pt-2 text-sm text-muted-foreground">
                  {customer ? `${customer.credit_days} días después de la fecha` : '—'}
                </p>
              </div>
            )}
            <Field>
              <FieldLabel htmlFor="reference">Referencia</FieldLabel>
              <Input
                id="reference"
                placeholder="Orden de compra del cliente…"
                {...form.register('reference')}
              />
            </Field>
            <Field className="sm:col-span-2 lg:col-span-3">
              <FieldLabel htmlFor="notes">Notas</FieldLabel>
              <Textarea id="notes" rows={2} {...form.register('notes')} />
            </Field>
          </CardContent>
        </Card>

        <CustomerSummary customer={customer} overCredit={overCredit} isQuote={isQuote} terms={terms} />
      </div>

      <Card className="gap-3">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Productos</CardTitle>
          {(errors.lines?.root?.message || errors.lines?.message) && (
            <span className="text-sm text-destructive">
              {errors.lines?.root?.message ?? errors.lines?.message}
            </span>
          )}
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10 pl-6">#</TableHead>
                  <TableHead className="min-w-64">Producto</TableHead>
                  {!isQuote && <TableHead className="text-right">Disponible</TableHead>}
                  <TableHead className="w-28 text-right">Cantidad</TableHead>
                  <TableHead className="w-32 text-right">Precio (c/IVA)</TableHead>
                  <TableHead className="w-28 text-right">Descuento</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  {canSeeMargin && !isQuote && <TableHead className="text-right">Margen est.</TableHead>}
                  <TableHead className="w-12 pr-6" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field, index) => {
                  const line = lines[index]
                  const pm = line?.product_id ? productMeta[line.product_id] : undefined
                  const stock = line?.product_id ? stockOf(line.product_id) : undefined
                  const available = stock ? Number(stock.quantity) : undefined
                  const requested = line?.product_id ? (requestedByProduct.get(line.product_id) ?? 0) : 0
                  const short =
                    !isQuote &&
                    ((available !== undefined &&
                      !user?.company.allow_negative_stock &&
                      requested > available) ||
                      shortages.some((s) => s.product_id === line?.product_id))
                  const amounts = totals.lines[index]
                  const qty = num(line?.quantity)
                  const belowMin =
                    pm?.minPrice != null && qty > 0 && amounts && amounts.total < pm.minPrice * qty - 0.004
                  const lineMargin = amounts && stock ? amounts.net - qty * Number(stock.avg_cost) : null
                  const lineErrors = errors.lines?.[index]
                  const discountError = totals.errors[`lines.${index}.discount_amount`]

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
                              selectedLabel={f.value ? productMeta[f.value]?.label : undefined}
                              invalid={!!lineErrors?.product_id}
                              usedIds={productIds}
                              onChange={(product) => {
                                f.onChange(product.id)
                                form.setValue(
                                  `lines.${index}.allows_decimals`,
                                  product.unit?.allows_decimals ?? false,
                                )
                                if (product.sale_price)
                                  form.setValue(`lines.${index}.unit_price`, product.sale_price, {
                                    shouldDirty: true,
                                  })
                                setProductMeta((m) => ({
                                  ...m,
                                  [product.id]: {
                                    label: `${product.sku} · ${product.name}`,
                                    unit: product.unit?.code,
                                    minPrice: product.min_price ? Number(product.min_price) : null,
                                  },
                                }))
                              }}
                            />
                          )}
                        />
                        {lineErrors?.product_id && (
                          <p className="mt-1 text-xs text-destructive">{lineErrors.product_id.message}</p>
                        )}
                        {belowMin && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-warning">
                            <TriangleAlert className="size-3" /> Bajo el precio mínimo (
                            {formatCurrency(pm!.minPrice!)}): requerirá autorización.
                          </p>
                        )}
                      </TableCell>
                      {!isQuote && (
                        <TableCell className="num pt-4 text-right align-top text-[13px]">
                          {available === undefined ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span
                              className={cn(
                                short ? 'font-semibold text-destructive' : 'text-muted-foreground',
                              )}
                            >
                              {formatQty(available, pm?.unit)}
                            </span>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="align-top">
                        <Input
                          inputMode="decimal"
                          className="num h-9 text-right"
                          aria-label="Cantidad"
                          aria-invalid={!!lineErrors?.quantity || short}
                          {...form.register(`lines.${index}.quantity`)}
                        />
                        {lineErrors?.quantity && (
                          <p className="mt-1 text-right text-xs text-destructive">
                            {lineErrors.quantity.message}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        <Input
                          inputMode="decimal"
                          className="num h-9 text-right"
                          aria-label="Precio unitario"
                          aria-invalid={!!lineErrors?.unit_price}
                          {...form.register(`lines.${index}.unit_price`)}
                        />
                        {lineErrors?.unit_price && (
                          <p className="mt-1 text-right text-xs text-destructive">
                            {lineErrors.unit_price.message}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        <Input
                          inputMode="decimal"
                          className="num h-9 text-right"
                          placeholder="0,00"
                          aria-label="Descuento de la línea"
                          aria-invalid={!!discountError}
                          {...form.register(`lines.${index}.discount_amount`)}
                        />
                        {discountError && (
                          <p className="mt-1 text-right text-xs text-destructive">Mayor al importe</p>
                        )}
                      </TableCell>
                      <TableCell className="num pt-4 text-right align-top text-[13px] font-medium">
                        {amounts && amounts.total ? formatCurrency(amounts.total) : '—'}
                        {amounts && amounts.globalShare > 0 && (
                          <span className="block text-[11px] font-normal text-muted-foreground">
                            −{formatCurrency(amounts.globalShare)} global
                          </span>
                        )}
                      </TableCell>
                      {canSeeMargin && !isQuote && (
                        <TableCell
                          className={cn(
                            'num pt-4 text-right align-top text-[13px]',
                            lineMargin !== null && lineMargin < 0 && 'text-destructive',
                          )}
                        >
                          {lineMargin === null ? '—' : formatCurrency(lineMargin)}
                        </TableCell>
                      )}
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
          <div className="flex flex-col gap-4 border-t px-6 pt-4 lg:flex-row lg:items-start lg:justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append(emptySalesLine())}
              disabled={fields.length >= 300}
            >
              <Plus /> Agregar producto
            </Button>
            <dl className="grid w-full max-w-sm grid-cols-[1fr_auto] items-center gap-x-6 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="num text-right">{formatCurrency(totals.subtotal)}</dd>
              {totals.lineDiscountTotal > 0 && (
                <>
                  <dt className="text-muted-foreground">Descuentos por línea</dt>
                  <dd className="num text-right">−{formatCurrency(totals.lineDiscountTotal)}</dd>
                </>
              )}
              <dt className="text-muted-foreground">
                <label htmlFor="global_discount">Descuento global</label>
              </dt>
              <dd>
                <Input
                  id="global_discount"
                  inputMode="decimal"
                  placeholder="0,00"
                  className={cn(
                    'num ml-auto h-8 w-28 text-right',
                    totals.errors.global_discount && 'border-destructive',
                  )}
                  {...form.register('global_discount')}
                />
              </dd>
              <div className="col-span-2 mt-1 border-t" aria-hidden />
              <dt className="font-medium">Total</dt>
              <dd className="num text-right text-xl font-semibold">{formatCurrency(totals.total)}</dd>
              {breakDownVat ? (
                <>
                  <dt className="text-xs text-muted-foreground">Neto (sin IVA)</dt>
                  <dd className="num text-right text-xs text-muted-foreground">
                    {formatCurrency(totals.net)}
                  </dd>
                  <dt className="text-xs text-muted-foreground">IVA 13 % incluido</dt>
                  <dd className="num text-right text-xs text-muted-foreground">
                    {formatCurrency(totals.vat)}
                  </dd>
                </>
              ) : (
                <dt className="col-span-2 text-xs text-muted-foreground">
                  Nota de venta sin desglose de IVA.
                </dt>
              )}
              {canSeeMargin && !isQuote && productIds.length > 0 && (
                <>
                  <dt className="text-xs text-muted-foreground">Margen estimado</dt>
                  <dd
                    className={cn(
                      'num text-right text-xs font-medium',
                      estimatedMargin < 0 ? 'text-destructive' : 'text-success',
                    )}
                  >
                    {formatCurrency(estimatedMargin)}
                    {totals.net > 0 &&
                      ` · ${((estimatedMargin / totals.net) * 100).toFixed(1).replace('.', ',')} %`}
                  </dd>
                </>
              )}
            </dl>
          </div>
        </CardContent>
      </Card>

      <AuthorizationDialog
        request={authRequest}
        canAuthorize={
          authRequest?.kind === 'credit'
            ? can('sales.override_credit_limit')
            : can('sales.authorize_below_cost')
        }
        onClose={() => setAuthRequest(null)}
        onAuthorize={async (reason) => {
          const next: PostingAuthorizationPayload = {
            ...granted,
            ...(authRequest?.kind === 'credit'
              ? { credit_override_reason: reason }
              : { below_cost_reason: reason }),
          }
          setAuthRequest(null)
          await doPost(next)
        }}
      />
      <CustomerFormSheet
        open={customerSheet}
        onOpenChange={setCustomerSheet}
        onSaved={(c) => {
          form.setValue('customer_id', c.id, { shouldDirty: true, shouldValidate: true })
          form.setValue('payment_terms', c.payment_terms, { shouldDirty: true })
        }}
      />
    </form>
  )
}

function CustomerSummary({
  customer,
  overCredit,
  isQuote,
  terms,
}: {
  customer: ReturnType<typeof useCustomer>['data']
  overCredit: boolean
  isQuote: boolean
  terms: 'cash' | 'credit'
}) {
  if (!customer) {
    return (
      <Card className="justify-center">
        <CardContent className="text-sm text-muted-foreground">
          Selecciona un cliente para ver su crédito y saldo.
        </CardContent>
      </Card>
    )
  }
  const r = customer.receivables
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <Link to={`/ventas/clientes/${customer.id}`} className="truncate hover:underline" target="_blank">
            {customer.name}
          </Link>
          <DebtStatusBadge status={r?.debt_status} />
        </CardTitle>
        <p className="num text-xs text-muted-foreground">
          {customer.document_label} · {customer.segment_label}
        </p>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Condición</span>
          <span>
            {customer.payment_terms === 'credit' ? `Crédito ${customer.credit_days} días` : 'Contado'}
          </span>
        </div>
        {r && customer.payment_terms === 'credit' && (
          <>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Límite</span>
              <span className="num">{formatCurrency(Number(customer.credit_limit))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Saldo</span>
              <span className="num">{formatCurrency(Number(r.balance))}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Disponible</span>
              <span className="num">{formatCurrency(Number(r.available_credit))}</span>
            </div>
          </>
        )}
        {r && Number(r.overdue_amount ?? 0) > 0 && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
            Tiene deuda vencida por {formatCurrency(Number(r.overdue_amount))}.
          </p>
        )}
        {overCredit && (
          <p className="flex items-start gap-1.5 rounded-md border border-warning/30 bg-warning/10 p-2 text-xs text-warning">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
            Esta venta supera el crédito disponible: requerirá autorización de gerencia.
          </p>
        )}
        {!isQuote && terms === 'credit' && customer.payment_terms !== 'credit' && (
          <p className="text-xs text-warning">
            El cliente es de contado: una venta a crédito requerirá autorización.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/*                                 Read-only                                  */
/* -------------------------------------------------------------------------- */

const dateTimeFmt = new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium', timeStyle: 'short' })

function SalesView({ document: doc }: { document: SalesDocument }) {
  const navigate = useNavigate()
  const { can } = useAuth()
  const voidDoc = useVoidSalesDocument()
  const convert = useConvertQuote()
  const [voidOpen, setVoidOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const meta = salesTypeMeta(doc.type)
  const isSale = doc.type !== 'quote'
  const open = Number(doc.open_amount ?? 0)
  const hasMargin = doc.margin_total !== undefined
  const activeConversion = doc.conversions?.find((c) => c.status !== 'voided')
  const quoteValid =
    doc.type === 'quote' &&
    doc.status === 'posted' &&
    (!doc.valid_until || daysFromToday(doc.valid_until) >= 0)

  const onVoid = async (reason: string) => {
    try {
      await voidDoc.mutateAsync({ id: doc.id, reason })
      toast.success(`${doc.type_label} ${doc.number} anulada`, {
        description: isSale ? 'Se revirtieron la salida de inventario y la cuenta por cobrar.' : undefined,
      })
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'No se pudo anular.', { duration: 12_000 })
      throw error
    }
  }

  const onConvert = async (type: 'invoice' | 'sales_note') => {
    try {
      const sale = await convert.mutateAsync({ id: doc.id, type })
      toast.success('Borrador de venta creado desde la cotización')
      navigate(`/ventas/documentos/${sale.id}`)
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'No se pudo convertir.')
    }
  }

  const info: [string, React.ReactNode][] = [
    [
      'Cliente',
      <Link
        key="c"
        to={`/ventas/clientes/${doc.customer_id}`}
        className="hover:text-brand-accent hover:underline"
      >
        {doc.customer?.name}
      </Link>,
    ],
    [
      'Documento del cliente',
      <span key="d" className="num">
        {doc.customer?.document_label}
      </span>,
    ],
    ['Fecha', formatBizDate(doc.document_date)],
    isSale ? ['Vencimiento', formatBizDate(doc.due_date)] : ['Válida hasta', formatBizDate(doc.valid_until)],
    [
      'Condición',
      doc.payment_terms_label +
        (doc.payment_method
          ? ` · ${PAYMENT_METHODS.find((m) => m.value === doc.payment_method)?.label}`
          : ''),
    ],
    ['Almacén', doc.warehouse?.name ?? '—'],
    ['Referencia', doc.reference ?? '—'],
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
            to="/ventas/documentos"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Ventas
          </Link>
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl border bg-surface-2">
              <meta.icon className="size-5 text-brand-accent" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="num text-2xl font-semibold tracking-tight">{doc.number ?? 'Borrador'}</h1>
                <SalesTypeBadge type={doc.type} label={doc.type_label} />
                <DocumentStatusBadge status={doc.status} />
              </div>
              <p className="text-sm text-muted-foreground">{doc.customer?.name}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {doc.status !== 'draft' && (
            <Button variant="outline" asChild>
              <a href={`/ventas/documentos/${doc.id}/imprimir`} target="_blank" rel="noreferrer">
                <Printer /> Imprimir / PDF
              </a>
            </Button>
          )}
          {isSale && doc.status === 'posted' && open > 0 && can('receivables.collect') && (
            <Button variant="outline" onClick={() => setPayOpen(true)}>
              <HandCoins /> Registrar cobro
            </Button>
          )}
          {quoteValid && !activeConversion && can('sales.create') && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={convert.isPending}>
                  {convert.isPending ? <LoaderCircle className="animate-spin" /> : <ArrowRightLeft />}
                  Convertir en venta
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => onConvert('invoice')}>Factura (VTA)</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onConvert('sales_note')}>
                  Nota de venta (NV)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {doc.status === 'posted' && can('sales.void') && (
            <Button variant="destructive" onClick={() => setVoidOpen(true)}>
              <Ban /> Anular
            </Button>
          )}
        </div>
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

      {(doc.below_cost_authorization || doc.credit_override) && (
        <div className="grid gap-3 md:grid-cols-2">
          {doc.below_cost_authorization && (
            <AuthorizationNote
              title="Venta bajo costo / precio mínimo autorizada"
              auth={doc.below_cost_authorization}
            />
          )}
          {doc.credit_override && (
            <AuthorizationNote title="Exceso de límite de crédito autorizado" auth={doc.credit_override} />
          )}
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
          {doc.inventory_document && (
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Salida de inventario</p>
              <Link
                to={`/inventario/documentos/${doc.inventory_document.id}`}
                className="num text-sm font-medium hover:text-brand-accent hover:underline"
              >
                {doc.inventory_document.number}
              </Link>
            </div>
          )}
          {doc.quote && (
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Cotización de origen</p>
              <Link
                to={`/ventas/documentos/${doc.quote.id}`}
                className="num text-sm font-medium hover:text-brand-accent hover:underline"
              >
                {doc.quote.number}
              </Link>
            </div>
          )}
          {doc.conversions && doc.conversions.length > 0 && (
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">Convertida en</p>
              <p className="flex flex-wrap gap-2">
                {doc.conversions.map((c) => (
                  <Link
                    key={c.id}
                    to={`/ventas/documentos/${c.id}`}
                    className="num text-sm font-medium hover:text-brand-accent hover:underline"
                  >
                    {c.number ?? `Borrador #${c.id}`}
                  </Link>
                ))}
              </p>
            </div>
          )}
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
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead className="text-right">Desc.</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  {hasMargin && isSale && <TableHead className="text-right">Costo</TableHead>}
                  {hasMargin && isSale && <TableHead className="pr-6 text-right">Margen</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {doc.lines?.map((l) => {
                  const discount = Number(l.discount_amount) + Number(l.global_discount_share)
                  return (
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
                      <TableCell className="num text-right">{formatCurrency(Number(l.unit_price))}</TableCell>
                      <TableCell className="num text-right text-muted-foreground">
                        {discount > 0 ? `−${formatCurrency(discount)}` : '—'}
                      </TableCell>
                      <TableCell className="num text-right font-medium">
                        {formatCurrency(Number(l.total))}
                      </TableCell>
                      {hasMargin && isSale && (
                        <TableCell className="num text-right text-muted-foreground">
                          {l.cost_total ? formatCurrency(Number(l.cost_total)) : '—'}
                        </TableCell>
                      )}
                      {hasMargin && isSale && (
                        <TableCell
                          className={cn(
                            'num pr-6 text-right',
                            Number(l.margin ?? 0) < 0 ? 'text-destructive' : 'text-success',
                          )}
                        >
                          {l.margin ? formatCurrency(Number(l.margin)) : '—'}
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-col gap-6 border-t px-6 pt-4 lg:flex-row lg:justify-between">
            <div className="min-w-0 flex-1">
              {isSale && doc.payments && doc.payments.length > 0 && (
                <>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Cobros aplicados</p>
                  <ul className="space-y-1 text-sm">
                    {doc.payments.map((p) => (
                      <li
                        key={p.payment_id}
                        className={cn(
                          'flex justify-between gap-4',
                          p.status === 'voided' && 'text-muted-foreground line-through',
                        )}
                      >
                        <span className="num">
                          {p.number} · {formatBizDate(p.date)} · {p.method_label}
                        </span>
                        <span className="num">{formatCurrency(Number(p.amount))}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
            <dl className="grid w-full max-w-sm grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd className="num text-right">{formatCurrency(Number(doc.subtotal))}</dd>
              {Number(doc.line_discount_total) + Number(doc.global_discount) > 0 && (
                <>
                  <dt className="text-muted-foreground">Descuentos</dt>
                  <dd className="num text-right">
                    −{formatCurrency(Number(doc.line_discount_total) + Number(doc.global_discount))}
                  </dd>
                </>
              )}
              <div className="col-span-2 mt-1 border-t" aria-hidden />
              <dt className="font-medium">Total</dt>
              <dd className="num text-right text-xl font-semibold">{formatCurrency(Number(doc.total))}</dd>
              {Number(doc.iva_amount) > 0 && (
                <>
                  <dt className="text-xs text-muted-foreground">Neto (sin IVA)</dt>
                  <dd className="num text-right text-xs text-muted-foreground">
                    {formatCurrency(Number(doc.net_amount))}
                  </dd>
                  <dt className="text-xs text-muted-foreground">IVA 13 % incluido</dt>
                  <dd className="num text-right text-xs text-muted-foreground">
                    {formatCurrency(Number(doc.iva_amount))}
                  </dd>
                </>
              )}
              {hasMargin && isSale && doc.margin_total && (
                <>
                  <dt className="text-xs text-muted-foreground">Margen</dt>
                  <dd
                    className={cn(
                      'num text-right text-xs font-medium',
                      Number(doc.margin_total) < 0 ? 'text-destructive' : 'text-success',
                    )}
                  >
                    {formatCurrency(Number(doc.margin_total))}
                    {Number(doc.net_amount) > 0 &&
                      ` · ${((Number(doc.margin_total) / Number(doc.net_amount)) * 100).toFixed(1).replace('.', ',')} %`}
                  </dd>
                </>
              )}
              {isSale && doc.status === 'posted' && (
                <>
                  <dt className="text-muted-foreground">Cobrado</dt>
                  <dd className="num text-right">{formatCurrency(Number(doc.paid_amount))}</dd>
                  <dt className="font-medium">Saldo</dt>
                  <dd className={cn('num text-right font-semibold', open > 0 && 'text-warning')}>
                    {formatCurrency(open)}
                  </dd>
                </>
              )}
            </dl>
          </div>
        </CardContent>
      </Card>

      <VoidReasonDialog
        open={voidOpen}
        onOpenChange={setVoidOpen}
        title={`Anular ${doc.number}`}
        description={
          isSale
            ? 'Se anulará también su salida de inventario (al costo original), su cobro automático si fue al contado, y se revertirá la cuenta por cobrar. Si tiene cobros aplicados, primero anúlalos.'
            : 'La cotización dejará de poder convertirse en venta.'
        }
        confirmLabel="Anular documento"
        onConfirm={onVoid}
      />
      {isSale && doc.customer && (
        <PaymentDialog
          open={payOpen}
          onOpenChange={setPayOpen}
          customer={doc.customer}
          maxAmount={open}
          sale={{ id: doc.id, number: doc.number }}
        />
      )}
    </div>
  )
}

function AuthorizationNote({
  title,
  auth,
}: {
  title: string
  auth: NonNullable<SalesDocument['credit_override']>
}) {
  return (
    <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
      <p className="flex items-center gap-1.5 font-medium text-warning">
        <ShieldCheck className="size-4" /> {title}
      </p>
      <p className="mt-1">
        {auth.by?.name ?? '—'} · {auth.at && dateTimeFmt.format(new Date(auth.at))}
      </p>
      <p className="mt-0.5 text-muted-foreground">Motivo: {auth.reason}</p>
    </div>
  )
}
