import { zodResolver } from '@hookform/resolvers/zod'
import { Ban, CheckCheck, LoaderCircle } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { useForm } from 'react-hook-form'

import {
  AlertDialog,
  AlertDialogAction,
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

import { voidSchema } from '../schemas'

interface ConfirmPostDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<unknown>
  summary: ReactNode
}

/** "Are you sure?" before posting: posting moves stock and cannot be edited afterwards. */
export function ConfirmPostDialog({ open, onOpenChange, onConfirm, summary }: ConfirmPostDialogProps) {
  const [pending, setPending] = useState(false)

  return (
    <AlertDialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Confirmar el documento?</AlertDialogTitle>
          <AlertDialogDescription>
            Se registrarán los movimientos de stock y se asignará un número correlativo. Después solo podrá
            anularse.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="rounded-lg border bg-surface-2/50 p-3 text-sm">{summary}</div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Volver</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={async (e) => {
              e.preventDefault()
              setPending(true)
              try {
                await onConfirm()
                onOpenChange(false)
              } finally {
                setPending(false)
              }
            }}
          >
            {pending ? <LoaderCircle className="animate-spin" /> : <CheckCheck />}
            Confirmar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

interface VoidDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  documentNumber: string | null
  onConfirm: (reason: string) => Promise<unknown>
}

/** Voiding requires a mandatory reason; it creates reverse movements at the original cost. */
export function VoidDialog({ open, onOpenChange, documentNumber, onConfirm }: VoidDialogProps) {
  const form = useForm<{ reason: string }>({
    resolver: zodResolver(voidSchema),
    defaultValues: { reason: '' },
  })
  const { errors, isSubmitting } = form.formState

  const submit = form.handleSubmit(async ({ reason }) => {
    await onConfirm(reason)
    form.reset()
    onOpenChange(false)
  })

  return (
    <AlertDialog open={open} onOpenChange={(o) => !isSubmitting && onOpenChange(o)}>
      <AlertDialogContent>
        <form onSubmit={submit} className="contents">
          <AlertDialogHeader>
            <AlertDialogTitle>Anular {documentNumber}</AlertDialogTitle>
            <AlertDialogDescription>
              Se crearán los movimientos inversos al costo original del documento. Esta acción queda
              registrada y no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Field data-invalid={!!errors.reason}>
            <FieldLabel htmlFor="void-reason">Motivo de anulación</FieldLabel>
            <Textarea
              id="void-reason"
              rows={3}
              autoFocus
              placeholder="Ej.: la factura del proveedor fue anulada"
              aria-invalid={!!errors.reason}
              {...form.register('reason')}
            />
            <FieldDescription>
              Obligatorio. Quedará visible en el documento y en la auditoría.
            </FieldDescription>
            <FieldError errors={[errors.reason]} />
          </Field>
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={isSubmitting}>
              Volver
            </AlertDialogCancel>
            <Button type="submit" variant="destructive" disabled={isSubmitting}>
              {isSubmitting ? <LoaderCircle className="animate-spin" /> : <Ban />}
              Anular documento
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
