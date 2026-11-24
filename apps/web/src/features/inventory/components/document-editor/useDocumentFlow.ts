import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { ApiError } from '@/lib/api-error'

import { useDeleteDocument, usePostDocument, useSaveDocument } from '../../hooks'
import { type DocumentFormValues, documentFormSchema, toDocumentPayload } from '../../schemas'
import type { InventoryDocument, StockShortage } from '../../types'
import type { DocumentEditorForm } from './useDocumentEditorForm'

/** Save / confirm / delete flow of an inventory draft (posting goes through a confirmation dialog). */
export function useDocumentFlow(form: DocumentEditorForm, document?: InventoryDocument) {
  const navigate = useNavigate()
  const save = useSaveDocument()
  const post = usePostDocument()
  const remove = useDeleteDocument()
  // One key per editor instance: a double click or retry never creates two drafts.
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [shortages, setShortages] = useState<StockShortage[]>([])
  // Read during render: RHF's formState proxy only tracks what the render subscribes to.
  const { isDirty, isSubmitting } = form.formState

  const applyServerErrors = (error: unknown): boolean => {
    if (!(error instanceof ApiError)) return false
    if (error.code === 'insufficient_stock') {
      setShortages((error.details as unknown as { lines: StockShortage[] }).lines ?? [])
      return true
    }
    if (error.isValidation) {
      for (const [field, messages] of Object.entries(error.details)) {
        form.setError(field as never, { message: messages[0] })
      }
      toast.error('Revisa los campos marcados.')
      return true
    }
    return false
  }

  const persist = async (values: DocumentFormValues): Promise<InventoryDocument> => {
    const saved = await save.mutateAsync({
      payload: toDocumentPayload(values),
      id: document?.id,
      idempotencyKey,
    })
    form.reset(values)
    return saved
  }

  const saveDraft = form.handleSubmit(async (values) => {
    setShortages([])
    try {
      const saved = await persist(values)
      toast.success('Borrador guardado')
      if (!document) navigate(`/inventario/documentos/${saved.id}`, { replace: true })
    } catch (error) {
      if (!applyServerErrors(error))
        toast.error(error instanceof ApiError ? error.message : 'No se pudo guardar.')
    }
  })

  const requestPost = form.handleSubmit(() => {
    setShortages([])
    setConfirmOpen(true)
  })

  const confirmPost = async () => {
    try {
      // Parsed values (Zod output): raw form values keep the decimal comma ("1,50").
      const saved =
        isDirty || !document ? await persist(documentFormSchema.parse(form.getValues())) : document
      const posted = await post.mutateAsync(saved.id)
      toast.success(`Documento ${posted.number} confirmado`, {
        description: 'Los movimientos de stock fueron registrados.',
      })
      navigate(`/inventario/documentos/${posted.id}`, { replace: true })
    } catch (error) {
      setConfirmOpen(false)
      if (!applyServerErrors(error))
        toast.error(error instanceof ApiError ? error.message : 'No se pudo confirmar.')
    }
  }

  const deleteDraft = async () => {
    if (
      !document ||
      !window.confirm('¿Eliminar este borrador? La eliminación queda registrada en la auditoría.')
    )
      return
    await remove.mutateAsync(document.id)
    toast.success('Borrador eliminado')
    navigate('/inventario/documentos', { replace: true })
  }

  return {
    shortages,
    confirmOpen,
    setConfirmOpen,
    saveDraft,
    requestPost,
    confirmPost,
    deleteDraft,
    saving: save.isPending,
    busy: isSubmitting || save.isPending || post.isPending,
  }
}
