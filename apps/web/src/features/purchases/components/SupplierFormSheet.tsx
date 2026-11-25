import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { useEffect } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
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
import { LocationPicker } from '@/features/sales/components/LocationPicker'
import { ApiError } from '@/lib/api-error'

import { COUNTRIES } from '../format'
import { useSaveSupplier } from '../hooks'
import {
  blankSupplier,
  fromSupplier,
  type SupplierFormInput,
  type SupplierFormValues,
  supplierFormSchema,
  toSupplierPayload,
} from '../schemas'
import type { Supplier } from '../types'

interface SupplierFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  supplier?: Supplier
}

/** Create / edit a supplier, including its location (Atlas supplier layer). */
export function SupplierFormSheet({ open, onOpenChange, supplier }: SupplierFormSheetProps) {
  const save = useSaveSupplier()
  const form = useForm<SupplierFormInput, unknown, SupplierFormValues>({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: blankSupplier(),
  })
  const { errors, isSubmitting } = form.formState
  const latitude = useWatch({ control: form.control, name: 'latitude' })
  const longitude = useWatch({ control: form.control, name: 'longitude' })

  useEffect(() => {
    if (open) form.reset(supplier ? fromSupplier(supplier) : blankSupplier())
  }, [open, supplier, form])

  const submit = form.handleSubmit(async (values) => {
    try {
      const saved = await save.mutateAsync({ id: supplier?.id, payload: toSupplierPayload(values) })
      toast.success(supplier ? 'Proveedor actualizado' : 'Proveedor creado', { description: saved.name })
      onOpenChange(false)
    } catch (error) {
      if (error instanceof ApiError && error.isValidation) {
        for (const [field, messages] of Object.entries(error.details)) {
          form.setError(field as keyof SupplierFormInput, { message: messages[0] })
        }
        return
      }
      toast.error(error instanceof ApiError ? error.message : 'No se pudo guardar el proveedor.')
    }
  })

  const text = (
    name: keyof SupplierFormInput,
    label: string,
    props: React.ComponentProps<typeof Input> = {},
  ) => (
    <Field data-invalid={!!errors[name]}>
      <FieldLabel htmlFor={`supplier-${name}`}>{label}</FieldLabel>
      <Input id={`supplier-${name}`} {...props} {...form.register(name)} />
      <FieldError errors={[errors[name]]} />
    </Field>
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{supplier ? 'Editar proveedor' : 'Nuevo proveedor'}</SheetTitle>
          <SheetDescription>
            Datos fiscales, condiciones de pago, plazo de entrega y ubicación.
          </SheetDescription>
        </SheetHeader>
        <form id="supplier-form" onSubmit={submit} className="px-4" noValidate>
          <FieldGroup className="gap-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
              {text('tax_id', 'NIT', { className: 'num' })}
              {text('name', 'Razón social')}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {text('contact_name', 'Contacto')}
              {text('phone', 'Teléfono')}
              {text('email', 'Correo', { type: 'email' })}
              {text('address', 'Dirección')}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                control={form.control}
                name="country"
                render={({ field }) => (
                  <Field data-invalid={!!errors.country}>
                    <FieldLabel>País</FieldLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError errors={[errors.country]} />
                  </Field>
                )}
              />
              {text('city', 'Ciudad')}
              {text('payment_terms_days', 'Plazo de pago (días, 0 = contado)', {
                inputMode: 'numeric',
                className: 'num',
              })}
              {text('lead_time_days', 'Plazo de entrega (días)', { inputMode: 'numeric', className: 'num' })}
            </div>
            <Controller
              control={form.control}
              name="issues_invoice"
              render={({ field }) => (
                <Field orientation="horizontal" className="rounded-lg border p-3">
                  <Switch id="supplier_invoice" checked={field.value} onCheckedChange={field.onChange} />
                  <FieldLabel htmlFor="supplier_invoice" className="flex flex-col items-start gap-0.5">
                    Emite factura
                    <span className="text-xs font-normal text-muted-foreground">
                      Con factura, el IVA (13 % por dentro) es crédito fiscal y el costo es el neto; sin
                      factura, el costo es el total pagado.
                    </span>
                  </FieldLabel>
                </Field>
              )}
            />
            <Field>
              <FieldLabel>Ubicación</FieldLabel>
              {open && (
                <LocationPicker
                  latitude={latitude}
                  longitude={longitude}
                  onChange={(lat, lng) => {
                    form.setValue('latitude', lat, { shouldDirty: true })
                    form.setValue('longitude', lng, { shouldDirty: true })
                  }}
                />
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="supplier-notes">Notas</FieldLabel>
              <Textarea id="supplier-notes" rows={2} {...form.register('notes')} />
            </Field>
            <Controller
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <Field orientation="horizontal" className="rounded-lg border p-3">
                  <Switch id="supplier_active" checked={field.value} onCheckedChange={field.onChange} />
                  <FieldLabel htmlFor="supplier_active">Activo</FieldLabel>
                </Field>
              )}
            />
          </FieldGroup>
        </form>
        <SheetFooter className="flex-row justify-end border-t">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form="supplier-form" disabled={isSubmitting}>
            {isSubmitting && <LoaderCircle className="animate-spin" />}
            Guardar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
