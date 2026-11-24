import { Banknote, CreditCard, Landmark, LoaderCircle, QrCode, X } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { PaymentMethod } from '@/features/sales/types'
import { formatCurrency } from '@/lib/format'
import { cn } from 'cn'

import { cashSuggestions, summarizePayments } from '../lib/payments'
import type { Tender } from '../types'

const METHODS: { value: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { value: 'cash', label: 'Efectivo', icon: Banknote },
  { value: 'qr', label: 'QR', icon: QrCode },
  { value: 'card', label: 'Tarjeta', icon: CreditCard },
  { value: 'transfer', label: 'Transferencia', icon: Landmark },
]
const parse = (v: string) => v.replace(',', '.').trim()
const toInput = (n: number) => (n > 0 ? n.toFixed(2).replace('.', ',') : '')

interface CheckoutProps {
  total: number
  pending: boolean
  onConfirm: (tenders: Tender[]) => void
}

/**
 * Payment dialog: one or several methods (e.g. part QR, part cash). Cash is
 * the amount TENDERED; the change is computed exactly as the server does.
 * Ctrl+Enter (or Enter on the received amount) confirms.
 */
export function CheckoutDialog({
  open,
  onOpenChange,
  ...props
}: CheckoutProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !props.pending && onOpenChange(o)}>
      {/* Mounted per opening: the tenders start fresh from the current total. */}
      {open && <CheckoutContent {...props} />}
    </Dialog>
  )
}

function CheckoutContent({ total, pending, onConfirm }: CheckoutProps) {
  const [tenders, setTenders] = useState<Tender[]>(() => [{ method: 'cash', amount: total.toFixed(2) }])

  const summary = summarizePayments(
    total,
    tenders.map((t) => ({ ...t, amount: parse(t.amount) })),
  )
  const confirm = () =>
    summary.valid && !pending && onConfirm(tenders.map((t) => ({ ...t, amount: parse(t.amount) })))

  const addMethod = (method: PaymentMethod) => {
    if (tenders.some((t) => t.method === method)) return
    // The new method takes what other non-cash methods leave unpaid; cash is then re-entered as tendered.
    const nonCash = summarizePayments(
      total,
      tenders.filter((t) => t.method !== 'cash'),
    ).nonCash
    const rest = toInput(Math.max(0, total - nonCash))
    setTenders((ts) =>
      method === 'cash'
        ? [...ts, { method, amount: rest }]
        : [{ method, amount: rest }, ...ts.map((t) => (t.method === 'cash' ? { ...t, amount: '' } : t))],
    )
  }
  const setAmount = (method: PaymentMethod, amount: string) =>
    setTenders((ts) => ts.map((t) => (t.method === method ? { ...t, amount } : t)))
  const removeMethod = (method: PaymentMethod) => setTenders((ts) => ts.filter((t) => t.method !== method))

  return (
    <DialogContent
      className="sm:max-w-lg"
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.ctrlKey) {
          e.preventDefault()
          confirm()
        }
      }}
    >
      <DialogHeader>
        <DialogTitle>Cobrar</DialogTitle>
        <DialogDescription>
          Total a cobrar <span className="num font-semibold text-foreground">{formatCurrency(total)}</span>
        </DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-4 gap-2">
        {METHODS.map((m) => (
          <Button
            key={m.value}
            type="button"
            variant="outline"
            className={cn(
              'h-14 flex-col gap-1',
              tenders.some((t) => t.method === m.value) && 'border-brand bg-brand/10',
            )}
            onClick={() => addMethod(m.value)}
          >
            <m.icon /> <span className="text-xs">{m.label}</span>
          </Button>
        ))}
      </div>

      <div className="space-y-2">
        {tenders.map((t) => {
          const meta = METHODS.find((m) => m.value === t.method)!
          return (
            <div key={t.method} className="flex items-center gap-2">
              <label htmlFor={`tender-${t.method}`} className="w-36 text-sm">
                {t.method === 'cash' ? 'Efectivo recibido' : meta.label}
              </label>
              <Input
                id={`tender-${t.method}`}
                autoFocus={t.method === 'cash'}
                inputMode="decimal"
                className="num h-10 flex-1 text-right text-lg"
                value={t.amount.replace('.', ',')}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setAmount(t.method, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.ctrlKey) {
                    e.preventDefault()
                    confirm()
                  }
                }}
              />
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Quitar ${meta.label}`}
                onClick={() => removeMethod(t.method)}
                disabled={tenders.length === 1}
              >
                <X />
              </Button>
            </div>
          )
        })}
        {tenders.some((t) => t.method === 'cash') && summary.cashDue > 0 && (
          <div className="flex flex-wrap justify-end gap-1.5">
            {cashSuggestions(summary.cashDue).map((v) => (
              <Button
                key={v}
                size="sm"
                variant="secondary"
                className="num"
                onClick={() => setAmount('cash', v.toFixed(2))}
              >
                {formatCurrency(v)}
              </Button>
            ))}
          </div>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-y-1 rounded-lg border bg-surface-2/50 p-3 text-sm">
        {summary.nonCash > 0 && (
          <>
            <dt className="text-muted-foreground">Otros medios</dt>
            <dd className="num text-right">{formatCurrency(summary.nonCash)}</dd>
            <dt className="text-muted-foreground">Efectivo a cubrir</dt>
            <dd className="num text-right">{formatCurrency(summary.cashDue)}</dd>
          </>
        )}
        {summary.missing > 0 && (
          <>
            <dt className="font-medium text-warning">Falta</dt>
            <dd className="num text-right font-semibold text-warning">{formatCurrency(summary.missing)}</dd>
          </>
        )}
        {summary.excessNonCash > 0 && (
          <dt className="col-span-2 text-destructive">
            Los pagos sin efectivo superan el total en {formatCurrency(summary.excessNonCash)}.
          </dt>
        )}
        <dt className="text-base font-medium">Cambio</dt>
        <dd className="num text-right text-2xl font-semibold text-success" data-testid="pos-change">
          {formatCurrency(summary.change)}
        </dd>
      </dl>

      <Button className="h-12 text-base" disabled={!summary.valid || pending} onClick={confirm}>
        {pending && <LoaderCircle className="animate-spin" />}
        Confirmar venta <kbd className="ml-1 text-xs opacity-70">Ctrl+Enter</kbd>
      </Button>
    </DialogContent>
  )
}
