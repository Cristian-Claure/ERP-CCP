import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle, Pencil, Plus, Warehouse as WarehouseIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/features/auth/hooks'
import { ApiError } from '@/lib/api-error'
import { formatCurrency } from '@/lib/format'

import { useInventoryDashboard, useSaveWarehouse, useWarehouses } from '../hooks'
import type { Warehouse } from '../types'

const schema = z.object({
  code: z.string().trim().min(1, 'Requerido.').max(20),
  name: z.string().trim().min(2, 'Requerido.').max(100),
  address: z.string().trim().max(255),
  is_active: z.boolean(),
})
type Values = z.infer<typeof schema>

export function WarehousesPage() {
  const { data: warehouses, isPending } = useWarehouses()
  const { data: dashboard } = useInventoryDashboard()
  const { can } = useAuth()
  const [editing, setEditing] = useState<Warehouse | 'new' | null>(null)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Almacenes"
        description="Cada almacén lleva su propio saldo y costo promedio por producto."
        actions={
          can('products.manage') && (
            <Button onClick={() => setEditing('new')}>
              <Plus />
              Nuevo almacén
            </Button>
          )
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {isPending
          ? Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)
          : warehouses?.map((w) => {
              const valuation = dashboard?.valuation.warehouses.find((v) => v.warehouse_id === w.id)
              return (
                <Card key={w.id} className="gap-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 items-center justify-center rounded-xl border bg-surface-2">
                        <WarehouseIcon className="size-5 text-brand-accent" />
                      </span>
                      <div>
                        <p className="font-medium">{w.name}</p>
                        <p className="num text-xs text-muted-foreground">{w.code}</p>
                      </div>
                    </div>
                    {can('products.manage') && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Editar ${w.name}`}
                        onClick={() => setEditing(w)}
                      >
                        <Pencil />
                      </Button>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{w.address ?? 'Sin dirección'}</p>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Valorizado</p>
                      <p className="num font-semibold">{formatCurrency(Number(valuation?.value ?? 0))}</p>
                    </div>
                    {!w.is_active && <Badge variant="outline">Inactivo</Badge>}
                    {valuation && (
                      <span className="text-xs text-muted-foreground">
                        {valuation.products} productos con stock
                      </span>
                    )}
                  </div>
                </Card>
              )
            })}
      </div>
      <WarehouseDialog
        warehouse={editing === 'new' ? undefined : (editing ?? undefined)}
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
      />
    </div>
  )
}

function WarehouseDialog({
  warehouse,
  open,
  onOpenChange,
}: {
  warehouse?: Warehouse
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const save = useSaveWarehouse()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { code: '', name: '', address: '', is_active: true },
  })
  const { errors, isSubmitting } = form.formState

  useEffect(() => {
    if (open)
      form.reset({
        code: warehouse?.code ?? '',
        name: warehouse?.name ?? '',
        address: warehouse?.address ?? '',
        is_active: warehouse?.is_active ?? true,
      })
  }, [open, warehouse, form])

  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync({ id: warehouse?.id, payload: { ...values, address: values.address || null } })
      toast.success(warehouse ? 'Almacén actualizado' : 'Almacén creado')
      onOpenChange(false)
    } catch (error) {
      if (error instanceof ApiError && error.isValidation) {
        for (const [f, m] of Object.entries(error.details))
          form.setError(f as keyof Values, { message: m[0] })
      } else toast.error('No se pudo guardar el almacén.')
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="contents">
          <DialogHeader>
            <DialogTitle>{warehouse ? 'Editar almacén' : 'Nuevo almacén'}</DialogTitle>
            <DialogDescription>
              Los almacenes con movimientos no se eliminan; se desactivan.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="gap-4">
            <div className="grid grid-cols-[1fr_2fr] gap-3">
              <Field data-invalid={!!errors.code}>
                <FieldLabel htmlFor="w-code">Código</FieldLabel>
                <Input id="w-code" className="num uppercase" {...form.register('code')} />
                <FieldError errors={[errors.code]} />
              </Field>
              <Field data-invalid={!!errors.name}>
                <FieldLabel htmlFor="w-name">Nombre</FieldLabel>
                <Input id="w-name" {...form.register('name')} />
                <FieldError errors={[errors.name]} />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="w-address">Dirección</FieldLabel>
              <Input id="w-address" {...form.register('address')} />
            </Field>
            <Controller
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <Field orientation="horizontal">
                  <Switch id="w-active" checked={field.value} onCheckedChange={field.onChange} />
                  <FieldLabel htmlFor="w-active">Activo</FieldLabel>
                </Field>
              )}
            />
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <LoaderCircle className="animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
