import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import type { StockShortage } from '@/features/inventory/types'
import { ApiError } from '@/lib/api-error'

import { useDeleteSalesDocument, usePostSalesDocument, useSaveSalesDocument } from '../../hooks'
import { type SalesFormValues, salesFormSchema, toSalesPayload } from '../../schemas'
import type {
  CreditLimitDetails,
  PostingAuthorizationPayload,
  PriceBelowCostDetails,
  SalesDocument,
} from '../../types'
import type { AuthorizationRequest } from '../AuthorizationDialog'
import type { SalesEditorForm } from './useSalesEditorForm'

/**
 * Save / post / delete flow of a sales draft, including the authorization
 * round-trip: a rejected post (credit limit, price below cost) opens the
 * dialog and retries with the accumulated authorization reasons.
 */
export function useSalesDocumentFlow({
  form,
  document,
  isQuote,
}: {
  form: SalesEditorForm
  document?: SalesDocument
  isQuote: boolean
}) {
  const navigate = useNavigate()
  const save = useSaveSalesDocument()
  const post = usePostSalesDocument()
  const remove = useDeleteSalesDocument()
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const [shortages, setShortages] = useState<StockShortage[]>([])
  const [authRequest, setAuthRequest] = useState<AuthorizationRequest | null>(null)
  const [granted, setGranted] = useState<PostingAuthorizationPayload>({})
  // Id of the draft once created. A failed post (stock, authorization) keeps the user on this
  // editor instance — remounting would lose the authorization dialog — so the URL is updated
  // with replaceState instead of a router navigation.
  const [draftId, setDraftId] = useState(document?.id)
  // Read during render: RHF's formState proxy only tracks what the render subscribes to.
  const { isDirty, isSubmitting } = form.formState

  const applyServerErrors = (error: unknown, authorization: PostingAuthorizationPayload): boolean => {
    if (!(error instanceof ApiError)) return false
    const details = error.details as unknown
    if (error.code === 'insufficient_stock') {
      setShortages((details as { lines: StockShortage[] }).lines ?? [])
      return true
    }
    if (error.code === 'credit_limit_exceeded') {
      setGranted(authorization)
      setAuthRequest({ kind: 'credit', details: details as CreditLimitDetails })
      return true
    }
    if (error.code === 'price_below_cost') {
      setGranted(authorization)
      setAuthRequest({ kind: 'below_cost', details: details as PriceBelowCostDetails })
      return true
    }
    if (error.isValidation) {
      for (const [field, messages] of Object.entries(error.details)) {
        form.setError(field as never, { message: Array.isArray(messages) ? messages[0] : String(messages) })
      }
      toast.error(error.message || 'Revisa los campos marcados.')
      return true
    }
    return false
  }

  const persist = async (values: SalesFormValues) => {
    const saved = await save.mutateAsync({ payload: toSalesPayload(values), id: draftId, idempotencyKey })
    form.reset(values)
    if (!draftId) {
      setDraftId(saved.id)
      window.history.replaceState(window.history.state, '', `/ventas/documentos/${saved.id}`)
    }
    return saved
  }

  const saveDraft = form.handleSubmit(async (values) => {
    setShortages([])
    try {
      await persist(values)
      toast.success('Borrador guardado')
    } catch (error) {
      if (!applyServerErrors(error, {}))
        toast.error(error instanceof ApiError ? error.message : 'No se pudo guardar.')
    }
  })

  const doPost = async (authorization: PostingAuthorizationPayload) => {
    setShortages([])
    try {
      // Parsed values (Zod output): raw form values keep the decimal comma ("1,50").
      const id = isDirty || !draftId ? (await persist(salesFormSchema.parse(form.getValues()))).id : draftId
      const posted = await post.mutateAsync({ id, authorization })
      setAuthRequest(null)
      toast.success(`${posted.type_label} ${posted.number} confirmada`, {
        description: isQuote
          ? 'La cotización fue emitida.'
          : 'Stock descontado y cuenta por cobrar registrada.',
      })
      navigate(`/ventas/documentos/${posted.id}`, { replace: true })
    } catch (error) {
      if (!applyServerErrors(error, authorization))
        toast.error(error instanceof ApiError ? error.message : 'No se pudo confirmar.')
    }
  }

  const postDraft = form.handleSubmit(() => doPost({}))

  /** Retries the post adding the reason for the pending authorization. */
  const authorize = async (reason: string) => {
    const next: PostingAuthorizationPayload = {
      ...granted,
      ...(authRequest?.kind === 'credit'
        ? { credit_override_reason: reason }
        : { below_cost_reason: reason }),
    }
    setAuthRequest(null)
    await doPost(next)
  }

  const deleteDraft = async () => {
    if (
      !draftId ||
      !window.confirm('¿Eliminar este borrador? La eliminación queda registrada en la auditoría.')
    )
      return
    await remove.mutateAsync(draftId)
    toast.success('Borrador eliminado')
    navigate('/ventas/documentos', { replace: true })
  }

  return {
    draftId,
    shortages,
    authRequest,
    closeAuthorization: () => setAuthRequest(null),
    authorize,
    saveDraft,
    postDraft,
    deleteDraft,
    saving: save.isPending,
    posting: post.isPending,
    busy: isSubmitting || save.isPending || post.isPending,
  }
}
