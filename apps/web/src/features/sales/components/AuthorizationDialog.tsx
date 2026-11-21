import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle, ShieldAlert, ShieldCheck } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { formatCurrency } from '@/lib/format'

import { reasonSchema } from '../schemas'
import type { CreditLimitDetails, PriceBelowCostDetails } from '../types'

export type AuthorizationRequest =
  { kind: 'below_cost'; details: PriceBelowCostDetails } | { kind: 'credit'; details: CreditLimitDetails }

interface AuthorizationDialogProps {
  request: AuthorizationRequest | null
  /** Whether the current user holds the permission to authorize this exception. */
  canAuthorize: boolean
  onClose: () => void
  onAuthorize: (reason: string) => Promise<unknown>
}

/**
 * Shown when posting fails with price_below_cost or credit_limit_exceeded.
 * With the permission, the user authorizes with a reason (audited); without
 * it, the dialog explains that a manager must authorize.
 */
export function AuthorizationDialog({
  request,
  canAuthorize,
  onClose,
  onAuthorize,
}: AuthorizationDialogProps) {
  const form = useForm<{ reason: string }>({
    resolver: zodResolver(reasonSchema),
    defaultValues: { reason: '' },
  })
  const { errors, isSubmitting } = form.formState

  useEffect(() => {
    if (request) form.reset({ reason: '' })
  }, [request, form])

  const submit = form.handleSubmit(async ({ reason }) => {
    await onAuthorize(reason)
  })

  const title = request?.kind === 'credit' ? 'Límite de crédito excedido' : 'Precio bajo el costo o el mínimo'

  return (
    <AlertDialog open={!!request} onOpenChange={(o) => !o && !isSubmitting && onClose()}>
      <AlertDialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="contents" noValidate>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="size-5 text-warning" />
              {title}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {canAuthorize
                ? 'Puedes autorizar esta excepción. Quedará registrado quién autorizó, cuándo y por qué.'
                : 'Esta venta requiere la autorización de un usuario con permiso (gerencia). Guarda el borrador y solicita la aprobación.'}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {request?.kind === 'credit' && (
            <dl className="grid grid-cols-2 gap-y-1.5 rounded-lg border bg-surface-2/50 p-3 text-sm">
              <dt className="text-muted-foreground">Cliente</dt>
              <dd className="text-right font-medium">{request.details.customer}</dd>
              <dt className="text-muted-foreground">Saldo actual</dt>
              <dd className="num text-right">{formatCurrency(Number(request.details.balance))}</dd>
              <dt className="text-muted-foreground">Esta venta</dt>
              <dd className="num text-right">{formatCurrency(Number(request.details.total))}</dd>
              <dt className="text-muted-foreground">Límite</dt>
              <dd className="num text-right">{formatCurrency(Number(request.details.credit_limit))}</dd>
              <dt className="text-muted-foreground">Disponible</dt>
              <dd className="num text-right font-semibold text-destructive">
                {formatCurrency(Number(request.details.available))}
              </dd>
            </dl>
          )}

          {request?.kind === 'below_cost' && (
            <ul className="divide-y rounded-lg border bg-surface-2/50 text-sm">
              {request.details.lines.map((l) => (
                <li
                  key={`${l.position}-${l.product_id}`}
                  className="flex items-center justify-between gap-3 p-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{l.product}</span>
                    <span className="text-xs text-muted-foreground">
                      {l.rule === 'below_cost'
                        ? 'Precio neto por debajo del costo promedio'
                        : `Por debajo del precio mínimo (${formatCurrency(Number(l.min_price))})`}
                    </span>
                  </span>
                  <span className="num shrink-0">{formatCurrency(Number(l.unit_price))}</span>
                </li>
              ))}
            </ul>
          )}

          {canAuthorize && (
            <Field data-invalid={!!errors.reason}>
              <FieldLabel htmlFor="auth-reason">Motivo de la autorización</FieldLabel>
              <Textarea
                id="auth-reason"
                rows={3}
                autoFocus
                aria-invalid={!!errors.reason}
                {...form.register('reason')}
              />
              <FieldDescription>Obligatorio. Queda en el documento y en la auditoría.</FieldDescription>
              <FieldError errors={[errors.reason]} />
            </Field>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={isSubmitting}>
              {canAuthorize ? 'Cancelar' : 'Entendido'}
            </AlertDialogCancel>
            {canAuthorize && (
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <LoaderCircle className="animate-spin" /> : <ShieldCheck />}
                Autorizar y confirmar
              </Button>
            )}
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
