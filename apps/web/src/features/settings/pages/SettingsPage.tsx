import { Boxes, LoaderCircle, ShoppingCart } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/features/auth/hooks'
import { useInventorySettings, useUpdateInventorySettings } from '@/features/inventory/hooks'
import { useSalesSettings, useUpdateSalesSettings } from '@/features/sales/hooks'

import { PurchasesSettingsCard } from '../components/PurchasesSettingsCard'

export function SettingsPage() {
  const { user, can } = useAuth()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Configuración" description={user?.company.legal_name} />
      <InventorySettingsCard />
      <SalesSettingsCard />
      {can('purchases.view') && <PurchasesSettingsCard />}
    </div>
  )
}

function InventorySettingsCard() {
  const { data, isPending } = useInventorySettings()
  const update = useUpdateInventorySettings()
  const { can } = useAuth()
  const editable = can('settings.manage')
  const [draftDays, setDays] = useState<string>()
  const days = draftDays ?? String(data?.document_backdate_days ?? 30)

  const saveDays = async () => {
    const value = Number(days)
    if (!Number.isInteger(value) || value < 0 || value > 365) {
      toast.error('Ingresa un número de días entre 0 y 365.')
      return
    }
    await update.mutateAsync({ document_backdate_days: value })
    setDays(undefined)
    toast.success('Ventana de fechas actualizada')
  }

  return (
    <Card className="max-w-3xl gap-4">
      <CardHeader className="flex-row items-start gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl border bg-surface-2">
          <Boxes className="size-5 text-brand-accent" />
        </span>
        <div className="space-y-1">
          <CardTitle className="text-base">Inventario</CardTitle>
          <CardDescription>
            Reglas que aplican a todos los documentos de inventario de la empresa.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {isPending || !data ? (
          <Skeleton className="h-28 w-full" />
        ) : (
          <>
            <Field orientation="horizontal" className="items-start justify-between rounded-lg border p-4">
              <FieldLabel htmlFor="allow-negative" className="flex flex-col items-start gap-1">
                Permitir stock negativo
                <FieldDescription>
                  Si está desactivado, una salida sin stock suficiente se rechaza indicando el disponible.
                </FieldDescription>
              </FieldLabel>
              <Switch
                id="allow-negative"
                disabled={!editable || update.isPending}
                checked={data.allow_negative_stock}
                onCheckedChange={async (checked) => {
                  await update.mutateAsync({ allow_negative_stock: checked })
                  toast.success(checked ? 'Stock negativo permitido' : 'Stock negativo bloqueado')
                }}
              />
            </Field>
            <Field className="rounded-lg border p-4">
              <FieldLabel htmlFor="backdate">
                Días hacia atrás permitidos en la fecha del documento
              </FieldLabel>
              <FieldDescription>
                Hoy se aceptan fechas entre <span className="num">{data.document_date_min}</span> y{' '}
                <span className="num">{data.document_date_max}</span>. Base para el futuro cierre de períodos.
              </FieldDescription>
              <div className="flex items-center gap-2">
                <Input
                  id="backdate"
                  type="number"
                  min={0}
                  max={365}
                  value={days}
                  disabled={!editable}
                  onChange={(e) => setDays(e.target.value)}
                  className="num w-28"
                />
                {editable && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={saveDays}
                    disabled={update.isPending || days === String(data.document_backdate_days)}
                  >
                    {update.isPending && <LoaderCircle className="animate-spin" />}
                    Guardar
                  </Button>
                )}
              </div>
            </Field>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function SalesSettingsCard() {
  const { data, isPending } = useSalesSettings()
  const update = useUpdateSalesSettings()
  const { can } = useAuth()
  const editable = can('settings.manage')
  const [draftDays, setDays] = useState<string>()
  const days = draftDays ?? String(data?.quote_validity_days ?? 15)

  const saveDays = async () => {
    const value = Number(days)
    if (!Number.isInteger(value) || value < 1 || value > 365) {
      toast.error('Ingresa un número de días entre 1 y 365.')
      return
    }
    await update.mutateAsync({ quote_validity_days: value })
    setDays(undefined)
    toast.success('Validez de cotizaciones actualizada')
  }

  return (
    <Card className="max-w-3xl gap-4">
      <CardHeader className="flex-row items-start gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl border bg-surface-2">
          <ShoppingCart className="size-5 text-brand-accent" />
        </span>
        <div className="space-y-1">
          <CardTitle className="text-base">Ventas e impuestos</CardTitle>
          <CardDescription>
            Los precios incluyen IVA ({data?.vat_rate ?? '13.00'} %), que se desglosa en cada documento.
            Lógica fiscal preliminar: validar con un contador antes de la facturación SIAT (ADR 0005).
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {isPending || !data ? (
          <Skeleton className="h-28 w-full" />
        ) : (
          <>
            <Field orientation="horizontal" className="items-start justify-between rounded-lg border p-4">
              <FieldLabel htmlFor="note-vat" className="flex flex-col items-start gap-1">
                Desglosar IVA en notas de venta
                <FieldDescription>
                  Las facturas siempre lo desglosan. Desactivado: la nota de venta muestra solo el total.
                </FieldDescription>
              </FieldLabel>
              <Switch
                id="note-vat"
                disabled={!editable || update.isPending}
                checked={data.sales_note_vat_breakdown}
                onCheckedChange={async (checked) => {
                  await update.mutateAsync({ sales_note_vat_breakdown: checked })
                  toast.success(
                    checked
                      ? 'Las notas de venta desglosan el IVA'
                      : 'Las notas de venta no desglosan el IVA',
                  )
                }}
              />
            </Field>
            <Field className="rounded-lg border p-4">
              <FieldLabel htmlFor="quote-days">Validez por defecto de las cotizaciones (días)</FieldLabel>
              <FieldDescription>Una cotización vencida ya no puede convertirse en venta.</FieldDescription>
              <div className="flex items-center gap-2">
                <Input
                  id="quote-days"
                  type="number"
                  min={1}
                  max={365}
                  value={days}
                  disabled={!editable}
                  onChange={(e) => setDays(e.target.value)}
                  className="num w-28"
                />
                {editable && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={saveDays}
                    disabled={update.isPending || days === String(data.quote_validity_days)}
                  >
                    {update.isPending && <LoaderCircle className="animate-spin" />}
                    Guardar
                  </Button>
                )}
              </div>
            </Field>
          </>
        )}
      </CardContent>
    </Card>
  )
}
