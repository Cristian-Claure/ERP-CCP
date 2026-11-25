import { FileWarning } from 'lucide-react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router'

import { EmptyState } from '@/components/feedback/EmptyState'
import { PageSkeleton } from '@/components/feedback/PageSkeleton'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/hooks'

import { SalesEditor } from '../components/editor/SalesEditor'
import { SalesView } from '../components/view/SalesView'
import { SALES_DOCUMENT_TYPES } from '../format'
import { useSalesDocument } from '../hooks'
import type { SalesDocumentType } from '../types'

/**
 * /ventas/documentos/nuevo?tipo= and /ventas/documentos/:id — routes to the
 * editor (new or draft document) or to the read-only view (posted/voided).
 */
export function SalesDocumentPage() {
  const params = useParams()
  const [search] = useSearchParams()
  const id = params.id ? Number(params.id) : undefined
  const { data: document, isPending, isError } = useSalesDocument(id)
  const { can } = useAuth()

  if (!id) {
    const type = search.get('tipo') as SalesDocumentType | null
    if (!type || !SALES_DOCUMENT_TYPES.some((t) => t.value === type) || !can('sales.create'))
      return <Navigate to="/ventas/documentos" replace />
    const customerId = Number(search.get('cliente')) || undefined
    return <SalesEditor key={`new-${type}`} type={type} initialCustomerId={customerId} />
  }

  if (isPending) return <PageSkeleton />
  if (isError || !document)
    return (
      <EmptyState
        icon={FileWarning}
        title="Documento no encontrado"
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/ventas/documentos">Volver</Link>
          </Button>
        }
      />
    )

  return document.status === 'draft' && can('sales.create') ? (
    <SalesEditor key={document.id} type={document.type} document={document} />
  ) : (
    <SalesView document={document} />
  )
}
