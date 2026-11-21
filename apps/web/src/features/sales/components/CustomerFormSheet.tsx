import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { useEffect } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ApiError } from '@/lib/api-error'

import { DEPARTMENTS, DOCUMENT_TYPE_OPTIONS, PAYMENT_TERMS, SEGMENTS } from '../format'
import { useSaveCustomer } from '../hooks'
import {
  type CustomerFormInput,
  type CustomerFormValues,
  customerFormSchema,
  toCustomerPayload,
} from '../schemas'
import type { Customer } from '../types'
import { LocationPicker } from './LocationPicker'

interface CustomerFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer?: Customer
  onSaved?: (customer: Customer) => void
}

function blank(): CustomerFormInput {
  return {
    document_type: 'nit',
    document_number: '',
    complement: '',
    name: '',
    email: '',
    phone: '',
    address: '',
    city: 'Santa Cruz de la Sierra',
    department: 'Santa Cruz',
    country: 'BO',
    latitude: '',
    longitude: '',
    payment_terms: 'cash',
    credit_days: '30',
    credit_limit: '',
    segment: 'retail',
    is_active: true,
    notes: '',
  }
}

function fromCustomer(c: Customer): CustomerFormInput {
  return {
    document_type: c.document_type,
    document_number: c.document_number,
    complement: c.complement ?? '',
    name: c.name,
    email: c.email ?? '',
    phone: c.phone ?? '',
    address: c.address ?? '',
    city: c.city ?? '',
    department: c.department ?? '',
    country: c.country,
    latitude: c.latitude ?? '',
    longitude: c.longitude ?? '',
    payment_terms: c.payment_terms,
    credit_days: String(c.credit_days),
    credit_limit: c.payment_terms === 'credit' ? c.credit_limit : '',
    segment: c.segment,
    is_active: c.is_active,
    notes: c.notes ?? '',
  }
}

