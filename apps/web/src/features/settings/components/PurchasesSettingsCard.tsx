import { LoaderCircle, Truck } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/hooks'
import { usePurchaseSettings, useSavePurchaseSettings } from '@/features/purchases/hooks'
import type { PurchaseSettings } from '@/features/purchases/types'

const FIELDS: { key: keyof PurchaseSettings; label: string; hint: string; suffix: string }[] = [
  {
    key: 'purchase_approval_threshold',
    label: 'Monto que requiere aprobación de gerencia',
    hint: 'Por encima de este total la OC necesita purchases.approve y la aprueba alguien distinto de quien la creó.',
    suffix: 'Bs',
  },
  {
    key: 'purchase_receipt_tolerance_pct',
    label: 'Tolerancia de sobre-recepción',
    hint: 'Cuánto más de lo pedido se acepta recibir. 0 % = nunca más de lo pendiente.',
    suffix: '%',
  },
  {
    key: 'purchase_price_variance_pct',
    label: 'Diferencia de precio que exige motivo',
    hint: 'Si el precio facturado difiere del de la OC más que esto, la recepción pide un motivo (auditado).',
    suffix: '%',
  },
]

/** Purchase controls of the company (ADR 0006). */
export function PurchasesSettingsCard() {
  const { data, isPending } = usePurchaseSettings()
  const save = useSavePurchaseSettings()
  const editable = useAuth().can('settings.manage')
  const [draft, setDraft] = useState<Partial<PurchaseSettings>>({})

  const submit = async () => {
    const payload = Object.fromEntries(
      Object.entries(draft).map(([k, v]) => [k, String(v).replace(',', '.')]),
    )
    try {
      await save.mutateAsync(payload)
      setDraft({})
      toast.success('Controles de compras actualizados')
    } catch {
      toast.error('Revisa los valores: montos y porcentajes no negativos (máximo 100 %).')
    }
  }

  return (
    <Card className="max-w-3xl gap-4">
      <CardHeader className="flex-row items-start gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl border bg-surface-2">
          <Truck className="size-5 text-brand-accent" />
        </span>
        <div className="space-y-1">
          <CardTitle className="text-base">Compras</CardTitle>
          <CardDescription>
            Aprobación por monto, tolerancia de recepción y control de precios. El costo de entrada usa el IVA
            por dentro como crédito fiscal (lógica preliminar, ADR 0006).
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isPending || !data ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <>
            {FIELDS.map((f) => (
              <Field key={f.key} className="rounded-lg border p-4">
                <FieldLabel htmlFor={f.key}>{f.label}</FieldLabel>
                <FieldDescription>{f.hint}</FieldDescription>
                <div className="flex items-center gap-2">
                  <Input
                    id={f.key}
                    inputMode="decimal"
                    className="num w-36 text-right"
                    disabled={!editable}
                    value={String(draft[f.key] ?? data[f.key]).replace('.', ',')}
                    onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                  />
                  <span className="text-sm text-muted-foreground">{f.suffix}</span>
                </div>
              </Field>
            ))}
            {editable && (
              <Button
                className="self-start"
                onClick={submit}
                disabled={save.isPending || Object.keys(draft).length === 0}
              >
                {save.isPending && <LoaderCircle className="animate-spin" />} Guardar controles
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
