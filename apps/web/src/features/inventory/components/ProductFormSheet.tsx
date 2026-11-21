import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
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

import { useCategories, useSaveProduct, useUnits } from '../hooks'
import { type ProductFormInput, type ProductFormValues, productFormSchema } from '../schemas'
import type { Product } from '../types'

interface ProductFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product?: Product
  onSaved?: (product: Product) => void
}

const NO_CATEGORY = 'none'

export function ProductFormSheet({ open, onOpenChange, product, onSaved }: ProductFormSheetProps) {
  const { data: units } = useUnits()
  const { data: categories } = useCategories()
  const save = useSaveProduct()

  const form = useForm<ProductFormInput, unknown, ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: blank(),
  })
  const { errors, isSubmitting } = form.formState

  useEffect(() => {
    if (!open) return
    form.reset(
      product
        ? {
            sku: product.sku,
            name: product.name,
            barcode: product.barcode ?? '',
            description: product.description ?? '',
            category_id: product.category?.id ?? null,
            unit_id: product.unit?.id ?? 0,
            min_stock: String(Number(product.min_stock)),
            is_active: product.is_active,
          }
        : blank(),
    )
  }, [open, product, form])

  const submit = form.handleSubmit(async (values) => {
    try {
      const saved = await save.mutateAsync({
        id: product?.id,
        payload: {
          ...values,
          barcode: values.barcode || null,
          description: values.description || null,
          min_stock: values.min_stock || '0',
        },
      })
      toast.success(product ? 'Producto actualizado' : 'Producto creado', {
        description: `${saved.sku} · ${saved.name}`,
      })
      onSaved?.(saved)
      onOpenChange(false)
    } catch (error) {
      if (error instanceof ApiError && error.isValidation) {
        for (const [field, messages] of Object.entries(error.details)) {
          form.setError(field as keyof ProductFormInput, { message: messages[0] })
        }
        return
      }
      toast.error(error instanceof ApiError ? error.message : 'No se pudo guardar el producto.')
    }
  })

  return (
    <Sheet open={open} onOpenChange={(o) => !isSubmitting && onOpenChange(o)}>
      <SheetContent className="w-full gap-0 sm:max-w-lg">
        <SheetHeader className="border-b">
          <SheetTitle>{product ? 'Editar producto' : 'Nuevo producto'}</SheetTitle>
          <SheetDescription>
            Los productos no se eliminan: se desactivan para conservar su historial.
          </SheetDescription>
        </SheetHeader>
        <form id="product-form" onSubmit={submit} className="flex-1 overflow-y-auto p-4">
          <FieldGroup className="gap-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_1.4fr]">
              <Field data-invalid={!!errors.sku}>
                <FieldLabel htmlFor="sku">Código (SKU)</FieldLabel>
                <Input
                  id="sku"
                  className="num uppercase"
                  autoFocus={!product}
                  aria-invalid={!!errors.sku}
                  {...form.register('sku')}
                />
                <FieldError errors={[errors.sku]} />
              </Field>
              <Field data-invalid={!!errors.barcode}>
                <FieldLabel htmlFor="barcode">Código de barras</FieldLabel>
                <Input id="barcode" className="num" {...form.register('barcode')} />
                <FieldError errors={[errors.barcode]} />
              </Field>
            </div>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="name">Nombre</FieldLabel>
              <Input id="name" aria-invalid={!!errors.name} {...form.register('name')} />
              <FieldError errors={[errors.name]} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                control={form.control}
                name="unit_id"
                render={({ field }) => (
                  <Field data-invalid={!!errors.unit_id}>
                    <FieldLabel>Unidad de medida</FieldLabel>
                    <Select
                      value={field.value ? String(field.value) : ''}
                      onValueChange={(v) => field.onChange(Number(v))}
                    >
                      <SelectTrigger className="w-full" aria-invalid={!!errors.unit_id}>
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        {units?.map((u) => (
                          <SelectItem key={u.id} value={String(u.id)}>
                            {u.name} <span className="num text-muted-foreground">({u.code})</span>
                            {u.allows_decimals && (
                              <span className="text-xs text-muted-foreground"> · fraccionable</span>
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError errors={[errors.unit_id]} />
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="category_id"
                render={({ field }) => (
                  <Field>
                    <FieldLabel>Categoría</FieldLabel>
                    <Select
                      value={field.value ? String(field.value) : NO_CATEGORY}
                      onValueChange={(v) => field.onChange(v === NO_CATEGORY ? null : Number(v))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_CATEGORY}>Sin categoría</SelectItem>
                        {categories?.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />
            </div>
            <Field data-invalid={!!errors.min_stock}>
              <FieldLabel htmlFor="min_stock">Stock mínimo</FieldLabel>
              <Input id="min_stock" inputMode="decimal" className="num" {...form.register('min_stock')} />
              <FieldDescription>
                Total entre almacenes. Debajo de este valor se alerta en el dashboard.
              </FieldDescription>
              <FieldError errors={[errors.min_stock]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="description">Descripción</FieldLabel>
              <Textarea id="description" rows={3} {...form.register('description')} />
            </Field>
            <Controller
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <Field orientation="horizontal" className="rounded-lg border p-3">
                  <Switch id="is_active" checked={field.value} onCheckedChange={field.onChange} />
                  <FieldLabel htmlFor="is_active" className="flex flex-col items-start gap-0.5">
                    Activo
                    <span className="text-xs font-normal text-muted-foreground">
                      Los inactivos no aparecen al registrar documentos.
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
          <Button type="submit" form="product-form" disabled={isSubmitting}>
            {isSubmitting && <LoaderCircle className="animate-spin" />}
            Guardar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function blank(): ProductFormInput {
  return {
    sku: '',
    name: '',
    barcode: '',
    description: '',
    category_id: null,
    unit_id: 0,
    min_stock: '0',
    is_active: true,
  }
}