/** Create / edit a customer, including its location on a 2D map (for Atlas). */
export function CustomerFormSheet({ open, onOpenChange, customer, onSaved }: CustomerFormSheetProps) {
  const save = useSaveCustomer()
  const form = useForm<CustomerFormInput, unknown, CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: blank(),
  })
  const { errors, isSubmitting } = form.formState
  const documentType = useWatch({ control: form.control, name: 'document_type' })
  const terms = useWatch({ control: form.control, name: 'payment_terms' })
  const latitude = useWatch({ control: form.control, name: 'latitude' })
  const longitude = useWatch({ control: form.control, name: 'longitude' })

  useEffect(() => {
    if (open) form.reset(customer ? fromCustomer(customer) : blank())
  }, [open, customer, form])

  const submit = form.handleSubmit(async (values) => {
    try {
      const saved = await save.mutateAsync({ id: customer?.id, payload: toCustomerPayload(values) })
      toast.success(customer ? 'Cliente actualizado' : 'Cliente creado', { description: saved.name })
      onSaved?.(saved)
      onOpenChange(false)
    } catch (error) {
      if (error instanceof ApiError && error.isValidation) {
        for (const [field, messages] of Object.entries(error.details)) {
          form.setError(field as keyof CustomerFormInput, { message: messages[0] })
        }
        return
      }
      toast.error(error instanceof ApiError ? error.message : 'No se pudo guardar el cliente.')
    }
  })

  const select = (
    name: 'document_type' | 'segment' | 'payment_terms' | 'department',
    label: string,
    options: { value: string; label: string }[],
  ) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <Field data-invalid={!!errors[name]}>
          <FieldLabel>{label}</FieldLabel>
          <Select value={field.value || undefined} onValueChange={field.onChange}>
            <SelectTrigger className="w-full" aria-invalid={!!errors[name]}>
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError errors={[errors[name]]} />
        </Field>
      )}
    />
  )

  return (
    <Sheet open={open} onOpenChange={(o) => !isSubmitting && onOpenChange(o)}>
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle>{customer ? 'Editar cliente' : 'Nuevo cliente'}</SheetTitle>
          <SheetDescription>
            Los clientes no se eliminan: se desactivan para conservar su historial.
          </SheetDescription>
        </SheetHeader>
        <form id="customer-form" onSubmit={submit} className="flex-1 overflow-y-auto p-4" noValidate>
          <FieldGroup className="gap-4">
            <div className="grid gap-4 sm:grid-cols-[1.1fr_1.2fr_0.6fr]">
              {select('document_type', 'Documento', DOCUMENT_TYPE_OPTIONS)}
              <Field data-invalid={!!errors.document_number}>
                <FieldLabel htmlFor="document_number">Número</FieldLabel>
                <Input
                  id="document_number"
                  className="num"
                  autoFocus={!customer}
                  aria-invalid={!!errors.document_number}
                  {...form.register('document_number')}
                />
                <FieldError errors={[errors.document_number]} />
              </Field>
              {documentType === 'ci_complement' && (
                <Field data-invalid={!!errors.complement}>
                  <FieldLabel htmlFor="complement">Compl.</FieldLabel>
                  <Input
                    id="complement"
                    className="num uppercase"
                    maxLength={5}
                    {...form.register('complement')}
                  />
                  <FieldError errors={[errors.complement]} />
                </Field>
              )}
            </div>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="name">Razón social o nombre</FieldLabel>
              <Input id="name" aria-invalid={!!errors.name} {...form.register('name')} />
              <FieldError errors={[errors.name]} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={!!errors.email}>
                <FieldLabel htmlFor="email">Correo</FieldLabel>
                <Input id="email" type="email" {...form.register('email')} />
                <FieldError errors={[errors.email]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="phone">Teléfono</FieldLabel>
                <Input id="phone" inputMode="tel" className="num" {...form.register('phone')} />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {select('segment', 'Segmento', SEGMENTS)}
              {select('payment_terms', 'Condición', PAYMENT_TERMS)}
              {terms === 'credit' && (
                <Field data-invalid={!!errors.credit_days}>
                  <FieldLabel htmlFor="credit_days">Plazo (días)</FieldLabel>
                  <Input
                    id="credit_days"
                    inputMode="numeric"
                    className="num"
                    {...form.register('credit_days')}
                  />
                  <FieldError errors={[errors.credit_days]} />
                </Field>
              )}
            </div>
            {terms === 'credit' && (
              <Field data-invalid={!!errors.credit_limit}>
                <FieldLabel htmlFor="credit_limit">Límite de crédito (Bs)</FieldLabel>
                <Input
                  id="credit_limit"
                  inputMode="decimal"
                  className="num"
                  placeholder="0,00"
                  {...form.register('credit_limit')}
                />
                <FieldDescription>
                  Una venta a crédito que lo supere requiere autorización de gerencia.
                </FieldDescription>
                <FieldError errors={[errors.credit_limit]} />
              </Field>
            )}

            <Field>
              <FieldLabel htmlFor="address">Dirección</FieldLabel>
              <Input id="address" {...form.register('address')} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-[1.4fr_1.2fr_0.5fr]">
              <Field>
                <FieldLabel htmlFor="city">Ciudad</FieldLabel>
                <Input id="city" {...form.register('city')} />
              </Field>
              {select(
                'department',
                'Departamento',
                DEPARTMENTS.map((d) => ({ value: d, label: d })),
              )}
              <Field data-invalid={!!errors.country}>
                <FieldLabel htmlFor="country">País</FieldLabel>
                <Input id="country" className="uppercase" maxLength={2} {...form.register('country')} />
                <FieldError errors={[errors.country]} />
              </Field>
            </div>
            <Field data-invalid={!!errors.latitude}>
              <FieldLabel>Ubicación</FieldLabel>
              {open && (
                <LocationPicker
                  latitude={latitude}
                  longitude={longitude}
                  onChange={(lat, lng) => {
                    form.setValue('latitude', lat, { shouldDirty: true, shouldValidate: true })
                    form.setValue('longitude', lng, { shouldDirty: true, shouldValidate: true })
                  }}
                />
              )}
              <FieldError errors={[errors.latitude]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="notes">Notas</FieldLabel>
              <Textarea id="notes" rows={2} {...form.register('notes')} />
            </Field>
            <Controller
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <Field orientation="horizontal" className="rounded-lg border p-3">
                  <Switch id="customer_active" checked={field.value} onCheckedChange={field.onChange} />
                  <FieldLabel htmlFor="customer_active" className="flex flex-col items-start gap-0.5">
                    Activo
                    <span className="text-xs font-normal text-muted-foreground">
                      Los inactivos no aparecen al registrar ventas.
                    </span>
                  </FieldLabel>
                </Field>
              )}
            />
          </FieldGroup>
        </form>
        <SheetFooter className="flex-row justify-end border-t">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form="customer-form" disabled={isSubmitting}>
            {isSubmitting && <LoaderCircle className="animate-spin" />}
            Guardar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
