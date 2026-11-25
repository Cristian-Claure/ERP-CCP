import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PAYMENT_METHODS, todayIso } from '@/features/sales/format'
import type { PaymentMethod } from '@/features/sales/types'
import { ApiError } from '@/lib/api-error'
import { formatCurrency } from '@/lib/format'

import { usePaySupplier } from '../hooks'
import type { Supplier } from '../types'
import { SupplierCombobox } from './SupplierCombobox'

/** Payment to a supplier, applied FIFO to its open receipts by due date. */
export function SupplierPaymentDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const pay = usePaySupplier()
  const [key, setKey] = useState(() => crypto.randomUUID())
  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('transfer')
  const [date, setDate] = useState(todayIso())
  const [reference, setReference] = useState('')
  const balance = Number(supplier?.balance ?? 0)

  const submit = async () => {
    if (!supplier) return
    try {
      const payment = await pay.mutateAsync({
        key,
        payload: {
          supplier_id: supplier.id,
          payment_date: date,
          method,
          amount: amount.replace(',', '.'),
          reference: reference || null,
        },
      })
      toast.success(`Pago ${payment.number} registrado`, {
        description: `Aplicado a ${payment.allocations?.map((a) => a.number).join(', ')}`,
      })
      setKey(crypto.randomUUID())
      setSupplier(null)
      setAmount('')
      setReference('')
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'No se pudo registrar el pago.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pago a proveedor</DialogTitle>
          <DialogDescription>
            Se aplica a las recepciones pendientes, de la más antigua a la más reciente.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field>
            <FieldLabel>Proveedor</FieldLabel>
            <SupplierCombobox value={supplier?.id ?? null} onChange={setSupplier} />
            {supplier && (
              <p className="text-xs text-muted-foreground">
                Saldo: <span className="num">{formatCurrency(balance)}</span>
              </p>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="pay-amount">Monto</FieldLabel>
              <Input
                id="pay-amount"
                inputMode="decimal"
                className="num text-right"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="pay-date">Fecha</FieldLabel>
              <Input
                id="pay-date"
                type="date"
                max={todayIso()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>Método</FieldLabel>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
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
            <Field>
              <FieldLabel htmlFor="pay-ref">Referencia</FieldLabel>
              <Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
            </Field>
          </div>
          {balance > 0 && (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="justify-self-start px-0"
              onClick={() => setAmount(balance.toFixed(2))}
            >
              Pagar todo el saldo ({formatCurrency(balance)})
            </Button>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!supplier || !Number(amount.replace(',', '.')) || pay.isPending}>
            {pay.isPending && <LoaderCircle className="animate-spin" />} Registrar pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
