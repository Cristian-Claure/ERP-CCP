import { zodResolver } from '@hookform/resolvers/zod'
import { HandCoins, LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
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
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ApiError } from '@/lib/api-error'
import { formatCurrency } from '@/lib/format'

import { PAYMENT_METHODS, todayIso } from '../format'
import { useRegisterPayment } from '../hooks'
import {
  type PaymentFormInput,
  type PaymentFormValues,
  paymentFormSchema,
  toPaymentPayload,
} from '../schemas'

interface PaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer: { id: number; name: string }
  /** Open debt the receipt may cover (customer balance or the sale's open amount). */
  maxAmount: number
  /** When set, the receipt is applied to this sale; otherwise FIFO by due date. */
  sale?: { id: number; number: string | null }
}

/** Registers a receipt (COB-) from the account statement or from a sale. */
export function PaymentDialog({ open, onOpenChange, customer, maxAmount, sale }: PaymentDialogProps) {
  const register = useRegisterPayment()
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())
  const form = useForm<PaymentFormInput, unknown, PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: { payment_date: todayIso(), method: 'transfer', amount: '', reference: '', notes: '' },
  })
  const { errors, isSubmitting } = form.formState

  useEffect(() => {
    if (!open) return
    setIdempotencyKey(crypto.randomUUID())
    form.reset({
      payment_date: todayIso(),
      method: 'transfer',
      amount: maxAmount > 0 ? maxAmount.toFixed(2) : '',
      reference: '',
      notes: '',
    })
  }, [open, maxAmount, form])

  const submit = form.handleSubmit(async (values) => {
    if (Number(values.amount) > maxAmount + 0.0001) {
      form.setError('amount', { message: `No puede superar ${formatCurrency(maxAmount)}.` })
      return
    }
    try {
      const payment = await register.mutateAsync({
        payload: toPaymentPayload(values, customer.id, sale?.id),
        idempotencyKey,
      })
      toast.success(`Cobro ${payment.number} registrado`, {
        description: `${formatCurrency(Number(payment.amount))} · ${customer.name}`,
      })
      onOpenChange(false)
    } catch (error) {
      if (error instanceof ApiError && error.isValidation && error.code === 'validation_failed') {
        for (const [field, messages] of Object.entries(error.details)) {
          form.setError(field as keyof PaymentFormInput, { message: messages[0] })
        }
        return
      }
      toast.error(error instanceof ApiError ? error.message : 'No se pudo registrar el cobro.')
    }
  })

  return (
    <Dialog open={open} onOpenChange={(o) => !isSubmitting && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="contents" noValidate>
          <DialogHeader>
            <DialogTitle>Registrar cobro</DialogTitle>
            <DialogDescription>
              {customer.name}
              {sale?.number ? ` · aplicado a ${sale.number}` : ' · se aplica a las ventas que vencen primero'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={!!errors.amount} className="sm:col-span-2">
              <FieldLabel htmlFor="pay-amount">Monto (Bs)</FieldLabel>
              <Input
                id="pay-amount"
                inputMode="decimal"
                className="num text-lg"
                autoFocus
                aria-invalid={!!errors.amount}
                {...form.register('amount')}
              />
              <FieldDescription>Deuda pendiente: {formatCurrency(maxAmount)}</FieldDescription>
              <FieldError errors={[errors.amount]} />
            </Field>
            <Controller
              control={form.control}
              name="method"
              render={({ field }) => (
                <Field>
                  <FieldLabel>Método</FieldLabel>
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
            <Field data-invalid={!!errors.payment_date}>
              <FieldLabel htmlFor="pay-date">Fecha</FieldLabel>
              <Input id="pay-date" type="date" max={todayIso()} {...form.register('payment_date')} />
              <FieldError errors={[errors.payment_date]} />
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="pay-ref">Referencia</FieldLabel>
              <Input id="pay-ref" placeholder="N° de transacción, cheque…" {...form.register('reference')} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || maxAmount <= 0}>
              {isSubmitting ? <LoaderCircle className="animate-spin" /> : <HandCoins />}
              Registrar cobro
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
