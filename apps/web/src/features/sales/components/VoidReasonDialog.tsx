import { zodResolver } from '@hookform/resolvers/zod'
import { Ban, LoaderCircle } from 'lucide-react'
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

import { reasonSchema } from '../schemas'

interface VoidReasonDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  onConfirm: (reason: string) => Promise<unknown>
}

/** Void with a mandatory reason (sales documents and receipts). */
export function VoidReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Anular',
  onConfirm,
}: VoidReasonDialogProps) {
  const form = useForm<{ reason: string }>({
    resolver: zodResolver(reasonSchema),
    defaultValues: { reason: '' },
  })
  const { errors, isSubmitting } = form.formState

  const submit = form.handleSubmit(async ({ reason }) => {
    try {
      await onConfirm(reason)
      form.reset()
      onOpenChange(false)
    } catch {
      // The caller already showed the error; keep the dialog open.
    }
  })

  return (
    <AlertDialog open={open} onOpenChange={(o) => !isSubmitting && onOpenChange(o)}>
      <AlertDialogContent>
        <form onSubmit={submit} className="contents" noValidate>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <Field data-invalid={!!errors.reason}>
            <FieldLabel htmlFor="void-reason">Motivo de anulación</FieldLabel>
            <Textarea
              id="void-reason"
              rows={3}
              autoFocus
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
              {confirmLabel}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
