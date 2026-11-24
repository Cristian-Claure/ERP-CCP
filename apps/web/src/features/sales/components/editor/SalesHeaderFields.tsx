import { Controller } from 'react-hook-form'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useWarehouses } from '@/features/inventory/hooks'

import { PAYMENT_METHODS, PAYMENT_TERMS, todayIso } from '../../format'
import type { useCustomer } from '../../hooks'
import type { PaymentTerms } from '../../types'
import { CustomerCombobox } from '../CustomerCombobox'
import type { SalesEditorForm } from './useSalesEditorForm'

/** "Datos del documento" card: customer, warehouse, date, terms and references. */
export function SalesHeaderFields({
  form,
  isQuote,
  terms,
  customer,
  fallbackCustomerName,
  onCreateCustomer,
}: {
  form: SalesEditorForm
  isQuote: boolean
  terms: PaymentTerms
  customer: ReturnType<typeof useCustomer>['data']
  fallbackCustomerName: string | undefined
  onCreateCustomer: (() => void) | undefined
}) {
  const { data: warehouses } = useWarehouses()
  const { errors } = form.formState

  return (
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
                selectedLabel={customer?.name ?? fallbackCustomerName}
                invalid={!!errors.customer_id}
                onCreate={onCreateCustomer}
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
          <Input id="reference" placeholder="Orden de compra del cliente…" {...form.register('reference')} />
        </Field>
        <Field className="sm:col-span-2 lg:col-span-3">
          <FieldLabel htmlFor="notes">Notas</FieldLabel>
          <Textarea id="notes" rows={2} {...form.register('notes')} />
        </Field>
      </CardContent>
    </Card>
  )
}
