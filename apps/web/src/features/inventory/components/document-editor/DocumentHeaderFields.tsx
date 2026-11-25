import { Controller } from 'react-hook-form'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

import { useAdjustmentReasons, useWarehouses } from '../../hooks'
import type { DocumentType } from '../../types'
import { type DocumentEditorForm, todayIso } from './useDocumentEditorForm'

const daysAgo = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toLocaleDateString('en-CA')
}

/** "Datos del documento" card: warehouses, date, adjustment reason, reference and notes. */
export function DocumentHeaderFields({
  form,
  type,
  warehouseId,
  reason,
  backdateDays,
}: {
  form: DocumentEditorForm
  type: DocumentType
  warehouseId: number
  reason: string | null | undefined
  backdateDays: number
}) {
  const { data: warehouses } = useWarehouses()
  const { data: reasons } = useAdjustmentReasons()
  const { errors } = form.formState
  const isAdjustment = type === 'adjustment'

  return (
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
            min={daysAgo(backdateDays)}
            max={todayIso()}
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
            placeholder={type === 'entry' ? 'N° factura del proveedor' : 'Opcional'}
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
  )
}
